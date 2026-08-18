# Implementation status

Last updated: 2026-08-18 · v0.2.0
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

- `npm run check` — lint, typecheck, **166 tests across 11 files**, production build (21 routes)
- `npm run verify:security` — **24/24 passing** against the real Supabase project
- Signup trigger fires: profile row + 2,000 credits + a `signup_bonus` ledger entry
- Sign-in through the real UI; dashboard, credits, settings and the workspace all
  render live data
- Project creation from a template → workspace opens with the template prompt
  seeded into the composer
- Studio pairing code generates and displays (`3FMPSV`, 10-minute expiry)
- Model selector correctly shows every model as unavailable, naming the missing
  provider key for each
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

## Not yet verified — external configuration required

**No AI provider key is configured** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY` are all empty), so no real
generation has run. The chat route, streaming, tool-calling and credit charging
are implemented against AI SDK v7's current API and unit-tested against fakes,
but have not made a live provider call. This is a credential gap, not an
implementation gap.

The OpenRouter **catalog** path *is* verified live — that endpoint is public, and
14 free models were fetched and merged into the running selector.

**No service-role key is configured**, so the Studio plugin's pair → poll →
execute → report cycle has not run inside Roblox Studio. Everything up to it —
pairing-code generation, the panel UI, command queueing — is verified.

Add either key to `.env.local` and restart; nothing else needs changing.

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
| Model registry + selector | **Verified live** — sections, search, logos, live free tier |
| OpenRouter provider | Code complete; catalog verified live, generation needs a key |
| Dynamic free discovery | **Verified live** — 14 models fetched and merged |
| Chat streaming, tool rows, plans, retry/stop | Code complete, no provider key |
| Agent tools + server-side validation | Done, unit tested |
| Luau validator | Done, unit tested |
| Credits: schema, atomic RPC, ledger, UI | **Verified live** |
| RLS / tenant isolation | **Verified live, 24 assertions** |
| Studio pairing UI + code generation | **Verified live** |
| Studio plugin bridge (pair/poll/dispatch) | Needs service-role key |
| Rate limiting, logging, error taxonomy | Done, unit tested |
| Billing | Interfaces only — deliberately not faked |

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
- **No diff view yet** — `file_revisions` already stores what it needs.
- **Composer attachments disabled** with a tooltip.
- The `(app)` loading skeleton is dashboard-shaped and also shows for the
  workspace route, which is a brief visual mismatch.

## Next work, in priority order

1. Add a provider key and exercise a real generation end to end.
2. Add the service-role key and run the Studio plugin cycle in Studio.
3. Enable leaked-password protection in the Supabase dashboard.
4. Diff view in the code panel using `file_revisions`.
5. Conversation summarisation past ~150 messages.
6. Stripe checkout behind the existing `CREDIT_PACKS` interface.

## Step 6 — Real generation model (verified)

Roblox Brain generates through OpenRouter `openai/gpt-5.6-sol`
(`ROBLOX_BRAIN_MODEL` overrides). Retrieval runs before generation; citations
reach the UI. Verified by a real authenticated request through `/api/chat`:
21/21 end-to-end checks, 212 unit tests, 31 live security checks, clean build.

Three defects were found by that verification and fixed — an unintended
`authenticated` EXECUTE grant from Supabase default privileges (migration 0006),
the Brain model never reaching the route (0007 + `resolveChatModelId`), and a
highlighter that leaked CSS class names into displayed code. Full detail in
`docs/roblox-brain/reports/STEP-6-REPORT.md`.

Verification commands:
- `npm run brain:verify-generation` — pipeline, one real request
- `node scripts/roblox-brain/verify-chat-route.mjs [--keep]` — authenticated end-to-end

## Step 7 — Production agent + Studio execution layer (verified)

The Brain is now an agent: classify → plan → retrieve → generate → validate →
propose change set → **human approval** → apply → verify → undo.

Preview is the default mode and writes nothing. Apply replays the exact approved
operation list; the model is not consulted at apply time and cannot approve its
own work — chat assent ("do it", "looks good") is explicitly refused.

Acceptance 44/44, unit tests 284, live security 37/37. Five real defects were
found by running the acceptance test; all fixed and pinned. Detail and the one
partial requirement (§12 repair loop is model-driven, not server-driven) in
`docs/roblox-brain/reports/STEP-7-REPORT.md`.

Commands:
- `npm run agent:verify` — full agent acceptance against a running dev server
- `npm run verify:security` — live RLS/grants, now including the agent tables
