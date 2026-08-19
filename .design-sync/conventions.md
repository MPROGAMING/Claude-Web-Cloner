# Building with Blockwright

Blockwright is an AI build partner for Roblox creators: you describe a mechanic,
it writes real Luau into a structured project and applies it into Roblox Studio.
The design language is dark-first, dense, and warm — an ember-orange brand
against near-black surfaces, with a display face (Archivo, run wide) doing the
talking on headings.

## Wrapping and setup

**Every screen must sit inside `.dark`.** The library is dark-first: dark is set
by default in the app, and the dark palette is defined as `&:is(.dark *)`, so
without a `.dark` ancestor in the DOM every component silently renders the light
palette. Put it on your outermost element together with an explicit background:

```jsx
<div className="dark bg-background text-foreground font-sans min-h-screen">
  {/* your screen */}
</div>
```

`bg-background`/`text-foreground` are not optional decoration — `--background`
and `--foreground` are redefined under `.dark`, so an element outside that
subtree, or one that paints no background, inherits the wrong ground.

**Wrap anything using `Tooltip` in `TooltipProvider`.** Tooltip parts read their
provider from context and render nothing without it. One provider near the root
is enough:

```jsx
<TooltipProvider delay={200}>{children}</TooltipProvider>
```

## Styling idiom: Tailwind utilities over a closed token palette

Style with Tailwind utility classes. Layout, spacing and type are open — use the
normal scale. **Colour is closed**: use the token names below and nothing else.
No hex values, no `oklch()` literals, no `slate-800`, no invented tokens.

### Surfaces — the depth vocabulary

| Class | Role |
| --- | --- |
| `bg-background` | The app canvas |
| `bg-surface-sunken` | Recessed: file trees, code panes, table headers |
| `bg-surface` | Panels, cards, the default raised plane |
| `bg-surface-raised` | Popovers, user message bubbles, floating controls |
| `bg-card`, `bg-popover` | What `Card` and popover surfaces already use |
| `bg-muted`, `bg-accent`, `bg-secondary` | Quiet fills, hover states |

### Semantic colour — each one means a specific thing

| Class | Means | Never use for |
| --- | --- | --- |
| `text-ember` / `bg-ember` | Brand, primary action, active state, generation in progress | Errors |
| `text-signal` / `bg-signal` | Roblox Studio connection, live and streaming state | Generic accents |
| `text-success` / `bg-success` | Completed step, passing validation, credit grant | Brand moments |
| `text-warning` / `bg-warning` | Low credits, lint warnings | Hard failures |
| `text-danger` / `bg-danger` | Errors, destructive actions | Anything recoverable |

Also available: `text-muted-foreground` (secondary text), `text-primary`,
`bg-ember-soft`, `border-ember`, `border-signal`, `border-border`, `border-input`.

### The ink rule — the one colour mistake that ships broken

`--ember`, `--success`, `--warning` and `--danger` are tuned to read against the
**page**. Put one on a 10% wash of itself — the badge pattern — and contrast
drops to 2.5–3.4:1. **Text on a tint uses the ink; the fill keeps the base
token.** Never one class for both.

```jsx
{/* right */}
<span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-ink">
  Low credits
</span>

{/* wrong — unreadable in light theme */}
<span className="bg-warning/10 text-warning">Low credits</span>
```

Inks: `text-ember-ink` (also the foreground for a solid `bg-ember` fill),
`text-success-ink`, `text-warning-ink`, `text-danger-ink`.

### Opacity modifiers: use the token name, never `var()`

Tailwind v4 cannot apply an alpha modifier to an arbitrary `var()`, and the class
is dropped **with no error** — the rule is simply never emitted.

```
bg-signal/6   border-ember/35   bg-warning/10     ← works
bg-[var(--signal)]/6            ← silently renders nothing
```

### Type

`font-sans` (Figtree) for body, `font-display` (Archivo, wide axis) for headings,
`font-mono` (Geist Mono) for code and meta. Display headings are tight:
`text-3xl font-bold leading-[1.03] tracking-[-0.03em] sm:text-[2.75rem]` is the
house setting for a section title.

### Named patterns worth reaching for

`label-meta` (mono uppercase eyebrow) · `hairline` (theme-safe rule) ·
`bg-blueprint` and `bg-dotgrid` (grid backgrounds behind heroes and empty
states) · `focus-ember` (focus ring for interactive non-`<button>` elements) ·
`code-type` (**the** metric for anything painting code — one class for every
layer) · `lift` (card hover) · `stagger` (list reveal; set `--i` per child) ·
`tap-target` / `tap-row` (thumb-sized floor on coarse pointers only) ·
`mask-fade-b` / `mask-fade-r` · radii `rounded-lg` → `rounded-3xl` · shadows
`shadow-flat`, `shadow-raised`, `shadow-overlay`, `shadow-ember`.

## Rules the library enforces

- **Navigation uses `LinkButton href`, never `Button` rendering a link.** The
  underlying Button asserts native button semantics; forcing an anchor through it
  breaks Enter/Space and announces the wrong role. `LinkButton` carries the same
  `variant`/`size` vocabulary.
- **`Button` variants have fixed meanings**: `default` is the single primary
  action on a surface; `outline` secondary; `ghost` tertiary and toolbars;
  `destructive` delete/disconnect; `link` inline. Sizes run
  `xs, sm, default, lg` plus `icon`, `icon-xs`, `icon-sm`, `icon-lg`.
- **`StatusDot` is the only status indicator.** Tones: `live` (Studio
  connected/streaming), `active` (done, passing), `working` (in progress),
  `idle`, `error`. Add `pulse` only for genuinely live state. It is 8px — always
  pair it with the label it qualifies.
- **Controls are deliberately dense** — 32px default button height, which is
  right for a mouse. The criterion is the pointer, not the viewport: add
  `tap-target` or `tap-row` where a thumb needs a 44px floor.
- **Assistant responses are not cards.** User messages are right-aligned bubbles
  (`bg-surface-raised`, `rounded-xl rounded-br-sm`, max 85% width); the
  assistant's reply is full width with no bubble — the response is the page.
- **Empty states name the next step.** Dot-grid background, dashed border, icon,
  title, one sentence, and an action. They do not apologise.

## Where the truth lives

- `_ds/<folder>/styles.css` and the files it imports — the complete compiled
  palette, every token and every utility that actually exists. Read it before
  inventing a class name.
- `guidelines/docs/DESIGN_SYSTEM.md` — the full design system: colour rationale,
  the type scale, spacing, motion vocabulary and easings, accessibility and
  responsive rules. The authority when this summary is not specific enough.
- `guidelines/docs/PRODUCT_SPEC.md` — what the product is, for realistic copy.
- `components/<group>/<Name>/<Name>.d.ts` and `<Name>.prompt.md` — the real prop
  contract and usage notes per component.

## An idiomatic screen

```jsx
<div className="dark bg-background text-foreground font-sans min-h-screen">
  <TooltipProvider delay={200}>
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <SectionHeading
        align="left"
        eyebrow="Projects"
        title="Pick up where you left off"
        description="Every project keeps its Luau, its blueprint and its Studio link."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StatusDot tone="live" pulse />
              Bloxburg Tycoon
            </CardTitle>
            <CardDescription>Synced to Studio 4 minutes ago</CardDescription>
            <CardAction>
              <Badge variant="outline">Live</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nine Luau scripts across ServerScriptService and ReplicatedStorage.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm">Open in Studio</Button>
            <Button size="sm" variant="ghost">Duplicate</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  </TooltipProvider>
</div>
```
