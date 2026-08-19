# Blockwright — full session handoff

Written for another AI picking this up cold. It assumes nothing about the
previous conversation. Every number here was read out of the repository or a
live system at the moment of writing, not remembered.

**State: paused deliberately.** Nothing is half-broken. One thing is
deliberately uncommitted and is described in full under *The one open blocker*.

- Repo: `/Users/moshe/Claude-Web-Cloner`, branch `master`, HEAD `40b3c07`
- Remote: `github.com/MPROGAMING/Claude-Web-Cloner` — **public**, pushed through `e3d8efb`
- Private holdout: `~/blockwright-holdout` — outside the repo, never committed
- Reference benchmarks cloned to `~/bw-bench-refs/{livecodebench,swebench}`

---

## 1. What Blockwright is

A Next.js web app where a Roblox creator describes a game in plain language and
an agent writes real Luau into a structured project, validates its own output,
and syncs it into Roblox Studio through a dedicated plugin.

Read these before touching anything:

| File | Why |
|---|---|
| `AGENTS.md` | Project rules. Non-negotiable. Contains traps that cost hours if skipped. |
| `docs/ARCHITECTURE.md` | How the pieces fit |
| `docs/PROJECT-CONTEXT-FOR-AI.md` | Single-file explainer of the whole product |
| `docs/IMPLEMENTATION_STATUS.md` | What is *verified* versus merely written |
| `docs/BENCHMARK-PROGRESS.md` | The benchmark workstream, with its own pause note |

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict ·
Tailwind v4 · shadcn/ui on **Base UI, not Radix** · Vercel AI SDK **v7** ·
Supabase (Postgres 17 + RLS) · Vitest. Benchmark tooling is Python 3.9 + pytest.

Health right now: **468 web tests**, **197 benchmark tests**, 199 source files,
12 migrations. `npm run check` is clean. `npm run verify:security` is 44/44
against the live database.

---

## 2. Traps that will cost you hours

These are real and every one of them bit somebody.

**Next.js 16** — `middleware.ts` is now **`proxy.ts`**. `params`,
`searchParams`, `cookies()`, `headers()` are **all async**.

**AI SDK v7 renames** — `system:` → `instructions:`, `onFinish` → `onEnd`,
`fullStream` → `stream`, `stepCountIs` → `isStepCount`. `convertToModelMessages`
is async and needs `{ tools }`.

**Supabase row types must be type aliases, not interfaces.** An interface has no
implicit index signature, fails postgrest-js's `Record<string, unknown>`
constraint, and every query silently resolves to `never`.

**Postgres grants need three roles revoked.** `REVOKE ... FROM public, anon,
authenticated`, then grant back. Naming all three is *not* redundant: a new
function is born with grants from both `CREATE FUNCTION`'s PUBLIC default *and*
Supabase's `ALTER DEFAULT PRIVILEGES`.

**`npm run test` does not typecheck; `next build` does.** Two commits in this
session shipped a broken build because vitest passed. Run `npm run check` before
committing, not `npm run test`.

**Tailwind v4 computes opacity-modified oklch tokens as `oklab()`.** An
`rgba()`-based colour parser silently *skips* those elements. That made an
accessibility audit report "clean" while six real contrast failures went
unchecked.

**`@apply pointer-coarse:*` inside a custom utility is silently dropped by
Tailwind v4.** The class appears on the element and no rule is ever emitted. Use
plain nested media queries in custom utilities.

**`luau file.luau` executes, it does not parse.** On any Roblox script it exits
1 because plain Luau has no `game`. For syntax checking use
`luau-compile --only-parse`.

**Plain `luau` has no Roblox API at all** — no `game`, no `Instance`, no
`workspace`. Anything Roblox-shaped needs the stub runtime.

**Backgrounded browser tabs do not composite**, so IntersectionObserver never
fires and animations never start. A long debugging detour came from this. Use
`scripts/shot.mjs` (headless Chrome over CDP) for anything visual.

---

## 3. What this session built, by workstream

35 commits, from `20a185e` to `40b3c07`.

### 3.1 The Studio bridge — proven inside real Roblox Studio

This was the last unverified path in the product. It now runs for real:

```bash
npm run studio:verify     # 16/16
```

The plugin (`roblox-plugin/Blockwright.server.lua`) is installed to
`~/Documents/Roblox/Plugins/`, Studio was restarted, a pairing code was typed in
by hand. What is proven: pairing claims a 6-character code and reports the open
place back; the code is spent; a token **hash** is stored, never a token;
`inspect_place` returns the real place; `sync_files` wrote 2 files that are
genuinely present as Instances in the right services with the right classes and
a `BlockwrightPath` attribute; **`execute_luau` is refused** — "Unsupported
action" — which is the assertion the whole design rests on; polling keeps
`last_seen_at` current; the plugin reconnects by itself after a Studio restart.

