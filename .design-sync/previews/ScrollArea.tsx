import { ScrollArea, Separator, StatusDot, Badge } from "blockwright";
import { FileCode2 } from "lucide-react";

// ScrollArea only reads as itself when its content overflows a bounded height,
// so every cell fixes a height and overfills it.
const FILES = [
  "ServerScriptService/RoundTimer.server.luau",
  "ServerScriptService/ShopService.server.luau",
  "ServerScriptService/LeaderboardService.server.luau",
  "ServerScriptService/DataStore.server.luau",
  "ReplicatedStorage/Remotes.luau",
  "ReplicatedStorage/Config.luau",
  "ReplicatedStorage/Types.luau",
  "StarterPlayerScripts/ShopUI.client.luau",
  "StarterPlayerScripts/TimerHud.client.luau",
  "StarterPlayerScripts/Checkpoints.client.luau",
];

export const ProjectFileTree = () => (
  <ScrollArea className="h-48 max-w-sm rounded-lg border border-border bg-surface-sunken">
    <div className="flex flex-col gap-0.5 p-2">
      {FILES.map((f) => (
        <span key={f} className="flex items-center gap-2 rounded px-1.5 py-1 font-mono text-xs">
          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{f}</span>
        </span>
      ))}
    </div>
  </ScrollArea>
);

export const ChangeSetList = () => (
  <ScrollArea className="h-48 max-w-sm rounded-lg border border-border bg-surface">
    <div className="flex flex-col p-2">
      {[
        ["Change set 14", "working", "3 files"],
        ["Change set 13", "active", "1 file"],
        ["Change set 12", "active", "7 files"],
        ["Change set 11", "error", "failed"],
        ["Change set 10", "active", "2 files"],
        ["Change set 9", "active", "4 files"],
        ["Change set 8", "idle", "reverted"],
      ].map(([name, tone, meta], i, all) => (
        <div key={name}>
          <div className="flex items-center gap-2 px-1.5 py-2 text-[0.8125rem]">
            <StatusDot tone={tone as "working"} />
            {name}
            <Badge variant="outline" className="ml-auto">
              {meta}
            </Badge>
          </div>
          {i < all.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  </ScrollArea>
);

export const LongCode = () => (
  <ScrollArea className="h-48 max-w-lg rounded-lg border border-border bg-surface-sunken">
    <pre className="code-type p-3 text-muted-foreground">
{`local RoundTimer = {}
RoundTimer.__index = RoundTimer

local ROUND_SECONDS = 90
local INTERMISSION = 15

function RoundTimer.new(remotes)
    local self = setmetatable({}, RoundTimer)
    self.remotes = remotes
    self.remaining = ROUND_SECONDS
    self.running = false
    return self
end

function RoundTimer:start()
    if self.running then return end
    self.running = true
    task.spawn(function()
        while self.running do
            self.remaining -= 1
            self.remotes.Tick:FireAllClients(self.remaining)
            if self.remaining <= 0 then
                self:finish()
            end
            task.wait(1)
        end
    end)
end

return RoundTimer`}
    </pre>
  </ScrollArea>
);
