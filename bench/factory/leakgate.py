"""
The leakage gate: the factory refuses to emit a record the holdout matches.

Wired into the pipeline as a stage, not offered as a manual step someone can
forget. A leakage check that has to be remembered is a leakage check that will
eventually not be, and the failure is silent -- the corpus looks fine, the
benchmark looks fine, and the number is meaningless.

Fails closed
------------
If the holdout tree cannot be found or cannot be loaded, `open_gate` raises. It
does not warn and continue. The pipeline then emits nothing, because a corpus
built without the gate is worse than no corpus: it looks identical to one that
passed. `allow_missing_holdout=True` exists for genuinely holdout-free
environments and stamps `leak_gate: "SKIPPED"` into the run report so the
resulting artefact carries its own asterisk.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from bench.contamination.detector import (
    DEFAULT_CONTAINMENT_THRESHOLD,
    DEFAULT_JACCARD_THRESHOLD,
    CorpusRecord,
    HoldoutIndex,
    TextKind,
)
from bench.contamination.manifest import build_manifest


class HoldoutUnavailable(RuntimeError):
    """The gate could not be built. Never downgraded to a warning."""


@dataclass
class LeakGate:
    index: HoldoutIndex | None
    manifest_hash: str
    jaccard_threshold: float = DEFAULT_JACCARD_THRESHOLD
    containment_threshold: float = DEFAULT_CONTAINMENT_THRESHOLD
    skipped: bool = False
    findings: list = field(default_factory=list)

    @property
    def active(self) -> bool:
        return self.index is not None and not self.skipped

    def check(self, record_id: str, text: str, source: str = "") -> list:
        """Findings for one record. Empty means the record may pass."""
        if not self.active:
            return []
        rec = CorpusRecord(record_id=record_id, text=text, kind=TextKind.luau, source=source)
        found = self.index.match(rec, self.jaccard_threshold, self.containment_threshold)
        self.findings.extend(found)
        return found

    def status(self) -> dict:
        return {
            "leak_gate": "SKIPPED" if self.skipped else "ACTIVE",
            "manifest_hash": self.manifest_hash,
            "holdout_units": len(self.index) if self.index else 0,
            "holdout_units_below_near_dup_floor": self.index.short_units if self.index else 0,
            "jaccard_threshold": self.jaccard_threshold,
            "containment_threshold": self.containment_threshold,
            "blocked_records": len({f.record_id for f in self.findings}),
        }


def open_gate(
    holdout_root: str,
    allow_missing_holdout: bool = False,
    jaccard_threshold: float = DEFAULT_JACCARD_THRESHOLD,
    containment_threshold: float = DEFAULT_CONTAINMENT_THRESHOLD,
) -> LeakGate:
    try:
        index = HoldoutIndex.from_dir(holdout_root)
    except Exception as exc:
        if not allow_missing_holdout:
            raise HoldoutUnavailable(
                "cannot open the holdout at %r (%s). The factory will not emit records "
                "without the leakage gate; pass allow_missing_holdout to build an "
                "explicitly ungated corpus." % (holdout_root, exc)
            )
        return LeakGate(index=None, manifest_hash="", skipped=True,
                        jaccard_threshold=jaccard_threshold,
                        containment_threshold=containment_threshold)
    if len(index) == 0 and not allow_missing_holdout:
        raise HoldoutUnavailable(
            "the holdout at %r loaded but contains zero units; an empty gate blocks "
            "nothing and would certify a corpus it never checked" % holdout_root
        )
    return LeakGate(
        index=index,
        manifest_hash=build_manifest(index)["manifest_hash"],
        jaccard_threshold=jaccard_threshold,
        containment_threshold=containment_threshold,
    )
