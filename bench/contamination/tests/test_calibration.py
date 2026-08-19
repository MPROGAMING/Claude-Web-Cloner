"""
The calibration numbers are quoted in three docstrings, in the scan report, and
in the choice of two module constants. If they drift, every one of those
statements becomes false silently.

So they are asserted here against a fresh run of the same corpus. A change to
the lexer, the normaliser, the shingle width or the corpus that moves the
measured behaviour fails this test, and the fix is to re-run
`python3 -m bench.contamination.calibrate` and update the prose that quotes it.
"""

import json
import os

import pytest

from bench.contamination.calibrate import (
    RESULTS_PATH,
    build_pairs,
    evaluate,
    separation,
    summary_for_report,
)
from bench.contamination.detector import (
    DEFAULT_CONTAINMENT_THRESHOLD,
    DEFAULT_JACCARD_THRESHOLD,
)
from bench.contamination.normalize import NormLevel
from bench.contamination.shingle import DEFAULT_K


@pytest.fixture(scope="module")
def pairs():
    return build_pairs(NormLevel.alpha, DEFAULT_K)


def test_the_corpus_is_the_size_the_docstrings_claim(pairs):
    counts = {}
    for p in pairs:
        counts[p.group] = counts.get(p.group, 0) + 1
    assert counts["structural"] == 11
    assert counts["same_problem"] == 33
    assert counts["cross_problem"] == 495
    assert counts["mechanical"] == 264


def test_no_false_positives_at_the_operating_thresholds(pairs):
    ev = evaluate(pairs, DEFAULT_JACCARD_THRESHOLD, DEFAULT_CONTAINMENT_THRESHOLD)
    assert ev["same_problem"]["flagged"] == 0, (
        "an independently written solution to the same problem was flagged as a leak"
    )
    assert ev["cross_problem"]["flagged"] == 0


def test_mechanical_laundering_is_caught_completely(pairs):
    ev = evaluate(pairs, DEFAULT_JACCARD_THRESHOLD, DEFAULT_CONTAINMENT_THRESHOLD)
    assert ev["mechanical"]["rate"] == 1.0, (
        "reformatting, renaming, re-commenting or wrapping must not defeat the detector"
    )


def test_structural_rewrite_recall_is_the_measured_value_not_an_aspiration(pairs):
    """
    4 of 11. This is the honest number and it is low: token shingles do not
    survive a human restructuring the code. It is asserted so nobody can quietly
    claim better.
    """
    ev = evaluate(pairs, DEFAULT_JACCARD_THRESHOLD, DEFAULT_CONTAINMENT_THRESHOLD)
    assert ev["structural"]["flagged"] == 4
    assert abs(ev["structural"]["rate"] - 4 / 11) < 1e-9


def test_structural_positives_and_same_problem_negatives_do_not_separate(pairs):
    """
    The finding that decides how the thresholds are set: the weakest structural
    positive scores *below* the strongest same-problem negative, on both
    measures. No threshold separates them, so the choice is which way to be
    wrong -- and the chosen answer is "miss the structural rewrite rather than
    flag honest work", with the gate's aggression coming from its cheap failure
    mode instead.
    """
    sep = separation(pairs)
    assert sep["jaccard"]["min_structural_positive"] < sep["jaccard"]["max_same_problem_negative"]
    assert not sep["separable_structural_vs_same_problem"]


def test_the_thresholds_sit_where_the_margins_are(pairs):
    sep = separation(pairs)
    assert sep["jaccard"]["max_same_problem_negative"] < DEFAULT_JACCARD_THRESHOLD
    assert sep["containment_max"]["max_same_problem_negative"] < DEFAULT_CONTAINMENT_THRESHOLD
    assert sep["jaccard"]["min_mechanical_positive"] > DEFAULT_JACCARD_THRESHOLD


def test_alpha_normalisation_beats_token_normalisation_on_renames():
    """
    The measured justification for renaming locals at all: at the token level a
    quarter of the mechanical mutations get through.
    """
    token_pairs = build_pairs(NormLevel.token, DEFAULT_K)
    ev = evaluate(token_pairs, DEFAULT_JACCARD_THRESHOLD, DEFAULT_CONTAINMENT_THRESHOLD)
    assert ev["mechanical"]["rate"] == 0.75


def test_the_committed_results_match_a_fresh_run(pairs):
    if not os.path.exists(RESULTS_PATH):
        pytest.skip("calibration has not been run")
    with open(RESULTS_PATH, "r", encoding="utf-8") as fh:
        committed = summary_for_report(json.load(fh))
    fresh = evaluate(pairs, DEFAULT_JACCARD_THRESHOLD, DEFAULT_CONTAINMENT_THRESHOLD)
    assert committed["recall_mechanical"] == round(fresh["mechanical"]["rate"], 4)
    assert committed["recall_structural"] == round(fresh["structural"]["rate"], 4)
    assert committed["false_positive_rate"] == round(fresh["overall"]["false_positive_rate"], 4)
    assert committed["k"] == DEFAULT_K
    assert committed["thresholds"]["jaccard"] == DEFAULT_JACCARD_THRESHOLD
