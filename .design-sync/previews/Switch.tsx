import { Label, Switch } from "blockwright";

// Uncontrolled `defaultChecked` throughout: a card is rendered once with no
// interaction, and a controlled `checked` with no onCheckedChange would freeze
// and warn. Both states matter here — the thumb travel and the primary fill are
// the whole component.
export const OnAndOff = () => (
  <div className="flex items-center gap-4">
    <Switch defaultChecked aria-label="Apply changes automatically" />
    <Switch aria-label="Email me when a build finishes" />
  </div>
);

export const Sizes = () => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <Switch size="sm" defaultChecked aria-label="Small, on" />
      <Switch size="sm" aria-label="Small, off" />
      <span className="text-xs text-muted-foreground">sm — dense panel rows</span>
    </div>
    <div className="flex items-center gap-3">
      <Switch defaultChecked aria-label="Default, on" />
      <Switch aria-label="Default, off" />
      <span className="text-xs text-muted-foreground">default — settings forms</span>
    </div>
  </div>
);

export const Disabled = () => (
  <div className="flex items-center gap-4">
    <Switch defaultChecked disabled aria-label="Locked on" />
    <Switch disabled aria-label="Locked off" />
  </div>
);

export const SettingsRow = () => (
  <div className="flex max-w-md items-start justify-between gap-6 rounded-lg border border-border bg-surface px-4 py-3">
    <div>
      <Label htmlFor="switch-autoapply">Apply changes automatically</Label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Write approved change sets straight into Studio instead of waiting for a
        review.
      </p>
    </div>
    <Switch id="switch-autoapply" defaultChecked className="mt-0.5" />
  </div>
);

export const SettingsPanel = () => (
  <div className="max-w-xl rounded-xl border border-border bg-surface p-6">
    <h2 className="text-sm font-semibold">Studio sync</h2>

    <div className="mt-4 flex flex-col">
      {[
        {
          id: "panel-auto",
          title: "Apply changes automatically",
          hint: "Skip the review step for change sets that validate cleanly.",
          on: true,
        },
        {
          id: "panel-validate",
          title: "Validate Luau before syncing",
          hint: "Refuse to send a script that does not parse.",
          on: true,
        },
        {
          id: "panel-backup",
          title: "Keep a file version on every apply",
          hint: "Full history stays available under the project's files.",
          on: false,
        },
      ].map((row, index) => (
        <div
          key={row.id}
          className={`flex items-start justify-between gap-6 py-3.5 ${
            index > 0 ? "border-t border-hairline" : ""
          }`}
        >
          <div>
            <Label htmlFor={row.id}>{row.title}</Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.hint}</p>
          </div>
          <Switch id={row.id} defaultChecked={row.on} className="mt-0.5" />
        </div>
      ))}
    </div>
  </div>
);
