"""
Measure the threshold instead of asserting it.

Run: `python3 -m bench.contamination.calibrate`

Produces the false-positive and false-negative numbers that the scan report
quotes, over two populations built to be adversarial in opposite directions:

POSITIVES (a miss is a false negative)
  mechanical  -- reformat, re-comment, rename locals, requote, renumber, plus
                 dilution (an unrelated helper spliced in) and wrapping the body
                 in a module. These are *by construction* the transformations
                 `normalize.py` is built to undo, so near-perfect recall here is
                 a self-consistency check, not evidence. It is reported
                 separately for exactly that reason.
  structural  -- hand-written reimplementations of the same algorithm: helpers
                 extracted, `for i = 1, #t` swapped for `ipairs`, guard clauses
                 inverted, a table rewritten as a class. These are the honest
                 positives, and the recall number on them is the one worth
                 believing.

NEGATIVES (a flag is a false positive)
  same-problem -- three independently written solutions to each of ten small
                 Roblox problems. Same services, same idioms, same API calls,
                 different code. This is the population that makes an
                 over-aggressive normaliser visible.
  cross-problem -- everything else. Easy, and included only to show the floor.

The sweep runs over k and over normalisation level as well, so "k=5 on alpha" is
a measured choice with the runner-up's numbers printed beside it.
"""

from __future__ import annotations

import json
import os
import random
import re
from dataclasses import dataclass

from .detector import DEFAULT_CONTAINMENT_THRESHOLD, DEFAULT_JACCARD_THRESHOLD
from .calibration.corpus import (
    PROBLEMS,
    cross_problem_pairs,
    same_problem_pairs,
    structural_pairs,
)
from .luau_lex import Tok, lex
from .normalize import NormLevel, find_local_binders, normalize
from .shingle import containment, jaccard, shingle

RESULTS_PATH = os.path.join(os.path.dirname(__file__), "calibration", "results.json")


# --- mechanical mutations ---------------------------------------------------
# Each is what a person laundering a copy would plausibly do in thirty seconds.


def m_reformat(src: str, rng: random.Random) -> str:
    out = []
    for line in src.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        depth = (len(line) - len(line.lstrip())) // 1
        out.append(" " * (depth * 2) + stripped + ("  " if rng.random() < 0.3 else ""))
        if rng.random() < 0.15:
            out.append("")
    return "\n".join(out)


def m_strip_comments(src: str, rng: random.Random) -> str:
    lexed = lex(src)
    keep = []
    last = 0
    for t in lexed.tokens:
        if t.kind is Tok.comment:
            keep.append(src[last : t.start])
            last = t.end
    keep.append(src[last:])
    return "".join(keep)


def m_add_comments(src: str, rng: random.Random) -> str:
    lines = ["-- Adapted for our project.", "-- TODO: revisit the magic numbers."]
    for line in src.split("\n"):
        lines.append(line)
        if line.strip() and rng.random() < 0.25:
            indent = line[: len(line) - len(line.lstrip())]
            lines.append(indent + "-- note: " + rng.choice(["why", "check this", "temporary"]))
    return "\n".join(lines)


def m_rename_locals(src: str, rng: random.Random) -> str:
    """
    Rename every local binder to a fresh opaque name.

    Uses the same binder detector the normaliser uses, which makes this mutation
    exactly the one the normaliser is designed to defeat. Stated plainly here so
    the resulting recall is read as a consistency check.
    """
    binders = sorted(find_local_binders(lex(src).code_tokens()))
    mapping = {}
    for i, name in enumerate(binders):
        mapping[name] = "%s%d" % (rng.choice(["v", "tmp", "x", "arg"]), i)
    if not mapping:
        return src
    pattern = re.compile(r"\b(%s)\b" % "|".join(re.escape(b) for b in binders))
    return pattern.sub(lambda m: mapping[m.group(1)], src)


