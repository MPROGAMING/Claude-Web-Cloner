"""
Command line for the training-data factory.

    python3 -m bench.factory.cli build --sources sources.json --out ~/corpus/train.jsonl

Exit codes: 0 built, 1 built but something needs a human (counts did not
reconcile, or the gate was skipped), 2 refused to build.

Refusing to build is the normal outcome when the holdout is missing. That is the
design: a corpus emitted without the leakage gate is indistinguishable from one
that passed it, so the pipeline would rather produce nothing.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from .leakgate import HoldoutUnavailable, open_gate
from .pipeline import run_pipeline
from .provenance import PERMISSIVE
from .quality import SyntaxChecker
from .sinks import save_hf_dataset, write_jsonl, write_report
from .sources import load_all, load_source_manifest

DEFAULT_HOLDOUT = os.environ.get("BLOCKWRIGHT_HOLDOUT", "~/blockwright-holdout")

EXIT_OK = 0
EXIT_NEEDS_ATTENTION = 1
EXIT_REFUSED = 2


def cmd_build(args) -> int:
    try:
        specs = load_source_manifest(args.sources)
    except (OSError, ValueError, KeyError) as exc:
        print("cannot read source manifest: %s" % exc, file=sys.stderr)
        return EXIT_REFUSED
    if not specs:
        print("source manifest declares no sources", file=sys.stderr)
        return EXIT_REFUSED

    try:
        gate = open_gate(args.holdout, allow_missing_holdout=args.allow_missing_holdout)
    except HoldoutUnavailable as exc:
        print("REFUSED: %s" % exc, file=sys.stderr)
        return EXIT_REFUSED

    checker = SyntaxChecker()
    if not checker.available:
        print(
            "warning: no luau binary found; the syntax gate is inert and every "
            "record will pass it",
            file=sys.stderr,
        )

    records, report = run_pipeline(
        load_all(specs),
        gate=gate,
        allowed_licences=PERMISSIVE,
        require_revision=args.require_revision,
        require_roblox_signal=not args.allow_generic_luau,
        drop_deprecated=args.drop_deprecated,
        dedup_threshold=args.dedup_threshold,
        syntax_checker=checker,
    )

    if args.out:
        write_jsonl(records, args.out, args.allow_in_repo)
    if args.hf_out:
        save_hf_dataset(records, args.hf_out, args.allow_in_repo)
    if args.report:
        write_report(report, args.report)

    if args.format == "json":
        print(json.dumps(report.to_json(), indent=2))
    else:
        print(render(report))

    if not report.reconciles():
        return EXIT_NEEDS_ATTENTION
    if gate.skipped:
        return EXIT_NEEDS_ATTENTION
    return EXIT_OK


def render(report) -> str:
    lines = []
    lines.append("=" * 72)
    lines.append("FACTORY RUN")
    lines.append("=" * 72)
    lines.append(report.summary_line())
    lines.append("")
    lines.append("%-14s %8s %8s %8s" % ("STAGE", "IN", "DROPPED", "OUT"))
    lines.append("-" * 42)
    for stage in report.stages.values():
        lines.append(
            "%-14s %8d %8d %8d%s"
            % (
                stage.name,
                stage.n_in,
                stage.n_dropped,
                stage.n_out,
                "" if stage.reconciles() else "   <- DOES NOT RECONCILE",
            )
        )
        for reason, count in sorted(stage.dropped.items(), key=lambda kv: -kv[1]):
            lines.append("                 %6d  %s" % (count, reason))
    lines.append("")
    gate = report.leak_gate
    lines.append("leak gate      : %s" % gate.get("leak_gate", "?"))
    lines.append("holdout        : %s" % gate.get("manifest_hash", "?"))
    lines.append(
        "               : %d units, %d blocked record(s)"
        % (gate.get("holdout_units", 0), gate.get("blocked_records", 0))
    )
    if gate.get("leak_gate") == "SKIPPED":
        lines.append("  *** this corpus was NOT checked against a holdout ***")
    dd = report.dedup
    if dd:
        lines.append(
            "dedup          : %d exact, %d near, %d multi-member clusters"
            % (
                dd.get("exact_dropped", 0),
                dd.get("near_dropped", 0),
                dd.get("clusters_with_more_than_one_member", 0),
            )
        )
        curve = dd.get("lsh_detection_curve", {})
        if curve:
            lines.append(
                "               : LSH %d bands x %d rows, P(detect) at the "
                "%.2f threshold = %.4f"
                % (
                    curve.get("bands", 0),
                    curve.get("rows", 0),
                    curve.get("threshold", 0.0),
                    curve.get("p_detect_at_threshold", 0.0),
                )
            )
    if report.warnings:
        lines.append("")
        lines.append("warnings:")
        for name, count in sorted(report.warnings.items(), key=lambda kv: -kv[1]):
            lines.append("  %6d  %s" % (count, name))
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="bench.factory.cli")
    sub = p.add_subparsers(dest="command", required=True)

    b = sub.add_parser("build", help="run the pipeline end to end")
    b.add_argument("--sources", required=True, help="path to a source manifest JSON")
    b.add_argument("--holdout", default=DEFAULT_HOLDOUT)
    b.add_argument("--out", default=None, help="JSONL output path (outside the repo)")
    b.add_argument("--hf-out", default=None, help="datasets save_to_disk path (local only)")
    b.add_argument("--report", default=None, help="run report JSON path")
    b.add_argument("--format", choices=("text", "json"), default="text")
    b.add_argument("--require-revision", action="store_true")
    b.add_argument("--allow-generic-luau", action="store_true")
    b.add_argument("--drop-deprecated", action="store_true")
    b.add_argument("--dedup-threshold", type=float, default=0.70)
    b.add_argument("--allow-in-repo", action="store_true")
    b.add_argument(
        "--allow-missing-holdout",
        action="store_true",
        help="build without the leakage gate; stamps the report SKIPPED",
    )
    b.set_defaults(func=cmd_build)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
