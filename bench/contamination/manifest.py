"""
The holdout manifest: the only thing about the holdout that is allowed in here.

A baseline score without a manifest hash beside it is an unfalsifiable claim.
"73.4% on the Blockwright holdout" means nothing unless you can say *which*
holdout -- one task added or one prompt reworded moves the number, and there is
no way for a reader to tell whether it moved because the model changed or
because the set did. So the manifest exists to be cited: `bench/baselines/*`
records a `manifest_hash`, and re-deriving that hash from a holdout tree is a
one-command check that the two runs measured the same thing.

What is committed, and what is deliberately not
-----------------------------------------------
Committed: whole-unit digests, token and byte counts, dates, and redacted refs.

Not committed, ever: unit text, task ids in the clear (they are descriptive
English and this repository is public), and -- the one that looks harmless and
is not -- **individual shingle hashes**. A 5-gram hash is invertible in practice:
an attacker with a large Luau corpus enumerates 5-grams, hashes them, and
reconstructs a private file window by window. Whole-unit digests carry no such
exposure because there is nothing to enumerate.

`assert_no_content` enforces this structurally rather than by care: every string
in the manifest must match a hash, a date, an enum, or a known constant. A future
edit that adds `"prompt": ...` fails the check and the test that calls it.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from .detector import HoldoutIndex, TextKind
from .normalize import normalizer_signature
from .shingle import MIN_TOKENS_FOR_NEAR_DUP

MANIFEST_VERSION = 1
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "holdout-manifest.json")

_HEX = re.compile(r"^[0-9a-f]+$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ISO_DT = re.compile(r"^\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+$")


def _canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def compute_manifest_hash(units: list, config: dict) -> str:
    """
    Deterministic over unit content-hashes and the normalisation that produced
    them. Order-independent (units are sorted by ref) so a manifest regenerated
    after a directory rename produces the same hash.
    """
    h = hashlib.sha256()
    h.update(_canonical(config).encode())
    for u in sorted(units, key=lambda x: x["ref"]):
        h.update(
            _canonical(
                {
                    "ref": u["ref"],
                    "sha256": u["sha256"],
                    "text_sha256": u["text_sha256"],
                    "token_sha256": u["token_sha256"],
                    "alpha_sha256": u["alpha_sha256"],
                }
            ).encode()
        )
    return "sha256:" + h.hexdigest()


def build_manifest(index: HoldoutIndex, reveal_ids: bool = False) -> dict:
    by_kind: dict = {}
    total_tokens = 0
    units = []
    for u in index.units:
        by_kind[u.kind.value] = by_kind.get(u.kind.value, 0) + 1
        total_tokens += u.n_tokens
        entry = {
            "ref": u.ref,
            "kind": u.kind.value,
            "sha256": u.sha256,
            "text_sha256": u.text_sha256,
            "token_sha256": u.token_sha256,
            "alpha_sha256": u.alpha_sha256,
            "n_tokens": u.n_tokens,
            "n_bytes": u.n_bytes,
            "authored_on": u.authored_on.isoformat() if u.authored_on else None,
            "below_near_dup_floor": u.n_tokens < MIN_TOKENS_FOR_NEAR_DUP,
        }
        if reveal_ids:
            # Only ever for local investigation. `assert_no_content` rejects it,
            # so a revealed manifest cannot be committed by accident.
            entry["task_id"] = u.task_id
            entry["unit"] = u.unit
        units.append(entry)
    units.sort(key=lambda x: x["ref"])

    config = {
        "normalizer": normalizer_signature(),
        "k": index.k,
        "prose_k": index.prose_k,
        "min_tokens_for_near_dup": MIN_TOKENS_FOR_NEAR_DUP,
    }
    manifest = {
        "schema_version": MANIFEST_VERSION,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "ids_redacted": not reveal_ids,
        "config": config,
        "counts": {
            "tasks": index.task_count,
            "units": len(units),
            "units_by_kind": by_kind,
            "units_below_near_dup_floor": index.short_units,
            "total_normalized_tokens": total_tokens,
        },
        "units": units,
    }
    manifest["manifest_hash"] = compute_manifest_hash(units, config)
    return manifest


def assert_no_content(manifest: dict) -> None:
    """
    Structural proof that the manifest carries no holdout content.

    Raises ValueError naming the offending path. Called by `write_manifest` and
    by a test that runs against the committed file, so the guarantee is checked
    on every CI run rather than promised in a docstring.
    """
    allowed_scalar_keys = {
        "schema_version",
        "generated_at",
        "ids_redacted",
        "manifest_hash",
        "normalizer",
        "k",
        "prose_k",
        "min_tokens_for_near_dup",
        "tasks",
        "units",
        "units_by_kind",
        "units_below_near_dup_floor",
        "total_normalized_tokens",
        "ref",
        "kind",
        "sha256",
        "text_sha256",
        "token_sha256",
        "alpha_sha256",
        "n_tokens",
        "n_bytes",
        "authored_on",
        "below_near_dup_floor",
        "luau",
        "prose",
        "config",
        "counts",
    }
    valid_kinds = {k.value for k in TextKind}

    def check(node, path: str):
        if isinstance(node, dict):
            for key, value in node.items():
                if key not in allowed_scalar_keys:
                    raise ValueError(
                        "manifest key %s%s is not on the allow-list; a manifest may "
                        "carry hashes and counts only" % (path, key)
                    )
                check(value, path + key + ".")
        elif isinstance(node, list):
            for i, value in enumerate(node):
                check(value, "%s[%d]." % (path, i))
        elif isinstance(node, str):
            if node.startswith("sha256:"):
                node = node[7:]
            ok = (
                _HEX.match(node)
                or _ISO_DATE.match(node)
                or _ISO_DT.match(node)
                or node in valid_kinds
                or node == normalizer_signature()
                or re.match(r"^luau-lex/\d+\+norm/\d+\+lit\d+$", node)
            )
            if not ok:
                raise ValueError(
                    "manifest string at %s is neither a hash, a date, nor a known "
                    "constant: %r" % (path.rstrip("."), node[:40])
                )
        elif isinstance(node, (int, float, bool)) or node is None:
            return
        else:
            raise ValueError("manifest value at %s has unexpected type" % path)

    check(manifest, "")


def write_manifest(manifest: dict, path: str = MANIFEST_PATH) -> str:
    assert_no_content(manifest)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=False)
        fh.write("\n")
    return manifest["manifest_hash"]


def load_manifest(path: str = MANIFEST_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


@dataclass
class VerifyResult:
    ok: bool
    expected_hash: str
    actual_hash: str
    added: list
    removed: list
    changed: list
    config_drift: dict

    def to_json(self) -> dict:
        return {
            "ok": self.ok,
            "expected_hash": self.expected_hash,
            "actual_hash": self.actual_hash,
            "added": self.added,
            "removed": self.removed,
            "changed": self.changed,
            "config_drift": self.config_drift,
        }


def verify(index: HoldoutIndex, manifest: dict) -> VerifyResult:
    """
    Compare a live holdout tree against a committed manifest.

    Distinguishes the three ways they can disagree, because they mean different
    things: an *added* unit means the holdout grew since the baseline (old scores
    are still valid on a subset), a *removed* one means it shrank, and a
    *changed* one means an existing unit was edited -- which silently invalidates
    every score measured against it.
    """
    recomputed = build_manifest(index)
    old = {u["ref"]: u for u in manifest.get("units", [])}
    new = {u["ref"]: u for u in recomputed["units"]}
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(
        ref
        for ref in set(old) & set(new)
        if any(old[ref].get(f) != new[ref].get(f) for f in ("sha256", "alpha_sha256"))
    )
    config_drift = {}
    for key, value in recomputed["config"].items():
        if manifest.get("config", {}).get(key) != value:
            config_drift[key] = {"manifest": manifest.get("config", {}).get(key), "live": value}
    expected = manifest.get("manifest_hash", "")
    actual = recomputed["manifest_hash"]
    return VerifyResult(
        ok=(expected == actual and not added and not removed and not changed and not config_drift),
        expected_hash=expected,
        actual_hash=actual,
        added=added,
        removed=removed,
        changed=changed,
        config_drift=config_drift,
    )
