import {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertAction,
  Button,
} from "blockwright";
import { CircleAlert, TriangleAlert, X } from "lucide-react";

export const ButtonAction = () => (
  <Alert className="max-w-lg">
    <AlertTitle>Change set 0f3a is waiting</AlertTitle>
    <AlertDescription>
      Three files ready to apply to Bloxburg Tycoon.rbxl.
    </AlertDescription>
    <AlertAction>
      <Button size="sm">Apply</Button>
    </AlertAction>
  </Alert>
);

export const DismissAction = () => (
  <Alert className="max-w-lg">
    <TriangleAlert />
    <AlertTitle>Leaderboard is still a stub</AlertTitle>
    <AlertDescription>
      The generated module returns an empty table until you point it at a
      DataStore.
    </AlertDescription>
    <AlertAction>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss">
        <X />
      </Button>
    </AlertAction>
  </Alert>
);

export const OnDestructive = () => (
  <Alert variant="destructive" className="max-w-lg">
    <CircleAlert />
    <AlertTitle>Studio not connected</AlertTitle>
    <AlertDescription>
      The plugin stopped polling 40 seconds ago, so nothing can be applied right
      now.
    </AlertDescription>
    <AlertAction>
      <Button size="sm" variant="outline">
        Re-pair
      </Button>
    </AlertAction>
  </Alert>
);

export const OnTintedTone = () => (
  <Alert className="max-w-lg border-warning/35 bg-warning/10 text-warning-ink">
    <TriangleAlert />
    <AlertTitle>Running low on credits</AlertTitle>
    <AlertDescription>
      420 left. The action slot reserves its own gutter so the text never runs
      under the button.
    </AlertDescription>
    <AlertAction>
      <Button size="sm" variant="outline">
        Top up
      </Button>
    </AlertAction>
  </Alert>
);
