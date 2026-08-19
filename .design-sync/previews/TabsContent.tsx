import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  StatusDot,
} from "blockwright";
import { FileCode2 } from "lucide-react";

const CODE = [
  "local Players = game:GetService(\"Players\")",
  "local ROUND_SECONDS = 90",
  "",
  "local function startRound()",
  "  for _, player in Players:GetPlayers() do",
  "    player:LoadCharacter()",
  "  end",
  "  task.wait(ROUND_SECONDS)",
  "end",
];

export const CodePanel = () => (
  <Tabs defaultValue="code" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">Chat</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
      <TabsTrigger value="studio">Studio</TabsTrigger>
    </TabsList>
    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">18 messages.</p>
    </TabsContent>
    <TabsContent value="code">
      <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-3">
        <div className="flex items-center gap-2 pb-2">
          <FileCode2 className="size-4 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">
            ServerScriptService/RoundTimer.server.lua
          </span>
        </div>
        {CODE.map((line, i) => (
          <p key={i} className="font-mono text-xs">
            {line || " "}
          </p>
        ))}
      </div>
    </TabsContent>
    <TabsContent value="studio">
      <p className="text-sm text-muted-foreground">Paired.</p>
    </TabsContent>
  </Tabs>
);

export const ChatPanel = () => (
  <Tabs defaultValue="chat" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">Chat</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
    </TabsList>
    <TabsContent value="chat">
      <div className="flex flex-col gap-2">
        <div className="rounded-lg bg-surface-raised px-3 py-2 text-sm">
          Give the obby checkpoints so players respawn at the last one they
          touched.
        </div>
        <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-muted-foreground">
          Wrote CheckpointService and rewrote RespawnService — 3 files in change
          set 0f3a, ready to apply.
        </div>
      </div>
    </TabsContent>
    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">14 scripts.</p>
    </TabsContent>
  </Tabs>
);

export const StudioPanel = () => (
  <Tabs defaultValue="studio" className="max-w-lg">
    <TabsList variant="line">
      <TabsTrigger value="code">Code</TabsTrigger>
      <TabsTrigger value="studio">Studio</TabsTrigger>
      <TabsTrigger value="memory">Memory</TabsTrigger>
    </TabsList>
    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">14 scripts.</p>
    </TabsContent>
    <TabsContent value="studio">
      <Card>
        <CardHeader>
          <CardTitle>Bloxburg Tycoon.rbxl</CardTitle>
          <CardDescription>Pairing code 4R7-QK2</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <StatusDot tone="live" />
            Plugin polling — last seen 2s ago
          </div>
          <div className="flex items-center gap-2 text-sm">
            <StatusDot tone="active" />
            3 commands applied in this session
          </div>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="memory">
      <p className="text-sm text-muted-foreground">11 remembered facts.</p>
    </TabsContent>
  </Tabs>
);

export const ChangeSetPanel = () => (
  <Tabs defaultValue="review" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="review">Review</TabsTrigger>
      <TabsTrigger value="diff">Diff</TabsTrigger>
    </TabsList>
    <TabsContent value="review">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">3 files</Badge>
          <Badge variant="secondary">Validated</Badge>
        </div>
        {[
          "ServerScriptService/CheckpointService.server.lua",
          "ServerScriptService/RespawnService.server.lua",
          "ReplicatedStorage/Course.module.lua",
        ].map((path) => (
          <div
            key={path}
            className="flex items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-1.5"
          >
            <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-xs">{path}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button size="sm">Apply to Studio</Button>
          <Button size="sm" variant="ghost">
            Discard
          </Button>
        </div>
      </div>
    </TabsContent>
    <TabsContent value="diff">
      <p className="text-sm text-muted-foreground">+128 / -14 lines.</p>
    </TabsContent>
  </Tabs>
);
