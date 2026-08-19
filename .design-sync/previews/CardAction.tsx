import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Badge,
  Button,
  StatusDot,
} from "blockwright";
import { MoreHorizontal } from "lucide-react";

export const ButtonAction = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Obby Checkpoints</CardTitle>
      <CardDescription>3 unapplied changes</CardDescription>
      <CardAction>
        <Button size="sm" variant="outline">
          Review
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        CardAction pins to the trailing edge of the header and spans both title
        rows.
      </p>
    </CardContent>
  </Card>
);

export const BadgeAction = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Bloxburg Tycoon</CardTitle>
      <CardDescription>Synced to Studio 4 minutes ago</CardDescription>
      <CardAction>
        <Badge variant="outline">Live</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot tone="live" />
        Plugin connected
      </div>
    </CardContent>
  </Card>
);

export const IconAction = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>LeaderboardService.lua</CardTitle>
      <CardDescription>ServerScriptService · 92 lines</CardDescription>
      <CardAction>
        <Button size="icon-sm" variant="ghost" aria-label="Script actions">
          <MoreHorizontal />
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="font-mono text-xs text-muted-foreground">
        local store = DataStoreService:GetOrderedDataStore(&quot;kills&quot;)
      </p>
    </CardContent>
  </Card>
);

export const WithFooterAction = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Round timer</CardTitle>
      <CardDescription>Server-authoritative, 90 second rounds</CardDescription>
      <CardAction>
        <Badge variant="outline">Validated</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        A header action and a footer action are different slots — the header one
        is secondary.
      </p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Apply to Studio</Button>
    </CardFooter>
  </Card>
);
