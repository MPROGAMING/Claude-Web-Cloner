"""
MinHash + LSH, used for the corpus-against-itself problem only.

Why it is not used for the holdout gate
---------------------------------------
The holdout is small (hundreds of items) and the training corpus is large. That
asymmetry means the holdout's *entire* shingle set fits in memory as one exact
inverted index, and every corpus record can be scored against every holdout item
in one pass over that record's shingles, exactly, with no sketching error at
all. Using MinHash there would import a false-negative rate for nothing.

Corpus-against-itself is the opposite shape: N^2 pairs over millions of records.
That is where sketching earns its keep, and where its false negatives have to be
stated rather than assumed away.

False-negative behaviour, stated
--------------------------------
LSH with `b` bands of `r` rows detects a pair of true Jaccard `s` with
probability `1 - (1 - s^r)^b`. The default 128 permutations as 32 bands of 4
rows gives (computed, not estimated -- the test asserts these):

    s = 0.80 -> 0.9999999   miss 1 in 21,053,138
    s = 0.70 -> 0.999847     miss 1 in 6,543
    s = 0.60 -> 0.988224     miss 1 in 85
    s = 0.50 -> 0.873211     miss 1 in 8
    s = 0.40 -> 0.563893     miss 1 in 2

The knee (P = 0.5) sits at s = 0.4204, so this banding is tuned for pairs above
roughly 0.5 and is close to useless below 0.4. At the 0.70 dedup threshold one
near-duplicate pair in 6,543 is missed by the candidate stage. That is a real,
quantified miss rate: acceptable for corpus hygiene, where a survivor duplicate
costs some training efficiency, and *not* acceptable for the holdout gate, where
a survivor costs the benchmark its meaning -- which is why the gate does not use
this. `lsh_detection_probability` computes the curve so any number in a report is
derived, never copied from this comment.

Additionally, MinHash estimates Jaccard with standard error ~1/sqrt(num_perm):
0.088 at 128 permutations. Candidates are therefore always re-scored against the
exact shingle sets before anything is reported.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, Sequence

from .shingle import ShingleSet

try:  # numpy is a large speedup on real corpora but must not be a hard dependency
    import numpy as _np
except ImportError:  # pragma: no cover - exercised only on numpy-less machines
    _np = None

# 2^31 - 1. A Mersenne prime, and small enough that (a*x + b) fits in a uint64
# without overflow when a, x, b are all reduced below it -- which is what lets
# the numpy path and the pure-Python path produce *bit-identical* signatures.
# Two paths that disagree would mean a corpus deduplicated differently depending
# on whether numpy happened to be installed, and the counts in a run report
# would stop being reproducible.
#
# The cost of the smaller field: within a single document of m shingles, the
# chance that two distinct shingles collide under one permutation is about
# m^2 / 2^32, so a 10k-shingle file has a ~1% chance per permutation of a tied
# minimum. A tie only ever biases the Jaccard estimate slightly upward, and
# every candidate this produces is re-scored against exact shingle sets before
# anything is reported, so the bias cannot reach a verdict.
_PRIME = (1 << 31) - 1
_MAX_HASH = _PRIME

DEFAULT_NUM_PERM = 128
DEFAULT_BANDS = 32

# Cap on the outer-product width so a pathological file cannot allocate
# num_perm * m uint64s in one go.
_CHUNK = 4096


def _permutations(num_perm: int, seed: int = 0xB10C):
    """
    Deterministic (a, b) coefficient pairs.

    Deterministic on purpose: a dedup decision must be reproducible across runs
    and machines, or a corpus rebuilt tomorrow drops a different set of records
    and the counts in the run report stop meaning anything.
    """
    a_list, b_list = [], []
    for i in range(num_perm):
        d = hashlib.blake2b(b"minhash-perm-%d-%d" % (seed, i), digest_size=16).digest()
        a = int.from_bytes(d[:8], "big") % (_PRIME - 1) + 1
        b = int.from_bytes(d[8:], "big") % _PRIME
        a_list.append(a)
        b_list.append(b)
    return a_list, b_list


class MinHasher:
    def __init__(self, num_perm: int = DEFAULT_NUM_PERM, seed: int = 0xB10C):
        self.num_perm = num_perm
        self.seed = seed
        a, b = _permutations(num_perm, seed)
        self._a_py, self._b_py = a, b
        if _np is not None:
            self._a = _np.array(a, dtype=_np.uint64)
            self._b = _np.array(b, dtype=_np.uint64)

    def signature(self, hashes: Iterable[int]) -> tuple:
        values = sorted(hashes)
        if not values:
            # An empty document must not look like every other empty document's
            # near-duplicate by accident, but it also has nothing to compare;
            # the all-max signature makes it collide only with other empties,
            # which the caller filters out on token count.
            return tuple([_MAX_HASH] * self.num_perm)
        if _np is not None:
            best = _np.full(self.num_perm, _MAX_HASH, dtype=_np.uint64)
            for off in range(0, len(values), _CHUNK):
                x = _np.array(values[off : off + _CHUNK], dtype=_np.uint64) % _np.uint64(_PRIME)
                # a * x + b fits in uint64 because a, x, b < 2^31.
                hv = (self._a[:, None] * x[None, :] + self._b[:, None]) % _np.uint64(_PRIME)
                best = _np.minimum(best, hv.min(axis=1))
            return tuple(int(v) for v in best)
        reduced = [v % _PRIME for v in values]
        return tuple(
            min((a * v + b) % _PRIME for v in reduced) for a, b in zip(self._a_py, self._b_py)
        )

    def of(self, s: ShingleSet) -> tuple:
        return self.signature(s.hashes)


def estimate_jaccard(sig_a: Sequence[int], sig_b: Sequence[int]) -> float:
    if not sig_a:
        return 0.0
    same = sum(1 for x, y in zip(sig_a, sig_b) if x == y)
    return same / len(sig_a)


def lsh_detection_probability(similarity: float, bands: int, rows: int) -> float:
    """P(at least one band collides) for a pair of true Jaccard `similarity`."""
    return 1.0 - (1.0 - similarity**rows) ** bands


def lsh_threshold_estimate(bands: int, rows: int) -> float:
    """The `s` where detection probability crosses 0.5 -- the knee of the curve."""
    return (1.0 / bands) ** (1.0 / rows)


@dataclass
class _Band:
    index: int
    table: dict


class LshIndex:
    """
    Banded LSH over MinHash signatures.

    Candidates only. Every candidate pair is re-scored against exact shingle
    sets by the caller; this class never decides that two things are duplicates.
    """

    def __init__(self, num_perm: int = DEFAULT_NUM_PERM, bands: int = DEFAULT_BANDS):
        if num_perm % bands:
            raise ValueError("num_perm (%d) must divide evenly into bands (%d)" % (num_perm, bands))
        self.num_perm = num_perm
        self.bands = bands
        self.rows = num_perm // bands
        self._tables: list[dict] = [defaultdict(list) for _ in range(bands)]
        self._sigs: dict = {}

    def add(self, key: str, signature: Sequence[int]) -> None:
        self._sigs[key] = tuple(signature)
        for bi in range(self.bands):
            chunk = signature[bi * self.rows : (bi + 1) * self.rows]
            bucket = hashlib.blake2b(
                b"|".join(b"%d" % v for v in chunk) + b"#%d" % bi, digest_size=8
            ).digest()
            self._tables[bi][bucket].append(key)

    def query(self, signature: Sequence[int]) -> set:
        out: set = set()
        for bi in range(self.bands):
            chunk = signature[bi * self.rows : (bi + 1) * self.rows]
            bucket = hashlib.blake2b(
                b"|".join(b"%d" % v for v in chunk) + b"#%d" % bi, digest_size=8
            ).digest()
            out.update(self._tables[bi].get(bucket, ()))
        return out

    def candidate_pairs(self) -> set:
        """All (key_a, key_b) pairs that share at least one band."""
        pairs: set = set()
        for table in self._tables:
            for keys in table.values():
                if len(keys) < 2:
                    continue
                ordered = sorted(set(keys))
                for i in range(len(ordered)):
                    for j in range(i + 1, len(ordered)):
                        pairs.add((ordered[i], ordered[j]))
        return pairs

    def detection_curve(self, points: Sequence[float] = (0.9, 0.8, 0.7, 0.6, 0.5, 0.4)) -> dict:
        return {
            "bands": self.bands,
            "rows": self.rows,
            "knee": lsh_threshold_estimate(self.bands, self.rows),
            "p_detect": {
                str(s): lsh_detection_probability(s, self.bands, self.rows) for s in points
            },
        }
