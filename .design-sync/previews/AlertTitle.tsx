import { Alert, AlertTitle, AlertDescription, AlertAction, Button } from "blockwright";
import { CircleCheck, TriangleAlert } from "lucide-react";

export const TitleOnly = () => (
  <div className="flex max-w-lg flex-col gap-3">
    <Alert>
      <AlertTitle>Build finished — 14 scripts written</AlertTitle>
    </Alert>
    <Alert variant="destructive">
      <AlertTitle>Change set 0f3a could not be applied</AlertTitle>
    </Alert>
  </div>
);

export const WithDescription = () => (
  <Alert className="max-w-lg">
    <AlertTitle>Project memory updated</AlertTitle>
    <AlertDescription>
      Remembered that Bloxburg Tycoon uses a 90 second round and that the shop
      lives in ReplicatedStorage/Items.
    </AlertDescription>
  </Alert>
);

export const NextToIcon = () => (
  <div className="flex max-w-lg flex-col gap-3">
    <Alert className="border-success/35 bg-success/10 text-success-ink">
      <CircleCheck />
      <AlertTitle>Validation passed</AlertTitle>
      <AlertDescription>
        Every path resolves inside the project and the Luau parses cleanly.
      </AlertDescription>
    </Alert>
    <Alert className="border-warning/35 bg-warning/10 text-warning-ink">
      <TriangleAlert />
      <AlertTitle>Leaderboard is still a stub</AlertTitle>
      <AlertDescription>
        The generated module returns an empty table — wire it to a
        DataStore before you publish.
      </AlertDescription>
    </Alert>
  </div>
);

export const BesideAction = () => (
  <Alert className="max-w-lg" variant="destructive">
    <TriangleAlert />
    <AlertTitle>Studio dropped the connection</AlertTitle>
    <AlertDescription>
      The plugin stopped polling 40 seconds ago. Re-pair to keep applying change
      sets.
    </AlertDescription>
    <AlertAction>
      <Button size="sm" variant="outline">
        Re-pair
      </Button>
    </AlertAction>
  </Alert>
);