def m_requote(src: str, rng: random.Random) -> str:
    def swap(m):
        body = m.group(1)
        return "'%s'" % body if "'" not in body else m.group(0)

    src = re.sub(r'"([^"\\\n]*)"', swap, src)
    # `25` -> `25.0`, which canonicalises back to `25`.
    src = re.sub(r"(?<![\w.])(\d+)(?![\w.])", lambda m: m.group(1) + ".0", src)
    return src


def m_insert_helper(src: str, rng: random.Random) -> str:
    """Dilution: splice in unrelated code so Jaccard falls but containment holds."""
    helper = """
local function clampAlpha(value: number): number
	if value < 0 then
		return 0
	elseif value > 1 then
		return 1
	end
	return value
end

local function formatSeconds(seconds: number): string
	local minutes = math.floor(seconds / 60)
	return string.format("%02d:%02d", minutes, seconds % 60)
end
"""
    return helper + "\n" + src + "\n" + helper.replace("clampAlpha", "clampBeta").replace(
        "formatSeconds", "formatMinutes"
    )


def m_wrap_module(src: str, rng: random.Random) -> str:
    body = "\n".join("\t" + line if line.strip() else line for line in src.split("\n"))
    return "local Wrapper = {}\n\nfunction Wrapper.run()\n%s\nend\n\nreturn Wrapper\n" % body


MECHANICAL = {
    "reformat": m_reformat,
    "strip_comments": m_strip_comments,
    "add_comments": m_add_comments,
    "rename_locals": m_rename_locals,
    "requote": m_requote,
    "insert_helper": m_insert_helper,
    "wrap_module": m_wrap_module,
}


def m_combo(src: str, rng: random.Random) -> str:
    for name in ("strip_comments", "rename_locals", "reformat", "requote", "add_comments"):
        src = MECHANICAL[name](src, rng)
    return src


MECHANICAL["combo"] = m_combo


# --- scoring ----------------------------------------------------------------


@dataclass
class PairScore:
    label: str
    group: str
    jaccard: float
    # Containment of the smaller side in the larger -- the direction the
    # detector uses for "holdout pasted inside a training file".
    containment_max: float

    def combined(self, jt: float, ct: float) -> bool:
        return self.jaccard >= jt or self.containment_max >= ct


def score_pair(a: str, b: str, level: NormLevel, k: int) -> tuple[float, float]:
    sa = shingle(normalize(a, level).tokens, k)
    sb = shingle(normalize(b, level).tokens, k)
    return jaccard(sa, sb), max(containment(sa, sb), containment(sb, sa))


def build_pairs(level: NormLevel, k: int, seed: int = 7) -> list:
    rng = random.Random(seed)
    pairs: list = []

    for problem in PROBLEMS:
        for sol in problem.solutions:
            for mname, fn in MECHANICAL.items():
                mutated = fn(sol.source, rng)
                j, c = score_pair(sol.source, mutated, level, k)
                pairs.append(
                    PairScore("%s/%s:%s" % (problem.problem_id, sol.sol_id, mname), "mechanical", j, c)
                )

    for label, orig, rewrite in structural_pairs():
        j, c = score_pair(orig, rewrite, level, k)
        pairs.append(PairScore(label, "structural", j, c))

    for label, a, b in same_problem_pairs():
        j, c = score_pair(a, b, level, k)
        pairs.append(PairScore(label, "same_problem", j, c))

    for label, a, b in cross_problem_pairs():
        j, c = score_pair(a, b, level, k)
        pairs.append(PairScore(label, "cross_problem", j, c))

    return pairs


POSITIVE_GROUPS = ("mechanical", "structural")
NEGATIVE_GROUPS = ("same_problem", "cross_problem")


def evaluate(pairs: list, jt: float, ct: float) -> dict:
    out: dict = {}
    for group in POSITIVE_GROUPS + NEGATIVE_GROUPS:
        members = [p for p in pairs if p.group == group]
        flagged = [p for p in members if p.combined(jt, ct)]
        out[group] = {
            "n": len(members),
            "flagged": len(flagged),
            "rate": (len(flagged) / len(members)) if members else 0.0,
            "worst": _worst(members, group),
        }
    positives = [p for p in pairs if p.group in POSITIVE_GROUPS]
    negatives = [p for p in pairs if p.group in NEGATIVE_GROUPS]
    tp = sum(1 for p in positives if p.combined(jt, ct))
    fp = sum(1 for p in negatives if p.combined(jt, ct))
    out["overall"] = {
        "recall": tp / len(positives) if positives else 0.0,
        "false_positive_rate": fp / len(negatives) if negatives else 0.0,
        "false_negatives": len(positives) - tp,
        "false_positives": fp,
        "n_positive": len(positives),
        "n_negative": len(negatives),
    }
    return out


