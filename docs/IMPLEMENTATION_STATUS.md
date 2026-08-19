# Implementation status

Last updated: 2026-08-19 · v0.5.0
Supabase project: `Blockwright` (`joqttyltdbbwebtwbabh`, ap-southeast-2, Postgres 17)

## Model catalog verification (2026-08-18)

Every requested model name was checked against the **live** OpenRouter catalog
(`GET https://openrouter.ai/api/v1/models`, 412 models, 18 free at the time).

| Requested | Verified slug | Exists | Free | Tools | Context | $/M in→out |
| --------- | ------------- | ------ | ---- | ----- | ------- | ---------- |
| GPT-5.6 Luna | `openai/gpt-5.6-luna` | Yes | No | Yes | 1,050,000 | 0.20 → 1.20 |
| Gemini 3.7 Flash | `google/gemini-3.7-flash` | Yes | No | Yes | 1,048,576 | 0.375 → 1.875 |
| Hy3 | `tencent/hy3` | Yes | No | Yes | 262,144 | 0.132 → 0.528 |
| Kimi K3 | `moonshotai/kimi-k3` | Yes | No | Yes | 1,048,576 | 3.00 → 15.00 |
| GLM 5.2 | `z-ai/glm-5.2` | Yes | No | Yes | 1,048,576 | 0.49 → 1.54 |
| *(added)* Free router | `openrouter/free` | Yes | **Yes** | Yes | 200,000 | 0 → 0 |

**All five exist and none are free.** No substitutions were needed. None are
deprecated (no `expiration_date`), and all five support tool calling and
structured output — which the agent requires.

A first search pass truncated its output and appeared to show GPT-5.6 Luna and
Gemini 3.7 Flash as absent. A wider search found both. Recorded here because the
lesson generalises: verify against the full result set, not the first page.

Free-at-provider models are priced at **0 Blockwright credits**. That is a
product decision in `registry.ts`, not a consequence of the provider being free
— `tests/credits.test.ts` pins it so a change is deliberate.

## Verified against the live database

Not assumed — executed:

- `npm run check` — lint, typecheck, **312 tests across 15 files**, production build (30 routes)
- `npm run verify:security` — **37/37 passing** against the real Supabase project
- `npm run agent:verify` — **44/44 passing** end to end through the real pipeline
- Signup trigger fires: profile row + 2,000 credits + a `signup_bonus` ledger entry
- Sign-in through the real UI; dashboard, credits, settings and the workspace all
  render live data
- Project creation from a template → workspace opens with the template prompt
  seeded into the composer
- Studio pairing code generates and displays (`3FMPSV`, 10-minute expiry)
- Model selector resolves availability from the keys actually configured:
  OpenRouter models are usable, direct-provider models name the key they need
- API error handling: malformed bodies → `400 invalid_request`; unconfigured
  subsystem → `503 provider_unconfigured`; no internal detail leaked

### What `verify:security` proves

Run it any time with `npm run verify:security`. It signs in as two real users
and attempts every cross-tenant access the schema should refuse:

- anonymous cannot read any of the 8 user-owned tables
- anonymous cannot execute `grant_credits` or `consume_credits`
- user B cannot list, read-by-id, update, or delete user A's project
- user B cannot insert a row owned by user A (RLS `WITH CHECK` rejects it)
- user B cannot read user A's balance, and its ledger contains only its own rows
- a signed-in user cannot write `credit_balances` directly
- a signed-in user cannot call `grant_credits`
- a signed-in user *can* spend their own credits, and overdraw is refused

## Generation, verified end to end (2026-08-19)

`npm run agent:verify` runs the section-24 acceptance scenario — "Create a
simple Roblox round system…" — against the running application, with a real
provider, a real database and a real user session. **44 assertions, 0 failures.**

What it proves, in the order the run does it:

| Stage | Proven |
| ----- | ------ |
| Classification | `multi_file_implementation`, plan required |
| State walk | ANALYZING → RETRIEVING_KNOWLEDGE → GENERATING → VALIDATING → COMPLETED, unbroken |
| Retrieval | a knowledge step occurred before generation |
| **Preview** | **0 files written** — staged only |
| Change set | 3 operations, `pending_approval`, no blocking issues |
| **Apply, unapproved** | **refused, 403 `changeset_not_approved`** |
| **Apply, anonymous** | **refused, 401** |
| **Approve, other user** | **refused, 404** |
| Apply, approved | 3/3 applied, audited, second apply refused |
| Output | uses `game:GetService`, server owns round state, a RemoteEvent joins the halves |
| Undo | all 3 reverted |
| Telemetry | tokens, credits and retrieval time recorded; no secret in the stream |

