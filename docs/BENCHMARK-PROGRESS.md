# Blockwright benchmark — live progress

**Updated:** 19 Aug 2026, 12:20 · no model has been trained and none will be in
this workstream.

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
| Roblox API stub runtime | not started |
| Private holdout tasks | builder running |
| Contamination + dataset factory | builder running |
| Baselines | blocked, see below |

## Coverage

Eight categories in the schema: `code_generation`, `debugging`,
`api_correctness`, `security`, `multi_file`, `project_reasoning`,
`studio_runtime`, `agent_tool_use`. **0 tasks authored so far** — the builder is
mid-flight. Counts land here when it reports.

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
