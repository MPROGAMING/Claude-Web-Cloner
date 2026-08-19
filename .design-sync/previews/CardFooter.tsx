import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  StatusDot,
} from "blockwright";

export const Actions = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Change set 0f3a</CardTitle>
      <CardDescription>3 files · Obby Checkpoints</CardDescription>
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

export const SplitMeta = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Bloxburg Tycoon</CardTitle>
      <CardDescription>Round timer, shop, leaderboard stub</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        The footer sits on a muted wash with a top border, and the card drops its
        bottom padding when one is present.
      </p>
    </CardContent>
    <CardFooter className="justify-between">
      <span className="font-mono text-xs text-muted-foreground">
        edited 4 min ago
      </span>
      <Badge variant="outline">Live</Badge>
    </CardFooter>
  </Card>
);

export const Destructive = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Delete Sword Fight Arena</CardTitle>
      <CardDescription>
        Removes the project, its scripts and its build history.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Anything already applied to your Studio place stays there.
      </p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm" variant="destructive">
        Delete project
      </Button>
      <Button size="sm" variant="ghost">
        Cancel
      </Button>
    </CardFooter>
  </Card>
);

export const Dense = () => (
  <Card size="sm" className="max-w-xs">
    <CardHeader>
      <CardTitle>Top up credits</CardTitle>
      <CardDescription>Builder pack — 25,000 credits</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="font-mono text-sm tabular-nums">$20.00</p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Buy pack</Button>
    </CardFooter>
  </Card>
);
