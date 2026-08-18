# Overnight build report

Session of 18–19 August 2026. Autonomous product-engineering pass over
Blockwright.

**Headline:** the product's missing centrepiece — idea → questions → plan →
approval — now exists and works against real model calls. The landing page won a
blind A/B against the live reference. Roblox Studio integration was proven
against a real place. Three real defects were found and fixed, one of them a
cost-control gap I had specified and never wired.

---

## Starting state

- 97 uncommitted files on a single "Initial commit". All of Steps 1–7 unversioned.
- 284 tests, 37 live security checks, agent acceptance 44/44.
- Roadmap items 4, 5, 14, 18, 23, 39 (intent → questions → blueprint → approval)
  entirely absent.

---

## Completed

### 1. The work was secured first

97 files committed in two meaningful commits. The 34MB / 5,464-file normalized
corpus is now gitignored: it is *derived* output, rebuilt deterministically from
the commits pinned in `source-lock.json`, while the provenance (source lock,
ingestion manifest, coverage report, step reports) stays versioned.

### 2. Game Blueprint — the missing headline experience

Roadmap 4, 5, 14, 18, 23, 39.

An idea now becomes a plan the creator reviews before any code exists:

- **Questions** (4–6, schema-constrained). Only asked when the answer changes
  what gets built; every option states its consequence. One is pre-selected so
  the flow can be accepted without reading everything.
- **Blueprint** — 15 possible sections, each with prose, concrete decisions and
  the Roblox services involved. Grounded in the Roblox Brain, so it names real
  services rather than guessing. Honest scope signal and an explicit
  out-of-scope list.
- **Review** — sections regenerate independently, so fixing the economy does not
  discard the combat.
- **Approval** — its own endpoint, like the change-set approval. It is the
  authorization event for autonomous building, and an approved plan becomes
  binding context on every later build turn. An approved plan cannot be edited
  out from under the agent.

Verified end to end against real model calls: **24/24**. Generated *"Deadbolt
House"* — medium scope, ~34 scripts, 15 sections, zero blocking issues,
networking section correctly stating what the server owns.

New: `src/lib/blueprint/{schema,generate}.ts`,
`src/components/blueprint/{blueprint-dialog,question-flow,blueprint-view}.tsx`,
four API routes, migration `0009`, 17 unit tests,
`scripts/roblox-brain/verify-blueprint.mjs`.

### 3. Landing page — Gauntlet win

Captured the real lemonade.gg at 1440×900 and Blockwright at the same viewport.

The gap was that Blockwright's hero was marketing copy and two buttons, while
the reference put a working prompt box front and centre. Fixed by building a
**real hero composer**: typing an idea carries it through sign-up into a project
whose dialog is pre-filled and whose workspace composer is seeded with it.
Display type enlarged, subhead cut to one line.

A fresh-context critic, given both live pages and forced to a binary choice:

> **VERDICT: PAGE B WINS** *(Blockwright)*

Its criticism of Blockwright stands and is recorded below under "known gaps":
the visual identity reads as the standard dev-tool uniform, the register is
pitched at engineers rather than teenage creators, and the product never shows
an actual game.

### 4. Roblox Studio — proven, not asserted

Studio MCP was live. I built a real landscape in the open place from here:
terrain generated from layered noise across a 900-stud area, water basin, four
materials, Atmosphere, Bloom, ColorCorrection, SunRays, and a framed camera.

Verified by query: **607,544 terrain cells**, atmosphere haze 2.1, bloom present,
ClockTime 17.4, 9 lighting children. The write path from this environment into a
real Roblox place works.

### 5. Command palette (roadmap 41, 42)

⌘K / Ctrl+K, mounted once in the app shell. Nine commands, grouped, with
prefix / substring / keyword / subsequence matching — "npj" finds "New project".
Verified live in the browser: opens, filters, arrow-navigates, escapes.

Every entry is a real navigation. Nothing is listed that the app cannot do.

### 6. Zero-placeholder pass (roadmap 9)

Scanned for the full list of placeholder markers. Three hits, two of them real
dead controls, both now real:

- **Attach a file "(coming soon)"** → real script attachment. Reads `.luau`,
  `.lua`, `.txt`, `.md`, `.json` client-side and inlines the source into the
  message, so "fix this script" works. No storage, no retention question.
- **"Checkout coming soon"** (disabled button) → a CTA that does something.
  There is no payment provider, so the card leads where credits actually come
  from today: a free account.

The third hit is an instruction telling the model *not* to write TODOs, which is
correct and stays.

---

## Defects found and fixed

**1. The output-token budget was declared and never enforced.** `budgets.ts`
defines `maxOutputTokens`, and the chat route never passed it to `streamText` —
so every request reserved the model's full 65,536-token window. It surfaced when
the provider refused the reservation on a low balance and the run died at
GENERATING with no usable error. This is exactly the cost control section 19
asked for, specified and not wired. Fixed, and pinned by a test that reads the
route source, because the alternative is spending real credit to discover it was
dropped again.

