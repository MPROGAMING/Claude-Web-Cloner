import {
  Progress,
  ProgressLabel,
  ProgressValue,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  Badge,
} from "blockwright";

const STEPS = [
  { label: "Queued", value: 0 },
  { label: "Planning the mechanic", value: 35 },
  { label: "Writing Luau", value: 72 },
  { label: "Validated", value: 100 },
];

export const Sweep = () => (
  <div className="flex w-96 flex-col gap-6">
    {STEPS.map((s) => (
      <Progress key={s.label} value={s.value}>
        <ProgressLabel>{s.label}</ProgressLabel>
        <ProgressValue />
      </Progress>
    ))}
  </div>
);

export const WithLabel = () => (
  <div className="w-96">
    <Progress value={72}>
      <ProgressLabel>Ingesting Roblox docs</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const BareBar = () => (
  <div className="flex w-96 flex-col gap-6">
    {[18, 64, 100].map((v) => (
      <div key={v} className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          Bloxburg Tycoon — {v}% ingested
        </p>
        <Progress value={v} />
      </div>
    ))}
  </div>
);

export const InACreditsCard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Current balance</CardTitle>
      <CardDescription>4,820 credits</CardDescription>
      <CardAction>
        <Badge variant="outline">Free plan</Badge>
      </CardAction>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">15,180 used</span>
        <span className="tabular-nums">20,000 granted</span>
      </div>
      <Progress value={76} className="h-1.5" />
    </CardContent>
  </Card>
);
