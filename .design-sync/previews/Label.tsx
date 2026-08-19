import { Input, Label, Switch, Textarea } from "blockwright";

// A Label with nothing to label is just text, so every cell is a real field
// row. Label is itself `flex items-center gap-2`, which is what lets it hold a
// control (the switch row) rather than only sit above one.
export const WithInput = () => (
  <div className="max-w-xs space-y-1.5">
    <Label htmlFor="label-name">Display name</Label>
    <Input id="label-name" name="displayName" defaultValue="builderman" maxLength={60} />
  </div>
);

export const WithTextarea = () => (
  <div className="max-w-md space-y-1.5">
    <Label htmlFor="label-description">Description</Label>
    <Textarea
      id="label-description"
      rows={3}
      defaultValue="Sword fight arena with 90 second rounds and a shop between them."
    />
  </div>
);

// htmlFor targets the switch's hidden input — Base UI puts the id there — so
// the label text is a hit target for the toggle.
export const WithSwitch = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Label htmlFor="label-autoapply">
      <Switch id="label-autoapply" defaultChecked />
      Apply changes automatically
    </Label>
    <Label htmlFor="label-validate">
      <Switch id="label-validate" defaultChecked />
      Validate Luau before syncing
    </Label>
    <Label htmlFor="label-notify">
      <Switch id="label-notify" />
      Email me when a build finishes
    </Label>
  </div>
);

export const WithHint = () => (
  <div className="max-w-xs space-y-1.5">
    <Label htmlFor="label-place">
      Roblox place ID
      <span className="text-xs font-normal text-muted-foreground">Optional</span>
    </Label>
    <Input id="label-place" defaultValue={108872401} className="tabular-nums" />
    <p className="text-xs text-muted-foreground">
      Found in the URL of your place on roblox.com.
    </p>
  </div>
);

// Label dims itself from its field wrapper — `group-data-[disabled=true]` on a
// `group` ancestor — so a disabled row reads as one unit rather than a bright
// label over a greyed control.
export const DisabledField = () => (
  <div className="group max-w-xs space-y-1.5" data-disabled="true">
    <Label htmlFor="label-key">Open Cloud API key</Label>
    <Input id="label-key" type="password" defaultValue="rbxapi-9f42c1" disabled />
    <p className="text-xs text-muted-foreground">
      Connect Roblox Studio to manage keys.
    </p>
  </div>
);
