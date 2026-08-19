# Architecture

> Read this before changing anything in `src/lib/`. It explains *why* the
> boundaries are where they are, which is the part that is expensive to
> rediscover.

## Stack

| Concern    | Choice                                       | Notes |
| ---------- | -------------------------------------------- | ----- |
| Framework  | Next.js 16 (App Router, Turbopack)           | `middleware` is now **`proxy.ts`**, Node runtime only |
| UI         | React 19, Tailwind v4, shadcn/ui (Base UI)   | shadcn style `base-nova`; primitives use `@base-ui/react`, **not** Radix |
| AI         | Vercel AI SDK **v7** (`ai@7`)                | v7 renamed a lot — see "AI SDK v7 gotchas" below |
| Providers  | `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` | |
| Data/Auth  | Supabase (Postgres + Auth + RLS)             | |
| Tests      | Vitest                                       | `tests/*.test.ts`, node environment |

## Request flow

```
browser ──► proxy.ts ──────────────► refresh session cookie, gate /dashboard etc.
        └─► Server Component ──────► lib/data/queries.ts  (user-scoped client, RLS)
        └─► Server Action ─────────► lib/actions/*        (user-scoped client, RLS)
        └─► POST /api/chat ────────► auth → ownership → rate limit → credit
                                     pre-flight → provider → stream → persist
                                     → charge
Studio plugin ──► POST /api/studio/{pair,poll} ──► service-role client + token auth
```

## The three Supabase clients, and when to use which

This is the single most important distinction in the codebase.

| File | Key | Use for |
| ---- | --- | ------- |
| `lib/supabase/client.ts` | anon | Browser components. RLS applies. |
| `lib/supabase/server.ts` | anon + user cookie | **Default for everything server-side.** RLS applies as the signed-in user. |
| `lib/supabase/admin.ts`  | service role | **Only the Roblox Studio bridge.** A polling plugin has no session, so this module does the authorization itself. |

**Rule:** if you reach for `admin.ts`, you are now responsible for authorization
yourself. Do not widen its use — credits and AI request logging were deliberately
moved *off* it (see below), and the app is fully functional with no service-role
key configured at all.

### Why credits do not need the service role

`consume_credits` takes **no user id**. It reads `auth.uid()` inside the
function, so a caller can only ever spend their own balance no matter what it
passes — which makes it safe to expose to `authenticated`, and keeps the
RLS-bypassing key out of the generation path.

`grant_credits` (minting) *does* take an explicit user id, so it stays
`service_role`-only. That asymmetry is the whole design.

## Security model

Defence is layered so no single mistake is fatal:

1. **RLS on every table.** `credit_balances` deliberately has *no* write policy —
   the browser cannot move a balance even with a stolen anon key.
   Verified live by `npm run verify:security` (24 assertions).
2. **`proxy.ts`** redirects anonymous users away from the app area. This is UX;
   it is not the security boundary.
3. **Explicit ownership checks** in routes and actions, so a wrong id gives a
   404 rather than a silent empty result.
4. **Zod at every input boundary** — API bodies, server-action form data, and
   every AI tool's `inputSchema`.
5. **`validateProjectPath`** for anything the model proposes as a file path.
   This is an allowlist (`src/`, `docs/`, known extensions, no traversal), not a
   denylist. Tested in `tests/project-model.test.ts`.
6. **Studio commands are allowlisted verbs**, never code. The plugin refuses an
   action it does not recognise.

## AI layer

```
lib/ai/registry.ts            Model catalogue + section/label config. The UI reads ONLY this.
lib/ai/providers.ts           The only file that imports a provider SDK.
lib/ai/openrouter-catalog.ts  Live catalog fetch, normalisation, caching, merge.
lib/ai/tools.ts               The agent's action surface (zod + server-side re-validation).
lib/ai/system-prompt.ts       Operating instructions.
lib/ai/types.ts               BlockwrightUIMessage — typed data parts.
app/api/chat/route.ts         Orchestration.
```

**Adding a provider is a two-file change**: add rows to `registry.ts`, add a
case to `providerFactory()` and `isProviderAvailable()` in `providers.ts`.
Nothing in `components/` branches on provider — the model selector does not know
OpenRouter exists.

### Curated vs discovered models

Two kinds of entry reach the selector:

- **Curated** — hand-written in `registry.ts` with a `lastVerified` date, a
  product-authored description, credit price and discovery labels.
- **Discovered** — pulled live from OpenRouter's catalog at runtime.

`mergeCatalog()` lets curated entries win on *editorial* fields (name,
description, labels, credit price) while always refreshing the *factual* ones
(free status, provider price, context length, status). That is what stops a
model that quietly became paid from still showing a FREE badge.

