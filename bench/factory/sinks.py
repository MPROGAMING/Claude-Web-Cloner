"""
Where finished records go. Local only -- nothing here uploads anything.

The output directory is refused if it sits inside this repository. Emitted
records are training data derived from external material, they can be large, and
this repository is public; the one thing that must never happen is a corpus
landing in version control next to a benchmark that swears it never saw it.
"""

from __future__ import annotations

import json
import os

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def guard_output_path(path: str, allow_in_repo: bool = False) -> str:
    target = os.path.abspath(os.path.expanduser(path))
    if not allow_in_repo and target.startswith(_REPO_ROOT + os.sep):
        raise ValueError(
            "refusing to write a training corpus inside the repository (%s). "
            "Write it outside the tree." % target
        )
    return target


def write_jsonl(records, path: str, allow_in_repo: bool = False) -> str:
    target = guard_output_path(path, allow_in_repo)
    os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    with open(target, "w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r.to_json(), ensure_ascii=False) + "\n")
    return target


def write_report(report, path: str, allow_in_repo: bool = False) -> str:
    """
    The run report is counts and configuration only -- no record text -- so it
    is safe to commit, and `allow_in_repo` defaults to letting it.
    """
    target = os.path.abspath(os.path.expanduser(path))
    os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    with open(target, "w", encoding="utf-8") as fh:
        json.dump(report.to_json(), fh, indent=2)
        fh.write("\n")
    return target


def save_hf_dataset(records, path: str, allow_in_repo: bool = False) -> str:
    """
    Save as a `datasets` Dataset on disk. Optional, and local: `save_to_disk`
    only, never `push_to_hub`.
    """
    try:
        from datasets import Dataset
    except ImportError as exc:
        raise RuntimeError("saving a HF dataset needs `pip install datasets`") from exc
    target = guard_output_path(path, allow_in_repo)
    rows = []
    for r in records:
        row = r.to_json()
        # Arrow wants a stable, flat-ish schema; the nested quality dict has a
        # different key set per record once optional metrics appear.
        row["quality"] = json.dumps(row["quality"], sort_keys=True)
        row["provenance"] = json.dumps(row["provenance"], sort_keys=True)
        row["meta"] = json.dumps(row["meta"], sort_keys=True)
        rows.append(row)
    Dataset.from_list(rows).save_to_disk(target)
    return target
