import { Toaster, Button } from "blockwright";

// Toaster is the sonner mount point: it renders nothing until a toast is fired,
// and a static capture cannot fire one. Rather than hand-write a lookalike toast
// — which would be a drawing of a component instead of the component — these
// cells show the real mount alongside the controls that trigger it. The card is
// honest about the limitation; see .design-sync/NOTES.md.
export const TheMount = () => (
  <div className="flex max-w-md flex-col gap-3 rounded-lg border border-border bg-surface p-4">
    <p className="text-[0.9375rem] font-semibold">Toaster</p>
    <p className="text-sm text-muted-foreground">
      Mount once near the root. Toasts are fired imperatively with{" "}
      <code className="code-type rounded bg-surface-sunken px-1 py-0.5">toast()</code> from
      sonner, so nothing renders here until something calls it.
    </p>
    <div className="flex gap-2">
      <Button size="sm" variant="outline">Apply to Studio</Button>
      <Button size="sm" variant="ghost">Copy Luau</Button>
    </div>
    <Toaster />
  </div>
);

export const WhereItGoes = () => (
  <div className="flex max-w-md flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-4">
    <span className="label-meta">src/app/layout.tsx</span>
    <pre className="code-type overflow-hidden text-muted-foreground">
{`<ThemeProvider>
  {children}
  <Toaster />
</ThemeProvider>`}
    </pre>
    <Toaster />
  </div>
);
