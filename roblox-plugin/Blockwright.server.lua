--!nonstrict
--[[
	Blockwright — Roblox Studio plugin

	Links a place open in Studio to a Blockwright project so generated scripts
	land as real Instances under the right services.

	How it works
	------------
	Studio plugins can make outbound HTTP requests but cannot accept inbound
	connections, so the plugin polls a single endpoint. Each poll reports the
	results of the previous batch, acts as a heartbeat, and returns the next
	queued commands.

	The plugin never receives code to run. It receives an allowlisted verb plus
	data, and refuses anything it does not recognise — a compromised token
	cannot turn into arbitrary execution inside Studio.

	Installation
	------------
	Save this file into your local Roblox Plugins folder:
	  Windows  %LOCALAPPDATA%\Roblox\Plugins
	  macOS    ~/Documents/Roblox/Plugins
	Then restart Studio and open the Blockwright toolbar button.
]]

local HttpService = game:GetService("HttpService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local StarterGui = game:GetService("StarterGui")
local StarterPlayer = game:GetService("StarterPlayer")
local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")

-- Point this at your deployment. Leave as-is for local development.
local BASE_URL = "http://localhost:3000"

local PLUGIN_NAME = "Blockwright"
local TOKEN_SETTING = "blockwright_token"
local URL_SETTING = "blockwright_base_url"
local PROJECT_SETTING = "blockwright_project_name"

local POLL_INTERVAL_IDLE = 3
local POLL_INTERVAL_BUSY = 1

-- ===========================================================================
-- State
-- ===========================================================================

local state = {
	token = nil,
	projectName = nil,
	connected = false,
	lastError = nil,
	lastSync = nil,
	running = false,
	pendingResults = {},
}

local baseUrl = plugin:GetSetting(URL_SETTING) or BASE_URL

-- ===========================================================================
-- Service resolution
--
-- The web app addresses files by service name. Resolving them here (rather
-- than trusting a path string from the server) is what keeps the command
-- surface closed.
-- ===========================================================================

local SERVICES = {
	ServerScriptService = ServerScriptService,
	ServerStorage = ServerStorage,
	ReplicatedStorage = ReplicatedStorage,
	StarterGui = StarterGui,
	Workspace = workspace,
	Lighting = Lighting,
	["StarterPlayer.StarterPlayerScripts"] = StarterPlayer:FindFirstChild("StarterPlayerScripts"),
	["StarterPlayer.StarterCharacterScripts"] = StarterPlayer:FindFirstChild("StarterCharacterScripts"),
}

local ALLOWED_CLASSES = {
	Script = true,
	LocalScript = true,
	ModuleScript = true,
}

local function resolveService(name: string): Instance?
	return SERVICES[name]
end

--- Finds or creates the Blockwright folder inside a service, so generated
--- content never mixes with instances the creator placed by hand.
local function projectFolder(service: Instance): Folder
	local folder = service:FindFirstChild(PLUGIN_NAME)
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = PLUGIN_NAME
		folder.Parent = service
	end
	return folder
end

-- ===========================================================================
-- HTTP
-- ===========================================================================

local function request(path: string, body: { [string]: any }): (boolean, any)
	local ok, response = pcall(function()
		return HttpService:RequestAsync({
			Url = baseUrl .. path,
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode(body),
		})
	end)

	if not ok then
		return false, tostring(response)
	end

	local decoded
	local decodeOk = pcall(function()
		decoded = HttpService:JSONDecode(response.Body)
	end)

	if not response.Success then
		local message = "HTTP " .. tostring(response.StatusCode)
		if decodeOk and decoded and decoded.error and decoded.error.message then
			message = decoded.error.message
		end
		return false, message
	end

	if not decodeOk then
		return false, "The server sent a response we could not read."
	end

	return true, decoded
end

-- ===========================================================================
-- Command handlers
-- ===========================================================================

local handlers = {}

--- Writes each file into Studio as a real script Instance.
function handlers.sync_files(command)
	local files = command.files or {}
	local written, skipped = 0, 0
	local touched = {}

	for _, file in ipairs(files) do
		local service = resolveService(file.service)
		if not service or not ALLOWED_CLASSES[file.className] then
			skipped += 1
			continue
		end

		local folder = projectFolder(service)
		local existing = folder:FindFirstChild(file.name)

		-- Replace rather than mutate when the class changed, so a module that
		-- became a Script does not linger as the wrong type.
		if existing and existing.ClassName ~= file.className then
			existing:Destroy()
			existing = nil
		end

		local instance = existing
		if not instance then
			instance = Instance.new(file.className)
			instance.Name = file.name
			instance.Parent = folder
		end

		instance.Source = file.source
		instance:SetAttribute("BlockwrightPath", file.path)
		written += 1
		table.insert(touched, file.service .. "/" .. file.name)
	end

	state.lastSync = os.time()

	-- A sync that writes nothing is not a success. The server sends the whole
	-- file list, so "0 written" means either the project is empty or every file
	-- was skipped for an unsupported class or service — and both of those look
	-- identical to a creator watching a green tick and an unchanged Explorer.
	if #files == 0 then
		return {
			ok = false,
			error = "The project has no Luau files to sync yet.",
			data = { written = 0, skipped = 0, instances = {} },
		}
	end

	if written == 0 then
		return {
			ok = false,
			error = string.format(
				"None of the %d file%s could be placed — unrecognised service or class.",
				#files,
				#files == 1 and "" or "s"
			),
			data = { written = 0, skipped = skipped, instances = {} },
		}
	end

	return {
		ok = true,
		summary = string.format(
			"Synced %d script%s into Studio%s",
			written,
			written == 1 and "" or "s",
			skipped > 0 and string.format(" (%d skipped)", skipped) or ""
		),
		data = { written = written, skipped = skipped, instances = touched },
	}
end

--- Reports what is actually in the place, so the AI can reason about reality
--- rather than about what it believes it created.
function handlers.inspect_place(_command)
	local summary = {}

	for name, service in pairs(SERVICES) do
		if service then
			local folder = service:FindFirstChild(PLUGIN_NAME)
			local scripts = {}
			if folder then
				for _, child in ipairs(folder:GetChildren()) do
					table.insert(scripts, { name = child.Name, className = child.ClassName })
				end
			end
			if #scripts > 0 then
				summary[name] = scripts
			end
		end
	end

	return {
		ok = true,
		summary = "Inspected the open place",
		data = {
			placeName = game.Name,
			placeId = tostring(game.PlaceId),
			managed = summary,
		},
	}
end

function handlers.create_folder(command)
	local payload = command.payload or {}
	local service = resolveService(payload.service)
	if not service then
		return { ok = false, error = "Unknown service: " .. tostring(payload.service) }
	end

	local parent = projectFolder(service)
	if not parent:FindFirstChild(payload.name) then
		local folder = Instance.new("Folder")
		folder.Name = payload.name
		folder.Parent = parent
	end

	return { ok = true, summary = "Created folder " .. tostring(payload.name) }
end

function handlers.remove_instance(command)
	local payload = command.payload or {}
	local service = resolveService(payload.service)
	if not service then
		return { ok = false, error = "Unknown service: " .. tostring(payload.service) }
	end

	local target: Instance? = service:FindFirstChild(PLUGIN_NAME)
	if not target then
		return { ok = false, error = "Nothing managed by Blockwright in " .. payload.service }
	end

	for segment in string.gmatch(payload.path or "", "[^%.]+") do
		target = target and target:FindFirstChild(segment)
	end

	if not target then
		return { ok = false, error = "Could not find " .. tostring(payload.path) }
	end

	target:Destroy()
	return { ok = true, summary = "Removed " .. tostring(payload.path) }
end

local function execute(command)
	local handler = handlers[command.action]
	if not handler then
		-- Unknown verbs are refused, not guessed at.
		return { commandId = command.id, ok = false, error = "Unsupported action: " .. tostring(command.action) }
	end

	local ok, result = pcall(handler, command)
	if not ok then
		return { commandId = command.id, ok = false, error = tostring(result) }
	end

	return {
		commandId = command.id,
		ok = result.ok ~= false,
		summary = result.summary,
		error = result.error,
		data = result.data,
	}
end

-- ===========================================================================
-- Poll loop
-- ===========================================================================

local onStateChanged: (() -> ())? = nil

local function setStatus(connected: boolean, err: string?)
	state.connected = connected
	state.lastError = err
	if onStateChanged then
		onStateChanged()
	end
end

local function pollOnce(): number
	local results = state.pendingResults
	state.pendingResults = {}

	local ok, response = request("/api/studio/poll", {
		token = state.token,
		placeName = game.Name,
		placeId = tostring(game.PlaceId),
		results = results,
	})

	if not ok then
		setStatus(false, tostring(response))
		return POLL_INTERVAL_IDLE
	end

	setStatus(true, nil)

	local commands = response.commands or {}
	for _, command in ipairs(commands) do
		table.insert(state.pendingResults, execute(command))
	end

	if #commands > 0 then
		if onStateChanged then
			onStateChanged()
		end
		return POLL_INTERVAL_BUSY
	end

	return response.pollIntervalSeconds or POLL_INTERVAL_IDLE
end

local function startLoop()
	if state.running then
		return
	end
	state.running = true

	task.spawn(function()
		while state.running and state.token do
			local wait = pollOnce()
			task.wait(wait)
		end
		state.running = false
	end)
end

local function stopLoop()
	state.running = false
end

-- ===========================================================================
-- UI
-- ===========================================================================

local toolbar = plugin:CreateToolbar(PLUGIN_NAME)
local button = toolbar:CreateButton(
	"Blockwright",
	"Connect this place to a Blockwright project",
	"rbxasset://textures/ui/GuiImagePlaceholder.png"
)

local widget = plugin:CreateDockWidgetPluginGui(
	"BlockwrightPanel",
	DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 280, 340, 240, 280)
)
widget.Title = PLUGIN_NAME