def _worst(members: list, group: str):
    """The pair closest to being wrong, so the margin is visible, not just the rate."""
    if not members:
        return None
    if group in POSITIVE_GROUPS:
        p = min(members, key=lambda x: max(x.jaccard, x.containment_max))
    else:
        p = max(members, key=lambda x: max(x.jaccard, x.containment_max))
    return {
        "label": p.label,
        "jaccard": round(p.jaccard, 4),
        "containment_max": round(p.containment_max, 4),
    }


def separation(pairs: list) -> dict:
    """
    The gap between the hardest positive and the hardest negative, per measure.

    Reported per measure rather than as one blended number, because Jaccard and
    containment run against different thresholds and blending them hid the fact
    that the widest same-problem gap is a containment gap, not a Jaccard one.

    `separable_*` is the question that decides whether a threshold exists at all:
    if the weakest positive scores below the strongest negative, no threshold
    separates the two populations and the honest report is "we chose which way
    to be wrong", not "we tuned it".
    """

    def stats(group: str, attr: str):
        vals = [getattr(p, attr) for p in pairs if p.group == group]
        return (min(vals), max(vals)) if vals else (None, None)

    out: dict = {}
    for measure in ("jaccard", "containment_max"):
        mech_lo, _ = stats("mechanical", measure)
        struct_lo, _ = stats("structural", measure)
        _, same_hi = stats("same_problem", measure)
        _, cross_hi = stats("cross_problem", measure)
        out[measure] = {
            "min_mechanical_positive": round(mech_lo, 4) if mech_lo is not None else None,
            "min_structural_positive": round(struct_lo, 4) if struct_lo is not None else None,
            "max_same_problem_negative": round(same_hi, 4) if same_hi is not None else None,
            "max_cross_problem_negative": round(cross_hi, 4) if cross_hi is not None else None,
            "separable_mechanical_vs_same_problem": bool(
                mech_lo is not None and same_hi is not None and mech_lo > same_hi
            ),
            "separable_structural_vs_same_problem": bool(
                struct_lo is not None and same_hi is not None and struct_lo > same_hi
            ),
        }
    out["separable_structural_vs_same_problem"] = (
        out["jaccard"]["separable_structural_vs_same_problem"]
        or out["containment_max"]["separable_structural_vs_same_problem"]
    )
    return out


def sweep(pairs: list, ct: float) -> list:
    """
    Overall recall is dominated by the 264 mechanical positives, so it barely
    moves and says almost nothing. The structural column is the one that moves,
    and it is the one to read.
    """
    rows = []
    for i in range(0, 21):
        jt = i / 20.0
        ev = evaluate(pairs, jt, ct)
        rows.append(
            {
                "jaccard_threshold": round(jt, 2),
                "recall_structural": round(ev["structural"]["rate"], 4),
                "recall_mechanical": round(ev["mechanical"]["rate"], 4),
                "fp_same_problem": round(ev["same_problem"]["rate"], 4),
                **ev["overall"],
            }
        )
    return rows


