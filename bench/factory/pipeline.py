"""
The pipeline, and the counting that makes it auditable.

Every stage reports `in`, `out`, and `dropped` broken down by named reason, and
the run report asserts that they reconcile. That invariant is not decoration: a
pipeline whose counts do not add up is one that is losing records somewhere it
does not know about, and "N in, K out" with no accounting for the difference is
how a corpus quietly becomes 40% smaller than anyone believes.

Stage order is chosen, not incidental:

  ingest -> provenance -> quality -> leak gate -> dedup -> emit

* Provenance first because it is the cheapest and most decisive: no point
  parsing a file that is not licensed to be here.
* Quality before the leak gate because the gate is the expensive stage per
  record and there is no reason to run it on a minified bundle.
* The leak gate before dedup, not after. Dedup collapses a cluster to one
  representative; if a leaked record were dropped as the *duplicate* of a clean
  one, the leak would vanish from the report while its twin sailed through. The
  gate has to see every record.
* Dedup last so it operates only on records that would otherwise be emitted.
"""

from __future__ import annotations

import hashlib
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from .dedup import content_hash, deduplicate
from .leakgate import LeakGate
from .provenance import PERMISSIVE
from .provenance import check as provenance_check
from .quality import SyntaxChecker, judge, measure, score
from .quality import config as quality_config
from .records import TrainingRecord


@dataclass
class StageCount:
    name: str
    n_in: int = 0
    n_out: int = 0
    dropped: Counter = field(default_factory=Counter)
    # A handful of ids per reason, so a count can be investigated without
    # re-running the whole pass.
    examples: dict = field(default_factory=dict)

    def drop(self, reason: str, record_id: str, detail: str = "") -> None:
        self.dropped[reason] += 1
        bucket = self.examples.setdefault(reason, [])
        if len(bucket) < 5:
            bucket.append({"record_id": record_id, "detail": detail[:120]})

    @property
    def n_dropped(self) -> int:
        return sum(self.dropped.values())

    def reconciles(self) -> bool:
        return self.n_in == self.n_out + self.n_dropped

    def to_json(self) -> dict:
        return {
            "name": self.name,
            "in": self.n_in,
            "out": self.n_out,
            "dropped": self.n_dropped,
            "reasons": dict(sorted(self.dropped.items())),
            "examples": self.examples,
            "reconciles": self.reconciles(),
        }


@dataclass
class RunReport:
    stages: "OrderedDict[str, StageCount]" = field(default_factory=OrderedDict)
    leak_gate: dict = field(default_factory=dict)
    dedup: dict = field(default_factory=dict)
    config: dict = field(default_factory=dict)
    warnings: Counter = field(default_factory=Counter)
    generated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )

    def stage(self, name: str) -> StageCount:
        if name not in self.stages:
            self.stages[name] = StageCount(name)
        return self.stages[name]

    @property
    def total_in(self) -> int:
        return next(iter(self.stages.values())).n_in if self.stages else 0

    @property
    def total_out(self) -> int:
        return list(self.stages.values())[-1].n_out if self.stages else 0

    def dropped_by_reason(self) -> dict:
        total = Counter()
        for s in self.stages.values():
            total.update(s.dropped)
        return dict(sorted(total.items(), key=lambda kv: (-kv[1], kv[0])))

    def reconciles(self) -> bool:
        return all(s.reconciles() for s in self.stages.values()) and (
            self.total_in == self.total_out + sum(s.n_dropped for s in self.stages.values())
        )

    def summary_line(self) -> str:
        """The one line the progress page shows."""
        reasons = self.dropped_by_reason()
        top = ", ".join("%d for %s" % (v, k) for k, v in list(reasons.items())[:3])
        return "%d in, %d dropped (%s), %d out" % (
            self.total_in,
            sum(reasons.values()),
            top or "none",
            self.total_out,
        )

    def to_json(self) -> dict:
        return {
            "generated_at": self.generated_at,
            "summary": self.summary_line(),
            "reconciles": self.reconciles(),
            "totals": {
                "in": self.total_in,
                "out": self.total_out,
                "dropped": sum(s.n_dropped for s in self.stages.values()),
                "dropped_by_reason": self.dropped_by_reason(),
            },
            "stages": [s.to_json() for s in self.stages.values()],
            "leak_gate": self.leak_gate,
            "dedup": self.dedup,
            "warnings": dict(sorted(self.warnings.items())),
            "config": self.config,
        }