Only **free** discoveries are merged in. Surfacing all ~400 paid OpenRouter
models would drown the selector, and the curated list is the product's opinion
about what is worth using for Roblox work.

### Free-tier discovery

OpenRouter's free catalog genuinely churns, so a hardcoded list is guaranteed to
start lying. `openrouter-catalog.ts` fetches it, derives free status from the
`pricing` field (never from a `:free` suffix, which is not authoritative), and
caches with:

- a TTL (`OPENROUTER_CATALOG_TTL_MS`, default 30 min)
- stale-while-revalidate up to 24h
- last-known-good fallback on fetch failure
- an in-flight guard so a cold cache does not stampede

Failure degrades to *fewer models*, never to *no models*: the curated registry
always stands on its own. Discovered models are additionally filtered to those
that output text and support tool calling — the agent cannot build with an image
or audio model, so offering one would only fail mid-generation.

### AI SDK v7 gotchas

v7 renamed a large amount of surface area. If you are working from older
examples or memory, these will bite:

| v6 and earlier | v7 |
| -------------- | -- |
| `system:` | **`instructions:`** |
| `onFinish` | **`onEnd`** |
| `result.fullStream` | **`result.stream`** |
| `stepCountIs(n)` | **`isStepCount(n)`** |
| `usage.cachedInputTokens` | `usage.inputTokenDetails.cacheReadTokens` |
| `usage.reasoningTokens` | `usage.outputTokenDetails.reasoningTokens` |
| `experimental_telemetry` | `telemetry` |

Two more that are easy to miss:

- **`convertToModelMessages` is async** and takes `{ tools }`. It needs the tool
  definitions to convert persisted tool-call parts back into model messages.
  This is why `buildTools()` is called *before* the stream opens, and status
  writes go through a `writerRef` holder rather than closing over `writer`.
- **`originalMessages` puts `createUIMessageStream` into persistence mode**,
  which is what populates `responseMessage` in `onEnd`. Without it you get the
  message list but no clean "here is the turn to save".

### Credit accounting

Charged in `streamText`'s `onEnd` from `usage`, which is **aggregated across all
steps** of a multi-step agent run — one charge per turn, not per tool call.

The pre-flight (`assertCanStartGeneration`) uses an *estimate* only to refuse a
request that clearly cannot be paid for. The actual charge always comes from
real reported tokens.

`consume_credits` is a `SECURITY DEFINER` function whose safety comes from one
statement:

```sql
UPDATE credit_balances SET balance = balance - p_amount
 WHERE user_id = v_user_id AND balance >= p_amount
RETURNING balance INTO new_balance;
```

`v_user_id` is `auth.uid()`, never an argument.

Postgres holds a row lock for that whole statement, so check-and-decrement
cannot interleave. No `RETURNING` row means the `WHERE` failed → raise
`INSUFFICIENT_CREDITS`.

## Notifications

A build takes minutes, and the creator is often not looking at it. The four
agent tables recorded a run finishing, failing or stopping for approval and
nothing ever told anyone, so `notifications` (migration `0010`) is that telling.

```
lib/notifications/events.ts     pure: copy, href, dedupe key, which sound
lib/notifications/service.ts    server: notify / getInbox / markRead
lib/notifications/announced.ts  client: what this tab already chimed for
app/api/notifications{,/read}   polled by the bell
components/app/notification-bell.tsx
```

The split is the same one the agent layer uses: decisions are pure functions
over plain shapes, so they can be tested without a Supabase client, and the one
module that touches the database is the only one importing `server-only`.

**Events are emitted where the transition happens**, in the chat route's
`streamText` handlers — next to `finishRun` and credit charging — not in a
watcher that polls for state changes. There is nothing to keep in sync.

**Emitting once is a database property, not a code property.** Both `onEnd` and
`onError` can fire for the same run, so the guarantee is a unique index on
`(owner_id, dedupe_key)`; a duplicate insert is a no-op, not an error. The
route's existing `runClosed` boolean is about closing the run, and reusing it
for notifications would tie two unrelated invariants to one flag.

**Polling, not realtime.** One indexed read every 20 seconds needs no socket, no
extra service and no reconnection logic, and being 20 seconds late on a
five-minute build costs nothing. It stops entirely while the tab is hidden — the
bell is mounted on every page, so a background tab polling forever would be a
battery drain with no reader. Same pattern as `studio-panel.tsx`.

**Why `announced.ts` exists.** The workspace already plays `complete` the
instant its own stream ends, which is right for someone watching. The bell then
sees the same event a poll later and would play it again. So the workspace
records that it announced a project's run, and the bell skips the *sound* —
never the badge — for a notification that lands inside the window. Module-level
state is the correct scope here: one tab, ephemeral, and nothing should
re-render when it changes.

