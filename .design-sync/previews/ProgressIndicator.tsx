// `Progress` renders its own `<ProgressTrack><ProgressIndicator /></ProgressTrack>`
// as its last child, so the indicator is previewed through the parent — a second
// explicit instance would draw a second bar.
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

export const FillSweep = () => (
  <div className="flex w-96 flex-col gap-6">
    {[0, 35, 72, 100].map((v) => (
      <Progress key={v} value={v}>
        <ProgressLabel>Writing Luau</ProgressLabel>
        <ProgressValue />
      </Progress>
    ))}
  </div>
);

export const NearlyDone = () => (
  <div className="w-96">
    <Progress value={96}>
      <ProgressLabel>Applying change set 0f3a</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const CustomRange = () => (
  <div className="flex w-96 flex-col gap-6">
    <Progress value={1840} max={2560}>
      <ProgressLabel>Chunks embedded</ProgressLabel>
      <ProgressValue />
    </Progress>
    <Progress value={14} max={14}>
      <ProgressLabel>Scripts written</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const InABuildCard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Sword Fight Arena</CardTitle>
      <CardDescription>Build started 40 seconds ago</CardDescription>
      <CardAction>
        <Badge variant="outline">Running</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <Progress value={45}>
        <ProgressLabel>Writing WeaponService.server.lua</ProgressLabel>
        <ProgressValue />
      </Progress>
    </CardContent>
  </Card>
);
