"""
Hand-written calibration corpus. Public, synthetic, and mine -- no holdout
content is here or ever will be.

The corpus exists to answer one question with numbers instead of confidence:
where does the near-duplicate threshold sit between the two ways it can be
wrong? Its shape is chosen to make that question hard.

* Ten small Roblox problems, each with **three independently written
  solutions**. Different solutions to the same small problem are the worst case
  for a code-similarity detector -- same API calls, same service names, same
  control flow, genuinely different code. Every within-problem pair is a
  *negative*: flagging one is a false positive. There are 30 of them, and they
  are the number that matters.
* Ten of those solutions carry a **structural rewrite**: a human-style
  reimplementation that preserves the algorithm while changing loop style,
  extracting helpers, inverting branches, or replacing a numeric `for` with
  `ipairs`. Every rewrite is a *positive*: missing one is a false negative, and
  these are the positives that hurt, because token shingles are not built to
  survive restructuring.
* Mechanical positives (reformat, re-comment, rename, requote) are generated in
  `calibrate.py` rather than written here, because a machine transformation
  should be produced by a machine.

Data as a Python module rather than JSON so the sources stay readable and a diff
of a solution reads as a diff of Luau.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Solution:
    sol_id: str
    source: str
    # A human-style reimplementation of the same algorithm. Positives that a
    # token-shingle detector is not guaranteed to catch, and is measured on.
    structural_rewrite: str | None = None


@dataclass
class Problem:
    problem_id: str
    statement: str
    solutions: list = field(default_factory=list)


PROBLEMS: list = [
    Problem(
        problem_id="touch-damage",
        statement="Damage a humanoid when it touches a part, with a per-humanoid debounce.",
        solutions=[
            Solution(
                "a",
                '''
local part = script.Parent
local DAMAGE = 25
local COOLDOWN = 1

local lastHit = {}

part.Touched:Connect(function(other)
	local humanoid = other.Parent and other.Parent:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return
	end
	local now = os.clock()
	if lastHit[humanoid] and now - lastHit[humanoid] < COOLDOWN then
		return
	end
	lastHit[humanoid] = now
	humanoid:TakeDamage(DAMAGE)
end)
''',
                structural_rewrite='''
local hurtBrick = script.Parent
local recentlyHurt = {}

local function findHumanoid(hit)
	local model = hit:FindFirstAncestorOfClass("Model")
	if model == nil then
		return nil
	end
	return model:FindFirstChildWhichIsA("Humanoid")
end

local function canHurt(target)
	local stamp = recentlyHurt[target]
	return stamp == nil or (os.clock() - stamp) >= 1
end

local function onTouched(hit)
	local target = findHumanoid(hit)
	if target ~= nil and canHurt(target) then
		recentlyHurt[target] = os.clock()
		target:TakeDamage(25)
	end
end

hurtBrick.Touched:Connect(onTouched)
''',
            ),
            Solution(
                "b",
                '''
local Debris = game:GetService("Debris")
local trap = script.Parent
local busy = false

local function hurt(hit: BasePart)
	if busy then
		return
	end
	local character = hit.Parent
	local hum = character and character:FindFirstChild("Humanoid")
	if not hum or not hum:IsA("Humanoid") then
		return
	end
	busy = true
	hum.Health = math.max(0, hum.Health - 25)
	local marker = Instance.new("BoolValue")
	marker.Name = "Hurt"
	marker.Parent = character
	Debris:AddItem(marker, 1)
	task.delay(1, function()
		busy = false
	end)
end

trap.Touched:Connect(hurt)
''',
            ),
            Solution(
                "c",
                '''
local CollectionService = game:GetService("CollectionService")

local COOLDOWN_ATTRIBUTE = "LastDamaged"

local function applyDamage(humanoid: Humanoid)
	local last = humanoid:GetAttribute(COOLDOWN_ATTRIBUTE)
	if typeof(last) == "number" and tick() - last < 1 then
		return false
	end
	humanoid:SetAttribute(COOLDOWN_ATTRIBUTE, tick())
	humanoid:TakeDamage(25)
	return true
end

for _, brick in CollectionService:GetTagged("DamageBrick") do
	brick.Touched:Connect(function(other)
		local parent = other.Parent
		if parent then
			local humanoid = parent:FindFirstChildOfClass("Humanoid")
			if humanoid then
				applyDamage(humanoid)
			end
		end
	end)
end
''',
            ),
        ],
    ),
    Problem(
        problem_id="leaderstats",
        statement="Create a leaderstats folder with a Coins value for each joining player.",
        solutions=[
            Solution(
                "a",
                '''
local Players = game:GetService("Players")

local function onPlayerAdded(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"

	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = 0
	coins.Parent = stats

	stats.Parent = player
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	onPlayerAdded(player)
end
''',
                structural_rewrite='''
local Players = game:GetService("Players")

local function makeValue(name: string, parent: Instance)
	local value = Instance.new("IntValue")
	value.Name = name
	value.Value = 0
	value.Parent = parent
	return value
end

local function setup(who)
	local container = Instance.new("Folder")
	container.Name = "leaderstats"
	makeValue("Coins", container)
	container.Parent = who
end

for _, existing in Players:GetPlayers() do
	setup(existing)
end
Players.PlayerAdded:Connect(setup)
''',
            ),
            Solution(
                "b",
                '''
local Players = game:GetService("Players")
local DEFAULTS = {
	Coins = 0,
}

Players.PlayerAdded:Connect(function(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	for statName, initial in pairs(DEFAULTS) do
		local entry = Instance.new("IntValue")
		entry.Name = statName
		entry.Value = initial
		entry.Parent = leaderstats
	end
end)
''',
            ),
            Solution(
                "c",
                '''
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")

local template = ServerStorage:FindFirstChild("LeaderstatsTemplate")

Players.PlayerAdded:Connect(function(player)
	local stats
	if template then
		stats = template:Clone()
	else
		stats = Instance.new("Folder")
		stats.Name = "leaderstats"
		local coins = Instance.new("IntValue")
		coins.Name = "Coins"
		coins.Parent = stats
	end
	stats.Parent = player
end)
''',
            ),
        ],
    ),
    Problem(
        problem_id="sum-list",
        statement="Return the sum of the numbers in an array.",
        solutions=[
            Solution(
                "a",
                '''
local function sum(numbers: {number}): number
	local total = 0
	for i = 1, #numbers do
		total += numbers[i]
	end
	return total
end

local function average(numbers: {number}): number
	if #numbers == 0 then
		return 0
	end
	return sum(numbers) / #numbers
end

return {
	sum = sum,
	average = average,
}
''',
                structural_rewrite='''
local Stats = {}

function Stats.sum(values: {number}): number
	local acc = 0
	for _, value in ipairs(values) do
		acc = acc + value
	end
	return acc
end

function Stats.average(values: {number}): number
	local count = #values
	if count == 0 then
		return 0
	end
	return Stats.sum(values) / count
end

return Stats
''',
            ),
            Solution(
                "b",
                '''
local function reduce(list, fn, seed)
	local acc = seed
	for _, item in ipairs(list) do
		acc = fn(acc, item)
	end
	return acc
end

local function add(a: number, b: number): number
	return a + b
end

return function(numbers: {number}): number
	return reduce(numbers, add, 0)
end
''',
            ),
            Solution(
                "c",
                '''
local module = {}

function module.total(numbers)
	assert(type(numbers) == "table", "expected a table")
	local running = 0
	local index = 1
	while numbers[index] ~= nil do
		running = running + numbers[index]
		index = index + 1
	end
	return running
end

return module
''',
            ),
        ],
    ),
    Problem(
        problem_id="tween-part",
        statement="Tween a part from its current position to a target position over two seconds.",
        solutions=[
            Solution(
                "a",
                '''
local TweenService = game:GetService("TweenService")

local part = script.Parent
local goalPosition = part.Position + Vector3.new(0, 10, 0)

local info = TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local tween = TweenService:Create(part, info, { Position = goalPosition })

tween:Play()
tween.Completed:Wait()
print("done")
''',
                structural_rewrite='''
local TweenService = game:GetService("TweenService")

local function riseBy(target: BasePart, height: number, seconds: number)
	local destination = target.Position + Vector3.new(0, height, 0)
	local settings = TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	local motion = TweenService:Create(target, settings, { Position = destination })
	motion:Play()
	return motion
end

local moving = riseBy(script.Parent, 10, 2)
moving.Completed:Wait()
print("done")
''',
            ),
            Solution(
                "b",
                '''
local RunService = game:GetService("RunService")

local part = script.Parent
local start = part.CFrame
local finish = start * CFrame.new(0, 10, 0)
local elapsed = 0
local DURATION = 2

local connection
connection = RunService.Heartbeat:Connect(function(dt)
	elapsed += dt
	local alpha = math.clamp(elapsed / DURATION, 0, 1)
	part.CFrame = start:Lerp(finish, alpha)
	if alpha >= 1 then
		connection:Disconnect()
	end
end)
''',
            ),
            Solution(
                "c",
                '''
local TweenService = game:GetService("TweenService")

local Mover = {}
Mover.__index = Mover

function Mover.new(instance: BasePart)
	return setmetatable({ instance = instance }, Mover)
end

function Mover:to(position: Vector3, seconds: number)
	local descriptor = TweenInfo.new(seconds)
	local handle = TweenService:Create(self.instance, descriptor, { Position = position })
	handle:Play()
	return handle
end

return Mover
''',
            ),
        ],
    ),
    Problem(
        problem_id="remote-validate",
        statement="Validate a RemoteEvent payload on the server before acting on it.",
        solutions=[
            Solution(
                "a",
                '''
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("BuyItem")

local PRICES = {
	Sword = 100,
	Shield = 150,
}

remote.OnServerEvent:Connect(function(player, itemName)
	if type(itemName) ~= "string" then
		return
	end
	local price = PRICES[itemName]
	if price == nil then
		return
	end
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	if not coins or coins.Value < price then
		return
	end
	coins.Value -= price
	print(player.Name, "bought", itemName)
end)
''',
                structural_rewrite='''
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CATALOGUE = {
	Sword = 100,
	Shield = 150,
}

local function costOf(name)
	if typeof(name) ~= "string" then
		return nil
	end
	return CATALOGUE[name]
end

local function wallet(buyer)
	local folder = buyer:FindFirstChild("leaderstats")
	if folder == nil then
		return nil
	end
	return folder:FindFirstChild("Coins")
end

local function handlePurchase(buyer, name)
	local cost = costOf(name)
	if cost == nil then
		return
	end
	local purse = wallet(buyer)
	if purse == nil or purse.Value < cost then
		return
	end
	purse.Value = purse.Value - cost
	print(buyer.Name, "bought", name)
end

ReplicatedStorage:WaitForChild("BuyItem").OnServerEvent:Connect(handlePurchase)
''',
            ),
            Solution(
                "b",
                '''
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local event = ReplicatedStorage:WaitForChild("PlaceBlock")

local MAX_DISTANCE = 50

local function isValidVector(value): boolean
	return typeof(value) == "Vector3"
		and value.Magnitude == value.Magnitude
		and value.Magnitude < 1e6
end

event.OnServerEvent:Connect(function(player, position)
	if not isValidVector(position) then
		player:Kick("bad payload")
		return
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root then
		return
	end
	if (root.Position - position).Magnitude > MAX_DISTANCE then
		return
	end
	local block = Instance.new("Part")
	block.Anchored = true
	block.Position = position
	block.Parent = workspace
end)
''',
            ),
            Solution(
                "c",
                '''
local schema = {
	slot = "number",
	name = "string",
}

local function validate(payload)
	if type(payload) ~= "table" then
		return false, "payload must be a table"
	end
	for key, expected in pairs(schema) do
		if type(payload[key]) ~= expected then
			return false, string.format("field %s must be %s", key, expected)
		end
	end
	if payload.slot < 1 or payload.slot > 9 then
		return false, "slot out of range"
	end
	return true, nil
end

return validate
''',
            ),
        ],
    ),
    Problem(
        problem_id="datastore-save",
        statement="Save player data to a DataStore with retries around a pcall.",
        solutions=[
            Solution(
                "a",
                '''
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("PlayerData")

local MAX_ATTEMPTS = 3

local function save(userId: number, data)
	local attempt = 0
	while attempt < MAX_ATTEMPTS do
		attempt += 1
		local ok, err = pcall(function()
			store:SetAsync(tostring(userId), data)
		end)
		if ok then
			return true
		end
		warn("save failed:", err)
		task.wait(2 ^ attempt)
	end
	return false
end

return save
''',
                structural_rewrite='''
local DataStoreService = game:GetService("DataStoreService")

local profileStore = DataStoreService:GetDataStore("PlayerData")

local function attemptWrite(key: string, payload)
	return pcall(profileStore.SetAsync, profileStore, key, payload)
end

local function persist(userId: number, payload)
	for attempt = 1, 3 do
		local succeeded, problem = attemptWrite(tostring(userId), payload)
		if succeeded then
			return true
		end
		warn("save failed:", problem)
		task.wait(2 ^ attempt)
	end
	return false
end

return persist
''',
            ),
            Solution(
                "b",
                '''
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local sessions = DataStoreService:GetDataStore("Sessions")

local function retry(fn, tries: number)
	local lastError
	for _ = 1, tries do
		local results = table.pack(pcall(fn))
		if results[1] then
			return table.unpack(results, 2, results.n)
		end
		lastError = results[2]
	end
	error(lastError)
end

Players.PlayerRemoving:Connect(function(player)
	retry(function()
		sessions:UpdateAsync(tostring(player.UserId), function(old)
			old = old or { visits = 0 }
			old.visits += 1
			return old
		end)
	end, 3)
end)
''',
            ),
            Solution(
                "c",
                '''
local DataStoreService = game:GetService("DataStoreService")

local Saver = {}
Saver.__index = Saver

function Saver.new(name: string)
	local self = setmetatable({}, Saver)
	self.store = DataStoreService:GetDataStore(name)
	self.backoff = 1
	return self
end

function Saver:write(key, value)
	local ok, err = pcall(self.store.SetAsync, self.store, key, value)
	if ok then
		self.backoff = 1
		return true
	end
	self.backoff = math.min(self.backoff * 2, 32)
	warn(err)
	return false
end

return Saver
''',
            ),
        ],
    ),
    Problem(
        problem_id="raycast-ground",
        statement="Cast a ray downward from a part and report what it hit.",
        solutions=[
            Solution(
                "a",
                '''
local part = script.Parent

local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { part }

local origin = part.Position
local direction = Vector3.new(0, -100, 0)

local result = workspace:Raycast(origin, direction, params)
if result then
	print("hit", result.Instance:GetFullName(), "at", result.Position)
else
	print("nothing below")
end
''',
                structural_rewrite='''
local function groundUnder(from: BasePart, reach: number)
	local filter = RaycastParams.new()
	filter.FilterType = Enum.RaycastFilterType.Exclude
	filter.FilterDescendantsInstances = { from }
	return workspace:Raycast(from.Position, Vector3.new(0, -reach, 0), filter)
end

local found = groundUnder(script.Parent, 100)
if found == nil then
	print("nothing below")
else
	print("hit", found.Instance:GetFullName(), "at", found.Position)
end
''',
            ),
            Solution(
                "b",
                '''
local Players = game:GetService("Players")

local function heightAboveGround(character: Model): number?
	local root = character:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	local params = RaycastParams.new()
	params.FilterDescendantsInstances = { character }
	params.FilterType = Enum.RaycastFilterType.Exclude
	local hit = workspace:Raycast(root.Position, Vector3.new(0, -500, 0), params)
	if not hit then
		return nil
	end
	return (root.Position - hit.Position).Magnitude
end

for _, player in Players:GetPlayers() do
	if player.Character then
		print(player.Name, heightAboveGround(player.Character))
	end
end
''',
            ),
            Solution(
                "c",
                '''
local CAST_LENGTH = 250

local function findFloor(origin: Vector3, ignore: {Instance})
	local options = RaycastParams.new()
	options.FilterType = Enum.RaycastFilterType.Exclude
	options.FilterDescendantsInstances = ignore
	options.IgnoreWater = true
	local outcome = workspace:Raycast(origin, Vector3.yAxis * -CAST_LENGTH, options)
	if outcome == nil then
		return nil, nil
	end
	return outcome.Position, outcome.Normal
end

return findFloor
''',
            ),
        ],
    ),
    Problem(
        problem_id="find-nearest",
        statement="Find the player closest to a given position.",
        solutions=[
            Solution(
                "a",
                '''
local Players = game:GetService("Players")

local function nearestPlayer(position: Vector3)
	local best = nil
	local bestDistance = math.huge
	for _, player in Players:GetPlayers() do
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root then
			local distance = (root.Position - position).Magnitude
			if distance < bestDistance then
				bestDistance = distance
				best = player
			end
		end
	end
	return best, bestDistance
end

return nearestPlayer
''',
                structural_rewrite='''
local Players = game:GetService("Players")

local function rootOf(player)
	local model = player.Character
	if model == nil then
		return nil
	end
	return model:FindFirstChild("HumanoidRootPart")
end

local function closestTo(point: Vector3)
	local candidates = {}
	for _, player in Players:GetPlayers() do
		local root = rootOf(player)
		if root ~= nil then
			table.insert(candidates, { who = player, gap = (root.Position - point).Magnitude })
		end
	end
	table.sort(candidates, function(left, right)
		return left.gap < right.gap
	end)
	local head = candidates[1]
	if head == nil then
		return nil, math.huge
	end
	return head.who, head.gap
end

return closestTo
''',
            ),
            Solution(
                "b",
                '''
local Players = game:GetService("Players")

local function distancesFrom(position: Vector3)
	local out = {}
	for _, player in Players:GetPlayers() do
		local root = player.Character and player.Character.PrimaryPart
		if root then
			out[player] = (root.Position - position).Magnitude
		end
	end
	return out
end

local function pickMinimum(map)
	local winner, score = nil, math.huge
	for key, value in pairs(map) do
		if value < score then
			winner, score = key, value
		end
	end
	return winner, score
end

return function(position: Vector3)
	return pickMinimum(distancesFrom(position))
end
''',
            ),
            Solution(
                "c",
                '''
local Players = game:GetService("Players")

local Targeting = {}

function Targeting.withinRadius(origin: Vector3, radius: number)
	local matches = {}
	for _, player in Players:GetPlayers() do
		local char = player.Character
		if char then
			local hrp = char:FindFirstChild("HumanoidRootPart")
			if hrp and (hrp.Position - origin).Magnitude <= radius then
				table.insert(matches, player)
			end
		end
	end
	return matches
end

return Targeting
''',
            ),
        ],
    ),
    Problem(
        problem_id="cooldown-table",
        statement="Track a per-player ability cooldown.",
        solutions=[
            Solution(
                "a",
                '''
local Players = game:GetService("Players")

local COOLDOWN = 5
local lastUse = {}

local function tryUse(player: Player): boolean
	local now = os.clock()
	local previous = lastUse[player.UserId]
	if previous and now - previous < COOLDOWN then
		return false
	end
	lastUse[player.UserId] = now
	return true
end

Players.PlayerRemoving:Connect(function(player)
	lastUse[player.UserId] = nil
end)

return tryUse
''',
                structural_rewrite='''
local Players = game:GetService("Players")

local Cooldown = {}
local stamps = {}

function Cooldown.ready(player: Player): boolean
	local previous = stamps[player.UserId]
	if previous == nil then
		return true
	end
	return (os.clock() - previous) >= 5
end

function Cooldown.stamp(player: Player)
	stamps[player.UserId] = os.clock()
end

function Cooldown.consume(player: Player): boolean
	if not Cooldown.ready(player) then
		return false
	end
	Cooldown.stamp(player)
	return true
end

Players.PlayerRemoving:Connect(function(player)
	stamps[player.UserId] = nil
end)

return Cooldown
''',
            ),
            Solution(
                "b",
                '''
local Debounce = {}
Debounce.__index = Debounce

function Debounce.new(seconds: number)
	return setmetatable({ seconds = seconds, entries = setmetatable({}, { __mode = "k" }) }, Debounce)
end

function Debounce:check(key): boolean
	local at = self.entries[key]
	if at ~= nil and tick() - at < self.seconds then
		return false
	end
	self.entries[key] = tick()
	return true
end

return Debounce
''',
            ),
            Solution(
                "c",
                '''
local COOLDOWN_ATTRIBUTE = "AbilityReadyAt"

local function readyAt(player: Player): number
	local value = player:GetAttribute(COOLDOWN_ATTRIBUTE)
	if typeof(value) ~= "number" then
		return 0
	end
	return value
end

local function useAbility(player: Player, duration: number): boolean
	if workspace:GetServerTimeNow() < readyAt(player) then
		return false
	end
	player:SetAttribute(COOLDOWN_ATTRIBUTE, workspace:GetServerTimeNow() + duration)
	return true
end

return useAbility
''',
            ),
        ],
    ),
    Problem(
        problem_id="spawn-circle",
        statement="Spawn N anchored parts arranged in a circle.",
        solutions=[
            Solution(
                "a",
                '''
local COUNT = 12
local RADIUS = 20

for i = 1, COUNT do
	local angle = (i / COUNT) * math.pi * 2
	local part = Instance.new("Part")
	part.Anchored = true
	part.Size = Vector3.new(2, 2, 2)
	part.Position = Vector3.new(math.cos(angle) * RADIUS, 5, math.sin(angle) * RADIUS)
	part.Parent = workspace
end
''',
                structural_rewrite='''
local function ringPosition(index: number, total: number, radius: number): Vector3
	local theta = math.pi * 2 * (index / total)
	return Vector3.new(radius * math.cos(theta), 5, radius * math.sin(theta))
end

local function buildRing(total: number, radius: number)
	local made = {}
	for index = 1, total do
		local block = Instance.new("Part")
		block.Anchored = true
		block.Size = Vector3.one * 2
		block.Position = ringPosition(index, total, radius)
		block.Parent = workspace
		table.insert(made, block)
	end
	return made
end

buildRing(12, 20)
''',
            ),
            Solution(
                "b",
                '''
local folder = Instance.new("Folder")
folder.Name = "Ring"
folder.Parent = workspace

local template = Instance.new("Part")
template.Anchored = true
template.CanCollide = false
template.Size = Vector3.new(2, 2, 2)

local n = 12
local step = math.rad(360 / n)

for index = 0, n - 1 do
	local clone = template:Clone()
	clone.CFrame = CFrame.new(0, 5, 0) * CFrame.Angles(0, step * index, 0) * CFrame.new(0, 0, -20)
	clone.Parent = folder
end

template:Destroy()
''',
            ),
            Solution(
                "c",
                '''
local Ring = {}

function Ring.create(config)
	local count = config.count or 8
	local radius = config.radius or 10
	local parent = config.parent or workspace
	local parts = table.create(count)
	for slot = 1, count do
		local fraction = slot / count
		local piece = Instance.new("Part")
		piece.Anchored = true
		piece.Position = Vector3.new(
			math.cos(fraction * 2 * math.pi) * radius,
			config.height or 3,
			math.sin(fraction * 2 * math.pi) * radius
		)
		piece.Parent = parent
		parts[slot] = piece
	end
	return parts
end

return Ring
''',
            ),
        ],
    ),
    Problem(
        problem_id="animate-loop",
        statement="Play a looping animation on a humanoid and stop it on demand.",
        solutions=[
            Solution(
                "a",
                '''
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()
local humanoid = character:WaitForChild("Humanoid")
local animator = humanoid:WaitForChild("Animator")

local animation = Instance.new("Animation")
animation.AnimationId = "rbxassetid://0"

local track = animator:LoadAnimation(animation)
track.Looped = true
track:Play()

task.delay(10, function()
	track:Stop(0.25)
end)
''',
                structural_rewrite='''
local Players = game:GetService("Players")

local function animatorFor(player)
	local model = player.Character or player.CharacterAdded:Wait()
	local humanoid = model:WaitForChild("Humanoid")
	return humanoid:WaitForChild("Animator")
end

local function loopClip(animator, assetId: string)
	local clip = Instance.new("Animation")
	clip.AnimationId = assetId
	local handle = animator:LoadAnimation(clip)
	handle.Looped = true
	handle:Play()
	return handle
end

local running = loopClip(animatorFor(Players.LocalPlayer), "rbxassetid://0")
task.delay(10, function()
	running:Stop(0.25)
end)
''',
            ),
            Solution(
                "b",
                '''
local AnimationController = {}
AnimationController.__index = AnimationController

function AnimationController.new(animator: Animator)
	return setmetatable({ animator = animator, tracks = {} }, AnimationController)
end

function AnimationController:play(name: string, assetId: string)
	local existing = self.tracks[name]
	if existing then
		existing:Play()
		return existing
	end
	local animation = Instance.new("Animation")
	animation.AnimationId = assetId
	local track = self.animator:LoadAnimation(animation)
	self.tracks[name] = track
	track.Looped = true
	track:Play()
	return track
end

function AnimationController:stopAll()
	for _, track in pairs(self.tracks) do
		track:Stop()
	end
end

return AnimationController
''',
            ),
            Solution(
                "c",
                '''
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("Emote")

local active = {}

remote.OnClientEvent:Connect(function(command, assetId)
	if command == "stop" then
		for _, handle in pairs(active) do
			handle:Stop()
		end
		table.clear(active)
		return
	end
	local humanoid = script.Parent:FindFirstChildOfClass("Humanoid")
	if humanoid == nil then
		return
	end
	local anim = Instance.new("Animation")
	anim.AnimationId = assetId
	local handle = humanoid.Animator:LoadAnimation(anim)
	handle.Looped = true
	handle:Play()
	table.insert(active, handle)
end)
''',
            ),
        ],
    ),
]


def all_solutions() -> list:
    """(problem_id, sol_id, source) for every solution."""
    return [(p.problem_id, s.sol_id, s.source) for p in PROBLEMS for s in p.solutions]


def structural_pairs() -> list:
    """(label, original, rewrite) -- the positives that are meant to be hard."""
    out = []
    for p in PROBLEMS:
        for s in p.solutions:
            if s.structural_rewrite:
                out.append(("%s/%s" % (p.problem_id, s.sol_id), s.source, s.structural_rewrite))
    return out


def same_problem_pairs() -> list:
    """
    (label, a, b) for distinct solutions to the *same* problem.

    These are the negatives that matter. Cross-problem pairs are easy and are
    also measured, but nobody's detector fails on those.
    """
    out = []
    for p in PROBLEMS:
        for i in range(len(p.solutions)):
            for j in range(i + 1, len(p.solutions)):
                out.append(
                    (
                        "%s/%s~%s" % (p.problem_id, p.solutions[i].sol_id, p.solutions[j].sol_id),
                        p.solutions[i].source,
                        p.solutions[j].source,
                    )
                )
    return out


def cross_problem_pairs() -> list:
    out = []
    flat = all_solutions()
    for i in range(len(flat)):
        for j in range(i + 1, len(flat)):
            if flat[i][0] == flat[j][0]:
                continue
            out.append(
                (
                    "%s/%s~%s/%s" % (flat[i][0], flat[i][1], flat[j][0], flat[j][1]),
                    flat[i][2],
                    flat[j][2],
                )
            )
    return out
