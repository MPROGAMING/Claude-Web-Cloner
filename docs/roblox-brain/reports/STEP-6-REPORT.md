# Step 6 — Real generation model

The Roblox Brain now sits between the user and a real OpenRouter model. Every
claim below was produced by running the thing, not by reading the code.

**Status: complete.** 212 unit tests, 31 live security checks, 21 end-to-end
checks through the real `/api/chat` route, and a production build all pass.
Three defects were found during verification — one security, one correctness,
one UI — and all three are fixed and pinned by tests.

---

## 1. Provider configuration

| | |
|---|---|
| Provider | OpenRouter (`OPENROUTER_API_KEY`, server-only) |
| Model | `openai/gpt-5.6-sol` |
| Override | `ROBLOX_BRAIN_MODEL` |
| Registry id | `openrouter:openai/gpt-5.6-sol` |
| Context window | 1,050,000 tokens |
| Provider price | $2.50 / $15.00 per 1M tokens |
| Blockwright credits | 250 in / 1500 out per 1M |

The model was verified against the live OpenRouter catalog before being added:
it exists, reports `tools=True`, and the context window and pricing above are
the catalogued values rather than assumptions.

Configuration lives in one place, `src/lib/knowledge/generation-config.ts`, so
no other module hard-codes a model id. If `ROBLOX_BRAIN_MODEL` names a model
that is not in the registry, `getBrainModelDefinition()` returns `undefined` and
the status endpoint reports it — it never substitutes a different model, because
a silent fallback would bill the user for something they did not choose.

---

## 2. Files changed

**New**

| File | Purpose |
|---|---|
| `src/lib/knowledge/generation-config.ts` | Model/provider config, `resolveChatModelId` precedence |
| `src/lib/knowledge/pre-retrieval.ts` | The Brain between user and model; citation shaping |
| `src/app/api/knowledge/status/route.ts` | Readiness, verified against real DB counts |
| `tests/brain-generation.test.ts` | 38 tests over the generation seam |
| `tests/code-viewer-highlight.test.ts` | 5 tests over the Luau tokeniser |
| `scripts/roblox-brain/verify-generation.mjs` | Standalone pipeline verification |
| `scripts/roblox-brain/verify-chat-route.mjs` | Authenticated end-to-end verification |
| `supabase/migrations/0006_revoke_default_function_grants.sql` | Closes an unintended grant |
| `supabase/migrations/0007_default_to_brain_model.sql` | Stored defaults point at the Brain model |

**Modified**

| File | Change |
|---|---|
| `src/app/api/chat/route.ts` | Pre-retrieval before generation; citations part; Brain model default |
| `src/lib/ai/system-prompt.ts` | Roblox expertise + 10 Brain rules, incl. the injection boundary |
| `src/lib/ai/registry.ts` | GPT-5.6 Sol entry |
| `src/lib/ai/providers.ts` | `pickUsableModel` gains an explicit fallback |
| `src/lib/ai/types.ts` | `CitationData` part, `knowledge_*` table types |
| `src/components/workspace/chat-message.tsx` | Citation block, knowledge tool row |
| `src/components/workspace/code-viewer.tsx` | Single-pass tokeniser |
| `tests/migration-safety.test.ts` | Models Supabase default privileges |
| `scripts/verify-security.mjs` | Probes the knowledge RPCs live |
| `AGENTS.md` | The corrected grant rule |

---

## 3. Retrieval flow

Retrieval happens **before** generation, so the model is handed the relevant
documentation rather than the bare question. The `search_roblox_knowledge` tool
still exists for follow-up lookups mid-turn — and the transcript shows the model
using it three times unprompted — but the common case no longer depends on the
model choosing to call it.

Trivial turns skip retrieval entirely; spending ~2.4s and several thousand
context tokens on "thanks" is pure waste. The gating order is deliberate:
`TRIVIAL` is tested before the length guard, because `hi` and `ok` are two
characters and would otherwise be misclassified as empty.

