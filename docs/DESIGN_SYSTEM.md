# Design system

All tokens live in `src/app/globals.css`. **Extend that file rather than
introducing ad-hoc colours, radii or shadows in components.** If you find
yourself writing a hex value or a one-off `shadow-[...]` in a component, the
token is missing — add it.

## Direction

Blockwright is a workshop, not a telemetry console. The deliberate departures
from the default "AI product" look:

- **Warm neutral axis (hue 75–85)**, not blue-tinted graphite (~265).
- **Ember accent**, not violet. It carries the forge/build metaphor and makes
  the product recognisable at a glance.
- **Depth by value, not by border.** Three surface tiers instead of stacking
  bordered cards on a flat page.
- **Restrained scale.** Display type tops out at ~2.75rem; there are no
  full-bleed gradient hero slabs.

## Colour

Defined in oklch so perceptual lightness stays consistent across themes.
Dark is the product default; light is fully supported.

### Surfaces

| Token | Role |
| ----- | ---- |
| `--background` | App canvas |
| `--surface-sunken` | Recessed areas: file tree, code panes, table headers |
| `--surface` | Panels, cards, the default raised plane |
| `--surface-raised` | Popovers, user message bubbles, floating controls |

Use `bg-surface`, `bg-surface-sunken`, `bg-surface-raised`.

### Semantic

| Token | Meaning | Do not use for |
| ----- | ------- | -------------- |
| `--ember` | Brand, primary action, active state, generation in progress | Errors |
| `--signal` | Roblox Studio connection, live/streaming state | Generic accents |
| `--success` | Completed step, passing validation, credit grant | Brand moments |
| `--warning` | Low credits, lint warnings | Hard failures |
| `--danger` | Errors, destructive actions | Anything recoverable |

Reference as `text-[var(--ember)]`, `border-[var(--signal)]/35`, etc.

### Borders

`--border` for real edges, `--hairline` (via `.hairline` or `border-hairline`)
for internal dividers inside a panel. Two weights, not one — a panel edge and a
row separator should not read the same.

## Typography

| Family | Variable | Use |
| ------ | -------- | --- |
| Space Grotesk | `font-display` | h1–h4, stat values. Applied automatically to headings. |
| Geist Sans | `font-sans` | Body, UI |
| Geist Mono | `font-mono` | Code, metadata, counts, pairing codes, timestamps |

Headings carry `letter-spacing: -0.022em` and `text-wrap: balance` from base
styles — do not re-apply per component.

### Scale

| Use | Size |
| --- | ---- |
| Hero | `text-[2.5rem]` → `sm:text-6xl` |
| Section heading | `text-3xl` → `sm:text-[2.5rem]` |
| Page title | `text-2xl` |
| Card title | `text-[0.9375rem]` |
| Body | `text-sm` / `text-[0.875rem]` |
| Secondary | `text-[0.8125rem]` |
| Dense UI | `text-[0.75rem]` |
| Metadata | `text-[0.625rem]` mono |

**`.label-meta`** is the standard eyebrow: mono, uppercase, `0.6875rem`,
`tracking-[0.14em]`, muted. Use it for every section label and stat caption
rather than hand-rolling one.

Numbers that change (credits, tokens, counts) always get `tabular-nums`.

## Spacing

4px base. Prefer `2 · 2.5 · 3 · 4 · 5 · 6 · 8 · 10 · 12` — enough steps to be
expressive, few enough to stay consistent.

| Context | Padding |
| ------- | ------- |
| Page body | `px-4 py-7` → `md:px-8 md:py-9`, `max-w-6xl` |
| Card | `p-5` (compact) / `p-6` (standard) |
| Dense panel row | `px-2.5 py-1.5` |
| Marketing section | `py-20` → `sm:py-24` |
| Conversation column | `max-w-3xl` |

## Radii

`--radius: 0.625rem` drives the scale. In practice:

- `rounded-md` — dense controls, inline chips
- `rounded-lg` — buttons, inputs, list rows, panel rows
- `rounded-xl` — cards, dialogs, major panels
- `rounded-full` — status dots, avatars, pills

## Elevation

| Shadow | Use |
| ------ | --- |
| `--shadow-flat` | Barely-raised surfaces |
| `--shadow-raised` | Cards on hover, auth card |
| `--shadow-overlay` | Dialogs, popovers, mobile sheets |
| `--shadow-ember` | Focus/active brand emphasis |

Never combine a shadow with a heavy border. One or the other.

## Components

### Buttons

| Variant | Use |
| ------- | --- |
| `default` | The single primary action on a surface |
| `outline` | Secondary |
| `ghost` | Tertiary, toolbars |
| `destructive` | Delete, disconnect |
| `link` | Inline |

