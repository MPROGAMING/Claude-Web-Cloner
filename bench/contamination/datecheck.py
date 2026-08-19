"""
The date check: LiveCodeBench's mechanism, mirrored and made conservative.

LiveCodeBench's whole "live" claim rests on two dates and one comparison. Every
problem carries a `contest_date`; every model carries a `release_date` in
`lm_styles.py`; `--start_date` / `--end_date` filter the evaluation set
(`benchmarks/code_generation.py`, `evaluation/compute_scores.py`). Set
`--start_date` to a model's release date and the score is computed only over
problems that model could not have seen. No trust required, no promise from the
lab, just a filter.

Two deliberate differences from the original.

**Inclusivity is flipped.** LiveCodeBench keeps problems where
`start_date <= contest_date`, so a problem dated exactly on the boundary is
*included* in the post-cutoff set. Here a task dated exactly on the boundary is
`EXPOSED`. The two conventions differ only for same-day items, and the
difference is deliberate: LiveCodeBench is choosing an evaluation window, this
is answering "could the model have seen it", and the honest answer on the
boundary day is "possibly".

**`release_date`, not the declared cutoff, is the default basis.** A lab's
declared pretraining cutoff is an earlier date than its release, and the gap is
filled with post-training, RL, and preference data that is also data. Filtering
on the release date is the conservative reading; `--basis cutoff` is available
for anyone who wants the looser one and is willing to say so in the report.

**An undated task is never safe.** `Task.authored_on is None` returns `UNDATED`,
which counts as exposed. A missing date is a missing proof, not a pass.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Iterable, Sequence

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "model-cutoffs.json")


class Exposure(str, Enum):
    safe = "SAFE"
    exposed = "EXPOSED"
    undated = "UNDATED"


class Basis(str, Enum):
    release = "release"
    cutoff = "cutoff"


@dataclass(frozen=True)
class ModelDates:
    model: str
    declared_cutoff: date | None
    release_date: date | None
    source: str = ""
    verified: bool = False

    def boundary(self, basis: Basis) -> date | None:
        if basis is Basis.cutoff:
            return self.declared_cutoff or self.release_date
        return self.release_date or self.declared_cutoff


@dataclass
class TaskExposure:
    task_id: str
    authored_on: date | None
    exposure: Exposure
    boundary: date | None
    # Days between the boundary and the task date. Negative means the task
    # predates the boundary. Reported because "exposed by three days" and
    # "exposed by three years" are different amounts of worry.
    margin_days: int | None


@dataclass
class EligibilityReport:
    model: str
    basis: Basis
    boundary: date | None
    verified_source: bool
    total: int = 0
    safe: int = 0
    exposed: int = 0
    undated: int = 0
    per_task: list = field(default_factory=list)

    @property
    def needs_asterisk(self) -> bool:
        """
        True when a score computed over the full task set would be misleading.

        Any exposed or undated task, or an unknown boundary, means the headline
        number is not a clean post-cutoff measurement.
        """
        return self.boundary is None or self.exposed > 0 or self.undated > 0

    def to_json(self) -> dict:
        return {
            "model": self.model,
            "basis": self.basis.value,
            "boundary": self.boundary.isoformat() if self.boundary else None,
            "verified_source": self.verified_source,
            "counts": {
                "total": self.total,
                "safe": self.safe,
                "exposed": self.exposed,
                "undated": self.undated,
            },
            "needs_asterisk": self.needs_asterisk,
            "per_task": [
                {
                    "task_id": t.task_id,
                    "authored_on": t.authored_on.isoformat() if t.authored_on else None,
                    "exposure": t.exposure.value,
                    "margin_days": t.margin_days,
                }
                for t in self.per_task
            ],
        }


def _parse_date(value) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def load_registry(path: str = REGISTRY_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        raw = json.load(fh)
    out = {}
    for entry in raw.get("models", []):
        md = ModelDates(
            model=entry["model"],
            declared_cutoff=_parse_date(entry.get("declared_cutoff")),
            release_date=_parse_date(entry.get("release_date")),
            source=entry.get("source", ""),
            verified=bool(entry.get("verified", False)),
        )
        out[md.model] = md
    return out


def classify(
    authored_on: date | None, boundary: date | None
) -> tuple[Exposure, int | None]:
    if authored_on is None:
        return Exposure.undated, None
    if boundary is None:
        # No boundary means no evidence either way, and no evidence is not a
        # clean bill of health.
        return Exposure.undated, None
    margin = (authored_on - boundary).days
    if authored_on > boundary:
        return Exposure.safe, margin
    return Exposure.exposed, margin


def check_tasks(
    tasks: Iterable,
    model: str,
    registry: dict | None = None,
    basis: Basis = Basis.release,
    boundary_override: date | None = None,
) -> EligibilityReport:
    """
    `tasks` is any iterable of objects with `.task_id` and `.authored_on`
    (i.e. `bench.schema.task.Task`, or a stand-in in tests).
    """
    registry = registry if registry is not None else load_registry()
    dates = registry.get(model)
    boundary = boundary_override or (dates.boundary(basis) if dates else None)
    report = EligibilityReport(
        model=model,
        basis=basis,
        boundary=boundary,
        verified_source=bool(dates and dates.verified) or boundary_override is not None,
    )
    for t in tasks:
        exposure, margin = classify(getattr(t, "authored_on", None), boundary)
        report.total += 1
        if exposure is Exposure.safe:
            report.safe += 1
        elif exposure is Exposure.exposed:
            report.exposed += 1
        else:
            report.undated += 1
        report.per_task.append(
            TaskExposure(
                task_id=getattr(t, "task_id", "<unknown>"),
                authored_on=getattr(t, "authored_on", None),
                exposure=exposure,
                boundary=boundary,
                margin_days=margin,
            )
        )
    return report


def eligible_tasks(
    tasks: Sequence,
    model: str,
    registry: dict | None = None,
    basis: Basis = Basis.release,
    boundary_override: date | None = None,
) -> list:
    """
    The subset a model may be scored on without an asterisk.

    This is the direct analogue of LiveCodeBench's `--start_date` filter: pass a
    model, get back only the tasks it provably could not have trained on.
    """
    report = check_tasks(tasks, model, registry, basis, boundary_override)
    safe_ids = {t.task_id for t in report.per_task if t.exposure is Exposure.safe}
    return [t for t in tasks if getattr(t, "task_id", None) in safe_ids]
