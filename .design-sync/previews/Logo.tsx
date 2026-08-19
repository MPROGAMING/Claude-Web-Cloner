import { Logo, Button, Badge } from "blockwright";

// The mark is generated from a single unit-cube projection so it stays crisp at
// 16px — worth showing across the sizes it actually ships at.
export const Sizes = () => (
  <div className="flex flex-col gap-5">
    <Logo className="[&_svg]:size-5 text-sm" />
    <Logo />
    <Logo className="[&_svg]:size-10 [&>span]:text-2xl" />
  </div>
);

export const MarkOnly = () => (
  <div className="flex items-center gap-6">
    <Logo showWordmark={false} />
    <Logo showWordmark={false} className="[&_svg]:size-10" />
    <Logo showWordmark={false} className="[&_svg]:size-4" />
  </div>
);

export const InAHeaderBar = () => (
  <div className="flex h-14 max-w-2xl items-center gap-4 rounded-xl border border-border bg-surface px-4">
    <Logo />
    <span className="ml-auto flex items-center gap-2">
      <Badge variant="outline">Pro</Badge>
      <Button size="sm" variant="ghost">Docs</Button>
      <Button size="sm">Open app</Button>
    </span>
  </div>
);

export const OnASunkenSurface = () => (
  <div className="flex max-w-md items-center justify-center rounded-xl bg-surface-sunken p-10">
    <Logo className="[&_svg]:size-9 [&>span]:text-xl" />
  </div>
);
