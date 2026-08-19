"""
Shingling and MinHash/LSH. The point of these tests is that the sketch's error
is bounded where the design says it is, so the false-negative rate quoted in the
reports is a derived number and not a hope.
"""

import random

from bench.contamination.minhash import (
    LshIndex,
    MinHasher,
    estimate_jaccard,
    lsh_detection_probability,
    lsh_threshold_estimate,
)
from bench.contamination.shingle import (
    MIN_TOKENS_FOR_NEAR_DUP,
    containment,
    jaccard,
    shingle,
)


def toks(n, seed=0):
    rng = random.Random(seed)
    return ["t%d" % rng.randrange(50) for _ in range(n)]


def test_shingle_count_matches_positions():
    s = shingle(["a", "b", "c", "d", "e", "f"], k=3)
    assert s.n_positions == 4
    assert s.n_tokens == 6


def test_document_shorter_than_k_still_produces_one_shingle():
    s = shingle(["a", "b"], k=5)
    assert len(s.hashes) == 1, "a short document must be comparable, not invisible"


def test_identical_token_streams_have_jaccard_one():
    a = shingle(toks(200, 1), k=5)
    b = shingle(toks(200, 1), k=5)
    assert jaccard(a, b) == 1.0


def test_containment_finds_a_fragment_that_jaccard_misses():
    small = ["s%d" % i for i in range(60)]
    big = ["x%d" % i for i in range(2000)] + small + ["y%d" % i for i in range(2000)]
    a, b = shingle(small, k=5), shingle(big, k=5)
    assert jaccard(a, b) < 0.03, "whole-document similarity is blind to this"
    assert containment(a, b) == 1.0, "containment is not"


def test_min_tokens_floor_is_exposed_on_the_shingle_set():
    assert shingle(toks(MIN_TOKENS_FOR_NEAR_DUP - 1), k=5).too_short
    assert not shingle(toks(MIN_TOKENS_FOR_NEAR_DUP + 10), k=5).too_short


def test_minhash_estimates_jaccard_within_its_standard_error():
    rng = random.Random(11)
    universe = ["u%d" % i for i in range(4000)]
    a = set(rng.sample(universe, 1200))
    b = set(rng.sample(universe, 1200)) | set(list(a)[:600])
    truth = len(a & b) / len(a | b)
    hasher = MinHasher(num_perm=256)
    est = estimate_jaccard(hasher.signature(hash(x) & 0xFFFFFFFFFFFFFFFF for x in a),
                           hasher.signature(hash(x) & 0xFFFFFFFFFFFFFFFF for x in b))
    # Standard error is ~1/sqrt(num_perm) = 0.0625; three of those is a safe bound.
    assert abs(est - truth) < 0.19, (est, truth)


def test_numpy_and_pure_python_signatures_agree():
    """
    The two code paths must be bit-identical, or a corpus deduplicates
    differently depending on whether numpy happens to be installed.
    """
    import bench.contamination.minhash as mh

    values = [hash("v%d" % i) & 0xFFFFFFFFFFFFFFFF for i in range(500)]
    hasher = MinHasher(num_perm=64)
    with_numpy = hasher.signature(values)
    saved, mh._np = mh._np, None
    try:
        without_numpy = MinHasher(num_perm=64).signature(values)
    finally:
        mh._np = saved
    assert with_numpy == without_numpy


def test_lsh_finds_planted_near_duplicates():
    rng = random.Random(3)
    base = ["b%d" % i for i in range(400)]
    hasher = MinHasher()
    index = LshIndex()
    index.add("base", hasher.of(shingle(base, k=5)))
    # ~10% of tokens perturbed: comfortably above the 0.5 knee.
    near = list(base)
    for i in rng.sample(range(len(near)), 40):
        near[i] = "z%d" % i
    index.add("near", hasher.of(shingle(near, k=5)))
    index.add("unrelated", hasher.of(shingle(["q%d" % i for i in range(400)], k=5)))
    pairs = index.candidate_pairs()
    assert ("base", "near") in pairs
    assert ("base", "unrelated") not in pairs


def test_detection_curve_is_monotonic_and_matches_the_documented_shape():
    index = LshIndex(num_perm=128, bands=32)
    curve = index.detection_curve()
    assert curve["rows"] == 4
    probabilities = [curve["p_detect"][k] for k in ("0.9", "0.8", "0.7", "0.6", "0.5", "0.4")]
    assert probabilities == sorted(probabilities, reverse=True)
    # The numbers quoted in minhash.py's docstring. Asserted here so the
    # docstring cannot drift away from the arithmetic it claims to report.
    for similarity, expected in (
        (0.80, 0.9999999),
        (0.70, 0.999847),
        (0.60, 0.988224),
        (0.50, 0.873211),
        (0.40, 0.563893),
    ):
        assert abs(lsh_detection_probability(similarity, 32, 4) - expected) < 5e-6, similarity
    assert abs(lsh_threshold_estimate(32, 4) - 0.4204) < 0.001


def test_bands_must_divide_the_permutations():
    try:
        LshIndex(num_perm=128, bands=7)
    except ValueError:
        return
    raise AssertionError("an uneven banding must be refused, not silently truncated")
