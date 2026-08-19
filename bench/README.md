# Blockwright Model Benchmark

Execution-based evaluation for Roblox and Luau code generation, plus the
training-data factory that feeds a future fine-tune. **Nothing here trains a
model.**

## The two bars

Measured against the official implementations, not against descriptions of
them. Both were cloned and read before any of this was designed.

**LiveCodeBench** (`LiveCodeBench/LiveCodeBench`) contributes:

- Four scenarios rather than one: `codegeneration`, `selfrepair`,
  `testoutputprediction`, `codeexecution`. A benchmark that only asks for fresh
  code measures one skill and calls it competence.
- **Contamination as a date, not a promise.** Every problem carries a
  `contest_date`; every model carries a `release_date`; the runner filters with
  `--start_date` / `--end_date` so a model is scored only on problems that
  postdate its training cutoff. This is the single most copyable idea in the
  repository.
- Private test cases stored `base64(zlib(pickle(...)))` so a published dataset
  does not hand over its own answer key to the next crawler.

**SWE-bench Verified** (`princeton-nlp/SWE-bench`) contributes:

- **Test-gated pass/fail.** An instance names `FAIL_TO_PASS` tests that must go
  from failing to passing, and `PASS_TO_PASS` tests that must stay passing.
  Resolution is `FULL` only when both are 1.0; `PARTIAL` when fail-to-pass is
  between 0 and 1 with maintenance intact; otherwise `NO`.
- Repository-level work: the unit is a patch against a real project, not a
  function against a signature.
- One guard worth copying verbatim, from `grading.py`: **a skipped
  fail-to-pass test counts as failed.** Without it, a patch that makes every
  target test skip lands in neither the success nor the failure list and scores
  `RESOLVED_FULL`.
- A report that separates infrastructure failure from model failure
  (`patch_is_None`, `patch_exists`, `patch_successfully_applied`, `resolved`,
  `infra_failure`), so a broken harness is never scored as a bad model.

## Where the holdout lives

Not here. This repository is public.

The holdout lives outside the tree (default `~/blockwright-holdout`), is
gitignored by three separate patterns, and is represented in-repo only by a
hash manifest. A score is only meaningful next to the manifest hash of the
holdout it was measured against.

## Layout

    schema/         task and result shapes, shared by every piece
    runtime/        Roblox API surface for plain `luau`, which has none
    harness/        sandboxed execution and scoring
    contamination/  leakage detection between training data and holdout
    factory/        training-data pipeline: provenance, dedup, quality
    baselines/      recorded model scores, committed
    tasks/          PUBLIC example tasks only — never holdout content
