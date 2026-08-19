"""
Command line for the leakage checks.

    python3 -m bench.contamination.cli manifest
    python3 -m bench.contamination.cli verify
    python3 -m bench.contamination.cli scan --corpus-dir ./raw --format text
    python3 -m bench.contamination.cli datecheck --model some/model --tasks bench/tasks

Exit codes are meant for CI: 0 clean, 1 suspected leak, 2 could not run. A scan
that could not run must never be mistaken for a scan that found nothing, which
is why "could not run" gets its own code rather than an error message on stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date

from .calibrate import load_summary
from .datecheck import Basis, check_tasks, load_registry
from .detector import (
    DEFAULT_CONTAINMENT_THRESHOLD,
    DEFAULT_JACCARD_THRESHOLD,
    CorpusRecord,
    HoldoutIndex,
    TextKind,
    import_registry_items,
    scan,
)
from .manifest import MANIFEST_PATH, build_manifest, load_manifest, verify, write_manifest
from .report import Status, build_report, write_report

DEFAULT_HOLDOUT = os.environ.get("BLOCKWRIGHT_HOLDOUT", "~/blockwright-holdout")

EXIT_CLEAN = 0
EXIT_SUSPECT = 1
EXIT_CANNOT_RUN = 2


def _load_index(args) -> HoldoutIndex:
    return HoldoutIndex.from_dir(args.holdout)


def iter_corpus(args):
    """Yield CorpusRecords from whichever source was given."""
    if args.corpus_dir:
        root = os.path.expanduser(args.corpus_dir)
        for dirpath, _dirs, files in os.walk(root):
            for name in sorted(files):
                if not name.endswith((".luau", ".lua", ".txt", ".md")):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, "r", encoding="utf-8", errors="replace") as fh:
                    text = fh.read()
                kind = TextKind.luau if name.endswith((".luau", ".lua")) else TextKind.prose
                yield CorpusRecord(
                    record_id=os.path.relpath(path, root), text=text, kind=kind, source=path
                )
    if args.corpus_jsonl:
        with open(os.path.expanduser(args.corpus_jsonl), "r", encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                obj = json.loads(line)
                text = obj.get("text") or obj.get("content") or obj.get("source") or ""
                if not text:
                    continue
                yield CorpusRecord(
                    record_id=str(obj.get("record_id") or obj.get("id") or lineno),
                    text=text,
                    kind=TextKind(obj.get("kind", "luau")),
                    source=str(obj.get("source") or obj.get("path") or args.corpus_jsonl),
                )


def cmd_manifest(args) -> int:
    index = _load_index(args)
    manifest = build_manifest(index, reveal_ids=args.reveal_ids)
    path = args.out or MANIFEST_PATH
    if args.reveal_ids and os.path.abspath(path) == os.path.abspath(MANIFEST_PATH):
        print(
            "refusing to write an id-revealing manifest to the committed path; "
            "pass --out to somewhere outside the repository",
            file=sys.stderr,
        )
        return EXIT_CANNOT_RUN
    write_manifest(manifest, path)
    print("holdout : %s" % index.source_root)
    print("tasks   : %d" % manifest["counts"]["tasks"])
    print("units   : %d (%d below the near-duplicate floor)" % (
        manifest["counts"]["units"], manifest["counts"]["units_below_near_dup_floor"]
    ))
    print("hash    : %s" % manifest["manifest_hash"])
    print("written : %s" % path)
    return EXIT_CLEAN


def cmd_verify(args) -> int:
    index = _load_index(args)
    try:
        manifest = load_manifest(args.manifest or MANIFEST_PATH)
    except OSError as exc:
        print("cannot read manifest: %s" % exc, file=sys.stderr)
        return EXIT_CANNOT_RUN
    result = verify(index, manifest)
    print("manifest : %s" % result.expected_hash)
    print("live     : %s" % result.actual_hash)
    if result.ok:
        print("MATCH -- the live holdout is the one this manifest describes.")
        return EXIT_CLEAN
    print("DRIFT")
    if result.added:
        print("  %d unit(s) added since the manifest" % len(result.added))
    if result.removed:
        print("  %d unit(s) removed since the manifest" % len(result.removed))
    if result.changed:
        print(
            "  %d unit(s) EDITED in place -- every score measured against this "
            "manifest is now unverifiable" % len(result.changed)
        )
    for key, drift in result.config_drift.items():
        print("  config drift: %s manifest=%r live=%r" % (key, drift["manifest"], drift["live"]))
    return EXIT_SUSPECT


def cmd_scan(args) -> int:
    if not args.corpus_dir and not args.corpus_jsonl:
        print("nothing to scan: pass --corpus-dir or --corpus-jsonl", file=sys.stderr)
        return EXIT_CANNOT_RUN
    try:
        index = _load_index(args)
    except FileNotFoundError as exc:
        print("cannot load holdout: %s" % exc, file=sys.stderr)
        return EXIT_CANNOT_RUN
    manifest_hash = build_manifest(index)["manifest_hash"]
    findings, scanned = scan(
        index, iter_corpus(args), args.jaccard_threshold, args.containment_threshold
    )
    report = build_report(
        findings=findings,
        records_scanned=scanned,
        index=index,
        manifest_hash=manifest_hash,
        corpus_label=args.corpus_dir or args.corpus_jsonl,
        jaccard_threshold=args.jaccard_threshold,
        containment_threshold=args.containment_threshold,
        calibration=load_summary(),
    )
    if args.format == "json":
        print(json.dumps(report.to_json(args.reveal_ids), indent=2))
    else:
        print(report.render(args.reveal_ids))
    if args.out:
        write_report(report, args.out, args.reveal_ids, args.allow_in_repo)
    return EXIT_CLEAN if report.status is Status.clean else EXIT_SUSPECT


def collect_task_views(root: str) -> list:
    """
    Every task in a tree, JSON-authored and Python-authored alike.

    The holdout is co-owned and half of it is Python objects. A date check that
    silently covered only the JSON half would report a clean eligibility split
    over tasks it never looked at.
    """
    root = os.path.expanduser(root)
    views = []
    seen = set()

    def add(view):
        if view.task_id not in seen:
            seen.add(view.task_id)
            views.append(view)

    if os.path.isdir(root):
        for dirpath, _dirs, files in os.walk(root):
            for name in sorted(files):
                if not name.endswith((".json", ".jsonl")):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, "r", encoding="utf-8") as fh:
                    if name.endswith(".jsonl"):
                        payload = [json.loads(l) for l in fh if l.strip()]
                    else:
                        payload = json.load(fh)
                for t in payload if isinstance(payload, list) else [payload]:
                    if isinstance(t, dict) and "task_id" in t:
                        add(_TaskView(t))
        # Walk up one level as well: tasks usually live in <holdout>/tasks while
        # the importable package root is <holdout>.
        for candidate in (root, os.path.dirname(root.rstrip(os.sep))):
            for item in import_registry_items(candidate):
                obj = getattr(item, "task", item)
                add(_TaskView.from_object(obj))
            if views:
                break
    else:
        with open(root, "r", encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    add(_TaskView(json.loads(line)))
    return views


def cmd_datecheck(args) -> int:
    root = os.path.expanduser(args.tasks)
    tasks = collect_task_views(root)
    if not tasks:
        print("no tasks found at %s" % root, file=sys.stderr)
        return EXIT_CANNOT_RUN

    registry = load_registry()
    override = date.fromisoformat(args.boundary) if args.boundary else None
    if args.model not in registry and override is None:
        print(
            "model %r is not in model-cutoffs.json and no --boundary was given; "
            "every task will classify UNDATED" % args.model,
            file=sys.stderr,
        )
    elif override is None and not registry[args.model].verified:
        print(
            "warning: model %r has verified=false in model-cutoffs.json -- confirm "
            "the date against the provider's model card before citing a baseline"
            % args.model,
            file=sys.stderr,
        )

    report = check_tasks(tasks, args.model, registry, Basis(args.basis), override)
    if args.format == "json":
        print(json.dumps(report.to_json(), indent=2))
    else:
        print("model    : %s" % report.model)
        print("basis    : %s" % report.basis.value)
        print("boundary : %s" % (report.boundary.isoformat() if report.boundary else "UNKNOWN"))
        print(
            "tasks    : %d safe, %d exposed, %d undated (of %d)"
            % (report.safe, report.exposed, report.undated, report.total)
        )
        print("asterisk : %s" % ("YES" if report.needs_asterisk else "no"))
        for t in report.per_task:
            if t.exposure.value != "SAFE":
                print(
                    "  %-40s %-8s %s"
                    % (
                        t.task_id,
                        t.exposure.value,
                        ("%+d days" % t.margin_days) if t.margin_days is not None else "",
                    )
                )
    return EXIT_SUSPECT if report.needs_asterisk else EXIT_CLEAN


class _TaskView:
    """Minimal stand-in so datecheck can run over raw task JSON or objects."""

    def __init__(self, d: dict):
        self.task_id = d.get("task_id", "<unknown>")
        raw = d.get("authored_on")
        self.authored_on = date.fromisoformat(raw[:10]) if raw else None

    @classmethod
    def from_object(cls, obj) -> "_TaskView":
        authored = getattr(obj, "authored_on", None)
        view = cls({"task_id": getattr(obj, "task_id", "<unknown>")})
        view.authored_on = (
            authored if hasattr(authored, "isoformat") else
            (date.fromisoformat(str(authored)[:10]) if authored else None)
        )
        return view


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="bench.contamination.cli")
    p.add_argument("--holdout", default=DEFAULT_HOLDOUT, help="holdout root (outside the repo)")
    sub = p.add_subparsers(dest="command", required=True)

    m = sub.add_parser("manifest", help="hash the holdout and write the committed manifest")
    m.add_argument("--out", default=None)
    m.add_argument("--reveal-ids", action="store_true")
    m.set_defaults(func=cmd_manifest)

    v = sub.add_parser("verify", help="check a live holdout against a committed manifest")
    v.add_argument("--manifest", default=None)
    v.set_defaults(func=cmd_verify)

    s = sub.add_parser("scan", help="scan a training corpus for holdout leakage")
    s.add_argument("--corpus-dir")
    s.add_argument("--corpus-jsonl")
    s.add_argument("--jaccard-threshold", type=float, default=DEFAULT_JACCARD_THRESHOLD)
    s.add_argument("--containment-threshold", type=float, default=DEFAULT_CONTAINMENT_THRESHOLD)
    s.add_argument("--format", choices=("text", "json"), default="text")
    s.add_argument("--out", default=None)
    s.add_argument("--reveal-ids", action="store_true")
    s.add_argument("--allow-in-repo", action="store_true")
    s.set_defaults(func=cmd_scan)

    d = sub.add_parser("datecheck", help="LiveCodeBench-style cutoff filter")
    d.add_argument("--model", required=True)
    d.add_argument("--tasks", required=True)
    d.add_argument("--basis", choices=("release", "cutoff"), default="release")
    d.add_argument("--boundary", default=None, help="override the registry date (YYYY-MM-DD)")
    d.add_argument("--format", choices=("text", "json"), default="text")
    d.set_defaults(func=cmd_datecheck)

    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
