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

### Inks

`--success-ink`, `--warning-ink`, `--danger-ink` are for **text sitting on a
tint of its own colour** — the badge pattern, `bg-[var(--warning)]/10` with a
label inside it.

The base tokens are tuned to read against the page. On a 10% wash of themselves
they fall to 2.5–3.4:1, which is how a yellow "low credits" badge shipped
unreadable in the light theme. Use the ink for the text and the base token for
the fill and border; never one for both.

### Diff

`--diff-add-bg` / `--diff-add-strong` / `--diff-add-ink` and the `remove`
equivalents. Derived from `--success` and `--danger` but named separately,
because a removed line is not an error — a future change to the error red must
not repaint the diff. `-strong` is the intra-line emphasis, painted as a
background layer *behind* the syntax colour so the two never fight over the same
text.

`--editor-active-line` is a value shift, not a colour, so it does not compete
with a diff tint or a diagnostic row in the same gutter. `--code-line` is the
editor's line-box height; the gutter, the row tints and the highlighted code are
three separate stacks that must agree to the pixel.

### Borders

`--border` for real edges, `--hairline` (via `.hairline` or `border-hairline`)
for internal dividers inside a panel. Two weights, not one — a panel edge and a
row separator should not read the same.

## Typography

| Family | Variable | Use |
| ------ | -------- | --- |
| Archivo (`wdth` axis, `font-stretch: 118%`) | `font-display` | h1–h4, stat values. Applied automatically to headings. |
| Figtree | `font-sans` | Body, UI |
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

## Material

Roblox surfaces are the one piece of visual vocabulary that is unmistakably
Roblox, so they are a **material** here, not a decoration. Everything below is
defined in `globals.css` under "The stud, as a material".

### The stud

**A stud is a rounded square, not a circle.** The earlier `bg-studs` used
`radial-gradient(circle …)`, which is exactly why the plate read as a dotted
background rather than as a surface. The geometry was measured off real Roblox
surface textures.