Delivery is exactly as durable as credit charging, because it happens in the
same handler. That is a deliberate ceiling, not an oversight: making it stronger
means a queue, and a queue is a bigger commitment than the feature warrants
today.

## Roblox Studio bridge

Studio plugins can make **outbound** HTTP requests but cannot accept inbound
connections. So the transport is a poll queue, not a websocket:

```
1. User clicks Connect       → server writes a 6-char pair_code (10 min TTL)
2. User pastes it in Studio  → POST /api/studio/pair → returns a token
                               (server stores only sha256(token))
3. Plugin loops              → POST /api/studio/poll every 1–3s
                               ├─ reports previous batch results
                               ├─ heartbeat (this is what "connected" means)
                               └─ receives next queued commands
```

Why a queue table rather than a socket:

- durable — a command survives a Studio restart
- auditable — the activity feed is just a read of `studio_commands`
- zero infrastructure
- `last_seen_at` age *is* the liveness signal (`lib/studio/liveness.ts`), so no
  background reaper job is needed

`dispatchCommands()` resolves `sync_files` into concrete
`{name, className, service, source}` payloads **server-side**. The plugin never
queries the database, never holds a service-role key, and never receives
anything to `loadstring`.

## Project ↔ Roblox mapping

The web app owns a **file tree**. Studio owns **Instances**. These are not the
same thing, and pretending otherwise is where naive tools break.
`lib/roblox/project-model.ts` makes the mapping explicit:

| Path prefix   | Roblox service                        |
| ------------- | ------------------------------------- |
| `src/server`  | `ServerScriptService`                 |
| `src/client`  | `StarterPlayer.StarterPlayerScripts`  |
| `src/shared`  | `ReplicatedStorage`                   |
| `src/ui`      | `StarterGui`                          |
| `docs`        | `ReplicatedStorage`                   |

Everything the plugin creates lands inside a folder named `Blockwright` under
the relevant service, so it never mixes with hand-placed instances.

## The Luau validator

`lib/roblox/luau-validator.ts` is **not** a parser. It is a feedback signal for
the agent: every rule targets a mistake language models demonstrably make in
Roblox code (`!=` instead of `~=`, `game.Players` instead of
`game:GetService("Players")`, `LocalPlayer` in a server script, unbalanced
`end`). Output is fed back as a tool result and the model fixes itself.

The block-balance counter subtracts `duplicateDo` because `for x do` and
`while x do` each contribute two openers but only one `end`.

## Postgres gotchas that cost real time

**`REVOKE ... FROM anon, authenticated` is a no-op.** `CREATE FUNCTION` grants
`EXECUTE` to `PUBLIC`, and every role inherits from `PUBLIC`. You must
`REVOKE ... FROM PUBLIC`. The tell in `pg_proc.proacl` is a leading `=X/postgres`
— an empty grantee means PUBLIC.

This matters more than it sounds: PostgREST publishes every `public`-schema
function at `/rest/v1/rpc/<name>`, so a `SECURITY DEFINER` function with the
default grant is an **unauthenticated internet endpoint**. `grant_credits` was
one, and could mint unlimited credits. `tests/migration-safety.test.ts` now fails
the build if a revoke omits `PUBLIC`.

**Hand-inserting `auth.users` rows breaks GoTrue.** It scans
`confirmation_token`, `recovery_token` and `email_change*` into non-nullable Go
strings. A raw `INSERT` leaves them `NULL`, and every auth request then returns
`500 Database error querying schema`. You also need a matching `auth.identities`
row for email login. Prefer the signup API; if you must insert, set those columns
to `''`.

## Verifying against a live database

```bash
npm run verify:security
```

Signs in as two real users and attempts every cross-tenant read, write, forge and
privilege escalation the schema should refuse. Unit tests cover our logic; this
covers Postgres actually enforcing it. Run it after any migration.

## Conventions

- Server-only modules import `"server-only"` at the top.
- Errors go through `AppError` / `toAppError`. Internal detail is logged, never
  returned to the browser (`tests/errors.test.ts` pins this).
- Logging is one JSON line per event via `lib/logger.ts`, with key-based
  redaction of anything matching `key|token|secret|password|authorization|cookie`.
- Navigation uses `LinkButton`, not `<Button render={<Link/>}>` — Base UI's
  Button carries native button semantics and forcing an anchor through it breaks
  keyboard and screen-reader behaviour.
- Do not mirror derived data into state. The React Compiler lint enforces this
  and it caught three real bugs during the build.
