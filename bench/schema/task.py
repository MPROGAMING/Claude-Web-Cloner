"""
Task and result shapes for the Blockwright benchmark.

One schema covers both bars because they are asking different questions about
the same artefact. LiveCodeBench asks "can it write, repair, predict and
execute code, and was this problem published after your cutoff". SWE-bench
Verified asks "did your patch turn the failing tests green without breaking the
passing ones". A Roblox benchmark needs both: a lot of Luau work is a single
function, and a lot of it is a change across five files in a real place.

Every field that exists only to serve one of those questions says so.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date
from enum import Enum
from typing import Any


class Scenario(str, Enum):
    """
    What the model is being asked to do.

    The first four mirror LiveCodeBench. `project_patch` is the SWE-bench
    Verified shape. `tool_use` is ours: an agent that can call tools is a
    different system from one that emits a code block, and Blockwright ships the
    former.
    """

    code_generation = "code_generation"
    self_repair = "self_repair"
    test_output_prediction = "test_output_prediction"
    code_execution = "code_execution"
    project_patch = "project_patch"
    tool_use = "tool_use"


class Category(str, Enum):
    """The eight capability areas the holdout has to cover."""

    code_generation = "code_generation"
    debugging = "debugging"
    api_correctness = "api_correctness"
    security = "security"
    multi_file = "multi_file"
    project_reasoning = "project_reasoning"
    studio_runtime = "studio_runtime"
    agent_tool_use = "agent_tool_use"


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class Visibility(str, Enum):
    """
    Public tasks may be published and may end up in someone's training data.
    Holdout tasks may not be published, ever, and never leave the private tree.
    """

    public = "public"
    holdout = "holdout"


@dataclass
class TestCase:
    # pytest collects any class named Test*; this is a data record, not a suite.
    __test__ = False

    """
    One assertion, as Luau source that either completes or raises.

    `hidden` mirrors LiveCodeBench's public/private split: a task ships a couple
    of visible tests so a model can be told what shape is expected, and keeps
    the rest back so passing cannot be achieved by reading the answer key.
    """

    name: str
    source: str
    hidden: bool = True
    timeout_s: float = 5.0


@dataclass
class ProjectFile:
    """A file in the task's starting project state."""

    path: str
    content: str


@dataclass
class Task:
    task_id: str
    scenario: Scenario
    category: Category
    difficulty: Difficulty
    visibility: Visibility

    prompt: str

    # --- LiveCodeBench-style contamination discipline -----------------------
    # The date this task's underlying material became public. A model whose
    # training cutoff is after this date cannot be scored on it without an
    # asterisk, and the runner enforces that rather than trusting a promise.
    authored_on: date | None = None
    # Where the material came from, so a contamination claim can be checked
    # rather than asserted. "original" means written for this benchmark and
    # published nowhere.
    provenance: str = "original"

    # --- the work -----------------------------------------------------------
    files: list[ProjectFile] = field(default_factory=list)
    entry_point: str | None = None

    # --- SWE-bench-style gating ---------------------------------------------
    # Tests that must go from failing to passing. A task with an empty
    # fail_to_pass is not a task; the grader refuses it rather than scoring it 1.
    fail_to_pass: list[TestCase] = field(default_factory=list)
    # Tests that pass before the change and must still pass after it. This is
    # what stops "delete the failing test" and "rewrite the module" scoring.
    pass_to_pass: list[TestCase] = field(default_factory=list)

    # --- self-repair --------------------------------------------------------
    # For Scenario.self_repair: the broken code and the error a run produced.
    broken_source: str | None = None
    observed_error: str | None = None

    # --- expected answer for the non-execution scenarios ---------------------
    expected_output: str | None = None

    tags: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        d = asdict(self)
        d["authored_on"] = self.authored_on.isoformat() if self.authored_on else None
        return d


class Resolution(str, Enum):
    """
    SWE-bench Verified's three-way outcome, kept because two-way hides the
    interesting middle: a patch that fixes some of the target tests without
    breaking anything is a different failure from one that breaks the project.
    """

    full = "FULL"
    partial = "PARTIAL"
    no = "NO"


@dataclass
class TaskResult:
    task_id: str
    model: str

    # Separated from correctness on purpose, following SWE-bench's report map.
    # A harness that cannot run is not a model that cannot code, and a benchmark
    # that conflates the two reports noise as signal.
    infra_failure: bool = False
    infra_detail: str | None = None

    response_present: bool = False
    code_extracted: bool = False

    fail_to_pass_passed: int = 0
    fail_to_pass_total: int = 0
    pass_to_pass_passed: int = 0
    pass_to_pass_total: int = 0

    resolution: Resolution = Resolution.no

    duration_s: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    detail: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        d = asdict(self)
        d["resolution"] = self.resolution.value
        return d