| Measure | Value | Why |
| ------- | ----- | --- |
| Lattice pitch | `--stud-pitch`, `30px` | One stud. Everything mounted on a plate measures in whole studs. |
| Stud footprint | ~5/8 of the pitch (19.6 of the tile's 32 units) | Studs sit apart; a wider stud reads as a grid, a narrower one as a dot. |
| Corner radius | ~0.27 × stud (5.2 units) | A moulded square corner, not a squircle and not a circle. |
| Bevel | a 2.4-unit **rim** stroke, not a broad dome | The edge catches the light; the top does not bulge. |
| Top face | flat, ~0.65 × stud, at 5% white | A moulded plastic face, barely lifted from its rim. |
| Cast shadow | offset down-right (+0.9, +1.8), 30% black | Places the stud on the plate rather than in it. |
| Light | always upper-left | One light source for the whole system. Never reverse it per component. |

**The tile carries no hue** — white and black at alpha only. It composites over
whatever `background-color` sits beneath, so one definition serves every plate
colour in both themes, and it stays crisp at any zoom because it is geometry,
not a bitmap.

### Two surfaces, inherited not invented

Roblox ships two surface types: **`Studs`** (raised) and **`Inlet`** (recessed).
They are the same lattice inverted, which hands the design system a rest/pressed
pair rather than requiring one to be invented.

| Class | Surface |
| ----- | ------- |
| `.stud-plate` | `Studs` — raised. The resting surface. |
| `.stud-plate-inlet` | `Inlet` — recessed. The same lattice pressed in. |
| `.bg-studs` | Compatibility alias for `.stud-plate`. Retained while existing markup migrates; **new work uses `.stud-plate`**. |

A plate is a surface, not a colour: set its colour with any background utility
and the studs composite on top.

### The three verbs

| Verb | API | Behaviour |
| ---- | --- | --------- |
| **Press** | `.brick` + `:active` / `[data-pressed="true"]` | A moulded part with real travel. It gets *shorter* — never just darker. |
| **Snap** | `.land` + `@keyframes stud-land` | Parts land with a one-eighth-stud overshoot and settle. They do not fade in. Stagger with `--i`. |
| **Mount** | `.mount` | Seated onto a plate: opaque, so the studs beneath are occluded, with a hard 2px base proving contact. |

`.brick` takes `--brick-face` (defaults to `--ember`) and derives its side wall
from it; `--lift` is the part's thickness, `5px` by default.

**Thickness is two shadows, and the pair is the point.** A hard, zero-blur
extruded side wall *plus* a separate blurred contact shadow. One blurred shadow
on its own reads as a floating div; the pair reads as plastic sitting on
something.

### Rules

- Measure in whole studs. If a mounted element's height is not a multiple of
  `--stud-pitch`, it is fighting the lattice.
- A plate is a surface. Do not use it as a texture behind unrelated content, and
  do not tint the tile — tint the plate.
- Anything mounted on a plate is opaque. Translucency over studs reads as a
  print, not as a part.
- Press is travel. A colour change alone is not a press.
- Under `prefers-reduced-motion: reduce` the travel and the landing go, **the
  bevel stays**. The material is still physical when it is still.

### The plate, and type moulded out of it

`.hero-plate` (`globals.css`) is a plate large enough to stand a page on. It
holds **one colour in both themes** — `--plate` and friends live on `:root`, not
in a theme block — because a landing hero is a physical object photographed on
the page, and re-tuning six moulding tones per theme yields two materials rather
than one. The page around it still follows the theme, so the plate starts below
the shared header: the nav keeps the page's tokens and the plate keeps its own.

Inside the plate every semantic token is remapped once (`--surface`,
`--foreground`, `--ember`, `--border`, …), so `.brick`, `.mount` and plain
Tailwind utilities pick up plate tones without any component knowing the plate
exists. Two things that bite:

- `--plate-ink` / `--plate-ink-mute` are separate tokens for the reason
  `--success-ink` is: `--muted-foreground` is tuned against `--background` and
  lands near 4:1 on this plate.
- The rule sets `color:` explicitly as well as `--foreground`. `color` is
  inherited from `<body>`, which resolved it long before the plate remapped the
  token, so a variable override alone leaves untokenised text painted in page
  ink — near-black on a dark plate in the light theme.

`.brick-type` is display type moulded out of the same lattice: a `::before`
reading `data-text` paints the extruded wall, and `.brick-type__face` paints the
lit top face with `--studs-raised` clipped to the glyph. The stud pitch is in
`em`, so a wordmark and a headline are one moulding at two distances. Always
compose it through `<BrickText>` — the face and the extrusion read the same
string from two places, and only the component keeps them from drifting.

The face is knocked out with `-webkit-text-fill-color`, **never**
`color: transparent`: the colour property stays at the tone the face actually
paints, so `npm run a11y` measures the visible letterform instead of reading
1:1 off a glyph it believes is invisible.

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

### Code surfaces

Everything that paints code carries `.code-type` — the editor's highlighted
layer, its transparent textarea, the gutter, and both sides of a diff. One class
for all of them, because the editor works by stacking layers over identical
text: any divergence in font, size, line height or ligature handling shows up
immediately as characters drifting out from under their own highlight.

- The editor is a textarea over a highlighted layer, not a dependency. See the
  note in `components/workspace/code-editor.tsx` for the measured trade.
- The diff shows changed lines paired with what they replaced, elides unchanged
  stretches, and marks the changed *tokens* within a changed line.
- Approval lives in the same frame as the diff. A change summary is enough to
  recognise a change set and not enough to consent to one.

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
| UI icons | [Lucide](https://lucide.dev) | ISC | everywhere |

Provider logos are trademarks of their owners and are shown solely to identify
which company makes a given model. Two providers (Poolside, Dots Studio) are not
in the icon set and fall back to a lettermark rather than borrowing another
brand's shape.

### Adding a provider logo

Add the brand to `lib/brand/providers.ts`, then map it to the icon component in
`provider-mark.tsx`. If the icon set does not carry it, leave it unmapped — the
lettermark fallback is deliberate, and inventing a logo is not an option.

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
| `animate-drift` | 22s loop | Slow ambient drift. Defined; the hero glow itself now uses `.animate-forge`. |
| `.lift` | 200ms | Cards that raise on hover |
| `.stagger` | 45ms/child | Sequential list reveal (set `--i`) |
| `.animate-forge` | 9s loop | The molten glow under the marketing hero, only |

Material motion — `.land`, `.brick` travel, `.stud-brick` — belongs to the
material and is documented under **Material** above.

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
