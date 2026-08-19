# design-sync notes — Blockwright

Repo-specific gotchas for syncing this design system to claude.ai/design.
Read this before re-running the sync.

## What this repo is, from the sync's point of view

Blockwright is a Next.js 16 application, **not** a published component library.
There is no `dist/`, no `.d.ts` tree, no Storybook, and `package.json` declares no
`main`/`module`/`exports`. Everything below exists because the converter's
package shape assumes a built, publishable package and this repo is neither.

## The pipeline

```sh
node .design-sync/prepare.mjs          # emits the stylesheet + the entry barrel
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry .design-sync/.cache/ds-entry.mjs --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

`prepare.mjs` is **not optional and must run first** — the converter has no way
to produce either of its outputs:

- **The stylesheet.** `src/app/globals.css` is a Tailwind v4 *source* file
  (`@import "tailwindcss"`), so pointing `cssEntry` at it ships an uncompiled
  sheet and every component renders unstyled. `prepare.mjs` compiles it through
  `@tailwindcss/postcss` into `.design-sync/.cache/ds-tailwind.css`.
- **The entry barrel.** With no `--entry`, `PKG_DIR` becomes
  `node_modules/blockwright`, which does not exist (npm won't self-install), and
  the build dies on a missing `package.json`. Passing a barrel *inside the repo*
  is what makes `PKG_DIR` walk up to the repo root.

## Scope: which components sync

`.design-sync/ds-scope.json` is the single source of truth, read by both
`prepare.mjs` (entry barrel) and `.design-sync/overrides/source-kit.mjs`
(discovery + enrichment). Currently `ui`, `brand`, `marketing`, `blueprint`.

`src/components/{app,auth,workspace}` are deliberately **excluded**: they import
server actions and Supabase, which transitively import `"server-only"` — a
module whose browser build throws at import time. The bundle is one IIFE, so one
such import throws before any component mounts and blanks *every* card. If you
widen the scope, check the new dir with:

```sh
grep -rln "server-only\|@/lib/supabase/server\|next/headers\|@/lib/actions\|@/lib/data" src/components/<dir>/
```

## Traps that cost real debugging time

- **`next/link` and `next/image` cannot be bundled.** They read
  `process.env.__NEXT_*` at module scope; in a browser IIFE with no `process`
  that is a `ReferenceError` before any component mounts. Symptom: all 118 cards
  fail with `process is not defined`. Fixed with browser-safe stand-ins in
  `.design-sync/shims/`, wired through `compilerOptions.paths` in
  `.design-sync/tsconfig.ds.json`. Removing Next's runtime also cut the bundle
  from 2557 KB to 2090 KB. **Any new `next/*` import inside the synced scope
  needs a shim** — nothing warns you, the whole bundle just goes dark.
- **Never put a `"//"` key in `tsconfig.ds.json`.** design-sync strips comments
  with a regex before `JSON.parse`, and that regex also eats a `"//"` *property
  name*. The parse then fails inside a `catch { return null }`, so the paths
  plugin silently resolves nothing — `@/*` included — with no error printed.
  Document that file in `/* */` block comments only.
- **Fonts are `next/font/google`, injected by `src/app/layout.tsx`.** The
  `--font-archivo` / `--font-figtree` / `--font-geist-mono` variables
  `globals.css` reads simply do not exist outside the Next runtime, so
  `--font-sans: var(--font-figtree)` resolves to nothing and every card renders
  in a browser default face. `prepare.mjs` restates them over a Google Fonts
  `@import`; `cfg.runtimeFontPrefixes` suppresses the resulting
  `[FONT_MISSING]`. Keep the families and axes in sync with `layout.tsx`.
- **Tailwind v4 skips hidden directories, so it never sees
  `.design-sync/previews/`.** An authored preview using any utility the app's own
  source does not already use rendered unstyled, silently, with nothing warning.
  `prepare.mjs` therefore compiles through a generated wrapper CSS that states
  `@source` for `src` and for `.design-sync/previews` explicitly, plus a
  `SAFELIST` of layout/type/token utilities via `@source inline(...)`. The
  safelist is load-bearing twice over: parallel authoring subagents cannot
  rebuild this sheet, and every class named in `conventions.md` has to exist in
  it. **Anything you add to `conventions.md` must be added to `SAFELIST` too** —
  otherwise the header promises the design agent a class the sheet does not have.
- **`bg-[var(--token)]/N` never compiles.** Tailwind v4 cannot apply an alpha
  modifier to an arbitrary `var()`, and the class is dropped with no error. Use
  the registered token form: `bg-signal/6`, `border-ember/35`. Note this affects
  the **app**, not just the sync: `src/components/workspace/studio-panel.tsx:161`
  and `src/components/blueprint/blueprint-view.tsx:233` both use the dead form, so
  those tinted panels render with no background and no border colour in
  production. `docs/DESIGN_SYSTEM.md` § Semantic also *documents* the dead form
  ("Reference as `text-[var(--ember)]`, `border-[var(--signal)]/35`") — that line
  is wrong and worth correcting at source.
- **`guidelinesGlob` must stay narrow.** The default globs swept all of `docs/`
  into the design agent's context, including `SESSION-PROGRESS.md`,
  `BENCHMARK-PROGRESS.md`, `OVERNIGHT-BUILD-REPORT.md` and
  `IMPLEMENTATION_STATUS.md` — engineering notes, not design guidance. Pinned to
  `DESIGN_SYSTEM.md` + `PRODUCT_SPEC.md`.

## The preview provider

`.design-sync/shims/ds-preview-root.tsx` is exposed to the bundle via
`cfg.extraEntries` and named in `cfg.provider`. It supplies three things a bare
preview card does not have, and every one of them was a visible defect first:

1. **`.dark`** — `src/components/theme-provider.tsx` sets `defaultTheme="dark"`,
   so dark *is* Blockwright's appearance, and `globals.css` builds its dark
   variant as `&:is(.dark *)` which needs a real `.dark` ancestor. Without it
   every card renders the light palette. The wrapper also paints
   `bg-background text-foreground` itself, because both tokens are redefined
   under `.dark` and the card's own body is outside that subtree.
2. **`TooltipProvider`** — `src/app/layout.tsx` wraps the whole tree in it and
   Base UI's Tooltip parts render nothing outside it.
3. **A `p-6` page gutter** — without it cards render flush to x=0 and
   left-aligned content clips (a left-aligned `SectionHeading` lost the stem of
   its first letter). In the app that gutter comes from `Section`'s `px-5 sm:px-8`.

## The source-kit fork

`.design-sync/overrides/source-kit.mjs` carries three changes, all forced by the
no-dist shape (declared in `cfg.libOverrides`, reasons inline in the file):

1. Scopes the src walk to `ds-scope.json` — no config key filters it.
2. Falls back to the src scan for the component list whenever the `.d.ts` scan
   comes up empty, not just in synth-entry mode. With `--entry` set, upstream
   never reaches the fallback and the run degrades to a tokens-only DS.
3. Carries each export's defining file through the src scan, and drops `ui` from
   the generic-dir list. Upstream's name-based fuzzy-find cannot match
   `CardHeader` to `card.tsx`, so 80 of 118 components lost their group and their
   JSDoc and landed in `general`. With the fix: 118/118 src-matched, groups
   `ui` (95), `marketing` (14), `brand` (6), `blueprint` (3).

On re-sync, diff this fork against `.ds-sync/lib/source-kit.mjs` and merge any
upstream changes.

## Environment

- Chromium for the render check comes from the cache at
  `~/Library/Caches/ms-playwright` (builds 1228 and 1234). `playwright@1.62.0`
  pins 1234, so it launches with **no browser download**. A different playwright
  version will try to fetch ~200MB; check `browsers.json` before upgrading.
- `.ds-sync/` needs its own deps: `esbuild ts-morph @types/react playwright@1.62.0`.

## Known render warns

(Triaged warns that are legitimate for this DS. A warn not listed here is new.)

- *none recorded yet — the authoring pass is still in progress.*

## Re-sync risks

- **`prepare.mjs` restates font families by hand.** If `src/app/layout.tsx`
  changes a family, an axis or a variable name, the compiled sheet keeps the old
  one and nothing fails — the cards just render in the wrong face. Diff
  `FONT_SETUP` against `layout.tsx` on every sync.
- **Utility coverage in the shipped CSS is repo source + previews + `SAFELIST`.**
  The safelist covers ordinary layout, spacing, type and the DS colour tokens, so
  a design agent can lay something out — but it is a floor, not everything
  Tailwind can express. A class outside it is absent from `styles.css` and fails
  silently. `conventions.md` and `SAFELIST` must move together.
- **The `next/*` shims are hand-written stand-ins tied to upstream API.** They
  cover the props these components pass today. A component that starts using a
  prop the shim drops will silently lose that behaviour in previews only.
- **The scope list is manual.** A new `src/components/<dir>` is invisible to the
  sync until it is added to `ds-scope.json` — and must be checked for
  server-only imports first.
- **`docs/DESIGN_SYSTEM.md` is referenced by `AGENTS.md` and is the real source
  of design truth here.** It is uploaded as a guideline; keep it current.
