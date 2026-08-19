"""
Prove every holdout task can tell a fix from no fix.

This is the check that decides whether the benchmark measures anything. A task
whose fail_to_pass tests already pass on the unmodified project scores 1.0 for
free and silently inflates every number computed from the set; a task whose
pass_to_pass tests fail on the unmodified project cannot detect a regression.
Both are authoring mistakes that no amount of careful scoring recovers from,
so they are caught here rather than discovered in a leaderboard.

Reports separately for tasks that need the Roblox stub, because until that
runtime exists their failures say nothing about the tasks themselves.

Run:  python3 bench/harness/verify_holdout.py [--holdout ~/blockwright-holdout]
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from harness.grade import verify_task_gate  # noqa: E402
from schema.task import Task  # noqa: E402

STUB_MARKER = "@bench/roblox"


def needs_stub(task: Task) -> bool:
    if any(STUB_MARKER in f.content for f in task.files):
        return True
    for case in list(task.fail_to_pass) + list(task.pass_to_pass):
        if STUB_MARKER in case.source:
            return True
    return bool(task.broken_source and STUB_MARKER in task.broken_source)


def apply_solution(task: Task, solution: dict, deletes) -> dict:
    """The project state a correct answer produces."""
    files = {f.path: f.content for f in task.files}
    for path in deletes or ():
        files.pop(path, None)
    files.update(solution or {})
    return files


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--holdout", default=os.path.expanduser("~/blockwright-holdout"))
    args = parser.parse_args()

    sys.path.insert(0, args.holdout)
    from tasks.registry import HOLDOUT  # noqa: E402

    runnable_ok, runnable_bad, stubbed = [], [], []

    for entry in HOLDOUT:
        task: Task = entry.task
        if needs_stub(task):
            stubbed.append(task.task_id)
            continue

        verdict = verify_task_gate(task)
        if not verdict.get("ok"):
            runnable_bad.append((task.task_id, verdict.get("reason", "?")))
            continue

        # The gate discriminating is necessary but not sufficient: the reference
        # solution also has to actually resolve it. A task nobody can pass is as
        # useless as one everybody passes.
        from harness.grade import grade
        result = grade(task, apply_solution(task, entry.solution, entry.solution_deletes), "reference")
        if result.resolution.value != "FULL":
            runnable_bad.append((
                task.task_id,
                f"reference solution does not resolve it: {result.resolution.value} "
                f"(f2p {result.fail_to_pass_passed}/{result.fail_to_pass_total}, "
                f"p2p {result.pass_to_pass_passed}/{result.pass_to_pass_total})",
            ))
        else:
            runnable_ok.append(task.task_id)

    total = len(HOLDOUT)
    print(f"\nholdout: {total} tasks")
    print(f"  needs the Roblox stub, not yet runnable  {len(stubbed)}")
    print(f"  gate verified AND reference resolves      {len(runnable_ok)}")
    print(f"  broken                                    {len(runnable_bad)}")
    for task_id, reason in runnable_bad:
        print(f"    {task_id}: {reason}")
    return 1 if runnable_bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
