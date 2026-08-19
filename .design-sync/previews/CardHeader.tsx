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

export const TitleAndDescription = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Sword Fight Arena</CardTitle>
      <CardDescription>
        14 Luau scripts · last build 6 minutes ago
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Round timer, weapon shop and the arena spawner are wired into
        ServerScriptService.
      </p>
    </CardContent>
  </Card>
);

export const WithActionSlot = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Obby Checkpoints</CardTitle>
      <CardDescription>Change set 0f3a waiting on review</CardDescription>
      <CardAction>
        <Badge variant="outline">3 files</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        The header switches to a two-column grid as soon as a CardAction is
        present.
      </p>
    </CardContent>
  </Card>
);

export const Divided = () => (
  <Card className="max-w-sm">
    <CardHeader className="border-b">
      <CardTitle>Studio bridge</CardTitle>
      <CardDescription>Paired to Bloxburg Tycoon.rbxl</CardDescription>
      <CardAction>
        <Button size="sm" variant="ghost">
          Unpair
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot tone="live" />
        Connected — polling every 2s
      </div>
    </CardContent>
  </Card>
);

export const Dense = () => (
  <Card size="sm" className="max-w-xs">
    <CardHeader>
      <CardTitle>ReplicatedStorage</CardTitle>
      <CardDescription>4 modules</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Card spacing drops to 12px, and the title steps down with it.
      </p>
    </CardContent>
  </Card>
);
