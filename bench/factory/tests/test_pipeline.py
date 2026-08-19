"""
The pipeline end to end, and the test this whole package exists for: a planted
near-duplicate of a holdout item must be *blocked*, not merely inspected.

The holdout used here is built in tmp_path. No test reads the real holdout, and
no holdout content appears in this file.
"""

import json
import os
import re
from datetime import date

import pytest

from bench.factory.leakgate import HoldoutUnavailable, open_gate
from bench.factory.pipeline import run_pipeline
from bench.factory.records import Provenance, RawDocument, SourceKind

TODAY = date(2026, 8, 19)

# The "holdout" item. Written here, planted into the fake holdout below, and
# then laundered into the fake corpus.
HOLDOUT_SOLUTION = """
local Players = game:GetService("Players")

local COOLDOWN = 5
local lastUse = {}

local function tryUse(player: Player): boolean
	local now = os.clock()
	local previous = lastUse[player.UserId]
	if previous and now - previous < COOLDOWN then
		return false
	end
	lastUse[player.UserId] = now
	return true
end

Players.PlayerRemoving:Connect(function(player)
	lastUse[player.UserId] = nil
end)

return tryUse
"""


def launder(src: str) -> str:
    """
    What someone actually does to a copied file in thirty seconds: rename the
    locals, reindent, swap the quotes, add a couple of comments. Nothing here
    changes the algorithm, so nothing here should defeat the gate.
    """
    renames = {
        "Players": "svc",
        "COOLDOWN": "WINDOW",
        "lastUse": "stamps",
        "tryUse": "attempt",
        "player": "who",
        "now": "t",
        "previous": "before",
    }
    out = src
    for old, new in renames.items():
        out = re.sub(r"\b%s\b" % old, new, out)
    out = out.replace('"Players"', "'Players'")
    out = out.replace("\t", "    ")
    out = "-- Ability gating, adapted for our project.\n" + out
    out = out.replace("return false", "return false -- still cooling down")
    return out


# A genuinely different solution to the same problem. Must survive.
INDEPENDENT = """
local Debounce = {}
Debounce.__index = Debounce

function Debounce.new(seconds: number)
	return setmetatable({ seconds = seconds, entries = {} }, Debounce)
end

function Debounce:check(key): boolean
	local at = self.entries[key]
	if at ~= nil and workspace:GetServerTimeNow() - at < self.seconds then
		return false
	end
	self.entries[key] = workspace:GetServerTimeNow()
	return true
end

return Debounce
"""

CLEAN_A = """
local TweenService = game:GetService("TweenService")

local part = script.Parent
local goal = part.Position + Vector3.new(0, 10, 0)
local info = TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local tween = TweenService:Create(part, info, { Position = goal })

tween:Play()
tween.Completed:Wait()
print("done")
"""

CLEAN_B = """
local CollectionService = game:GetService("CollectionService")

local function wire(prompt: ProximityPrompt)
	prompt.Triggered:Connect(function(player)
		local character = player.Character
		if character == nil then
			return
		end
		local humanoid = character:FindFirstChildOfClass("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = 32
		end
	end)
end

for _, prompt in CollectionService:GetTagged("SpeedPad") do
	wire(prompt)
end
"""


def make_holdout(tmp_path):
    root = tmp_path / "holdout"
    (root / "tasks").mkdir(parents=True, exist_ok=True)
    with open(root / "tasks" / "cooldown.json", "w", encoding="utf-8") as fh:
        json.dump(
            {
                "task_id": "hold-fake-cooldown",
                "authored_on": "2026-04-01",
                "prompt": "Track a per-player ability cooldown and release state on leave.",
                "files": [{"path": "src/Cooldown.luau", "content": HOLDOUT_SOLUTION}],
            },
            fh,
        )
    return str(root)


