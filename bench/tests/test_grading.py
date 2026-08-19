"""
The grader's own gate.

Each of these is a way a benchmark can score the wrong thing, taken from
reading the reference harnesses rather than invented.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from harness.grade import (  # noqa: E402
    InvalidTask, grade, resolution_of, validate_task, verify_task_gate,
)
from schema.task import (  # noqa: E402
    Category, Difficulty, ProjectFile, Resolution, Scenario, Task, TestCase, Visibility,
)


def make_task(**over) -> Task:
    base = dict(
        task_id="t1",
        scenario=Scenario.project_patch,
        category=Category.code_generation,
        difficulty=Difficulty.easy,
        visibility=Visibility.public,
        prompt="Make add() return the sum.",
        authored_on=date(2026, 8, 19),
        files=[ProjectFile(path="mod.luau", content="return { add = function(a, b) return 0 end }")],
        fail_to_pass=[TestCase(
            name="adds",
            source='local m = require("./mod") assert(m.add(2, 3) == 5, "add wrong")',
        )],
        pass_to_pass=[TestCase(
            name="module_loads",
            source='local m = require("./mod") assert(type(m.add) == "function", "no add")',
        )],
    )
    base.update(over)
    return Task(**base)


FIXED = {"mod.luau": "return { add = function(a, b) return a + b end }"}
BROKEN = {"mod.luau": "return { add = function(a, b) return 0 end }"}


class TestResolution:
    """SWE-bench Verified's three-way criteria."""

    def test_full_needs_both(self):
        assert resolution_of(2, 2, 3, 3) is Resolution.full

    def test_partial_is_some_targets_and_no_regression(self):
        assert resolution_of(1, 2, 3, 3) is Resolution.partial

    def test_breaking_a_passing_test_is_never_full(self):
        # Every target test green, but something regressed. A fix that breaks
        # the project is not a fix.
        assert resolution_of(2, 2, 2, 3) is Resolution.no

    def test_no_when_nothing_fixed(self):
        assert resolution_of(0, 2, 3, 3) is Resolution.no


class TestMalformedTasks:
    def test_empty_fail_to_pass_is_refused_not_scored(self):
        # The reference averages an empty set to 1.0, which is right for their
        # aggregate and would hand a malformed task a free pass here.
        with pytest.raises(InvalidTask, match="no fail_to_pass"):
            validate_task(make_task(fail_to_pass=[]))

    def test_duplicate_test_names_refused(self):
        dupe = TestCase(name="adds", source="assert(true)")
        with pytest.raises(InvalidTask, match="duplicate"):
            validate_task(make_task(pass_to_pass=[dupe]))


class TestGrading:
    def test_correct_solution_resolves_full(self):
        r = grade(make_task(), FIXED, model="fixture")
        assert r.resolution is Resolution.full
        assert (r.fail_to_pass_passed, r.fail_to_pass_total) == (1, 1)
        assert not r.infra_failure

    def test_unfixed_project_does_not_resolve(self):
        r = grade(make_task(), BROKEN, model="fixture")
        assert r.resolution is Resolution.no
        assert r.fail_to_pass_passed == 0

    def test_deleting_the_module_is_not_a_pass(self):
        # The classic cheat: make the failing test stop failing by removing what
        # it imports. pass_to_pass is what catches it.
        r = grade(make_task(), {"mod.luau": "return {}"}, model="fixture")
        assert r.resolution is Resolution.no

    def test_an_infinite_loop_is_a_failure_not_a_hang(self):
        task = make_task(fail_to_pass=[TestCase(
            name="spins", source="while true do end", timeout_s=1.0,
        )])
        r = grade(task, FIXED, model="fixture")
        assert r.resolution is Resolution.no
        assert "timeout" in r.detail["fail_to_pass"][0]["reason"]

    def test_no_output_from_the_model_scores_nothing(self):
        r = grade(make_task(), {}, model="fixture")
        assert r.resolution is Resolution.no
        assert r.code_extracted is False


class TestTaskGate:
    """A task has to be able to tell a fix from no fix."""

    def test_a_real_task_discriminates(self):
        assert verify_task_gate(make_task())["ok"] is True

    def test_task_whose_targets_already_pass_is_rejected(self):
        # This is the failure that silently inflates every score computed from
        # the benchmark, so it is caught at authoring time.
        already = make_task(
            files=[ProjectFile(path="mod.luau", content="return { add = function(a,b) return a+b end }")],
        )
        verdict = verify_task_gate(already)
        assert verdict["ok"] is False
        assert "measures nothing" in verdict["reason"]

    def test_guard_that_fails_on_the_untouched_project_is_rejected(self):
        bad_guard = make_task(pass_to_pass=[TestCase(
            name="impossible", source='assert(false, "cannot pass")',
        )])
        verdict = verify_task_gate(bad_guard)
        assert verdict["ok"] is False
        assert "regression" in verdict["reason"]
