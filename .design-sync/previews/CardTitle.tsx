import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatusDot,
} from "blockwright";
import { FileCode2 } from "lucide-react";

export const Default = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Bloxburg Tycoon</CardTitle>
      <CardDescription>Owned by you · created in March</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        The title is Archivo at 16px, medium weight — the display face carries
        every card heading in the product.
      </p>
    </CardContent>
  </Card>
);

export const WithStatus = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <StatusDot tone="working" />
        Generating leaderboard
      </CardTitle>
      <CardDescription>Writing LeaderboardService.lua</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        A StatusDot composes inside the title rather than beside the card.
      </p>
    </CardContent>
  </Card>
);

export const WithIcon = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <FileCode2 className="size-4 text-ember" />
        RoundTimer.server.lua
      </CardTitle>
      <CardDescription>ServerScriptService · 138 lines</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="font-mono text-xs text-muted-foreground">
        local ROUND_SECONDS = 90
      </p>
    </CardContent>
  </Card>
);

export const Dense = () => (
  <div className="flex flex-col gap-3">
    <Card className="max-w-xs">
      <CardHeader>
        <CardTitle>Default size — 16px</CardTitle>
      </CardHeader>
    </Card>
    <Card size="sm" className="max-w-xs">
      <CardHeader>
        <CardTitle>Small card — title steps to 14px</CardTitle>
      </CardHeader>
    </Card>
  </div>
);