Two bugs it found: `sync_files` reported `ok` for writing nothing (the server
reads project files from Postgres rather than taking them from the payload, so
an empty project produced a green tick and an unchanged Explorer); and the first
version of the acceptance asserted against a payload the server ignores, so it
passed against an empty project.

### 3.2 Horror demo — built through the product's own pipeline

The game logic was **not** hand-written. It came from a prompt through the real
pipeline: preview run on the free router → 13 operations across 7 files →
approval gate → apply → plugin sync → 7/7 real Instances in the correct
services. Then Play was pressed and it did not run, which produced three real
product fixes:

1. **The agent had no idea where its files land.** It wrote
   `ReplicatedStorage:WaitForChild("Remotes")` — what the repo layout suggests —
   but the bridge parents everything under a `Blockwright` folder. The system
   prompt now states the mapping with worked require paths, pinned by a test
   against `inferService`.
2. **The validator passed a file that does not parse** —
   `doorLabel backgroundColor3 = ...`, a dropped dot. Studio refuses the whole
   script, so one missing character silenced an entire HUD. Now an error, with a
   keyword guard.
3. **A `.server.luau` file becomes a Script and cannot be `require`d.** The
   agent wrote `WardenModule.server.luau` and required it. `reviewChangeset` now
   refuses this outright — it is a cross-file property the per-file checker
   structurally cannot see.

The demo place itself is in Studio but its scripts still do not run; the free
router could not perform the repair turn reliably (it produced 13 operations on
one run and zero on the next).

### 3.3 Product features merged from parallel builders

- **Project Memory** — durable per-project facts that survive between
  conversations. Migration `0010`, `src/lib/memory/`, a `remember_fact` tool, a
  Memory panel where a creator can read and delete every fact. Corrections
  *supersede* rather than overwrite. Memory is untrusted text replayed into the
  model forever, so it is fenced the same way retrieved docs are.
- **Notifications** — migration `0011`, bell/inbox in the topbar, four events
  emitted where the transitions actually happen. Emit-once is a unique index,
  not a boolean, because both `onEnd` and `onError` can fire.
- **Mini-IDE** — real diff view on `file_revisions`, file editing with
  revision-conditional writes, Luau-aware editor keys, tabs, `⌘P` go-to-file.
  **+10.1 KB gzipped**, no editor dependency added (CodeMirror would have been
  125.6 KB, Monaco 852 KB).
- **Partial approval** — migration `0012`. A change set was all-or-nothing; now
  each file has a checkbox and the button reads "Apply 2 of 3". The request may
  only ever *narrow* the proposal, checked server-side, and apply re-validates
  the subset rather than the original whole.

### 3.4 Reliability and honesty fixes

- **Runs stranded forever on a provider error.** A provider that rejects a call
  fails before the stream starts, so `onEnd` never fires and `onError` only
  logged. Rows sat in `GENERATING` with a null `completed_at`.
- **Every unexpected 500 was invisible.** `errors.ts` promised internal detail is
  "logged server-side" and the one function every route funnels through logged
  nothing. With logging added the cause named itself immediately.
- **We were blaming ourselves for the model.** `AI_NoObjectGeneratedError` was
  reported as "Something went wrong on our side". It now says the model did not
  return a usable plan.
- **A duplicated blueprint section passed review.** `reviewBlueprint` built a
  `Set` of keys so duplicates collapsed to zero issues — and "rewrite this
  section" then replaced *both*.
- **The default model could not run on this deployment** (Claude Sonnet with no
  Anthropic key configured). Now the Brain model, pinned by a test.

### 3.5 Accessibility

`scripts/a11y.mjs` was written this session — headless Chrome, real rendered
pages. It found 52 touch-target failures, then six contrast failures it had
previously been *skipping* because of the `oklab()` parser bug above. All fixed.
Clean now across `/`, `/pricing`, `/dashboard`, `/templates`, `/activity`,
`/credits`, `/settings` in both themes at 1440px and 390px.

### 3.6 Template banners

All 12 template cards carry real CC0 cartoon art from kenney.nl (licence
verified per pack page, credited in `public/templates/CREDITS.md`). Two Roblox
image sources were tested and reported before choosing: Creator Store thumbnails
are isolated props on white; experience thumbnails are other studios' shipped
games.