**Navigation uses `<LinkButton href>`, never `<Button render={<Link/>}>`.**
Base UI's Button asserts native button semantics; forcing an anchor through it
breaks Enter/Space handling and announces the wrong role.

### Status

`<StatusDot tone>` is the *only* status indicator. Tones: `live` (signal),
`active` (success), `working` (ember), `idle` (muted), `error` (danger).
Add `pulse` for genuinely live state only.

### Messages

- User: right-aligned, `bg-surface-raised`, `rounded-xl rounded-br-sm`, max 85%.
- Assistant: full width, no bubble. The response is the page, not a card.
- Tool calls: single-line rows, expandable. Default view is "what happened";
  JSON is one click away.

### Empty states

Always `<EmptyState>`: dot-grid background, bordered-dashed container, icon,
title, one sentence, and **an action**. An empty state names the next step; it
does not apologise.

## Imagery and brand assets

All artwork is third-party and properly licensed, inlined as SVG. Nothing is
hot-linked, so no asset can fail to load or shift layout, and there is no
runtime image request on the critical path.

| Asset | Source | Licence | Used by |
| ----- | ------ | ------- | ------- |
| AI provider logos | [`@lobehub/icons`](https://icons.lobehub.com) | MIT | `components/brand/provider-mark.tsx` |
| Game genre icons | [Game-icons.net](https://game-icons.net) via `react-icons/gi` | CC BY 3.0 | `components/marketing/template-art.tsx` |
| UI icons | [Lucide](https://lucide.dev) | ISC | everywhere |

**Attribution is required for CC BY 3.0** and is rendered in the marketing
footer. Do not remove it.

Provider logos are trademarks of their owners and are shown solely to identify
which company makes a given model. Two providers (Poolside, Dots Studio) are not
in the icon set and fall back to a lettermark rather than borrowing another
brand's shape.

### Adding a provider logo

Add the brand to `lib/brand/providers.ts`, then map it to the icon component in
`provider-mark.tsx`. If the icon set does not carry it, leave it unmapped — the
lettermark fallback is deliberate, and inventing a logo is not an option.

### Template art

`TemplateArt` composes a genre icon over a two-stop gradient taken from the
template's own `accent`. To add a template, pick a real Game Icons glyph, add it
to `ArtIcon` and to the `ICONS` map. Never substitute a photo: stock photography
tested poorly here — it was generic, inconsistent in mood, and frequently
mismatched to the genre.

## Motion

| Animation | Duration | Use |
| --------- | -------- | --- |
| `animate-rise` | 400ms | New content entering a list or stream |
| `animate-pop` | 280ms | Menus, toasts, badges appearing under the cursor |
| `animate-slide-in` | 300ms | Rows arriving in the generation rail |
| `animate-tick` | 500ms | A number changing value |
| `animate-breathe` | 2.2s loop | The *active* generation step only |
| `animate-sweep` | 1.6s loop | Working indicator on the status rail |
| `animate-caret` | 1.1s loop | Streaming cursor |
| `animate-drift` | 22s loop | Ambient hero glow only |
| `.lift` | 200ms | Cards that raise on hover |
| `.stagger` | 45ms/child | Sequential list reveal (set `--i`) |

Two easing tokens, and only two: `--ease-enter` for arrivals, `--ease-exit` for
departures. Exits are faster than entrances — leaving should feel immediate,
arriving should feel settled.

Rules:

- Motion communicates state change. If it does not, remove it.
- Never animate anything larger than a panel.
- `prefers-reduced-motion: reduce` is honoured globally in `globals.css`; any
  JS-driven animation must check it too (see `WorkspacePreview`).

## Accessibility

- Focus is always visible. Use `.focus-ember` on custom interactive elements;
  shadcn primitives already handle it.
- Every icon-only control has an `aria-label`.
- Toggles use `aria-pressed`; menu options use `role="menuitemradio"` with
  `aria-checked`.
- Live regions: `role="status" aria-live="polite"` on the generation rail.
- Body text sits at or above 4.5:1 in both themes; `--muted-foreground` is
  tuned for this and should not be dimmed further.
- Never rely on colour alone — status dots are paired with text, diagnostics
  with severity labels.

## Responsive

Deliberate layout changes, not a shrunk desktop:

| Breakpoint | Behaviour |
| ---------- | --------- |
| `< 768` | Bottom tab bar (a different component, not the rail). Workspace side panels become full-height overlay sheets. |
| `768–1279` | Icon-only sidebar rail. Workspace: conversation + code panel. |
| `1280–1535` | Sidebar with labels. Workspace: file tree + conversation. |
| `≥ 1536` | All three workspace columns. |

The conversation column always owns the available width; panels yield first.
