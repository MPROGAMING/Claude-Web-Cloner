"""
Point the detector at this repository.

The holdout lives outside the tree and is gitignored three ways, but none of
that stops someone pasting a holdout snippet into a test fixture, a docstring,
or an example. That is the realistic leak: not a policy failure, a copy-paste.

So the tool checks its own house. Every text file under `bench/` is scanned
against the live holdout, as code and as prose, and the test fails if anything
matches. It skips when no holdout is present, because a machine without one has
nothing to check -- and says so rather than passing quietly.
"""

import os

import pytest

from bench.contamination.detector import CorpusRecord, HoldoutIndex, TextKind, scan

HOLDOUT_ROOT = os.environ.get("BLOCKWRIGHT_HOLDOUT", "~/blockwright-holdout")
BENCH_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SCANNED_SUFFIXES = (".py", ".luau", ".lua", ".md", ".json", ".txt")

# The manifest is hashes of the holdout by construction, and the calibration
# results are hashes of nothing at all. Scanning them would compare the holdout
# to its own digest list, which cannot match but wastes the time.
SKIP = {"holdout-manifest.json", "results.json"}


def iter_repo_records():
    for dirpath, dirnames, filenames in os.walk(BENCH_ROOT):
        dirnames[:] = [d for d in dirnames if d not in ("__pycache__", ".pytest_cache")]
        for name in sorted(filenames):
            if not name.endswith(SCANNED_SUFFIXES) or name in SKIP:
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, BENCH_ROOT)
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    text = fh.read()
            except (OSError, UnicodeDecodeError):
                continue
            # Both kinds: a leaked solution is code, a leaked prompt is prose,
            # and a .py fixture can be carrying either.
            yield CorpusRecord(rel, text, TextKind.luau, rel)
            yield CorpusRecord(rel + "#prose", text, TextKind.prose, rel)


def test_no_holdout_content_has_been_pasted_into_this_repository():
    root = os.path.expanduser(HOLDOUT_ROOT)
    if not os.path.isdir(root):
        pytest.skip("no holdout at %s; nothing to check against" % HOLDOUT_ROOT)
    index = HoldoutIndex.from_dir(root)
    if len(index) == 0:
        pytest.skip("holdout at %s is empty" % HOLDOUT_ROOT)

    findings, scanned = scan(index, iter_repo_records())
    assert scanned > 0, "the repository walk found nothing to scan"
    if findings:
        # Name the repository file, never the holdout unit: this assertion
        # message ends up in CI logs, which are not private.
        offenders = sorted(
            "%s (%s, %.3f)" % (f.record_source, f.match_kind.value, f.score)
            for f in findings
        )
        raise AssertionError(
            "holdout content appears in %d repository file(s): %s"
            % (len(set(f.record_source for f in findings)), "; ".join(offenders))
        )
