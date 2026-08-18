# Step 7 — Production agent + Studio execution layer

The Roblox Brain is now an agent: it classifies a request, plans before a
multi-file build, generates against retrieved documentation, validates its own
output, proposes a change set, and mutates the project **only** after an
explicit human approval it cannot grant itself.

**Status: complete.** Acceptance test **44/44**, unit tests **284**, live
security checks **37/37**, clean typecheck, lint and production build.

Five real defects were found by running the acceptance test rather than by
reading the code. All five are fixed and pinned by regression tests. One
requirement is partially implemented and is described honestly in §10.

---

## 1. What was built

Nothing existing was replaced. The Brain, retrieval, corpus, model config,
credits and Studio protocol are untouched; Step 7 wraps them.

The central decision: **the write tools became mode-aware rather than being
duplicated.** In `preview` the existing `create_file` / `update_file` /
`delete_file` stage operations into a change set; in `apply` they write. The
model sees an identical tool surface in both modes and cannot tell which it is
in — so it cannot behave differently when its writes are real.

```
src/lib/agent/
  types.ts           states, change operations, budgets  (pure)
  state-machine.ts   12 states, guarded transitions      (pure)
  changesets.ts      staging, validation, inversion      (pure)
  authorization.ts   who may apply, and on what evidence (pure)
  budgets.ts         step/repair/token/credit ceilings   (pure)
  classifier.ts      request kind → pipeline + budget    (pure)
  security.ts        Roblox exploit-class static review  (pure)
  planner.ts         structured plan schema + review     (pure)
  repair.ts          validate → repair policy            (pure)
  context.ts         project tree under a token budget   (server)
  audit.ts           run/step/tool-call/changeset records(server)
  executor.ts        replays an approved change set      (server)
```

The pure/impure split is deliberate: every rule that decides whether something
is allowed is a pure function over plain data, which is why 72 of the agent
tests need no database at all.

---

## 2. State machine

```
IDLE → ANALYZING → {PLANNING, RETRIEVING_KNOWLEDGE, GENERATING}
                 → GENERATING → VALIDATING
                 → VALIDATING → {EXECUTING_STUDIO, VERIFYING, REPAIRING, COMPLETED}
                 → REPAIRING → GENERATING
                 → * → {FAILED, CANCELLED}
```

Transitions are guarded, not conventional. `GENERATING → EXECUTING_STUDIO` is
**not** an edge, so unvalidated code cannot reach a place by any code path —
that is a structural guarantee rather than a review habit. Terminal states
accept nothing. A cancellation request diverts the next transition to
`CANCELLED` rather than throwing, so a cancelled run stops at a defined point
instead of unwinding mid-tool-call.

Observed in the acceptance run:

```
ANALYZING → RETRIEVING_KNOWLEDGE → GENERATING → VALIDATING → COMPLETED
```

Every transition is written to `agent_steps` with run, owner, step index,
previous state, new state, reason and timestamp.

---

## 3. Authorization model

This is the part that matters most, so it is stated plainly.

**Approval is an HTTP endpoint reached by a button, never a sentence.**

- `resolveMode` defaults to `preview` and only returns `apply` for the exact
  string `"apply"`. Anything unrecognised degrades safely.
- `authorizeApply` checks, independently: authenticated, owns the project, owns
  the change set, status is `approved`, not already applied, no blocking issues.
- Chat text is explicitly *not* an authorization channel. `looksLikeAssent`
  exists solely to produce a better refusal: "yes", "do it", "looks good",
  "ship it", "lgtm" all return `conversational_assent_is_not_approval` and tell
  the user to use the Approve control.
- The `apply_changes` **tool** exists and is typed, and it routes through the
  same `authorizeApply`. During a preview run there is no approved change set,
  so it always declines. A prompt-injected "apply the changes" is therefore
  inert by construction, not by instruction.
- Apply replays the **stored operation list**. The model is not consulted at
  apply time. If it were, the user would be approving an intention rather than
  a change.

Proven live in the acceptance run: apply refused while pending (403
`changeset_not_approved`), refused unauthenticated (401), a second user could
not approve someone else's change set (404), and nothing was written through
any of it.

---

## 4. Change sets

```ts
{
  kind: "create" | "update" | "delete" | "move" | "rename",
  path, toPath?, content?, fileKind?, robloxParent?,
  precondition: { mustExist, expectedRevision? },
  rollback:     { kind, path, content?, revision? },
  summary
}
```

Rollback is captured at **stage** time against the file's state *before the run
started*, not derived at apply time — so an operation remains undoable even
after a later operation in the same change set has touched the file.

Persisted to `agent_changesets` with status, operations, issues and counts.
There is no delete policy on that table: an approval record that can be erased
is not an audit trail.

---

## 5. Validation pipeline

One gate, used by both preview and apply:

1. **Structural** — operation after delete, duplicate create, empty content,
   missing move destination, path re-validation.
2. **Luau** — the existing validator, on the resulting file state.
3. **Security** — the Roblox rules in §6.

A change set with any error cannot be approved (422) and cannot be applied
(403). The apply endpoint re-validates the stored operations before writing,
because a stored change set is data and data that reaches a write is re-checked.