The negative assertions are the point. Preview writing nothing and apply being
refused until an explicit approval exists are the two invariants the whole
approval design rests on, and both are now checked against the live system
rather than argued from the code.

`--model` pins the run to one model, so the acceptance is reproducible on an
account with no balance — it is a test of the state machine, the approval gate
and the write barrier, none of which depend on which model wrote the Luau.

**The free router cannot be substituted everywhere.** The agent path tolerates
it because tool calls are validated and repaired; the blueprint path does not,
because `generateObject` needs the model to hold a strict schema across a long
response, and the free router fails it with `AI_NoObjectGeneratedError` roughly
as often as it succeeds. Blueprint acceptance therefore needs a real model.
That failure now reports as "the model did not return a usable plan", not as an
internal error, because it is not one.

### Provider errors close the run

Found while running the above against an account with $0.09 of OpenRouter
credit left: a provider that rejects the call outright fails *before* the
stream starts, so `onEnd` never fires. The route's `onError` only logged, which
left the row in `GENERATING` with a null `completed_at` — a spinner in the run
history that never resolves, and an `agent_runs` table accumulating rows
nothing would ever close. `onError` now closes the run itself. Verified live in
both directions: exhausted balance ends `… → GENERATING → FAILED`.

## Still requiring external configuration

- **The Studio plugin cycle has not run inside Roblox Studio.** The service-role
  key is configured and pairing, polling and command queueing are verified from
  the web side; what has not happened is a real plugin in a real place
  completing pair → poll → execute → report.
- **Leaked password protection** is still off — a Supabase dashboard toggle
  (Authentication → Policies) with no Management API behind it.

## Security work done during setup

Three issues were found by inspecting the live database. Two were real
vulnerabilities that reading the SQL could not have caught.

### 1. `grant_credits` was callable by anyone with the anon key (critical)

`CREATE FUNCTION` grants `EXECUTE` to `PUBLIC`, and every role inherits from
`PUBLIC`. The original migration revoked from `anon` and `authenticated`, which
does nothing while the `PUBLIC` grant stands. PostgREST exposes `public`-schema
functions at `/rest/v1/rpc/<name>`, so an anonymous caller could mint unlimited
credits for any known user id.

Confirmed by calling it — the function *executed* and only failed on a foreign
key. Fixed with `REVOKE ... FROM PUBLIC`, re-tested (`42501 permission denied`),
and pinned by `tests/migration-safety.test.ts`.

The tell in `pg_proc.proacl` is a leading `=X/postgres` — an empty grantee means
PUBLIC.

### 2. Service-role key was on the generation hot path

Credit charging and AI request logging both ran through the RLS-bypassing
service-role client, even though a user session exists at that point. Reworked
so `consume_credits` reads `auth.uid()` instead of taking a user id, which makes
it safe to expose to `authenticated`. `ai_requests` gained own-row insert/update
policies.

The service-role key is now required by **exactly one subsystem**: the Roblox
Studio bridge, where a polling plugin genuinely has no session. The rest of the
app runs without it.

### 3. `touch_updated_at` had a mutable `search_path`

Pinned to `public`, matching the other three functions.

### Remaining advisor notices (2, both accepted)

- `consume_credits` executable by `authenticated` — **intentional**. It takes no
  user id and derives the account from `auth.uid()`, so a caller can only spend
  their own credits. `verify-security.mjs` proves this directly.
- **Leaked password protection disabled** — worth enabling, but it is a
  dashboard toggle (Authentication → Policies) with no Management API exposed
  through the MCP server. One click, recommended.

## v0.2 changes

### OpenRouter as a first-class provider
Added `@openrouter/ai-sdk-provider` alongside — not replacing — the direct
Anthropic, OpenAI and Google adapters, which all still route natively. Provider
selection stays entirely in `registry.ts`; no component branches on provider.

### Dynamic free-model discovery
`lib/ai/openrouter-catalog.ts` fetches the live catalog with a 30-minute TTL,
stale-while-revalidate, last-known-good fallback and an in-flight guard. Free
status is derived from the `pricing` field, never from a `:free` suffix.
Verified live: **14 free models** appeared in the selector without a code change.

### Model selector rebuild
Sections (Recommended / Free / Fast / Coding / Reasoning / Multimodal /
Premium), search, recently-used with de-duplication, discovery labels, capability
badges, context size, credit cost, and a catalog freshness timestamp.

