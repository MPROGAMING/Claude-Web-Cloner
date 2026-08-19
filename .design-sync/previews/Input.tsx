import { Button, Input, Label } from "blockwright";

// The field row is the real unit — src/components/app/settings-form.tsx pairs
// every Input with a Label in a `space-y-1.5` stack. Values are `defaultValue`
// so the inputs stay uncontrolled in a card that never receives an onChange.
const Field = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-xs space-y-1.5">{children}</div>
);

export const Placeholder = () => (
  <Field>
    <Label htmlFor="roblox-username">Roblox username (optional)</Label>
    <Input id="roblox-username" name="robloxUsername" placeholder="builderman" maxLength={30} />
  </Field>
);

export const Filled = () => (
  <Field>
    <Label htmlFor="project-name">Project name</Label>
    <Input id="project-name" name="name" defaultValue="Bloxburg Tycoon" maxLength={80} />
  </Field>
);

export const Disabled = () => (
  <Field>
    <Label htmlFor="account-email">Email</Label>
    <Input id="account-email" type="email" defaultValue="builder@blockwright.dev" disabled />
    <p className="text-xs text-muted-foreground">
      Sign-in email cannot be changed here.
    </p>
  </Field>
);

// aria-invalid is what paints the destructive border — the Input applies no
// validation of its own, so the calling form sets it alongside the message.
export const Invalid = () => (
  <Field>
    <Label htmlFor="place-id">Roblox place ID</Label>
    <Input id="place-id" name="placeId" defaultValue="1088-72a" aria-invalid />
    <p className="text-xs text-destructive">Place IDs are digits only.</p>
  </Field>
);

export const Types = () => (
  <div className="grid max-w-lg gap-4 sm:grid-cols-2">
    <div className="space-y-1.5">
      <Label htmlFor="types-place">Place ID</Label>
      <Input id="types-place" type="number" defaultValue={108872401} className="tabular-nums" />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="types-key">Open Cloud API key</Label>
      <Input id="types-key" type="password" defaultValue="rbxapi-9f42c1" />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="types-round">Round length (seconds)</Label>
      <Input id="types-round" type="number" defaultValue={90} className="tabular-nums" />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="types-search">Find a script</Label>
      <Input id="types-search" type="search" placeholder="RoundTimer.server.luau" />
    </div>
  </div>
);

// Ported from src/components/app/settings-form.tsx — the two-column field grid
// inside a bordered surface, with the action on a hairline-separated footer.
export const InProjectSettings = () => (
  <div className="max-w-xl rounded-xl border border-border bg-surface p-6">
    <h2 className="text-sm font-semibold">Project</h2>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="settings-name">Project name</Label>
        <Input id="settings-name" name="name" defaultValue="Bloxburg Tycoon" maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-place">Roblox place ID</Label>
        <Input
          id="settings-place"
          name="placeId"
          defaultValue={108872401}
          className="tabular-nums"
        />
      </div>
    </div>

    <div className="mt-6 flex justify-end border-t border-hairline pt-5">
      <Button type="submit">Save changes</Button>
    </div>
  </div>
);