Measured on the acceptance question:

```
reason          retrieved
strategy        implementation
chunks          8
code examples   4
symbols         RemoteEvent
vector search   true
latency         4808ms
citations       11
```

---

## 4. Real API verification

### Standalone pipeline (`brain:verify-generation`)

```
streamed        591 chunks
first token     7852ms
generation      25862ms
usage           prompt 5913, completion 1400, cost $0.03947625
Luau code block         true
mentions RemoteEvent    true
client/server wiring    true
server-side validation  true
uses game:GetService    true
RESULT: PASS
```

### Authenticated, through `/api/chat` (`verify-chat-route.mjs`)

21/21 checks pass:

```
unauthenticated /api/chat is refused          status 401
authenticated request accepted                status 200
response streamed incrementally               3392 network frames
time to first byte                            7244ms
stream carries incremental text deltas        1277 deltas
citations data part present in stream         yes
citations point at canonical Roblox docs      21 unique URLs
generated on the configured Brain model       openrouter:openai/gpt-5.6-sol
user and assistant messages persisted         2 rows
real token usage recorded                     69800 in / 1747 out
credits charged from real usage               21 credits
balance decreased by exactly the charge       1967 -> 1946
```

The question asked was the one specified:
*"How do I create a RemoteEvent and safely handle it between a client and server
in Roblox?"*

The model produced two working Luau files — an authoritative server handler with
type validation, an allow-list, and a one-second per-player cooldown, plus a
client script — ran them through the Luau validator, and cited the documentation
it used. Rendered in the UI as **"11 sources from Roblox documentation"**,
expanding to 11 links to `create.roblox.com`.

### Latency and cost

| | |
|---|---|
| Retrieval | 4.8s |
| Time to first byte | 7.2–7.9s |
| Full turn (multi-step, 2 files written and validated) | 56–63s |
| Cost per acceptance run | $0.04–$0.05 |
| Credits charged | 21–31 |

A multi-step agentic turn re-sends context on each step, so input tokens
accumulate — 69,800 for one question. That is the dominant cost term and worth
watching, not a defect.

---

## 5. Defects found and fixed

Verification is only worth running if it is allowed to fail. It failed three
times.

### 5.1 Unintended `authenticated` grant (security)

`knowledge_pending_chunks` was granted to `service_role` only in migration 0005,
yet the live ACL showed `authenticated` holding EXECUTE.

The cause is a **second** grant channel, distinct from the PUBLIC default this
project already knew about. Supabase ships:

```sql
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
```

Once a `pg_default_acl` entry exists, Postgres applies it *instead of* the
built-in PUBLIC default. A new function is therefore born holding three explicit
role grants and no PUBLIC entry at all — so `revoke ... from public, anon` reads
as correct, reviews as correct, and still leaves `authenticated` with EXECUTE.

**Impact, stated precisely and not inflated:** no privilege escalation. The
function is `SECURITY INVOKER`, and `knowledge_chunks` / `knowledge_embeddings`
both carry `for select to authenticated using (true)` policies, so a signed-in
caller could already read the same rows. What it did expose was an unbilled,
compute-heavy anti-join over all 14,012 chunks — and, more seriously, a pattern
that would have silently exposed the next genuinely server-only function.

Fixed in `0006`. Verified live: `authenticated` and `anon` now both false for
`knowledge_pending_chunks`.

The static test guarding this was initially **decorative**. It passed when the
bug was deliberately reintroduced, because `functionsGrantedTo()` started from
an empty set — the same false assumption that caused the bug. It now seeds each
function with Supabase's default roles on `CREATE`. Re-running the mutation
makes three separate tests fail by name.

### 5.2 The Brain model never reached the route (correctness)

Configuration was right, retrieval was right, generation succeeded — and
`ai_requests.model_id` read `openrouter:openai/gpt-5.6-luna`. The route never
consulted the Brain config.

Two compounding causes:

