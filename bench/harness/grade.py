"""
Test-gated grading, after SWE-bench Verified.

The shape is theirs and the reasons are worth restating, because each one is a
way a benchmark can quietly score the wrong thing:

  * Two test sets, not one. `fail_to_pass` must go red-to-green, `pass_to_pass`
    must stay green. Without the second, deleting the failing test scores.
  * Three outcomes, not two. FULL, PARTIAL, NO. Two-way hides the interesting
    middle: a patch that fixes some target tests without breaking anything is a
    different animal from one that breaks the project.
  * Anything that is not an observed pass counts as a failure — including a
    timeout and including an error. SWE-bench guards this explicitly for skips,
    with the note that otherwise "a patch that makes every F2P test skip lands
    in neither list and scores RESOLVED_FULL". A benchmark should never have a
    path where doing nothing scores full marks.
  * Infrastructure failure is recorded separately from model failure. A harness
    that cannot run is not a model that cannot code.

One guard is ours rather than theirs. `compute_fail_to_pass` in the reference
returns 1.0 when there are no fail-to-pass tests at all, which is correct for
their averaging but means a malformed task scores a free pass. Here a task with
an empty `fail_to_pass` is rejected at validation time, before anything runs.
"""

from __future__ import annotations

from dataclasses import dataclass

from harness.execute import ExecResult, run_luau
from schema.task import Resolution, Task, TaskResult, TestCase


class InvalidTask(ValueError):
    """A task that cannot be scored honestly."""


def validate_task(task: Task) -> None:
    if not task.fail_to_pass:
        raise InvalidTask(
            f"{task.task_id}: no fail_to_pass tests. A task with nothing to fix "
            f"scores 1.0 for free — the reference harness averages to 1 on an "
            f"empty set, so this has to be caught here instead."
        )
    seen = set()
    for case in list(task.fail_to_pass) + list(task.pass_to_pass):
        if case.name in seen:
            raise InvalidTask(f"{task.task_id}: duplicate test name {case.name!r}")
        seen.add(case.name)


@dataclass
class TestOutcome:
    name: str
    passed: bool
    reason: str
    duration_s: float


def _run_case(files: dict[str, str], case: TestCase) -> TestOutcome:
    """
    A test is a Luau file that runs to completion or raises.

    Only exit code 0 counts as a pass. A timeout, a runtime error, a failed
    assertion and a harness problem are all not-a-pass, which is the point.
    """
    harness_file = "__bw_test.luau"
    merged = dict(files)
    merged[harness_file] = case.source

    result: ExecResult = run_luau(merged, harness_file, timeout_s=case.timeout_s)

    if result.infra_error:
        return TestOutcome(case.name, False, f"infra: {result.infra_error}", result.duration_s)
    if result.timed_out:
        return TestOutcome(case.name, False, f"timeout after {case.timeout_s}s", result.duration_s)
    if result.exit_code != 0:
        first = (result.stderr.strip().splitlines() or ["non-zero exit"])[0]
        return TestOutcome(case.name, False, first, result.duration_s)
    return TestOutcome(case.name, True, "ok", result.duration_s)


def resolution_of(f2p_passed: int, f2p_total: int, p2p_passed: int, p2p_total: int) -> Resolution:
    """
    SWE-bench Verified's criteria, unchanged.

    FULL when every target test passes and nothing regressed. PARTIAL when some
    target tests pass and nothing regressed. NO otherwise — which includes the
    case where the target tests all pass but something else broke, because a fix
    that breaks the project is not a fix.
    """
    if f2p_total == 0:
        raise InvalidTask("no fail_to_pass tests; refusing to score")

    f2p = f2p_passed / f2p_total
    # An empty pass_to_pass set means nothing was regression-guarded. Treated as
    # intact rather than as a failure, matching the reference, but a task that
    # ships without one is weaker and the authoring guidance says so.
    p2p = 1.0 if p2p_total == 0 else p2p_passed / p2p_total

    if f2p == 1.0 and p2p == 1.0:
        return Resolution.full
    if 0.0 < f2p < 1.0 and p2p == 1.0:
        return Resolution.partial
    return Resolution.no


def grade(task: Task, candidate_files: dict[str, str], model: str) -> TaskResult:
    """
    Score one candidate solution.

    `candidate_files` is the project state after the model's change — the same
    unit SWE-bench works in, a repository state rather than a lone function.
    """
    validate_task(task)

    result = TaskResult(task_id=task.task_id, model=model)
    result.response_present = bool(candidate_files)
    result.code_extracted = bool(candidate_files)

    if not candidate_files:
        result.detail["note"] = "no files produced by the model"
        return result

    f2p = [_run_case(candidate_files, c) for c in task.fail_to_pass]
    p2p = [_run_case(candidate_files, c) for c in task.pass_to_pass]

    # An infra failure anywhere makes the whole score untrustworthy, so it is
    # flagged rather than folded into the numbers.
    infra = [o for o in f2p + p2p if o.reason.startswith("infra:")]
    if infra:
        result.infra_failure = True
        result.infra_detail = infra[0].reason

    result.fail_to_pass_passed = sum(1 for o in f2p if o.passed)
    result.fail_to_pass_total = len(f2p)
    result.pass_to_pass_passed = sum(1 for o in p2p if o.passed)
    result.pass_to_pass_total = len(p2p)
    result.duration_s = sum(o.duration_s for o in f2p + p2p)

    result.resolution = resolution_of(
        result.fail_to_pass_passed, result.fail_to_pass_total,
        result.pass_to_pass_passed, result.pass_to_pass_total,
    )
    result.detail["fail_to_pass"] = [{"name": o.name, "passed": o.passed, "reason": o.reason} for o in f2p]
    result.detail["pass_to_pass"] = [{"name": o.name, "passed": o.passed, "reason": o.reason} for o in p2p]
    return result


def verify_task_gate(task: Task) -> dict[str, object]:
    """
    Prove a task's gate actually discriminates.

    With the reference solution applied, every fail_to_pass must pass. WITHOUT
    it, at least one must fail. A task whose target tests already pass before the
    fix measures nothing and will silently inflate every score computed from it,
    so this runs at authoring time and refuses.
    """
    validate_task(task)
    before = {f.path: f.content for f in task.files}

    broken = [_run_case(before, c) for c in task.fail_to_pass]
    if all(o.passed for o in broken):
        return {
            "ok": False,
            "reason": "every fail_to_pass test already passes before the fix — "
                      "this task measures nothing",
            "before": [{"name": o.name, "passed": o.passed, "reason": o.reason} for o in broken],
        }

    guard = [_run_case(before, c) for c in task.pass_to_pass]
    if not all(o.passed for o in guard):
        return {
            "ok": False,
            "reason": "a pass_to_pass test fails on the UNMODIFIED project, so it "
                      "cannot detect a regression",
            "before": [{"name": o.name, "passed": o.passed, "reason": o.reason} for o in guard],
        }

    return {"ok": True, "failing_before": sum(1 for o in broken if not o.passed)}