local BACKGROUND = Color3.fromRGB(28, 27, 26)
local SURFACE = Color3.fromRGB(38, 37, 35)
local TEXT = Color3.fromRGB(242, 240, 237)
local MUTED = Color3.fromRGB(150, 147, 142)
local EMBER = Color3.fromRGB(232, 138, 58)
local SIGNAL = Color3.fromRGB(96, 186, 205)
local DANGER = Color3.fromRGB(214, 98, 84)

local root = Instance.new("Frame")
root.Size = UDim2.fromScale(1, 1)
root.BackgroundColor3 = BACKGROUND
root.BorderSizePixel = 0
root.Parent = widget

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 14)
padding.PaddingBottom = UDim.new(0, 14)
padding.PaddingLeft = UDim.new(0, 14)
padding.PaddingRight = UDim.new(0, 14)
padding.Parent = root

local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 10)
layout.Parent = root

local function label(text: string, size: number, colour: Color3, order: number, bold: boolean?): TextLabel
	local element = Instance.new("TextLabel")
	element.BackgroundTransparency = 1
	element.Size = UDim2.new(1, 0, 0, size + 6)
	element.Font = bold and Enum.Font.GothamBold or Enum.Font.Gotham
	element.Text = text
	element.TextColor3 = colour
	element.TextSize = size
	element.TextXAlignment = Enum.TextXAlignment.Left
	element.TextWrapped = true
	element.LayoutOrder = order
	element.Parent = root
	return element
