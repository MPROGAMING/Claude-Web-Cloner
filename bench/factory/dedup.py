"""
Deduplication of the corpus against itself.

Same normalisation as the leakage detector -- deliberately. If the factory
deduplicated on raw bytes while the leak gate matched on normalised tokens, the
two would disagree about what "the same file" means, and the disagreement would
show up as a leak that survived dedup by being reformatted.

This is the one place MinHash/LSH is used, because this is the only quadratic
problem here: N corpus records against each other. Its false-negative rate is
derived from the banding curve and reported in `DedupResult.detection_curve`, so
a surviving duplicate is an accounted-for cost rather than a surprise.

Cluster representative selection is deterministic and order-independent: highest
quality score, then content hash, then record id. Never input position -- that
would make the winner depend on directory walk order, so the same corpus rebuilt
on another machine would keep a different member of each cluster and the run
report's counts would stop being comparable.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from bench.contamination.minhash import DEFAULT_BANDS, DEFAULT_NUM_PERM, LshIndex, MinHasher
from bench.contamination.normalize import NormLevel, normalize
from bench.contamination.shingle import (
    DEFAULT_K,
    MIN_TOKENS_FOR_NEAR_DUP,
    containment,
    jaccard,
    shingle,
)


@dataclass
class DedupResult:
    kept: list = field(default_factory=list)
    # record_id -> (kept_representative_id, kind, score)
    dropped: dict = field(default_factory=dict)
    exact_dropped: int = 0
    near_dropped: int = 0
    clusters: int = 0
    detection_curve: dict = field(default_factory=dict)

    def to_json(self) -> dict:
        return {
            "kept": len(self.kept),
            "dropped": len(self.dropped),
            "exact_dropped": self.exact_dropped,
            "near_dropped": self.near_dropped,
            "clusters_with_more_than_one_member": self.clusters,
            "lsh_detection_curve": self.detection_curve,
        }


class _Union:
    def __init__(self):
        self.parent: dict = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def content_hash(text: str) -> str:
    import hashlib

    tokens = normalize(text, NormLevel.alpha).tokens
    return hashlib.sha256("\x1f".join(tokens).encode("utf-8")).hexdigest()


def deduplicate(
    records: list,
    threshold: float = 0.70,
    containment_threshold: float = 0.90,
    k: int = DEFAULT_K,
    num_perm: int = DEFAULT_NUM_PERM,
    bands: int = DEFAULT_BANDS,
) -> DedupResult:
    """
    `records` are TrainingRecords (or anything with `.record_id`, `.text`,
    `.quality`).

    The near-duplicate threshold here is higher than the leak gate's. The two
    answer different questions: the gate asks "might this be the holdout" and
    should over-trigger, dedup asks "is this the same file twice" and should
    not, because dropping two genuinely different files that solve the same
    problem removes real training signal.
    """
    result = DedupResult()
    if not records:
        return result

    order = {r.record_id: i for i, r in enumerate(records)}
    shingles: dict = {}
    hashes: dict = {}
    for r in records:
        tokens = normalize(r.text, NormLevel.alpha).tokens
        shingles[r.record_id] = shingle(tokens, k)
        hashes[r.record_id] = getattr(r, "content_hash", "") or content_hash(r.text)

    union = _Union()

    # Exact first: identical after normalisation, no similarity maths needed.
    by_hash: dict = {}
    for r in records:
        by_hash.setdefault(hashes[r.record_id], []).append(r.record_id)
    for group in by_hash.values():
        for other in group[1:]:
            union.union(group[0], other)

    # Near: LSH proposes, exact set overlap disposes.
    hasher = MinHasher(num_perm=num_perm)
    lsh = LshIndex(num_perm=num_perm, bands=bands)
    for r in records:
        if shingles[r.record_id].n_tokens >= MIN_TOKENS_FOR_NEAR_DUP:
            lsh.add(r.record_id, hasher.of(shingles[r.record_id]))

    for a, b in lsh.candidate_pairs():
        if union.find(a) == union.find(b):
            continue
        sa, sb = shingles[a], shingles[b]
        j = jaccard(sa, sb)
        c = max(containment(sa, sb), containment(sb, sa))
        if j >= threshold or c >= containment_threshold:
            union.union(a, b)

    clusters: dict = {}
    for r in records:
        clusters.setdefault(union.find(r.record_id), []).append(r)

    for members in clusters.values():
        if len(members) > 1:
            result.clusters += 1
        best = max(
            members,
            key=lambda r: (
                float(r.quality.get("_score", 0.0)) if isinstance(r.quality, dict) else 0.0,
                hashes[r.record_id],
                # Tie-break on the record id, never on input position. Input
                # position makes the winner depend on directory walk order, so
                # the same corpus rebuilt on another machine keeps a different
                # member of each cluster and the run reports stop comparing.
                r.record_id,
            ),
        )
        result.kept.append(best)
        for r in members:
            if r.record_id == best.record_id:
                continue
            same_hash = hashes[r.record_id] == hashes[best.record_id]
            kind = "exact" if same_hash else "near"
            sa, sb = shingles[r.record_id], shingles[best.record_id]
            result.dropped[r.record_id] = (
                best.record_id,
                kind,
                1.0 if same_hash else round(jaccard(sa, sb), 4),
            )
            if same_hash:
                result.exact_dropped += 1
            else:
                result.near_dropped += 1

    # Emit in the order the records arrived, so a JSONL corpus stays diffable
    # against the previous build instead of being reshuffled by cluster order.
    result.kept.sort(key=lambda r: order[r.record_id])
    result.detection_curve = lsh.detection_curve()
    result.detection_curve["threshold"] = threshold
    result.detection_curve["containment_threshold"] = containment_threshold
    result.detection_curve["p_detect_at_threshold"] = (
        1.0 - (1.0 - threshold**lsh.rows) ** lsh.bands
    )
    return result
