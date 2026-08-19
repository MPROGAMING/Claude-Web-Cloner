"""
Manifest tests, including the one that matters most: the committed manifest
contains no holdout content, checked structurally rather than promised.
"""

import json
import os

import pytest

from bench.contamination.detector import HoldoutIndex, TextKind
from bench.contamination.manifest import (
    MANIFEST_PATH,
    assert_no_content,
    build_manifest,
    load_manifest,
    verify,
    write_manifest,
)

SECRET_TEXT = """
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("SecretHoldoutRemote")

local function guardedCall(player: Player, payload)
	if typeof(payload) ~= "table" then
		return
	end
	remote:FireClient(player, payload)
end

return guardedCall
"""


def make_index(tmp_path, task_id="hold-secret-task", text=SECRET_TEXT):
    root = tmp_path / "holdout" / "tasks"
    root.mkdir(parents=True, exist_ok=True)
    with open(root / (task_id + ".json"), "w", encoding="utf-8") as fh:
        json.dump(
            {
                "task_id": task_id,
                "prompt": "A prompt that must never appear in the repository.",
                "authored_on": "2026-04-01",
                "files": [{"path": "src/Guard.luau", "content": text}],
            },
            fh,
        )
    return HoldoutIndex.from_dir(str(tmp_path / "holdout"))


def test_manifest_contains_no_holdout_content(tmp_path):
    manifest = build_manifest(make_index(tmp_path))
    blob = json.dumps(manifest)
    for leak in ("SecretHoldoutRemote", "guardedCall", "must never appear", "hold-secret-task"):
        assert leak not in blob, "%r leaked into the manifest" % leak
    assert_no_content(manifest)


def test_assert_no_content_rejects_an_added_content_field(tmp_path):
    manifest = build_manifest(make_index(tmp_path))
    manifest["units"][0]["prompt"] = "the prompt"
    with pytest.raises(ValueError) as exc:
        assert_no_content(manifest)
    assert "allow-list" in str(exc.value)


def test_assert_no_content_rejects_a_revealed_manifest(tmp_path):
    revealed = build_manifest(make_index(tmp_path), reveal_ids=True)
    with pytest.raises(ValueError):
        assert_no_content(revealed)


def test_write_manifest_refuses_content(tmp_path):
    manifest = build_manifest(make_index(tmp_path))
    manifest["counts"]["units_by_kind"]["luau"] = "forty-six"
    with pytest.raises(ValueError):
        write_manifest(manifest, str(tmp_path / "out.json"))


def test_manifest_hash_is_stable_across_rebuilds(tmp_path):
    index = make_index(tmp_path)
    a = build_manifest(index)["manifest_hash"]
    b = build_manifest(HoldoutIndex.from_dir(str(tmp_path / "holdout")))["manifest_hash"]
    assert a == b


def test_manifest_hash_is_independent_of_unit_order(tmp_path):
    index = make_index(tmp_path)
    manifest = build_manifest(index)
    shuffled = dict(manifest)
    shuffled["units"] = list(reversed(manifest["units"]))
    from bench.contamination.manifest import compute_manifest_hash

    assert (
        compute_manifest_hash(shuffled["units"], manifest["config"])
        == manifest["manifest_hash"]
    )


def test_verify_detects_an_edited_unit(tmp_path):
    index = make_index(tmp_path)
    manifest = build_manifest(index)
    edited = make_index(tmp_path, text=SECRET_TEXT.replace("FireClient", "FireAllClients"))
    result = verify(edited, manifest)
    assert not result.ok
    assert result.changed, "an in-place edit silently invalidates every score"


def test_verify_distinguishes_added_from_changed(tmp_path):
    index = make_index(tmp_path)
    manifest = build_manifest(index)
    index.add_text("hold-extra", "file:src/Extra.luau", "local x = 1\nreturn x\n", TextKind.luau)
    result = verify(index, manifest)
    assert result.added and not result.changed and not result.removed


def test_verify_flags_normalisation_drift(tmp_path):
    index = make_index(tmp_path)
    manifest = build_manifest(index)
    manifest["config"]["k"] = 99
    result = verify(index, manifest)
    assert not result.ok
    assert "k" in result.config_drift


def test_the_committed_manifest_is_clean_if_it_exists():
    """
    Runs against the real committed file. This is the check that would catch a
    manifest regenerated with --reveal-ids and committed by mistake.
    """
    if not os.path.exists(MANIFEST_PATH):
        pytest.skip("no committed manifest yet")
    manifest = load_manifest(MANIFEST_PATH)
    assert manifest.get("ids_redacted") is True
    assert_no_content(manifest)