end

local heading = label("Blockwright", 15, TEXT, 1, true)
local statusLabel = label("Not connected", 12, MUTED, 2)

local codeBox = Instance.new("TextBox")
codeBox.Size = UDim2.new(1, 0, 0, 34)
codeBox.BackgroundColor3 = SURFACE
codeBox.BorderSizePixel = 0
codeBox.Font = Enum.Font.RobotoMono
codeBox.PlaceholderText = "Pairing code"
codeBox.Text = ""
codeBox.TextColor3 = TEXT
codeBox.TextSize = 16
codeBox.ClearTextOnFocus = false
codeBox.LayoutOrder = 3
codeBox.Parent = root

local codeCorner = Instance.new("UICorner")
codeCorner.CornerRadius = UDim.new(0, 6)
codeCorner.Parent = codeBox

local function makeButton(text: string, colour: Color3, order: number): TextButton
	local element = Instance.new("TextButton")
	element.Size = UDim2.new(1, 0, 0, 32)
	element.BackgroundColor3 = colour
	element.BorderSizePixel = 0
	element.Font = Enum.Font.GothamMedium
	element.Text = text
	element.TextColor3 = Color3.fromRGB(24, 23, 22)
	element.TextSize = 13
	element.AutoButtonColor = true
	element.LayoutOrder = order
	element.Parent = root

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = element

	return element
end

local connectButton = makeButton("Connect", EMBER, 4)
local disconnectButton = makeButton("Disconnect", SURFACE, 5)
disconnectButton.TextColor3 = MUTED
disconnectButton.Visible = false