---

## 6. Roblox security review

Static checks for the exploit classes that actually ruin Roblox games:
client-authoritative currency, damage and inventory; RemoteEvent handlers with
no argument validation; missing player-ownership checks; client access to
ServerStorage/ServerScriptService; `LocalPlayer` on the server; remotes fired in
the wrong direction; misplaced LocalScripts and Scripts; `loadstring`;
hard-coded secrets; untrusted URLs; `SetAsync` without a read; non-yielding
loops; connections created inside loops.

Two design points worth stating:

- Rules that look for evidence **inside a string** (a hard-coded key, a URL,
  `game:GetService("ServerStorage")`) run on comment-stripped but
  string-preserving text. Running them on fully stripped lines made them
  structurally incapable of firing — a bug the tests caught.
- Severity is **earned**. `non-yielding-loop` reports `error` only when the loop
  body contains no calls at all; when it delegates to functions the rule cannot
  see into, it reports a warning instead. See §9.

This is lint, not proof, and the tool result says so to the model. Nothing here
licenses a claim that generated code is secure.

---

## 7. Tools

Reused and made mode-aware: `create_file`, `update_file`, `delete_file`,
`list_files`, `read_file`, `validate_scripts`, `studio_status`,
`request_studio_action`, `search_roblox_knowledge`.

Added: `submit_plan` (schema-constrained), `get_api_symbol`,
`search_code_examples`, `security_review`, `preview_changes`, `apply_changes`
(authorization-gated, always declines in preview), `studio_run_test`,
`studio_get_output`. `run_test` was added to the Studio allow-list.

`validate_scripts` and `security_review` merge staged content over stored
content in preview — otherwise they would validate the project as it exists
rather than as it is being proposed, which is the wrong thing entirely.

The model never receives a shell, a filesystem path outside the allow-list, or
SQL. Every path goes through `validateProjectPath`; every Studio action is an
allow-listed verb.

---

## 8. Planning

`submit_plan` is a zod-schema tool input, so the provider constrains generation
to the schema and the SDK validates before the application sees it. A malformed
plan is a tool error the model can retry, not a runtime crash.

The schema requires the fields that actually determine whether Roblox code
works: services, Instances with ClassNames and parents, scripts with context,
remotes with direction and payload validation, and an explicit client/server
boundary. `reviewPlan` then rejects plans that parse but would produce broken
code — a client path declared server-side, a client-to-server remote with no
server script to receive it, a LocalScript declared to run on the server.

Mandatory for multi-file builds, forbidden for questions.

---

## 9. Defects found by the acceptance test

The acceptance test failed five times before it passed. Each failure was real.

**1. Every state transition was silently dropped.** `agent_steps` has a foreign
key to `agent_runs`, and the run transitioned to `ANALYZING` *before* the run
row was inserted. The insert failed, and the fire-and-forget logger swallowed
it. Result: `0 transitions`. Fixed by creating the run row before the machine
exists.

**2. The run never reached a terminal state.** The route transitioned to
`RETRIEVING_KNOWLEDGE` and then never to `GENERATING`, and there is no
`RETRIEVING_KNOWLEDGE → VALIDATING` edge — so `tryTransition` correctly refused
and the run ended stuck. The machine was right; the route was wrong.

**3. Preview and apply used different gates.** `build()` recorded only
structural issues while apply re-validated with Luau and security. A change set
could be previewed as clean and then refused at apply, which makes the user's
approval meaningless — they approved something that was never what got checked.
Unified into `reviewChangeset`.

**4. Intermediate drafts blocked a correct build.** The agent wrote
`RoundSystem.server.luau` four times while correcting its own unbalanced
blocks. Validating *every* operation flagged the superseded drafts, so a change
set whose final state was valid was refused. Fixed by validating the resulting
state of each path (`finalState`) rather than every write.

**5. Undo reported failure after succeeding.** `invertOperations` emitted one
inverse per operation, so a path written three times produced three deletes: the
first succeeded and the rest failed with "does not exist". The undo was
completely correct and reported `ok: false`. Fixed by collapsing to one inverse
per path.

Two further false positives were fixed in the security rules: string-literal
stripping (§6) and `non-yielding-loop` firing on the standard Roblox pattern
`while true do waitForPlayers(); runRound() end`, where the yields live inside
the callees. That one blocked an otherwise correct build, which is exactly the
cost of an over-confident rule.

One assertion in the acceptance test was itself wrong: it required a client
script under `src/client/`, but the model put the HUD at `src/ui/`, which maps
to StarterGui and is client context by the project's own definition. The test
was corrected, not the product.

---

## 10. Partial implementation — stated plainly

**§12's automatic repair loop is not a server-driven re-prompt loop.**

What exists: the repair *policy* is implemented and tested (`decideRepair`,
maximum three attempts, failure-only prompts that never resend the project,
`exhaustedMessage`). Repair in practice happens inside the step budget — the
validation tools return diagnostics to the model mid-stream and it corrects
itself, which is observable in the acceptance runs, where the agent rewrote one
file three times to fix its own syntax errors.

