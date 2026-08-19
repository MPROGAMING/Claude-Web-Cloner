"""
The report. CLEAN, or every suspected leak with its score and both sources.

A CLEAN verdict is a claim about a detector, not about the universe, so the
report always carries the detector's own limits next to the verdict: the
thresholds it ran at, the measured miss rate at those thresholds, and the count
of holdout units too short for near-duplicate detection to apply at all. A
"CLEAN" with no stated sensitivity is the kind of reassurance that makes a
benchmark worse, because it converts an unmeasured system into a confident one.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from .shingle import MIN_TOKENS_FOR_NEAR_DUP


class Status(str, Enum):
    clean = "CLEAN"
    suspect = "SUSPECT"
    error = "ERROR"


@dataclass
class ContaminationReport:
    status: Status
    manifest_hash: str
    corpus_label: str
    records_scanned: int
    holdout_units: int
    holdout_units_below_floor: int
    jaccard_threshold: float
    containment_threshold: float
    config: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)
    # Numbers from calibrate.py, carried verbatim so the report never asserts a
    # sensitivity it has not measured.
    calibration: dict | None = None
    error: str | None = None
    generated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )

    @property
    def leaked_records(self) -> int:
        return len({f.record_id for f in self.findings})

    @property
    def leaked_units(self) -> int:
        return len({f.holdout_ref for f in self.findings})

    def to_json(self, reveal_ids: bool = False) -> dict:
        return {
            "status": self.status.value,
            "generated_at": self.generated_at,
            "manifest_hash": self.manifest_hash,
            "corpus": self.corpus_label,
            "counts": {
                "records_scanned": self.records_scanned,
                "holdout_units": self.holdout_units,
                "holdout_units_below_near_dup_floor": self.holdout_units_below_floor,
                "findings": len(self.findings),
                "distinct_records_implicated": self.leaked_records,
                "distinct_holdout_units_implicated": self.leaked_units,
            },
            "thresholds": {
                "jaccard": self.jaccard_threshold,
                "containment": self.containment_threshold,
                "min_tokens_for_near_dup": MIN_TOKENS_FOR_NEAR_DUP,
            },
            "config": self.config,
            "calibration": self.calibration,
            "findings": [f.to_json(reveal_ids) for f in self.findings],
            "error": self.error,
        }

    def render(self, reveal_ids: bool = False) -> str:
        lines = []
        lines.append("=" * 72)
        lines.append("CONTAMINATION SCAN: %s" % self.status.value)
        lines.append("=" * 72)
        lines.append("corpus         : %s" % self.corpus_label)
        lines.append("holdout        : %s" % self.manifest_hash)
        lines.append(
            "scanned        : %d records against %d holdout units"
            % (self.records_scanned, self.holdout_units)
        )
        lines.append(
            "thresholds     : jaccard >= %.2f, containment >= %.2f, near-dup floor %d tokens"
            % (self.jaccard_threshold, self.containment_threshold, MIN_TOKENS_FOR_NEAR_DUP)
        )
        lines.append("normalisation  : %s" % self.config.get("normalizer", "?"))
        lines.append("")

        if self.status is Status.error:
            lines.append("ERROR: %s" % self.error)
            lines.append("")
            lines.append("No verdict. A scan that could not run is not a clean scan.")
            return "\n".join(lines)

        if self.status is Status.clean:
            lines.append("No holdout unit matched any record in this corpus.")
        else:
            lines.append(
                "%d finding(s): %d record(s) implicate %d holdout unit(s)."
                % (len(self.findings), self.leaked_records, self.leaked_units)
            )
            lines.append("")
            width = min(max([len(f.record_source or f.record_id) for f in self.findings] + [20]), 60)

            def label(f):
                if reveal_ids:
                    return "%s/%s" % (f.holdout_task_id, f.holdout_unit)
                return f.holdout_ref

            # The holdout column is sized to its content, never truncated to a
            # constant. A fixed width silently chopped revealed task ids, which
            # made --reveal-ids useless for the one job it has.
            hw = min(max([len(label(f)) for f in self.findings] + [len("HOLDOUT")]), 70)
            lines.append(
                "  %-*s  %-22s  %6s  %s" % (hw, "HOLDOUT", "MATCH", "SCORE", "CORPUS SOURCE")
            )
            lines.append("  " + "-" * (hw + 24 + 8 + width))
            for f in sorted(self.findings, key=lambda x: -x.score):
                src = (f.record_source or f.record_id)[-width:]
                lines.append(
                    "  %-*s  %-22s  %6.3f  %s"
                    % (hw, label(f)[:hw], f.match_kind.value, f.score, src)
                )
                lines.append(
                    "  %-*s  jaccard=%.3f  holdout-in-record=%.3f  record-in-holdout=%.3f  "
                    "(%d vs %d tokens)"
                    % (
                        hw,
                        "",
                        f.jaccard,
                        f.containment_holdout_in_record,
                        f.containment_record_in_holdout,
                        f.holdout_tokens,
                        f.record_tokens,
                    )
                )

        lines.append("")
        lines.append("-- what this verdict does not cover " + "-" * 36)
        lines.append(
            "  %d of %d holdout units are under the %d-token near-duplicate floor;"
            % (self.holdout_units_below_floor, self.holdout_units, MIN_TOKENS_FOR_NEAR_DUP)
        )
        lines.append(
            "  for those, only exact/reformat-insensitive matching applied. A short"
        )
        lines.append("  leaked snippet that was also renamed would not be caught.")
        if self.calibration:
            m = self.calibration
            lines.append(
                "  measured at these thresholds: recall %.3f on mechanical rewrites,"
                % m.get("recall_mechanical", float("nan"))
            )
            lines.append(
                "  %.3f on structural rewrites; false-positive rate %.4f on"
                % (
                    m.get("recall_structural", float("nan")),
                    m.get("false_positive_rate", float("nan")),
                )
            )
            lines.append(
                "  independent solutions to the same problem (%d negative pairs)."
                % m.get("negative_pairs", 0)
            )
        else:
            lines.append("  sensitivity UNMEASURED for this configuration -- run calibrate.py.")
        return "\n".join(lines)


_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def write_report(
    report: ContaminationReport,
    path: str,
    reveal_ids: bool = False,
    allow_in_repo: bool = False,
) -> None:
    """
    Write a report to disk, refusing the one mistake that would undo the point.

    A report with `reveal_ids` names holdout task ids in the clear. Writing one
    inside this (public) repository would put holdout identity into version
    control by accident, so it is refused unless explicitly overridden.
    """
    target = os.path.abspath(path)
    inside_repo = target.startswith(_REPO_ROOT + os.sep)
    if reveal_ids and inside_repo and not allow_in_repo:
        raise ValueError(
            "refusing to write an id-revealing report inside the repository (%s); "
            "write it outside the tree, or pass allow_in_repo=True and know why" % target
        )
    os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    with open(target, "w", encoding="utf-8") as fh:
        json.dump(report.to_json(reveal_ids), fh, indent=2)
        fh.write("\n")


def build_report(
    findings: list,
    records_scanned: int,
    index,
    manifest_hash: str,
    corpus_label: str,
    jaccard_threshold: float,
    containment_threshold: float,
    calibration: dict | None = None,
) -> ContaminationReport:
    return ContaminationReport(
        status=Status.suspect if findings else Status.clean,
        manifest_hash=manifest_hash,
        corpus_label=corpus_label,
        records_scanned=records_scanned,
        holdout_units=len(index),
        holdout_units_below_floor=index.short_units,
        jaccard_threshold=jaccard_threshold,
        containment_threshold=containment_threshold,
        config=index.config(),
        findings=list(findings),
        calibration=calibration,
    )