**A critic ruled this LOSES to Lemonade.** Its measurement: Lemonade's tile is
178×232 = 41,296px² of uninterrupted picture; ours is a 260×260 card with only a
112px image band = 29,120px². Our card is 64% larger and shows 30% *less* image.
The named gap: every Kenney scene is a depopulated god's-eye diorama with
figures under 6px, where Lemonade puts a large near-camera character performing
the genre's verb. Weakest card: "Round-Based Arena", which reads as an
archaeology dig.

**Note:** the user has since decided templates are to be **deleted entirely** as
a user-facing product (see §6). Do not invest further in banners.

---

## 4. The benchmark and dataset factory — the current task

Goal: build a Roblox/Luau model benchmark and a training-data factory, with
**no fine-tuning**. Progress page: `docs/BENCHMARK-PROGRESS.md`.

### The two bars, read in code rather than remembered

Both cloned to `~/bw-bench-refs`.

**LiveCodeBench** contributes four scenarios rather than one; contamination as a
**date check** (problem `contest_date` vs model `release_date`, filtered by
`--start_date`/`--end_date`); and private tests stored `base64(zlib(pickle(…)))`
so a published dataset does not hand over its own answer key.

**SWE-bench Verified** contributes test-gated `FAIL_TO_PASS` / `PASS_TO_PASS`;
three-way resolution FULL / PARTIAL / NO; a report separating infra failure from
model failure; and one guard copied verbatim — **a skipped fail-to-pass test
counts as failed**, or a patch that makes every target test skip scores
`RESOLVED_FULL`.

### What exists

```
bench/schema/task.py        6 scenarios, 8 categories, both bars' shapes
bench/harness/execute.py    sandboxed luau, timeouts, require aliases
bench/harness/grade.py      test-gated grading, three-way resolution
bench/harness/verify_holdout.py   proves each task discriminates
bench/contamination/        lexer, normalisation, MinHash+LSH, date check, manifest
bench/factory/              provenance → quality → leak gate → dedup → emit
bench/runtime/              Roblox stub — UNCOMMITTED, see §5
~/blockwright-holdout/      41 private tasks, never committed
```

**Holdout: 41 tasks**, all eight categories — code_generation 6, debugging 6,
security 6, api_correctness 5, studio_runtime 5, agent_tool_use 5, multi_file 4,
project_reasoning 4. 166 fail-to-pass and 96 pass-to-pass tests.

**Gate verification** is the check that decides whether any of this measures
anything. Per task it executes three claims: fail-to-pass genuinely fails on the
untouched project, pass-to-pass genuinely passes on it, and the reference
solution resolves it to FULL.

```
holdout: 41 tasks
  needs the Roblox stub, not yet runnable  16
  gate verified AND reference resolves      25
  broken                                    0
```

**Contamination thresholds are measured, not assumed** (alpha, k=5, Jaccard ≥
0.35 or containment ≥ 0.60): mechanical rewrites 264/264 caught; hand-written
structural rewrites 4/11; independent solutions to the same problem 0/33 false
positives; cross-problem 0/495. The important negative result: the weakest
structural positive scores *below* the strongest honest same-problem negative,
so **no threshold separates them** — the choice was to miss the structural
rewrite rather than flag honest work.

### The single biggest bug this workstream found

All 25 runnable holdout tasks reported "a pass_to_pass test fails on the
UNMODIFIED project". **None of them were broken.** Tasks import their modules
through a Luau require alias (`require("@proj/shared/Inventory")`), which Luau
resolves via a `.luaurc` in the working directory — and the harness never wrote
one. The harness could not import the code it was scoring. A benchmark that
cannot load a task reports zero, and zero looks like a finding.

---

## 5. The one open blocker — resolve this first

The contamination detector flags the new Roblox stub runtime:

```
holdout content appears in 1 repository file(s):
  runtime/roblox.luau (near_jaccard, 0.598)
```

`bench/runtime/` is therefore **gitignored and uncommitted** so it cannot reach
this public repository before the flag is understood. Two possibilities needing
opposite fixes:

1. **True positive** — holdout source was pasted into the stub while deriving
   its API surface. Then rewrite the stub from the audit's extracted member list
   alone (`cd ~/blockwright-holdout && python3 tasks/audit.py`), never from task
   bodies.
2. **False positive** — a Roblox API stub necessarily shares identifiers with
   every task calling that API (`WaitForChild`, `FireServer`, `ChildAdded`).
   This is exactly the weakness the detector's own author predicted: "real
   Roblox corpora are full of genuine boilerplate". If so the fix is a
   *genericity score* per holdout unit, not a change to the stub.