**2. Provider credit exhaustion reported as an internal fault.** "Something went
wrong on our side" for a problem only the account owner can fix. Now mapped to a
402 that says what to do.

**3. An icon-only button with no accessible name.** The workspace "Plan" control
keeps its label in `hidden sm:inline`, so below the `sm` breakpoint it became an
unnamed button — on exactly the devices most Roblox creators use. Given an
explicit `aria-label`. A sweep for the same pattern across all components found
no others.

**4. Provider schema constraint.** OpenAI strict structured outputs require every
property to appear in `required`; an `.optional()` field is rejected outright.
Optional blueprint fields are now nullable. Found by a real 500, not by reading
docs.

---

## Verification

| Check | Result |
|---|---|
| Corpus validation | PASS — 5,456 documents, 0 errors |
| Knowledge DB validation | PASS — 14,012 chunks / 14,012 embeddings |
| Retrieval evaluation | Recall@5 **98.7%**, MRR **0.910** (unchanged — untouched) |
| `tsc --noEmit` | clean |
| ESLint | clean |
| Unit tests | **304 passed**, 15 files (up from 284) |
| Production build | success, 29 routes |
| `verify:security` | **37 passed, 0 failed** |
| Blueprint acceptance | **24/24** against real model calls |
| Agent acceptance | 44/44 before the balance ran out; blocked after (see below) |

---

## Gauntlet record

| Surface | Reference | Verdict |
|---|---|---|
| Landing page | lemonade.gg (live, 1440×900) | **Blockwright wins** (fresh-context critic, binary) |
| Blueprint UI | — | Built and inspected in-browser: 15 sections, correct order, approved state, section summaries when collapsed |
| Command palette | — | Verified live: open, fuzzy filter, keyboard nav, escape |

The critic's criticism of Blockwright is recorded honestly rather than filed as
a win. See known gaps.

---

## Blocked

**Roblox Studio screenshots.** The Studio window is minimized, and viewport
capture requires a compositing window. Terrain, lighting and atmosphere were all
written and verified by query — only the image is unavailable. Un-minimize
Studio and `capture_screenshot` will work; nothing in code needs to change.

**OpenRouter account balance.** Ran out mid-session:
*"You requested up to 65536 tokens, but can only afford 21983."* All paid calls
stopped at that point per the budget rule. The agent acceptance test cannot
re-run until the account is topped up — it passed 44/44 earlier in the session,
and the only code change to that path since is the token-ceiling fix, which
makes the failure mode strictly better.

To be precise about the two different budgets: the **$3 authorization was not
exhausted** — this session spent roughly **$0.30** on external calls (two
blueprint generations at ~$0.13 each plus two failed agent runs). The constraint
that stopped work is the **OpenRouter account's own balance**, which is separate
from the spending ceiling I was given.

---

## Known gaps

Ranked by how much they cost the product.

1. **Visual identity is not distinctive.** The critic's words: dark charcoal,
   amber accent, uppercase mono eyebrows, bordered cards — "swap the wordmark and
   this is a dozen other dev tools." This is a real loss against the reference
   and the largest remaining design problem.
2. **The product never shows a game.** For a game-creation product it shows code,
   file trees and validation ticks. The intended fix — build a scene in Studio
   and screenshot it — is written and executed; only the capture is blocked.
   Creator Store search is heavily keyword-spammed (a "low poly tree pack"
   returned a weapons pack), so asset-hunting needs visual verification of every
   candidate; Roblox's own assets are reliable but 2008-era blocky.
3. **Register is pitched at engineers.** "Server-authoritative damage",
   "allowlisted actions only". Accurate, and not how a thirteen-year-old creator
   reads a landing page.
4. **Blueprint generation is slow** — 122–136s for the plan. It is one large
   structured-output call; streaming section by section would make the wait
   legible.
5. **The repair loop is still model-driven**, not a server-driven re-prompt loop
   (carried over from Step 7, unchanged).
6. **Roadmap not reached tonight:** notifications (43), agent run-history UI (44),
   project memory (45), world builder (24), asset registry (33), live progress
   page (57), onboarding (39 beyond the blueprint flow).

---

## GitHub

Two commits on `master`, both verified before committing (tsc, lint, tests,
build, security):

- `7f48632` — Roblox Brain, real generation, and the agent layer
- `a6a5ce7` — Game Blueprint: questions, plan, approval

A third commit covers the command palette, the budget fix and the accessibility
fix. Nothing was pushed with failing checks and no history was rewritten.

---

## Budget

| | |
|---|---|
| Authorized | $3.00 |
| Estimated spend this session | **~$0.30** |
| Paid calls | 2 blueprint generations (questions + plan, ×2), 2 failed agent runs |
| Free/local | Studio MCP, Lemonade capture, browser QA, all validation, all tests |
| Stopped because | The OpenRouter account balance ran out, not the authorization |

No purchases, no subscriptions, no upgrades.
