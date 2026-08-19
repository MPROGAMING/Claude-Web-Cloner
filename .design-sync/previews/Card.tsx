import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
  StatusDot,
} from "blockwright";

export const Basic = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Bloxburg Tycoon</CardTitle>
      <CardDescription>Last synced to Studio 4 minutes ago</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Nine scripts across ServerScriptService and ReplicatedStorage. The round
        timer and the shop are wired; the leaderboard is still a stub.
      </p>
    </CardContent>
  </Card>
);

export const WithAction = () => (
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
        Adds a checkpoint part tag and respawns the player at the last one
        touched.
      </p>
    </CardContent>
  </Card>
);

export const WithFooter = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Round timer</CardTitle>
      <CardDescription>Server-authoritative, 90 second rounds</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot tone="active" />
        Validated — no Luau errors
      </div>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Apply to Studio</Button>
      <Button size="sm" variant="ghost">
        Discard
      </Button>
    </CardFooter>
  </Card>
);

export const Grid = () => (
  <div className="grid gap-4 sm:grid-cols-2">
    {[
      { name: "Bloxburg Tycoon", state: "Live", tone: "live" as const },
      { name: "Sword Fight Arena", state: "Draft", tone: "idle" as const },
    ].map((p) => (
      <Card key={p.name}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusDot tone={p.tone} />
            {p.name}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">{p.state}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Updated yesterday</p>
        </CardContent>
      </Card>
    ))}
  </div>
);
