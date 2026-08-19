# Overnight build report

Session of 2026-08-19 · branch `master` · 8 commits from `8353bae` to `8823ad0`
· 43 files changed, +2,701 / −236

The brief was to keep going until Blockwright wins the comparison or the
remaining improvement is blocked. Some of it is blocked, and the blocker is
named at the bottom rather than buried.

---

## What actually got proven

Not "implemented" — run, against the live system, with the output read back.

| Check | Result |
| ----- | ------ |
| `npm run check` | lint, typecheck, **321 tests / 15 files**, production build, 30 routes |
| `npm run verify:security` | **37 / 37** against the real Supabase project |
| `npm run agent:verify` | **44 / 44** end to end through the real pipeline |
| `npm run blueprint:verify` | **23 / 24** — the miss is a free-model artefact, explained below |

### The end-to-end run

`agent:verify` puts the section-24 scenario — *"Create a simple Roblox round
system…"* — through the running application with a real provider, a real
database and a real signed-in user, then reads the result out of Postgres.

The assertions that matter are the negative ones:

- **preview wrote 0 files** — it staged a change set and touched nothing
- **apply was refused while pending** — 403 `changeset_not_approved`
- **apply was refused unauthenticated** — 401
- **another user could not approve it** — 404
- only after an explicit owner approval did 3/3 operations apply
- a second apply was refused
- undo reverted all three

The generated Luau used `game:GetService`, kept round state on the server, and
connected the halves with a RemoteEvent. Nothing in the stream contained a
secret or the service-role key.

This is the run that licenses saying the pipeline works. Before it, that claim
rested on unit tests against fakes.

---

## Three bugs the verification found

None of these were visible by reading the code. All three were found by running
the system and looking at what came back.

### 1. Runs stranded forever on a provider error

A provider that rejects a call outright — exhausted balance, dead key, model
withdrawn — fails *before* the stream starts, so AI SDK's `onEnd` never fires.
The route's `onError` only logged. The `agent_runs` row stayed in `GENERATING`
with a null `completed_at`.

Consequences: a permanent spinner in the run history, and a table that
accumulates rows nothing will ever close. `onError` now closes the run itself,
guarded so a mid-stream failure cannot double-write.

Verified in both directions: an exhausted account now walks
`ANALYZING → RETRIEVING_KNOWLEDGE → GENERATING → FAILED`.

### 2. Every unexpected 500 was invisible

`errors.ts` opens by promising internal detail is "logged server-side and never
sent to the browser". The second half was true. The first was not — the one
function every route funnels through logged nothing at all.

Found because a blueprint run failed with `POST /api/blueprint 500 in 57s`
against a completely empty error log. With logging added, the cause named itself
on the very next run: `AI_NoObjectGeneratedError`.

Which surfaced a second problem: the creator was being told *"Something went
wrong on our side"* when the model had failed to hold the schema. Nothing was
wrong on our side, and the two have completely different fixes — only one of
which is available to the person reading the message. It now says the model did
not return a usable plan, and suggests retrying or a stronger model.

### 3. A duplicated blueprint section passed review

A live plan came back with sections `… networking, persistence, economy,
networking`. `reviewBlueprint` built a `Set` of keys, so the duplicate collapsed
and the review reported **zero issues**.

Not cosmetic — every consumer keys by `section.key`:

- React saw duplicate keys in the section list
- one expand toggle opened both panels
- **"rewrite this section" mapped over the array and replaced both**, so asking
  for one rewrite silently produced two identical sections

Fixed at three levels: the prompt now states each key appears exactly once,
generation dedupes and logs when it has to, and review reports a duplicate as a
blocking error.

### Also, from the UI work

- The Studio "connected" chime fired **every three seconds, forever**. The
  callback was memoized on `[projectId]` but read `state?.status`, frozen at its
  first-render `null`, so the "already connected?" guard was permanently true.
  Fixing it with a ref also wired up the `disconnect` sound, which had been
  written and never used.
- The landing page's workspace mock gated its summary paragraph and live dot on
  `elapsed > 6800` while the tick stopped at `3600`. **Neither could ever
  render.** The panel finished in three seconds and then sat there with the
  space its summary was meant to fill left empty — which is exactly the "half
  empty mock" a reviewer had measured. Every time-gate now derives from one
  table the tick is required to outlast.

---

## The landing page

### Real Roblox replaced catalogue art

The page had been showing three Creator Store asset renders — a wall, some
towers, a standing zombie on flat blue — which the page itself had to caption
"Roblox Creator Store model". A catalogue thumbnail is not a game; captioning it
honestly only made that legible.

Two real places replaced them, both built in Studio and captured with Studio's
own screenshot tool:

- a sconce-lit hotel corridor
- a floating-island scene: terrain islands, 17 trees, a 61-stud catenary rope
  bridge, volumetric clouds, and a stone arch at the far end so the bridge has
  somewhere to go

The island scene started the session as bare grass discs with one prop — a
blockout, not a game. The chest, arch and one tree were generated as meshes from
text descriptions; the terrain, bridge, lighting and atmosphere were built in
the place.