### Real brand assets
Provider logos are the genuine marks from `@lobehub/icons` (MIT). Template art
uses real Game Icons artwork (CC BY 3.0) via `react-icons/gi`, attributed in the
footer. Both inline as SVG — no hot-linking, no broken images, no layout shift.

Stock photography was evaluated and **rejected**: downloaded candidates were
generic and repeatedly mismatched to genre (a scary clown returned for "horror",
a games controller for a PvP arena, a portrait-orientation castle for a
resource simulator). Real game iconography reads correctly at every size.

### Templates
Expanded 8 → **12 genres**, each with hero art, category, tags, accent, featured
flag and an example prompt. New filterable gallery; dashboard and create dialog
both use the visual cards.

### Auth surface completed
Added forgot-password, reset-password (with live requirement feedback and expiry
handling) and email-verification with resend. Reset requests always report
success to avoid account enumeration. OAuth providers render only when actually
listed in `NEXT_PUBLIC_AUTH_PROVIDERS`; otherwise the UI says plainly that social
sign-in is not enabled.

### Motion
Added `pop`, `slide-in`, `tick`, `breathe`, `sweep`, plus `.lift` and `.stagger`
utilities and two easing tokens. Generation status now maps to real operations
with a post-run created/modified/deleted summary derived from streamed artifact
parts. Credit balance counts rather than snaps. All reduced-motion aware.

## Status by area

| Area | Status |
| ---- | ------ |
| Design system + tokens | Done |
| App shell, nav, responsive | Done |
| Landing + pricing | Done |
| Auth (email/password, callback, protected routes) | **Verified live** |
| Dashboard / projects / templates / activity / credits / settings | **Verified live** |
| Project CRUD, duplicate, archive | Done (create verified live) |
| Workspace (3-pane, collapsible, mobile sheets) | **Verified live** |
| Code editor: tabs, editing, diff, go-to-file | **Verified live** — see "Workspace editor" |
| Model registry + selector | **Verified live** — sections, search, logos, live free tier |
| OpenRouter provider | **Verified live** — catalog and generation both |
| Dynamic free discovery | **Verified live** — 14 models fetched and merged |
| Chat streaming, tool rows, plans, retry/stop | **Verified live** — 44/44 acceptance |
| Agent tools + server-side validation | **Verified live** — staged, validated, repaired |
| Luau validator | Done, unit tested |
| Credits: schema, atomic RPC, ledger, UI | **Verified live** |
| RLS / tenant isolation | **Verified live, 37 assertions** |
| Studio pairing UI + code generation | **Verified live** |
| Studio plugin bridge (pair/poll/dispatch) | Key configured; not yet run inside Studio |
| Rate limiting, logging, error taxonomy | Done, unit tested |
| Billing | Interfaces only — deliberately not faked |
| Agent state machine, change sets, approval gate | **Verified live** — 44/44 |
| Server-driven repair loop | Done; exercised by the acceptance run |
| Run history (`/activity`) | Done — reads the four Step 7 tables |
| Game Blueprint (questions → plan → approval) | **Verified live** — 23/24, needs a real model |
| Real Roblox output on the landing page | Done — places built and captured in Studio |

## QA accounts

Two confirmed accounts exist in the project for `verify:security`. Their
addresses and password live in `.env.local` as `QA_USER_A` / `QA_USER_B` /
`QA_PASSWORD` — deliberately not in any tracked file.

Delete them before going to production:

```sql
delete from auth.users where email like 'blockwright.qa.%@gmail.com';
```

Note: email confirmation is **on**, so signups do not return a session until the
link is clicked. For local development, turn it off under Authentication →
Sign In / Providers → Confirm email.

## Known gaps

- **Rate limiting is in-process.** Fine for a single region; multi-region needs a
  shared store. `lib/rate-limit.ts` exposes the interface Redis would.
- **Database types are hand-maintained** (`lib/supabase/types.ts`). If the SQL
  changes, change that file in the same commit. They must stay **type aliases,
  not interfaces** — an interface has no implicit index signature and fails
  postgrest-js's `Record<string, unknown>` constraint, making every query resolve
  to `never`.
- **Hand-inserting `auth.users` rows breaks GoTrue.** It scans
  `confirmation_token`, `recovery_token`, `email_change*` into non-nullable Go
  strings; a raw INSERT leaves them `NULL` and every auth call then 500s with
  "Database error querying schema". Set them to `''` and add an
  `auth.identities` row. Prefer the signup API.
