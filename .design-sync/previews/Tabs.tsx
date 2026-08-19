import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  StatusDot,
} from "blockwright";
import { MessageSquare, Code2, Blocks } from "lucide-react";

const CODE = [
  "local Players = game:GetService(\"Players\")",
  "local ROUND_SECONDS = 90",
  "",
  "local function startRound()",
  "  for _, player in Players:GetPlayers() do",
  "    player:LoadCharacter()",
  "  end",
  "end",
];

export const WorkspacePanels = () => (
  <Tabs defaultValue="code" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">
        <MessageSquare />
        Chat
      </TabsTrigger>
      <TabsTrigger value="code">
        <Code2 />
        Code
      </TabsTrigger>
      <TabsTrigger value="blueprint">
        <Blocks />
        Blueprint
      </TabsTrigger>
    </TabsList>

    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">
        Ask for a mechanic and the agent plans it before writing any Luau.
      </p>
    </TabsContent>
    <TabsContent value="code">
      <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-3">
        <p className="font-mono text-xs text-muted-foreground">
          ServerScriptService/RoundTimer.server.lua
        </p>
        {CODE.map((line, i) => (
          <p key={i} className="font-mono text-xs">
            {line || " "}
          </p>
        ))}
      </div>
    </TabsContent>
    <TabsContent value="blueprint">
      <p className="text-sm text-muted-foreground">
        Six answered questions, two left before the build can start.
      </p>
    </TabsContent>
  </Tabs>
);

export const LineVariant = () => (
  <Tabs defaultValue="usage" className="max-w-lg">
    <TabsList variant="line">
      <TabsTrigger value="usage">Usage by model</TabsTrigger>
      <TabsTrigger value="requests">Requests</TabsTrigger>
      <TabsTrigger value="ledger">Transactions</TabsTrigger>
    </TabsList>

    <TabsContent value="usage">
      <div className="flex flex-col gap-2">
        {[
          { model: "claude-sonnet-4-6", credits: "1,840" },
          { model: "gpt-5-mini", credits: "612" },
          { model: "llama-3.3-70b", credits: "204" },
        ].map((row) => (
          <div
            key={row.model}
            className="flex items-center justify-between rounded-md bg-surface-sunken px-2.5 py-1.5"
          >
            <span className="font-mono text-xs">{row.model}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {row.credits}
            </span>
          </div>
        ))}
      </div>
    </TabsContent>
    <TabsContent value="requests">
      <p className="text-sm text-muted-foreground">312 requests this month.</p>
    </TabsContent>
    <TabsContent value="ledger">
      <p className="text-sm text-muted-foreground">
        Two grants and 14 deductions.
      </p>
    </TabsContent>
  </Tabs>
);

export const Vertical = () => (
  <Tabs orientation="vertical" defaultValue="studio" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="code">Code</TabsTrigger>
      <TabsTrigger value="studio">Studio</TabsTrigger>
      <TabsTrigger value="memory">Memory</TabsTrigger>
    </TabsList>

    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">14 scripts in the project.</p>
    </TabsContent>
    <TabsContent value="studio">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot tone="live" />
          Paired to Bloxburg Tycoon.rbxl
        </div>
        <p className="text-sm text-muted-foreground">
          Polling every 2 seconds. Applying a change set sends allowlisted
          commands only.
        </p>
      </div>
    </TabsContent>
    <TabsContent value="memory">
      <p className="text-sm text-muted-foreground">
        11 remembered facts about this project.
      </p>
    </TabsContent>
  </Tabs>
);

export const WithCounts = () => (
  <Tabs defaultValue="active" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="active">
        Active
        <Badge variant="secondary">4</Badge>
      </TabsTrigger>
      <TabsTrigger value="archived">
        Archived
        <Badge variant="secondary">2</Badge>
      </TabsTrigger>
    </TabsList>

    <TabsContent value="active">
      <div className="flex flex-col gap-2">
        {["Bloxburg Tycoon", "Obby Checkpoints", "Sword Fight Arena"].map(
          (name) => (
            <div key={name} className="flex items-center gap-2 text-sm">
              <StatusDot tone="active" />
              {name}
            </div>
          ),
        )}
      </div>
    </TabsContent>
    <TabsContent value="archived">
      <p className="text-sm text-muted-foreground">
        Tycoon Prototype, Racing Test
      </p>
    </TabsContent>
  </Tabs>
);