**No caption claims a prompt produced any of it**, because none did. That
caption is reserved for a place an end-to-end run actually builds.

### One thing that was tried and reverted

A review called the corridor too dark to read at thumbnail size, so it was
relit brighter. That made it worse: lifting the ambient flattened the frame into
a single amber field, and the sconces stopped reading as light sources because
no shadow was left for them to be brighter than. Four passes chasing it back —
cooler fill, tighter falloff, higher contrast, Neon fixtures — recovered
contrast but never the mood.

The original is back. Dark is the point, and the legibility concern is answered
better by what now sits beside it: the daylit island scene gives the row the
contrast a single dim image lacked.

### Copy

The page never once mentioned publishing, players or friends — it described
building and stopped there, which is the least interesting true thing about it.
Three sentences now carry it to the outcome, and they stay accurate: Blockwright
syncs into Studio and **the creator presses Publish**. Nothing claims otherwise.

---

## Accessibility

`npm run a11y` was written this session: headless Chrome, real rendered pages,
measured results. Static analysis cannot answer whether a colour pair clears
WCAG once every CSS variable and opacity has resolved, whether a control has an
accessible name after Base UI composed it, or whether a target is thumb-sized
under a coarse pointer.

Structure and contrast came back nearly clean — **zero contrast failures in
either theme**, one missing `h1` on `/pricing`, and no `<main>` landmark
anywhere in the authenticated app. Touch targets did not: **52 failures**.

The fix that mattered was at the source. The shared `Button` size variants now
carry a 44px floor under `pointer-coarse`, which fixed every button using them
in one change; only the controls that had bypassed the shared component needed
individual attention. The criterion is the pointer rather than the viewport — a
32px button is fine with a trackpad at 390px and bad with a finger at 1024px —
so **the desktop layout does not move by a pixel**.

Three of the findings were about the tool rather than the app, and each is now
fixed in the tool:

- `@apply pointer-coarse:*` inside a custom utility is **silently dropped** by
  Tailwind v4. The classes appeared on the elements and no rule was ever
  emitted, so controls stayed 28px while the markup claimed otherwise.
- CDP's `setEmulatedMedia` has **no `pointer` feature**. Without touch
  emulation the page answered `(pointer: coarse)` with false and the entire
  touch-target pass measured the desktop layout. The audit now prints the
  pointer state it actually got, so a silent emulation failure cannot make the
  check vacuously pass.
- Two rules were over-strict: WCAG 2.5.8 exempts a target inside a sentence,
  and the stretched-link pattern means a 23px card title's real hit area is the
  whole card.

Clean now across `/`, `/pricing`, `/dashboard`, `/templates`, `/activity`,
`/credits` and `/settings`, in both themes, at 1440px and 390px.

---

## Spend

Ceiling: **$3.00 USD**.

| Source | Figure |
| ------ | ------ |
| OpenRouter usage today (UTC) | **$0.23** |
| This key, lifetime | $3.39 |
| Account credits purchased | $10.00 |
| Account credits remaining | **$0.20** |

Nothing was purchased and no subscription was created.

The app's own ledger for the same period, from `ai_requests`:

| Model | Calls | Failed | Input | Output | Credits |
| ----- | ----: | -----: | ----: | -----: | ------: |
| `openai/gpt-5.6-sol` | 13 | 1 | 2,982,583 | 78,598 | 868 |
| `openrouter/free` | 5 | 0 | 250,782 | 29,440 | 0 |
| `openai/gpt-5.6-luna` | 3 | 0 | 72,848 | 3,394 | 3 |

`verify-agent.mjs` gained a `--model` flag during this session precisely so the
acceptance could keep running at zero cost. It is a test of the state machine,
the approval gate and the write barrier — none of which care which model wrote
the Luau.

---

## Blocked, and by what

**The OpenRouter account has $0.20 left.** That is the blocker on further live
generation work, and it is not something to route around:

- The agent path tolerates the free router, because tool calls are validated and
  repaired — that is how the 44/44 acceptance ran for nothing.
- **The blueprint path does not.** `generateObject` needs the model to hold a
  strict schema across a long response, and the free router fails that with
  `AI_NoObjectGeneratedError` roughly as often as it succeeds. Blueprint work
  needs a real model.

Topping the account up is a purchase, so it is the account owner's call, not
something to be done unattended.

**The Studio plugin cycle has still never run inside Roblox Studio.** The
service-role key is configured and pairing, polling and command queueing are all
verified from the web side. What has not happened is a real plugin in a real
place completing pair → poll → execute → report. That is the last unverified
path in the product and it needs a person in Studio.

---

## Not done

Named plainly rather than left to be discovered:

- Studio plugin cycle inside a real place (above)
- Notifications
- Admin control centre
- Vercel deploy and post-deploy verification
- Mini-IDE compared against Cursor
- Project Memory as a visible surface
- Template expansion beyond the current 12
- Leaked-password protection — a Supabase dashboard toggle with no API behind it

`docs/IMPLEMENTATION_STATUS.md` is current as of this session and is the place
to look for what is verified versus merely written. It had drifted badly — it
still claimed 166 tests and that no generation had ever run.