- **Conversation history capped at 200 messages** in `/api/chat`.
- **Composer attachments disabled** with a tooltip.
- **Light-theme contrast backlog.** `npm run a11y` could not see most of the
  palette until its colour parser was fixed (below). The workspace, marketing,
  dashboard, templates, credits and settings routes are clean in both themes;
  `/pricing` ("Most credits per dollar" 3.59:1, "Default" 3.19:1), `/templates`
  (the count pill, 3.19:1) and `/activity` ("Needs approval", 3.32:1) still fail
  in light at 9–11px, and `/projects` has a pre-existing H1 → H3 heading jump.
- The `(app)` loading skeleton is dashboard-shaped and also shows for the
  workspace route, which is a brief visual mismatch.

## Next work, in priority order

1. Run the Studio plugin cycle inside a real place — the last unverified path.
2. Enable leaked-password protection in the Supabase dashboard.
3. Clear the light-theme contrast backlog listed under Known gaps.
4. Conversation summarisation past ~150 messages.
5. Stripe checkout behind the existing `CREDIT_PACKS` interface.

## Workspace editor (2026-08-19)

The code panel is an editor now, not a viewer. Four pieces, each judgeable on
its own:

**Diff.** `lib/diff.ts` is a Myers O(ND) line diff with hunking, side-by-side
pairing and word-level spans inside a changed line. No dependency: the whole
thing is one shortest-edit search, and a diff library would arrive with a
renderer, a patch parser and a merge engine nothing here calls.
`GET /api/agent/changesets/[id]/diff` serves the exact stored content and the
exact staged content — `toPreview()` still omits content, because a change
*summary* does not need it, but an approval does. "Review changes" opens the
diff, the file list, and the approve control in one frame.

**Editing.** `lib/actions/files.ts` adds `saveFile` and `createFile`. A
user-supplied path is no more trusted than a model-supplied one, so both go
through `validateProjectPath`; the previous content is snapshotted into
`file_revisions` before the write, and the write is conditional on the revision
the editor had open, so a generation landing mid-edit reports a conflict instead
of eating the edit.

**Editor quality.** Line numbers, current-line, in-file search with match
stepping, live Luau diagnostics on the *draft*, and Luau-aware keys: Tab to the
next stop or over a block, Enter carrying indentation and adding a level after
`then`/`do`/`function`/`repeat`/`{`, auto-dedent when a line becomes `end` /
`else` / `until`, `⌘/` to comment, `⌥↑/↓` to move lines, `⌘S` to save. The rules
are pure functions in `lib/editor/luau-editing.ts` and tested as string
transformations.

**Multi-file.** Tabs with per-tab dirty state and drafts that survive switching,
`⌥←/→` between them, and `⌘P` go-to-file with subsequence matching. The panel
expands to `min(52rem, 55vw)` so a nine-file change set is not reviewed through
a 22rem slot.

### Measured

- **+10.1 KB gzipped** to the client bundle (623,635 → 634,009 B over 39
  chunks), for the editor, the diff, the tokeniser, the edit rules, tabs and
  go-to-file. CodeMirror 6 is 125.6 KB gzipped before a Lua grammar; Monaco is
  852 KB plus a 44 KB icon font (bundlephobia, measured 2026-08-19).
- **78 new tests** across `diff`, `luau-editing`, `luau-highlight`,
  `file-actions` and `fuzzy`; suite now 397 across 19 files.
- Diffing a 2,000-line file with two changed lines: **under 150 ms**, pinned by
  a test. Past a 4,000-edit bound the diff says so and falls back to a wholesale
  replace rather than chasing a quadratic answer nobody can read.

### The highlighter moved, and got a lexer's memory

`lib/roblox/luau-highlight.ts` is the tokeniser lifted out of the old
`code-viewer.tsx`. Its test used to rebuild the patterns by reading the
component's source, because the function was private to a client component; it
imports the module now. It also tokenises the whole buffer and splits tokens
across lines afterwards, rather than restarting per line — `--[[` and `[[` run
past a newline, and a highlighter restarted on every line cannot see that it is
still inside one.

### The accessibility audit had a blind spot

`scripts/a11y.mjs` parsed colours with an `rgba()` regex. Every Tailwind opacity
modifier on an oklch token (`text-muted-foreground/45`) computes as
`oklab(...)`, which the regex did not match — so `parse()` returned null and the
check skipped the element silently. A 2.29:1 line-number gutter and a 2.55:1
credit badge both audited as clean.

Colours resolve through a canvas now, and translucent text and stacked
translucent surfaces are composited rather than treated as opaque. That found
six real contrast failures on the workspace and marketing routes, all fixed, and
the backlog above.
