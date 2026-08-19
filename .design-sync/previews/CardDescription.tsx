import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  Badge,
} from "blockwright";

export const UnderTitle = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Shop kiosk</CardTitle>
      <CardDescription>
        Sells the pickaxe upgrades from ReplicatedStorage/Items
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        The description sits in the header&apos;s second row and reads as muted
        against the title.
      </p>
    </CardContent>
  </Card>
);

export const Wrapping = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Change set 0f3a</CardTitle>
      <CardDescription>
        Adds a checkpoint tag to every BasePart under Course, rewrites
        RespawnService to read the last touched checkpoint, and removes the
        hard-coded spawn position.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Badge variant="outline">3 files changed</Badge>
    </CardContent>
  </Card>
);

export const WithAction = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Sword Fight Arena</CardTitle>
      <CardDescription>
        Archived · last synced to Studio on 12 April
      </CardDescription>
      <CardAction>
        <Badge variant="secondary">Archived</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Description and action share the header grid without colliding.
      </p>
    </CardContent>
  </Card>
);

export const Dense = () => (
  <Card size="sm" className="max-w-xs">
    <CardHeader>
      <CardTitle>Credits</CardTitle>
      <CardDescription>
        Metered from the token usage each provider reports
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="font-mono text-sm tabular-nums">4,820 remaining</p>
    </CardContent>
  </Card>
);