def _record_id(doc) -> str:
    if doc.doc_id:
        return doc.doc_id
    return hashlib.sha256(doc.text.encode("utf-8")).hexdigest()[:24]


def run_pipeline(
    documents,
    gate: LeakGate,
    today: date | None = None,
    allowed_licences: frozenset = PERMISSIVE,
    require_revision: bool = False,
    require_roblox_signal: bool = True,
    drop_deprecated: bool = False,
    dedup_threshold: float = 0.70,
    syntax_checker: SyntaxChecker | None = None,
) -> tuple:
    """
    Returns (emitted_records, RunReport).

    `documents` is any iterable of RawDocument. It is materialised because the
    syntax stage batches and dedup is inherently whole-corpus; a streaming
    variant would have to give up both.
    """
    docs = list(documents)
    report = RunReport()
    checker = syntax_checker or SyntaxChecker()
    report.config = {
        "quality": quality_config(),
        "allowed_licences": sorted(allowed_licences),
        "require_revision": require_revision,
        "require_roblox_signal": require_roblox_signal,
        "drop_deprecated": drop_deprecated,
        "dedup_threshold": dedup_threshold,
        "syntax_binary": checker.binary,
        "syntax_parse_only": checker.parse_only,
    }
    if checker.available and not checker.parse_only:
        # A fallback to the plain interpreter both executes untrusted code and
        # rejects ordinary Roblox scripts for want of `game`. Loud, not silent.
        report.warnings["syntax.fallback_executes_code"] += 1

    ingest = report.stage("ingest")
    ingest.n_in = len(docs)
    ingest.n_out = len(docs)

    prov = report.stage("provenance")
    prov.n_in = len(docs)
    surviving = []
    for doc in docs:
        rid = _record_id(doc)
        verdict = provenance_check(doc, today, allowed_licences, require_revision)
        if not verdict.ok:
            prov.drop(verdict.reason, rid, verdict.detail)
            continue
        for w in verdict.warnings:
            report.warnings[w] += 1
        surviving.append((rid, doc, verdict.warnings))
    prov.n_out = len(surviving)

    qual = report.stage("quality")
    qual.n_in = len(surviving)
    syntax_results = checker.check_many([d.text for _rid, d, _w in surviving])
    passed = []
    for (rid, doc, warns), (syn_ok, syn_msg) in zip(surviving, syntax_results):
        metrics = measure(doc.text)
        verdict = judge(
            doc.text,
            syn_ok,
            syn_msg,
            metrics,
            require_roblox_signal=require_roblox_signal,
            drop_deprecated=drop_deprecated,
        )
        if not verdict.ok:
            qual.drop(verdict.reason, rid, verdict.detail)
            continue
        for w in verdict.warnings:
            report.warnings[w.split(":")[0]] += 1
        passed.append((rid, doc, list(warns) + list(verdict.warnings), metrics))
    qual.n_out = len(passed)

    leak = report.stage("leak_gate")
    leak.n_in = len(passed)
    clean = []
    for rid, doc, warns, metrics in passed:
        findings = gate.check(rid, doc.text, doc.path or doc.doc_id)
        if findings:
            worst = max(findings, key=lambda f: f.score)
            leak.drop(
                "leak.%s" % worst.match_kind.value,
                rid,
                # The holdout ref, never the holdout content or its task id.
                "holdout=%s score=%.3f" % (worst.holdout_ref, worst.score),
            )
            continue
        clean.append((rid, doc, warns, metrics))
    leak.n_out = len(clean)
    report.leak_gate = gate.status()

    candidates = []
    for rid, doc, warns, metrics in clean:
        q = dict(metrics)
        q["_score"] = score(metrics)
        candidates.append(
            TrainingRecord(
                record_id=rid,
                text=doc.text,
                provenance=doc.provenance,
                path=doc.path,
                n_tokens=metrics["n_tokens"],
                n_bytes=metrics["n_bytes"],
                content_hash=content_hash(doc.text),
                quality=q,
                warnings=warns,
                meta=dict(doc.meta),
            )
        )

    dd = report.stage("dedup")
    dd.n_in = len(candidates)
    result = deduplicate(candidates, threshold=dedup_threshold)
    for rid, (kept_id, kind, sim) in result.dropped.items():
        dd.drop("dedup.%s" % kind, rid, "same as %s (%.3f)" % (kept_id, sim))
    dd.n_out = len(result.kept)
    report.dedup = result.to_json()

    emit = report.stage("emit")
    emit.n_in = len(result.kept)
    emit.n_out = len(result.kept)
    return result.kept, report
