/**
 * The workspace's material vocabulary, in one place.
 *
 * Every class string here composes `globals.css` primitives — `.plate`,
 * `.mount`, `.brick`, `.stud-plate` — and adds nothing new. It exists so the
 * eleven components that make up this surface cannot drift into eleven
 * slightly different mouldings; if a part's lift or radius needs to change, it
 * changes once.
 *
 * Read `docs/DESIGN_SYSTEM.md` § Material before editing any of it.
 */

/**
 * Token remapping for everything inside the workspace plate.
 *
 * `.plate` already remaps the semantic palette, but it maps `--surface` to the
 * *raised* moulding tone. That is right for a marketing hero, where a mount
 * carries one line of cream text, and wrong for a workspace, where the same
 * mounts carry ember, signal, success and danger text at 12px. On
 * `--plate-raised` those land between 2.8:1 and 4.4:1; on `--plate-deep` the
 * worst of them is 6.2:1.
 *
 * So inside the workspace a mount is a *recessed* well seated into the plate —
 * which is also the more honest reading of the material, since Roblox's own
 * Inlet surface is the plate pressed in. Raised tones stay available as
 * `--surface-raised` for parts that only ever hold ink: nameplates, user
 * messages, selected rows.
 *
 * These must sit on a child of `.plate`, not on the same element: `.plate` is
 * an unlayered rule and would win the cascade against a Tailwind utility.
 */
export const PLATE_TOKENS = [
  "[--surface:var(--plate-deep)]",
  "[--surface-sunken:color-mix(in_oklch,var(--plate-deep)_74%,black)]",
  "[--muted:color-mix(in_oklch,var(--plate-deep)_74%,black)]",
  "[--accent:var(--plate-raised)]",
  "[--accent-foreground:var(--plate-ink)]",
  "[--card:var(--plate-deep)]",
  "[--card-foreground:var(--plate-ink)]",
  "[--popover:var(--plate-raised)]",
  "[--popover-foreground:var(--plate-ink)]",
  "[--input:var(--plate-raised)]",
  "[--primary:var(--plate-ember)]",
  "[--primary-foreground:var(--ember-ink)]",
  "[--secondary:var(--plate-raised)]",
  "[--secondary-foreground:var(--plate-ink)]",
  "[--sidebar:var(--plate-deep)]",
  // `.plate` remaps `--success-ink` but not the other two, and the plate holds
  // one colour in both themes while the inks are tuned per theme — so in the
  // light theme a "running low on credits" chip lands dark-yellow on dark
  // plastic at 1.6:1. Re-derived here from the fill and the plate's own ink so
  // the hue survives and the contrast does too, in both themes.
  "[--warning-ink:color-mix(in_oklch,var(--warning)_50%,var(--plate-ink))]",
  "[--danger-ink:color-mix(in_oklch,var(--danger)_50%,var(--plate-ink))]",
  // Same problem, same fix, for the diff. The plate is dark in the light theme
  // and `--diff-add-ink` is a dark green there, which would put a diff on this
  // surface at roughly 1.5:1. Re-derived from the semantic fills so the
  // green/red convention survives without inventing a colour.
  "[--diff-add-ink:color-mix(in_oklch,var(--success)_58%,var(--plate-ink))]",
  "[--diff-remove-ink:color-mix(in_oklch,var(--danger)_50%,var(--plate-ink))]",
  "[--diff-add-bg:color-mix(in_oklch,var(--success)_13%,transparent)]",
  "[--diff-add-strong:color-mix(in_oklch,var(--success)_28%,transparent)]",
  "[--diff-remove-bg:color-mix(in_oklch,var(--danger)_16%,transparent)]",
  "[--diff-remove-strong:color-mix(in_oklch,var(--danger)_34%,transparent)]",
  "[--editor-active-line:color-mix(in_oklch,var(--plate-ink)_6%,transparent)]",
].join(" ");

/** A panel seated into the plate. Opaque, so the studs beneath are occluded. */
export const PANEL = "mount overflow-hidden rounded-xl";

/**
 * Small chrome — icon buttons, toggles, nameplates rendered as pressable
 * parts. A shallower lift than a primary action so the header does not read as
 * a row of equal-weight buttons.
 */
export const PART =
  "brick rounded-lg [--brick-face:var(--plate-raised)] [--lift:3px] text-foreground";

/** The same part, sized for an icon and thumb-safe on a touch device. */
export const PART_ICON = `${PART} tap-target flex size-8 items-center justify-center`;

/** A part whose face is a semantic colour, so its label must be dark ink. */
export const PART_INK = "text-[var(--ember-ink)]";