local detailLabel = label("", 11, MUTED, 6)
detailLabel.Size = UDim2.new(1, 0, 0, 60)
detailLabel.TextYAlignment = Enum.TextYAlignment.Top

local urlBox = Instance.new("TextBox")
urlBox.Size = UDim2.new(1, 0, 0, 26)
urlBox.BackgroundColor3 = SURFACE
urlBox.BorderSizePixel = 0
urlBox.Font = Enum.Font.RobotoMono
urlBox.PlaceholderText = "Server URL"
urlBox.Text = baseUrl
urlBox.TextColor3 = MUTED
urlBox.TextSize = 11
urlBox.ClearTextOnFocus = false
urlBox.LayoutOrder = 7
urlBox.Parent = root

local urlCorner = Instance.new("UICorner")
urlCorner.CornerRadius = UDim.new(0, 6)
urlCorner.Parent = urlBox

local function render()
	if state.connected then
		statusLabel.Text = "● Connected" .. (state.projectName and (" · " .. state.projectName) or "")
		statusLabel.TextColor3 = SIGNAL
		codeBox.Visible = false
		connectButton.Visible = false
		disconnectButton.Visible = true
		detailLabel.Text = state.lastSync
				and ("Last sync " .. os.date("%H:%M", state.lastSync))
			or "Waiting for actions from the web app."
		detailLabel.TextColor3 = MUTED
	elseif state.token then
		statusLabel.Text = "● Reconnecting"
		statusLabel.TextColor3 = EMBER
		codeBox.Visible = false
		connectButton.Visible = false
		disconnectButton.Visible = true
		detailLabel.Text = state.lastError or "Trying to reach the server."
		detailLabel.TextColor3 = state.lastError and DANGER or MUTED
	else
		statusLabel.Text = "○ Not connected"
		statusLabel.TextColor3 = MUTED
		codeBox.Visible = true
		connectButton.Visible = true
		disconnectButton.Visible = false
		detailLabel.Text = state.lastError
			or "Open a project in Blockwright, click Connect Roblox Studio, and paste the code above."
		detailLabel.TextColor3 = state.lastError and DANGER or MUTED
	end
end

onStateChanged = render

-- ===========================================================================
-- Wiring
-- ===========================================================================

local function connect()
	local code = string.upper((codeBox.Text or ""):gsub("%s", ""))
	if #code < 4 then
		state.lastError = "Enter the code shown in Blockwright."
		render()
		return
	end

	connectButton.Text = "Connecting…"

	task.spawn(function()
		local ok, response = request("/api/studio/pair", {
			code = code,
			placeName = game.Name,
			placeId = tostring(game.PlaceId),
			studioVersion = version(),
		})

		connectButton.Text = "Connect"

		if not ok then
			state.lastError = tostring(response)
			render()
			return
		end

		state.token = response.token
		state.projectName = response.projectName
		state.lastError = nil

		plugin:SetSetting(TOKEN_SETTING, state.token)
		plugin:SetSetting(PROJECT_SETTING, state.projectName)

		codeBox.Text = ""
		setStatus(true, nil)
		startLoop()
	end)
end

local function disconnect()
	stopLoop()
	state.token = nil
	state.projectName = nil
	state.connected = false
	state.lastError = nil
	plugin:SetSetting(TOKEN_SETTING, nil)
	plugin:SetSetting(PROJECT_SETTING, nil)
	render()
end

connectButton.MouseButton1Click:Connect(connect)
disconnectButton.MouseButton1Click:Connect(disconnect)

codeBox.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		connect()
	end
end)

urlBox.FocusLost:Connect(function()
	local value = (urlBox.Text or ""):gsub("%s", ""):gsub("/$", "")
	if value == "" then
		urlBox.Text = baseUrl
		return
	end
	baseUrl = value
	plugin:SetSetting(URL_SETTING, baseUrl)
end)

button.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

plugin.Unloading:Connect(stopLoop)

-- Resume a previous session automatically.
state.token = plugin:GetSetting(TOKEN_SETTING)
state.projectName = plugin:GetSetting(PROJECT_SETTING)

if state.token then
	startLoop()
end

render()

if RunService:IsEdit() then
	print("[Blockwright] plugin loaded. Server: " .. baseUrl)
end
