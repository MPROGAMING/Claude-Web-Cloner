"""
Report shape and the guards around writing one.
"""

import json
import os

import pytest

from bench.contamination.detector import CorpusRecord, HoldoutIndex, TextKind, scan
from bench.contamination.report import Status, build_report, write_report

CODE = """
local Players = game:GetService("Players")

local function greet(player: Player)
	local message = string.format("welcome %s", player.Name)
	print(message)
end

Players.PlayerAdded:Connect(greet)
return greet
"""

OTHER = """
local TweenService = game:GetService("TweenService")
local part = script.Parent
local tween = TweenService:Create(part, TweenInfo.new(1), { Transparency = 1 })
tween:Play()
tween.Completed:Wait()
part:Destroy()
"""


def index_with(tmp_path, text=CODE):
    root = tmp_path / "holdout" / "tasks"
    root.mkdir(parents=True, exist_ok=True)
    with open(root / "t.json", "w", encoding="utf-8") as fh:
        json.dump(
            {
                "task_id": "hold-greet-secret",
                "prompt": "Greet a joining player.",
                "files": [{"path": "src/Greet.luau", "content": text}],
            },
            fh,
        )
    return HoldoutIndex.from_dir(str(tmp_path / "holdout"))


def make(tmp_path, records):
    index = index_with(tmp_path)
    findings, scanned = scan(index, records)
    return build_report(findings, scanned, index, "sha256:abc", "test-corpus", 0.35, 0.60)


def test_a_corpus_with_no_matches_is_clean(tmp_path):
    report = make(tmp_path, [CorpusRecord("a", OTHER, TextKind.luau)])
    assert report.status is Status.clean
    assert "CLEAN" in report.render()


def test_a_match_makes_the_report_suspect_and_names_both_sides(tmp_path):
    report = make(tmp_path, [CorpusRecord("a", CODE, TextKind.luau, "raw/a.luau")])
    assert report.status is Status.suspect
    text = report.render()
    assert "SUSPECT" in text
    assert "raw/a.luau" in text
    assert "exact_bytes" in text


def test_the_report_states_what_it_does_not_cover(tmp_path):
    report = make(tmp_path, [CorpusRecord("a", OTHER, TextKind.luau)])
    text = report.render()
    assert "what this verdict does not cover" in text
    assert "near-duplicate floor" in text


def test_a_clean_report_does_not_reveal_holdout_identity_by_default(tmp_path):
    report = make(tmp_path, [CorpusRecord("a", CODE, TextKind.luau)])
    assert "hold-greet-secret" not in report.render()
    assert "hold-greet-secret" not in json.dumps(report.to_json())
    assert "hold-greet-secret" in report.render(reveal_ids=True)


def test_writing_an_id_revealing_report_into_the_repository_is_refused(tmp_path):
    report = make(tmp_path, [CorpusRecord("a", CODE, TextKind.luau)])
    in_repo = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scan-report.json"
    )
    with pytest.raises(ValueError) as exc:
        write_report(report, in_repo, reveal_ids=True)
    assert "refusing" in str(exc.value)
    assert not os.path.exists(in_repo)


def test_a_redacted_report_may_be_written_anywhere(tmp_path):
    report = make(tmp_path, [CorpusRecord("a", CODE, TextKind.luau)])
    out = str(tmp_path / "out" / "report.json")
    write_report(report, out)
    with open(out, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    assert payload["status"] == "SUSPECT"
    assert "holdout_task_id" not in payload["findings"][0]