What does not exist: a server-side loop that re-invokes generation after the
stream ends. Wiring that into the streaming route is a larger change to the
response architecture than Step 7 should make unannounced.

The deterministic guarantee that *does* hold is stronger in one respect: a
change set with any Luau or security error cannot be approved or applied, so
broken code cannot reach the project regardless of whether repair converged.

---

## 11. Database

`agent_runs`, `agent_steps`, `agent_tool_calls`, `agent_changesets` — migration
`0008`. All owner-scoped RLS; all four tables verified live to be unreadable by
`anon` and unforgeable across tenants.

**No functions were created.** That is deliberate: the Step-6 finding was that
every new function in `public` is born with EXECUTE granted to
`anon`/`authenticated`/`service_role` via Supabase's `ALTER DEFAULT PRIVILEGES`,
so the safest new function is the one you do not write. Everything here is table
access governed by policy.

Tool arguments and results are **not** stored — only a tool name, state, ok
flag, duration and a short summary. Script content already lives in
`project_files`, and a tool result can carry retrieved documentation, which is
bulk with no audit value.

---

## 12. Verification

| Check | Result |
|---|---|
| Corpus validation | PASS — 5,456 documents, 0 errors, 0 warnings |
| Knowledge DB validation | PASS — 14,012 chunks / 14,012 embeddings |
| Retrieval evaluation | Recall@5 **98.7%**, Recall@10 **100%**, MRR **0.910** |
| `tsc --noEmit` | clean |
| ESLint | clean |
| Unit tests | **284 passed** (14 files; 72 new agent tests) |
| Production build | success, 26 routes |
| `verify:security` | **37 passed, 0 failed** |
| **Agent acceptance** | **44 passed, 0 failed** |

Retrieval quality is unchanged from Step 6, as intended — nothing in the
retrieval layer was touched.

---

## 13. Acceptance result

Request: *"Create a simple Roblox round system. Players wait in a lobby, a
countdown starts when at least two players are present, players are moved into
the arena, the round lasts 60 seconds, then everyone returns to the lobby."*

| Requirement | Result |
|---|---|
| Classified as multi-file implementation | PASS |
| Retrieved Roblox documentation | PASS (`RETRIEVING_KNOWLEDGE`, 5.3s) |
| Produced a structured plan | PASS (`submit_plan`) |
| Produced a change set | PASS (3 files) |
| Validated the generated Luau | PASS (0 blocking issues) |
| Identified client/server boundaries | PASS (server controller, client HUD, shared config) |
| Passed security checks | PASS |
| **Remained in PREVIEW until approved** | **PASS — 0 files written** |
| Apply refused while pending | PASS (403) |
| Apply refused unauthenticated | PASS (401) |
| Another user could not approve | PASS (404) |
| Applied only after explicit approval | PASS (3/3 operations) |
| Verified resulting structure | PASS |
| Could not be applied twice | PASS (403) |
| Undo restored the project | PASS (3 reverted, 0 files remain) |
| No secret in the response stream | PASS |

Generated files:

```
src/shared/RoundConfig.luau
src/server/RoundController.server.luau
src/client/RoundHud.client.luau
```

---

## 14. Performance, against the Step 6 baseline

| | Step 6 | Step 7 |
|---|---|---|
| Retrieval | 4.8s | 5.0–5.4s |
| Time to first byte | 7.2s | 10.3s |
| Full run | 56–63s | 145–226s |
| Input tokens | ~70,000 | 321,000–546,000 |
| Credits | 21 | 92–159 |
| Tool calls | ~8 | 17–21 |
| Apply | n/a | 2.5–9.0s |

The increase is the agent doing more work: planning, reading, validating,
security-reviewing and self-correcting across ~20 tool calls, each of which
resends context. **This is the dominant cost of the system and the thing to
watch.** The budget ceilings exist for exactly this reason, and a budget
violation fails the run — it never silently substitutes a cheaper model, which
would bill the user for a model they did not choose.

Time to first byte grew by ~3s because classification and the change-set
snapshot happen before generation opens.

---

## 15. Known limitations

- **Repair is model-driven, not server-driven.** See §10.
- **Security review is regex-based** and cannot follow data flow or calls. It
  will miss real problems and occasionally flag safe code. `non-yielding-loop`
  already demonstrated both failure modes.
- **Studio execution is queue-based.** `studio_run_test` enqueues a command and
  results are read on a later turn; there is no synchronous run-test-read cycle
  inside a single run, so §17's "repair and rerun" loop spans turns.
- **Cancellation is a flag, polled between transitions.** A run cannot be
  interrupted inside a long tool call.
- **The project tree is file-based, not Instance-based.** The agent reasons
  about paths mapped to services; the plugin materialises Instances. Full
  DataModel introspection (§9) is limited to what `inspect_place` returns.
- **`agent_runs.tool_calls`** counts activity events, which approximates tool
  calls but is not identical to the provider's step count.
- **Cost per multi-file build is high** (~100–160 credits). Prompt caching and
  trimming inter-step context are the obvious next targets.
