// ProgressTrack has no standalone render: `Progress` already emits
// `<ProgressTrack><ProgressIndicator /></ProgressTrack>` as its last child, so
// the honest preview is a full Progress composition — adding a second track
// would draw two bars.
import {
  Progress,
  ProgressLabel,
  ProgressValue,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "blockwright";

export const EmptyToFull = () => (
  <div className="flex w-96 flex-col gap-6">
    {[0, 50, 100].map((v) => (
      <Progress key={v} value={v}>
        <ProgressLabel>Build {v === 0 ? "queued" : "running"}</ProgressLabel>
        <ProgressValue />
      </Progress>
    ))}
  </div>
);

export const OnASunkenSurface = () => (
  <div className="w-96 rounded-lg bg-surface-sunken p-4">
    <Progress value={72}>
      <ProgressLabel>Ingesting Roblox docs</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const InsideACard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Knowledge ingest</CardTitle>
      <CardDescription>1,840 of 2,560 chunks embedded</CardDescription>
    </CardHeader>
    <CardContent>
      <Progress value={72}>
        <ProgressLabel>Roblox API reference</ProgressLabel>
        <ProgressValue />
      </Progress>
    </CardContent>
  </Card>
);

export const Stacked = () => (
  <div className="flex w-96 flex-col gap-4">
    {[
      { label: "ServerScriptService", value: 100 },
      { label: "ReplicatedStorage", value: 62 },
      { label: "StarterPlayerScripts", value: 8 },
    ].map((row) => (
      <Progress key={row.label} value={row.value}>
        <ProgressLabel>{row.label}</ProgressLabel>
        <ProgressValue />
      </Progress>
    ))}
  </div>
);