**Do not resolve it by raising the threshold.** That disarms the check that
protects the benchmark.

The agent building the stub reported "All 16 pass" for the stub-dependent tasks
just before it was stopped, but that is its own unverified claim;
`verify_holdout.py` still reports those 16 as not runnable because it does not
yet mount the runtime.

The one failing test in `python3 -m pytest bench` is this leak scan. **It is
failing correctly** — it found something and is refusing to stay quiet.

### Other open items

| Item | State |
|---|---|
| Baselines | **0 models run.** OpenRouter credit is exhausted ($0.20 left of $10). The free router works but is not a serious candidate model. |
| Per-piece critics vs the two bars | Never run |
| Vercel deployment | Project `blockwright` created and linked, but the token cannot create or list deployments (403 forbidden). Needs the account owner to grant deploy rights. |
| Studio plugin cycle | Verified once by hand; not automated |

### Honest limits of the benchmark, recorded rather than buried

- **No container isolation.** SWE-bench gives each instance a Docker container;
  Docker is not installed here. Execution is process-level: wall-clock timeout
  with SIGKILL, emptied environment, fresh temp dir, path-escape check.
- **`RLIMIT_AS` is not honoured on this macOS host.** Probed, not assumed — and
  the first version of that probe re-set each limit to its *current* value,
  which always succeeds, so it reported isolation the host does not provide.
- **Every Roblox stub is a place the benchmark can diverge from real Roblox**
  and score the wrong thing. The surface is kept minimal and listed explicitly
  by the audit.

---

## 6. What the user asked for next, and has not been started

A **full visual/product UX rebirth** of Blockwright. Not a reskin, not a backend
rewrite. Target feel: Roblox toy workshop × professional AI build partner,
roughly 80% playful/tactile and 20% sophisticated technology. The Roblox stud
becomes a real material that presses, snaps and mounts — not a dotted
background. Conversation becomes the centre of every surface.

**Two permanent deletions were ordered:**

1. **Templates are finished as a user-facing product.** Remove nav, gallery,
   dashboard shelves, links and route entry points. Replace their creative
   function with conversation-native inspiration — prompt starters, genre chips,
   Surprise Me. Do not perform destructive database surgery for aesthetic
   purity; dormant data may remain.
2. **The two handmade Roblox Studio marketing images are dead** —
   `public/demos/hero-corridor.jpg` and `public/demos/islands.jpg`, currently
   used by `src/components/marketing/roblox-showcase.tsx`. Do not move, crop or
   recycle them, and do not open Studio to manufacture replacements.

The bar is live **lemonade.gg**, fetched before every comparison at the same
viewport. Everything must be verified in a browser, gated by fresh-context
critics giving binary verdicts, and finally judged on a **deployed** preview
rather than localhost.

Functional immutability applies: auth, projects, Questions, Blueprint, explicit
approval, Agent, changesets, apply/undo, Studio bridge, credits, model
selection, RLS and validation must not be weakened or faked.

---

## 7. Useful commands

```bash
npm run check              # lint + typecheck + 468 tests + build. Use before committing.
npm run verify:security    # 44/44 live RLS and grant probes
npm run agent:verify -- --model openrouter:openrouter/free   # 44/44 end to end, free
npm run studio:verify      # 16/16, needs Studio open and a code typed in by hand
npm run a11y -- http://localhost:3000/ --theme dark --width 390
node scripts/shot.mjs <url> <out.png> [w] [h] [scrollY|full]  # headless screenshots
node scripts/card-shots.mjs --out /tmp/cards                  # one image per template card
node scripts/session-cookie.mjs                               # QA session cookie for BW_COOKIE

python3 -m pytest bench -q                    # 197 tests, 1 failing on purpose
python3 bench/harness/verify_holdout.py       # 25/41 gate-verified
cd ~/blockwright-holdout && python3 tasks/audit.py
```

Dev server: use the Browser pane's `preview_start` with the `blockwright` config
from `.claude/launch.json`. Never run a dev server through a plain shell.

---

## 8. Working principles that produced the good findings here

Almost every real bug in this session was found by **running the thing and
reading what came back**, not by reading code. The playtest found three product
bugs. The accessibility audit found a bug in itself. The leak detector found the
stub. The gate runner found that the harness could not import its own tasks.

When a check reports "clean", ask whether it *could* have failed. Two separate
probes in this session reported success because they were structurally incapable
of failing — a resource-limit probe that re-set a limit to its current value,
and a colour parser that skipped every element it could not parse.

State limits rather than hiding them. A benchmark that says it sandboxes and
does not is worse than one that says it does not.
