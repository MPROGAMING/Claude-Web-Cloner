import { Separator, StatusDot, Badge, Button } from "blockwright";

export const Horizontal = () => (
  <div className="flex max-w-sm flex-col gap-3 rounded-lg border border-border bg-surface p-3">
    <p className="text-[0.9375rem] font-semibold">Bloxburg Tycoon</p>
    <Separator />
    <p className="text-sm text-muted-foreground">
      Nine Luau scripts across ServerScriptService and ReplicatedStorage.
    </p>
    <Separator />
    <div className="flex items-center gap-2 text-[0.8125rem]">
      <StatusDot tone="live" />
      Studio connected
    </div>
  </div>
);

export const Vertical = () => (
  <div className="flex h-8 max-w-sm items-center gap-3 text-[0.8125rem] text-muted-foreground">
    <span>9 scripts</span>
    <Separator orientation="vertical" />
    <span>3 unapplied</span>
    <Separator orientation="vertical" />
    <span>Updated yesterday</span>
  </div>
);

export const InAToolbar = () => (
  <div className="flex h-9 max-w-md items-center gap-1 rounded-lg border border-border bg-surface px-1.5">
    <Button size="sm" variant="ghost">Chat</Button>
    <Button size="sm" variant="ghost">Code</Button>
    <Separator orientation="vertical" className="mx-1" />
    <Button size="sm" variant="ghost">Blueprint</Button>
    <Separator orientation="vertical" className="mx-1" />
    <Badge variant="outline" className="ml-auto">Pro</Badge>
  </div>
);

export const HairlineVariant = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <p className="label-meta">Default border</p>
    <Separator />
    <p className="label-meta">Hairline — survives both themes</p>
    <Separator className="hairline" />
  </div>
);
