import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  Badge,
  Button,
  StatusDot,
} from "blockwright";
import { FileCode2 } from "lucide-react";

export const Prose = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>What this change set does</CardTitle>
      <CardDescription>Change set 0f3a · Obby Checkpoints</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Tags every BasePart under Course as a checkpoint, stores the highest one
        each player has touched, and respawns them there instead of at the
        SpawnLocation.
      </p>
    </CardContent>
  </Card>
);

export const FileList = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Files in this build</CardTitle>
      <CardDescription>Bloxburg Tycoon</CardDescription>
      <CardAction>
        <Badge variant="outline">3</Badge>
      </CardAction>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      {[
        "ServerScriptService/RoundTimer.server.lua",
        "ServerScriptService/ShopService.server.lua",
        "ReplicatedStorage/Items.module.lua",
      ].map((path) => (
        <div
          key={path}
          className="flex items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-1.5"
        >
          <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs">{path}</span>
        </div>
      ))}
    </CardContent>
  </Card>
);

export const Metrics = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Last build</CardTitle>
      <CardDescription>Sword Fight Arena · 4 minutes ago</CardDescription>
    </CardHeader>
    <CardContent className="grid grid-cols-3 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Scripts</p>
        <p className="mt-1 font-display text-lg font-semibold tabular-nums">
          14
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Credits</p>
        <p className="mt-1 font-display text-lg font-semibold tabular-nums">
          312
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Errors</p>
        <p className="mt-1 font-display text-lg font-semibold tabular-nums">
          0
        </p>
      </div>
    </CardContent>
  </Card>
);

export const StatusRows = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Validation</CardTitle>
      <CardDescription>Ran before the change set was offered</CardDescription>
      <CardAction>
        <Button size="sm" variant="ghost">
          Re-run
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <StatusDot tone="active" />
        Luau parses — 0 syntax errors
      </div>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot tone="active" />
        Every path resolves inside the project
      </div>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot tone="error" />
        RemoteEvent &quot;BuyItem&quot; has no server listener
      </div>
    </CardContent>
  </Card>
);