def run(
    levels=(NormLevel.token, NormLevel.alpha),
    ks=(4, 5, 6, 7, 8),
    jt: float = DEFAULT_JACCARD_THRESHOLD,
    ct: float = DEFAULT_CONTAINMENT_THRESHOLD,
) -> dict:
    grid = []
    for level in levels:
        for k in ks:
            pairs = build_pairs(level, k)
            ev = evaluate(pairs, jt, ct)
            grid.append(
                {
                    "level": level.value,
                    "k": k,
                    "at_default_thresholds": ev,
                    "separation": separation(pairs),
                }
            )
    default_pairs = build_pairs(NormLevel.alpha, 5)
    return {
        "thresholds": {"jaccard": jt, "containment": ct},
        "corpus": {
            "problems": len(PROBLEMS),
            "solutions": sum(len(p.solutions) for p in PROBLEMS),
            "structural_rewrites": len(structural_pairs()),
            "same_problem_pairs": len(same_problem_pairs()),
            "cross_problem_pairs": len(cross_problem_pairs()),
        },
        "grid": grid,
        "chosen": {"level": "alpha", "k": 5},
        "sweep_at_chosen": sweep(default_pairs, ct),
        "detail_at_chosen": evaluate(default_pairs, jt, ct),
        "separation_at_chosen": separation(default_pairs),
    }


def summary_for_report(results: dict) -> dict:
    """The handful of numbers the scan report prints under its verdict."""
    d = results["detail_at_chosen"]
    return {
        "recall_mechanical": round(d["mechanical"]["rate"], 4),
        "recall_structural": round(d["structural"]["rate"], 4),
        "false_positive_rate": round(d["overall"]["false_positive_rate"], 4),
        "false_positive_rate_same_problem": round(d["same_problem"]["rate"], 4),
        "negative_pairs": d["overall"]["n_negative"],
        "same_problem_pairs": d["same_problem"]["n"],
        "level": results["chosen"]["level"],
        "k": results["chosen"]["k"],
        "thresholds": results["thresholds"],
    }


def load_summary(path: str = RESULTS_PATH):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return summary_for_report(json.load(fh))
    except (OSError, ValueError, KeyError):
        return None


def main() -> int:
    results = run()
    with open(RESULTS_PATH, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)
        fh.write("\n")

    c = results["corpus"]
    print(
        "corpus: %d problems, %d solutions, %d structural rewrites, "
        "%d same-problem negative pairs, %d cross-problem"
        % (
            c["problems"],
            c["solutions"],
            c["structural_rewrites"],
            c["same_problem_pairs"],
            c["cross_problem_pairs"],
        )
    )
    print()
    print(
        "%-7s %-3s %9s %9s %9s %9s   %s"
        % ("LEVEL", "K", "MECH", "STRUCT", "FP-same", "FP-all", "SEPARABLE")
    )
    print("-" * 78)
    for row in results["grid"]:
        ev = row["at_default_thresholds"]
        print(
            "%-7s %-3d %9.3f %9.3f %9.4f %9.4f   %s"
            % (
                row["level"],
                row["k"],
                ev["mechanical"]["rate"],
                ev["structural"]["rate"],
                ev["same_problem"]["rate"],
                ev["overall"]["false_positive_rate"],
                "yes" if row["separation"]["separable_structural_vs_same_problem"] else "no",
            )
        )
    print()
    sep = results["separation_at_chosen"]
    print("at the chosen configuration (alpha, k=5):")
    for measure in ("jaccard", "containment_max"):
        m = sep[measure]
        print("  %s:" % measure)
        print("    weakest mechanical positive   %s" % m["min_mechanical_positive"])
        print("    weakest structural positive   %s" % m["min_structural_positive"])
        print("    strongest same-problem neg.   %s" % m["max_same_problem_negative"])
        print("    strongest cross-problem neg.  %s" % m["max_cross_problem_negative"])
        print("    a threshold separates structural positives from same-problem"
              " negatives: %s" % ("yes" if m["separable_structural_vs_same_problem"] else "NO"))
    print()
    print(
        "%-10s %10s %10s %12s %8s"
        % ("JACCARD-T", "STRUCTURAL", "MECHANICAL", "FP-SAME-PROB", "FP-ALL")
    )
    for row in results["sweep_at_chosen"]:
        print(
            "%-10.2f %10.4f %10.4f %12.4f %8d"
            % (
                row["jaccard_threshold"],
                row["recall_structural"],
                row["recall_mechanical"],
                row["fp_same_problem"],
                row["false_positives"],
            )
        )
    print()
    print("written to %s" % RESULTS_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