def prov():
    return Provenance(
        source_id="github:org/repo",
        source_kind=SourceKind.github,
        licence="MIT",
        retrieved_on=TODAY,
        url="https://github.com/org/repo",
        revision="abc123",
        licence_evidence="spdx-file",
    )


def docs(*pairs):
    return [RawDocument(doc_id=rid, text=text, provenance=prov(), path=rid) for rid, text in pairs]


# --- the test this package exists for --------------------------------------


def test_the_gate_blocks_a_planted_near_duplicate(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    corpus = docs(
        ("laundered_leak.luau", launder(HOLDOUT_SOLUTION)),
        ("clean_a.luau", CLEAN_A),
        ("clean_b.luau", CLEAN_B),
    )
    emitted, report = run_pipeline(corpus, gate=gate, today=TODAY)

    emitted_ids = {r.record_id for r in emitted}
    assert "laundered_leak.luau" not in emitted_ids, (
        "a renamed, reindented, re-commented copy of a holdout item was emitted"
    )
    assert {"clean_a.luau", "clean_b.luau"} <= emitted_ids

    leak_stage = report.stages["leak_gate"]
    assert leak_stage.n_dropped == 1
    assert any(r.startswith("leak.") for r in leak_stage.dropped)
    assert report.leak_gate["blocked_records"] == 1


def test_a_verbatim_copy_is_blocked_too(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    emitted, report = run_pipeline(
        docs(("verbatim.luau", HOLDOUT_SOLUTION), ("clean_a.luau", CLEAN_A)),
        gate=gate,
        today=TODAY,
    )
    assert {r.record_id for r in emitted} == {"clean_a.luau"}
    assert report.stages["leak_gate"].dropped["leak.exact_bytes"] == 1


def test_a_holdout_item_buried_in_a_large_file_is_blocked(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    padding = "\n".join(
        "local function pad%d(a%d: number, b%d: string): string\n"
        "\treturn string.format('%%d-%%s-%d', a%d + %d, b%d)\nend" % (i, i, i, i, i, i, i)
        for i in range(120)
    )
    # Wrapped in `do ... end` so the whole file is still valid Luau -- the
    # holdout's own trailing `return` would otherwise make it a syntax error and
    # the record would be dropped for that instead, never reaching the gate.
    buried = "%s\n%s\ndo\n%s\nend\n%s" % (CLEAN_B, padding, HOLDOUT_SOLUTION, padding)
    emitted, report = run_pipeline(
        docs(("buried.luau", buried), ("clean_a.luau", CLEAN_A)), gate=gate, today=TODAY
    )
    assert "buried.luau" not in {r.record_id for r in emitted}
    assert report.stages["leak_gate"].dropped["leak.holdout_inside_record"] == 1


def test_an_independent_solution_to_the_same_problem_survives(tmp_path):
    """
    The other half of the bargain. A gate that blocks everything is not a gate,
    it is a shredder.
    """
    gate = open_gate(make_holdout(tmp_path))
    emitted, report = run_pipeline(
        docs(("independent.luau", INDEPENDENT)), gate=gate, today=TODAY
    )
    assert [r.record_id for r in emitted] == ["independent.luau"]
    assert report.stages["leak_gate"].n_dropped == 0


def test_a_leaked_record_is_not_hidden_by_dedup(tmp_path):
    """
    Stage order matters. If dedup ran first, a leaked record could be dropped as
    the *duplicate* of a clean twin and vanish from the leak report while its
    twin sailed through. The gate sees every record.
    """
    gate = open_gate(make_holdout(tmp_path))
    laundered = launder(HOLDOUT_SOLUTION)
    emitted, report = run_pipeline(
        docs(
            ("leak_1.luau", laundered),
            ("leak_2.luau", laundered + "\n-- second copy\n"),
            ("clean_a.luau", CLEAN_A),
        ),
        gate=gate,
        today=TODAY,
    )
    assert {r.record_id for r in emitted} == {"clean_a.luau"}
    assert report.stages["leak_gate"].n_dropped == 2, "both copies must be counted as leaks"
    assert report.stages["dedup"].n_dropped == 0


# --- failing closed ---------------------------------------------------------


def test_a_missing_holdout_refuses_to_open_the_gate(tmp_path):
    with pytest.raises(HoldoutUnavailable):
        open_gate(str(tmp_path / "does-not-exist"))


def test_an_empty_holdout_refuses_to_open_the_gate(tmp_path):
    empty = tmp_path / "empty-holdout"
    (empty / "tasks").mkdir(parents=True)
    with pytest.raises(HoldoutUnavailable):
        open_gate(str(empty))


def test_skipping_the_gate_is_possible_but_stamps_the_report(tmp_path):
    gate = open_gate(str(tmp_path / "nope"), allow_missing_holdout=True)
    emitted, report = run_pipeline(docs(("clean_a.luau", CLEAN_A)), gate=gate, today=TODAY)
    assert len(emitted) == 1
    assert report.leak_gate["leak_gate"] == "SKIPPED"


# --- counting ---------------------------------------------------------------


def test_every_stage_reconciles_and_the_totals_add_up(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    bad_provenance = RawDocument(doc_id="unlicensed.luau", text=CLEAN_A, provenance=None)
    corpus = docs(
        ("clean_a.luau", CLEAN_A),
        ("clean_b.luau", CLEAN_B),
        ("dup_of_a.luau", CLEAN_A.replace("\t", "    ")),
        ("tiny.luau", "return 1\n"),
        ("leak.luau", launder(HOLDOUT_SOLUTION)),
    ) + [bad_provenance]

    emitted, report = run_pipeline(corpus, gate=gate, today=TODAY)

    assert report.total_in == 6
    assert report.reconciles(), report.to_json()["stages"]
    assert all(s.reconciles() for s in report.stages.values())
    reasons = report.dropped_by_reason()
    assert reasons["provenance.missing"] == 1
    assert reasons["quality.too_small"] == 1
    assert reasons["dedup.exact"] == 1
    assert sum(1 for k in reasons if k.startswith("leak.")) == 1
    assert report.total_out == len(emitted) == 2
    assert report.total_in == report.total_out + sum(reasons.values())


def test_the_summary_line_is_the_one_the_progress_page_shows(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    _, report = run_pipeline(
        docs(("clean_a.luau", CLEAN_A), ("tiny.luau", "return 1\n")), gate=gate, today=TODAY
    )
    line = report.summary_line()
    assert line.startswith("2 in,")
    assert "quality.too_small" in line
    assert line.endswith("1 out")


def test_drop_examples_never_name_the_holdout_task(tmp_path):
    """
    A run report is safe to commit, so a leak drop may cite the holdout by
    redacted ref and never by task id.
    """
    gate = open_gate(make_holdout(tmp_path))
    _, report = run_pipeline(
        docs(("leak.luau", launder(HOLDOUT_SOLUTION))), gate=gate, today=TODAY
    )
    blob = json.dumps(report.to_json())
    assert "hold-fake-cooldown" not in blob
    assert "tryUse" not in blob and "COOLDOWN" not in blob


def test_the_run_report_records_which_holdout_it_gated_against(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    _, report = run_pipeline(docs(("clean_a.luau", CLEAN_A)), gate=gate, today=TODAY)
    assert report.leak_gate["manifest_hash"].startswith("sha256:")
    assert report.leak_gate["leak_gate"] == "ACTIVE"


def test_syntax_stage_configuration_is_recorded(tmp_path):
    gate = open_gate(make_holdout(tmp_path))
    _, report = run_pipeline(docs(("clean_a.luau", CLEAN_A)), gate=gate, today=TODAY)
    cfg = report.config
    if cfg["syntax_binary"]:
        assert cfg["syntax_parse_only"] is True, (
            "the syntax gate must parse, not execute, scraped material"
        )
        assert os.path.basename(cfg["syntax_binary"]) == "luau-compile"