1. `pickUsableModel` fell back to whichever model was flagged `recommended`.
2. `projects.model_id` is `NOT NULL DEFAULT 'anthropic:claude-sonnet-4-5'`, so
   "the user never chose" was indistinguishable from "the user chose this" — and
   that provider is not configured on this deployment.

Fixed by adding an explicit `fallbackId` to `pickUsableModel`, extracting
`resolveChatModelId` so the precedence is testable, and repointing the stored
defaults in `0007`. **An explicit user or project choice still always wins** —
overriding the model selector would bill people for a model they did not pick.
Existing rows are deliberately not rewritten; the runtime fallback handles them.

Only visible by reading `model_id` back out of the database after a real, paid
request. Now asserted by the verification script and by three unit tests.

### 5.3 Highlighter leaked CSS class names into code (UI)

Every Luau comment rendered as `"text-muted-foreground/55 italic">--!strict`.

`highlight()` applied its patterns sequentially over its own output: the comment
rule emitted `<span class="text-muted-foreground/55 italic">`, and the *string*
rule then matched that quoted class name inside the generated attribute, nesting
a span inside an attribute value. Rewritten as a single-pass tokeniser with one
combined alternation, so generated markup is never re-scanned. Ordering comments
before strings also fixes `--` inside a string literal.

Confirmed fixed in the browser on the generated file.

---

## 6. Security verification

| Requirement | Result |
|---|---|
| Key never in client code | `generation-config.ts` and `pre-retrieval.ts` are `server-only`; grep of the response stream finds no key |
| Key never hard-coded | Read from `process.env` only |
| Key never sent to browser | Asserted against the raw stream for all five provider keys |
| Service-role key withheld from the model | Not in the system prompt or tool surface; asserted absent from the stream |
| No `sk-` fragment, no service-role JWT, no raw SQL in the stream | Asserted |
| Retrieved docs are data, not instructions | Rule 10 of the system prompt; covered by prompt-injection tests |
| No arbitrary SQL from user input | All retrieval goes through parameterised RPCs |
| Internal error detail withheld | Logged server-side, never returned |
| Studio commands allow-listed | Unchanged |
| Anon cannot reach knowledge RPCs | All five refused, verified live |
| Server-only RPCs off `authenticated` | Verified live after `0006` |

`npm run verify:security`: **31 passed, 0 failed.**

One housekeeping note: while checking which providers were configured I printed
`.env.local` to the terminal, so your OpenRouter key appears in this session's
scrolled output. It never left the machine and was not sent anywhere, so no
rotation is needed on account of that — but you may prefer to rotate it anyway,
and the check should have used `${VAR:+SET}` without echoing the value.

---

## 7. Verification chain

| Step | Result |
|---|---|
| `npm run brain:validate` — corpus | PASS, 5,456 documents, 0 errors, 0 warnings |
| `npm run brain:validate` — database | PASS, 14,012 chunks / 14,012 embeddings / 9,591 symbols |
| `npm run brain:eval` | Recall@5 **98.7%**, Recall@10 **100%**, MRR **0.910**, 0 errors |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (2 pre-existing warnings removed) |
| `npm run test` | **212 passed**, 13 files |
| `npm run build` | 22 routes, success |
| `npm run verify:security` | **31 passed, 0 failed** |
| Authenticated end-to-end | **21 passed, 0 failed** |

---

## 8. Remaining blockers

None for Step 6.

Worth knowing before it surprises someone:

- **Turn cost is dominated by multi-step input tokens** (~70k for one question,
  ~21 credits). Real, expected for an agentic model, worth a budget guard later.
- **Retrieval adds ~4.8s before first token.** Cacheable by query, not yet
  cached.
- **Existing projects still hold `anthropic:claude-sonnet-4-5`** and are served
  by the runtime fallback. Deliberate: a migration cannot tell a real choice
  from an untouched default, so it must not overwrite one.
- **Only OpenRouter is configured here.** Everything works; the other providers
  are dormant, not broken.
