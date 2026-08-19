import { Alert, AlertTitle, AlertDescription } from "blockwright";
import { CircleAlert, Info } from "lucide-react";

export const Default = () => (
  <Alert className="max-w-lg">
    <AlertTitle>Change set 0f3a is ready</AlertTitle>
    <AlertDescription>
      Three files: a new CheckpointService, a rewrite of RespawnService, and a
      tag added to every BasePart under Course.
    </AlertDescription>
  </Alert>
);

export const Destructive = () => (
  <Alert variant="destructive" className="max-w-lg">
    <CircleAlert />
    <AlertTitle>Luau validation failed</AlertTitle>
    <AlertDescription>
      ShopService.server.lua:42 — &quot;then&quot; expected near
      &quot;player&quot;. The description takes the destructive ink at 90% so it
      stays subordinate to the title.
    </AlertDescription>
  </Alert>
);

export const MultipleParagraphs = () => (
  <Alert className="max-w-lg">
    <Info />
    <AlertTitle>Applying to Studio</AlertTitle>
    <AlertDescription>
      <p>
        Blockwright sends allowlisted commands to the plugin — it never sends
        code for Studio to execute.
      </p>
      <p>
        Every path in a change set is checked against the project root before the
        first command leaves the server.
      </p>
    </AlertDescription>
  </Alert>
);

export const Compact = () => (
  <Alert className="max-w-md">
    <AlertTitle>Nothing to apply</AlertTitle>
    <AlertDescription>
      Bloxburg Tycoon is already up to date in Studio.
    </AlertDescription>
  </Alert>
);
