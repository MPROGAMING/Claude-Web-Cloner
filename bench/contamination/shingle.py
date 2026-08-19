"""
Shingling and the two similarity measures that matter here.

Jaccard alone is not enough for leakage, and this is the part most
contamination checks get wrong. If a holdout task's 60-token solution is pasted
into the middle of a 3,000-token training file, Jaccard is about 0.02 -- far
under any sane threshold -- while every single one of the holdout's shingles is
present in the training file. Containment measured *against the holdout side*
is 1.0 and catches it exactly.

So both are computed, and a finding is raised on either. Jaccard answers "are
these the same document"; containment answers "is the holdout inside this
document", which is the question a leak actually poses.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Iterable, Sequence

# Token n-gram width, chosen by measurement rather than convention. On the
# calibration corpus at the alpha normalisation level, recall on hand-written
# structural rewrites against false-positive rate on independent solutions to
# the same problem:
#
#   k=4  structural 0.545   same-problem false positives 0.0303
#   k=5  structural 0.364   same-problem false positives 0.0000
#   k=6  structural 0.273   same-problem false positives 0.0000
#   k=7  structural 0.273   same-problem false positives 0.0000
#   k=8  structural 0.000   same-problem false positives 0.0000
#
# k=4 buys half again as much structural recall and starts flagging honest work;
# k=5 is the widest window that still holds zero measured false positives.
DEFAULT_K = 5

# Below this many code tokens, set-overlap statistics are noise: a 12-token file
# has 8 shingles and two unrelated one-liners routinely share half of them.
# Documents under the floor are compared by whole-document hash only, and the
# resulting false negative -- a leaked snippet shorter than this, reformatted --
# is stated in the report rather than hidden.
MIN_TOKENS_FOR_NEAR_DUP = 40


@dataclass(frozen=True)
class ShingleSet:
    hashes: frozenset
    n_tokens: int
    # Number of shingles before deduplication, i.e. n_tokens - k + 1. Repetitive
    # files have far fewer distinct hashes than this, which is itself a quality
    # signal the factory uses.
    n_positions: int
    k: int

    @property
    def too_short(self) -> bool:
        return self.n_tokens < MIN_TOKENS_FOR_NEAR_DUP


def _h(text: str) -> int:
    return int.from_bytes(hashlib.blake2b(text.encode("utf-8"), digest_size=8).digest(), "big")


def shingle(tokens: Sequence[str], k: int = DEFAULT_K) -> ShingleSet:
    """
    k-gram shingles over a normalised token stream.

    A document shorter than k contributes one shingle covering the whole stream,
    rather than none. Contributing none would make it match everything (empty
    set) or nothing depending on the similarity convention, and both are wrong.
    """
    n = len(tokens)
    if n == 0:
        return ShingleSet(frozenset(), 0, 0, k)
    if n < k:
        return ShingleSet(frozenset({_h("\x1f".join(tokens))}), n, 1, k)
    hashes = set()
    for i in range(n - k + 1):
        hashes.add(_h("\x1f".join(tokens[i : i + k])))
    return ShingleSet(frozenset(hashes), n, n - k + 1, k)


def jaccard(a: ShingleSet, b: ShingleSet) -> float:
    if not a.hashes or not b.hashes:
        return 0.0
    inter = len(a.hashes & b.hashes)
    if inter == 0:
        return 0.0
    return inter / len(a.hashes | b.hashes)


def containment(needle: ShingleSet, haystack: ShingleSet) -> float:
    """Fraction of `needle`'s shingles that appear in `haystack`."""
    if not needle.hashes:
        return 0.0
    return len(needle.hashes & haystack.hashes) / len(needle.hashes)


def overlap_count(a: ShingleSet, b: ShingleSet) -> int:
    return len(a.hashes & b.hashes)


def digest_of(hashes: Iterable[int]) -> str:
    """
    Order-independent digest of a shingle set.

    Used only for equality of whole sets in tests and caches. Never committed:
    a file's individual shingle hashes are a rainbow-table away from being the
    file, which is why the holdout manifest carries whole-document digests only.
    """
    h = hashlib.blake2b(digest_size=16)
    for v in sorted(hashes):
        h.update(v.to_bytes(8, "big"))
    return h.hexdigest()
