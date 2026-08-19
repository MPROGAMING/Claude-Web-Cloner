"""
Within-corpus deduplication.
"""

from bench.factory.dedup import content_hash, deduplicate
from bench.factory.records import TrainingRecord

BASE = """
local Players = game:GetService("Players")

local function onAdded(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = 0
	coins.Parent = stats
	stats.Parent = player
end

Players.PlayerAdded:Connect(onAdded)
"""

DIFFERENT = """
local TweenService = game:GetService("TweenService")

local Mover = {}
Mover.__index = Mover

function Mover.new(instance: BasePart)
	return setmetatable({ instance = instance }, Mover)
end

function Mover:to(position: Vector3, seconds: number)
	local descriptor = TweenInfo.new(seconds)
	local handle = TweenService:Create(self.instance, descriptor, { Position = position })
	handle:Play()
	return handle
end

return Mover
"""


def rec(rid, text, quality_score=1.0):
    return TrainingRecord(
        record_id=rid,
        text=text,
        provenance=None,
        content_hash=content_hash(text),
        quality={"_score": quality_score},
    )


def test_identical_records_collapse_to_one():
    result = deduplicate([rec("a", BASE), rec("b", BASE)])
    assert len(result.kept) == 1
    assert result.exact_dropped == 1


def test_reformatted_and_renamed_copies_collapse_as_exact_after_normalisation():
    reformatted = BASE.replace("\t", "    ").replace("player", "p").replace("stats", "folder")
    reformatted = reformatted.replace('"leaderfolder"', '"leaderstats"')
    result = deduplicate([rec("a", BASE), rec("b", reformatted)])
    assert len(result.kept) == 1
    assert result.exact_dropped == 1, "normalisation makes these the same record"


def test_genuinely_different_records_both_survive():
    result = deduplicate([rec("a", BASE), rec("b", DIFFERENT)])
    assert len(result.kept) == 2
    assert not result.dropped


def test_a_near_duplicate_above_threshold_is_dropped():
    tweaked = BASE.replace("coins.Value = 0", "coins.Value = 100") + "\nreturn true\n"
    result = deduplicate([rec("a", BASE), rec("b", tweaked)])
    assert len(result.kept) == 1
    assert result.near_dropped == 1


def test_the_representative_is_the_highest_quality_member():
    result = deduplicate([rec("low", BASE, 0.1), rec("high", BASE, 9.9)])
    assert [r.record_id for r in result.kept] == ["high"]
    assert "low" in result.dropped


def test_selection_is_deterministic_across_runs():
    records = [rec("a", BASE, 1.0), rec("b", BASE, 1.0), rec("c", BASE, 1.0)]
    first = deduplicate(records).kept[0].record_id
    for _ in range(5):
        assert deduplicate(list(reversed(records))).kept[0].record_id == first


def test_dedup_reports_its_own_miss_rate():
    """
    LSH is a sketch, so some duplicate pairs are missed. The number is derived
    from the banding, reported, and therefore accounted for rather than assumed
    away.
    """
    result = deduplicate([rec("a", BASE), rec("b", DIFFERENT)])
    curve = result.detection_curve
    assert curve["bands"] * curve["rows"] == 128
    assert 0.99 < curve["p_detect_at_threshold"] < 1.0


def test_dropped_entries_name_what_they_were_dropped_for():
    result = deduplicate([rec("keep", BASE, 9.0), rec("dupe", BASE, 1.0)])
    kept_id, kind, similarity = result.dropped["dupe"]
    assert kept_id == "keep" and kind == "exact" and similarity == 1.0


def test_empty_input_is_not_an_error():
    assert deduplicate([]).kept == []
