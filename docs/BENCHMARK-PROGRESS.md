# Blockwright benchmark — live progress

**Updated:** 19 Aug 2026, 14:40 — PAUSED · no model has been trained and none will be in
this workstream.

## Paused — read this first on resume

Work stopped deliberately, not because of a failure. Everything green is
committed; one thing is deliberately NOT.

**The blocker to resolve first.** The contamination detector flags the new
Roblox stub runtime:

    holdout content appears in 1 repository file(s):
      runtime/roblox.luau (near_jaccard, 0.598)

`bench/runtime/` is therefore **gitignored and uncommitted**, so it cannot reach
this public repository until the flag is understood. Two possibilities, and they
need different actions:

1. **True positive** — holdout source was pasted into the stub while deriving
   its API surface. Then the stub must be rewritten from the audit's extracted
   member list alone, never from task bodies.
2. **False positive** — a Roblox API stub necessarily shares identifiers with
   every task that calls that API (`WaitForChild`, `FireServer`, `ChildAdded`).
   This is precisely the weakness the detector's author predicted: "real Roblox
   corpora are full of genuine boilerplate". If so, the fix is the genericity
   score they recommended, not a change to the stub.

Do not commit `bench/runtime/` until this is decided. Do not resolve it by
raising the threshold — that would disarm the check protecting the benchmark.

The stub builder reported "All 16 pass" for the stub-dependent tasks just before
it was stopped, but that was its own claim and has not been independently
verified; `verify_holdout.py` still reports those 16 as not runnable because it
does not yet mount the runtime.

**Also unfinished:** baselines (0 models, OpenRouter at $0.20), and the
per-piece critics against the two bars have never run.

## The bars, read rather than remembered

Both cloned to `~/bw-bench-refs` and read before anything was designed.

| Bar | What was taken from it |
|---|---|
| `LiveCodeBench/LiveCodeBench` | Four scenarios, not one. Contamination as a **date check** — problem `contest_date` vs model `release_date`, filtered by `--start_date`/`--end_date`. Private tests stored `base64(zlib(pickle(...)))` so a published dataset does not hand over its own answer key. |
| `princeton-nlp/SWE-bench` | Test-gated `FAIL_TO_PASS` / `PASS_TO_PASS`. Three-way resolution FULL / PARTIAL / NO. A report that separates infra failure from model failure. And one guard copied verbatim: **a skipped fail-to-pass test counts as failed**, or a patch that makes every target test skip scores `RESOLVED_FULL`. |

## Status

| Piece | State |
|---|---|
| Task + result schema | **done** — `bench/schema/task.py`, 6 scenarios, 8 categories |
| Sandboxed Luau execution | **done** — `bench/harness/execute.py` |
| Test-gated grader | **done** — `bench/harness/grade.py`, 14 tests passing |
| Holdout privacy | **done** — outside the repo, gitignored 3 ways, probe-verified |
| Contamination detection | **done** — 178 tests |
| Dataset factory | **done** — provenance → quality → leak gate → dedup |
| Private holdout tasks | **41 authored**, 25 fully gate-verified |
| Roblox API stub runtime | builder running — blocks the other 16 |
| Baselines | blocked, see below |
| Per-piece critics | not run |

## Coverage

**41 tasks, all eight categories.** 166 fail-to-pass tests, 96 pass-to-pass,
82 visible / 180 hidden, 89 project files.

| Category | Tasks | Category | Tasks |
|---|---|---|---|
| code_generation | 6 | security | 6 |
| debugging | 6 | api_correctness | 5 |
| multi_file | 4 | studio_runtime | 5 |
| project_reasoning | 4 | agent_tool_use | 5 |

By scenario: 19 `project_patch`, 11 `code_generation`, 6 `self_repair`,
5 `tool_use`. By difficulty: 10 easy, 26 medium, 5 hard.

### Gate verification — the check that decides whether any of this measures anything

    holdout: 41 tasks
      needs the Roblox stub, not yet runnable  16
      gate verified AND reference resolves      25
      broken                                    0

"Gate verified" is three separate claims per task, all executed: the
fail-to-pass tests genuinely FAIL on the untouched project, the pass-to-pass
tests genuinely PASS on it, and the reference solution resolves the task to
FULL. A task that misses any of those is refused rather than scored.

## Contamination status

**Not yet measured.** The mechanism exists in the schema (`authored_on`,
`provenance`) and the detector is being built. No leakage claim can be made yet
and none is made.

The holdout lives at `~/blockwright-holdout`, outside a **public** repository,
ignored by three patterns, verified with `git check-ignore`. Only a hash
manifest will ever be committed.

## Baselines

**0 models run.** Blocked on provider credit: the OpenRouter account has $0.20
left. The free router is available and will give a first reproducible baseline
at zero cost, but it is not a serious candidate model, so a baseline from it
should be read as a harness smoke test rather than a capability measurement.

## Honest limits, recorded rather than buried

- **No container isolation.** SWE-bench gives every instance its own Docker
  container; Docker is not installed here. Execution is process-level: wall-clock
  timeout with SIGKILL, an emptied environment, a fresh temp directory per run,
  and a path check so a task file cannot escape the sandbox.
- **`RLIMIT_AS` is not honoured on this host.** Probed, not assumed — the first
  version of that probe re-set each limit to its current value, which always
  succeeds, and so reported every limit as applied. Now probed in a child with
  the real target value. Applied on this machine: `RLIMIT_NOFILE` yes,
  `RLIMIT_CORE` yes, `RLIMIT_AS` **no**. Every run reports this next to its score.
- **Plain `luau` has no Roblox API.** No `game`, no `Instance`, no `workspace`.
  A stub runtime is needed, and every stub is a place the benchmark can diverge
  from real Roblox and score the wrong thing. The surface will be kept minimal
  and listed explicitly.

## Failures found so far

| Where | What |
|---|---|
| `execute.py` | `preexec_fn` raised on macOS because `RLIMIT_AS` is unsupported, killing the subprocess launch with an opaque error. Limits are best-effort now. |
| `execute.py` | The limits probe could not fail, so it claimed isolation the host does not provide. |
| `grade.py` | The reference `compute_fail_to_pass` returns 1.0 on an empty set — correct for their averaging, a free pass here. Empty `fail_to_pass` is now refused at validation. |
| `detector.py` | Assumed `files` is a list of `{path, content}` — what a Task serialises to — and raised on the `{path: content}` mapping an exported SOLUTION uses. That aborted the repository leak scan entirely, so the check protecting the benchmark had never completed, and the artefact it choked on is the answer key. |
| `execute.py` | No `.luaurc` was written, so `require("@proj/...")` never resolved. **All 25 runnable holdout tasks reported "a pass_to_pass test fails on the UNMODIFIED project" and not one of them was broken** — the harness could not import the code it was scoring. A benchmark that cannot load a task reports zero and it looks like a finding. |
| `quality.py` (factory) | `luau file.luau` EXECUTES rather than parses, and exits 1 on any Roblox script because plain Luau has no `game`. A syntax gate built on it would have dropped the entire Roblox corpus. Uses `luau-compile --only-parse`. |
