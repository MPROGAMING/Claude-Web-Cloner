import {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertAction,
  Button,
} from "blockwright";
import { CircleAlert, Info, TriangleAlert, PlugZap } from "lucide-react";

export const Variants = () => (
  <div className="flex max-w-lg flex-col gap-3">
    <Alert>
      <AlertTitle>Change set applied</AlertTitle>
      <AlertDescription>
        RoundTimer.server.lua and ShopService.server.lua are now in your Studio
        place.
      </AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <AlertTitle>Luau validation failed</AlertTitle>
      <AlertDescription>
        ShopService.server.lua:42 — &quot;then&quot; expected near
        &quot;player&quot;. Nothing was written to the project.
      </AlertDescription>
    </Alert>
  </div>
);

export const WithIcon = () => (
  <div className="flex max-w-lg flex-col gap-3">
    <Alert>
      <Info />
      <AlertTitle>Blueprint saved as a draft</AlertTitle>
      <AlertDescription>
        Answer the last two questions and the agent will start writing scripts.
      </AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>Studio not connected</AlertTitle>
      <AlertDescription>
        Open the Blockwright plugin in Roblox Studio and enter the pairing code
        to apply this change set.
      </AlertDescription>
    </Alert>
  </div>
);

export const SemanticTones = () => (
  <div className="flex max-w-lg flex-col gap-3">
    <Alert className="border-warning/35 bg-warning/10 text-warning-ink">
      <TriangleAlert />
      <AlertTitle>Running low on credits</AlertTitle>
      <AlertDescription>
        420 credits left. Generations stop once your balance cannot cover a
        request.
      </AlertDescription>
    </Alert>
    <Alert className="border-signal/35 bg-signal/10 text-signal">
      <PlugZap />
      <AlertTitle>Studio bridge is live</AlertTitle>
      <AlertDescription>
        Paired to Bloxburg Tycoon.rbxl — commands apply as soon as you approve
        them.
      </AlertDescription>
    </Alert>
  </div>
);

export const WithAction = () => (
  <Alert className="max-w-lg">
    <TriangleAlert />
    <AlertTitle>2 scripts were skipped</AlertTitle>
    <AlertDescription>
      LeaderboardService.lua and Items.module.lua sit outside the project root,
      so they were left untouched.
    </AlertDescription>
    <AlertAction>
      <Button size="sm" variant="outline">
        Review
      </Button>
    </AlertAction>
  </Alert>
);
