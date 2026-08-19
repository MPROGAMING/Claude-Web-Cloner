"""
Detector tests. The holdout used here is built in a tmp_path -- no test ever
reads, embeds, or depends on the real holdout's content.
"""

import json
import os

from bench.contamination.detector import (
    CorpusRecord,
    HoldoutIndex,
    MatchKind,
    TextKind,
    scan,
)

SOLUTION = """
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

# Same algorithm, laundered: comments added, locals renamed, reindented,
# requoted. This is the shape a leak actually arrives in.
LAUNDERED = """
-- Ability gating, adapted from a snippet we found.
local svc = game:GetService('Players')

local WINDOW = 5
local stamps = {}

local function attempt(who: Player): boolean
    -- has enough time passed?
    local t = os.clock()
    local before = stamps[who.UserId]
    if before and t - before < WINDOW then
        return false
    end
    stamps[who.UserId] = t
    return true
end

svc.PlayerRemoving:Connect(function(who)
    stamps[who.UserId] = nil
end)

return attempt
"""

# A genuinely different approach to the same problem. Must NOT be flagged.
INDEPENDENT = """
local Debounce = {}
Debounce.__index = Debounce

function Debounce.new(seconds: number)
	return setmetatable({ seconds = seconds, entries = {} }, Debounce)
end

function Debounce:check(key): boolean
	local at = self.entries[key]
	if at ~= nil and tick() - at < self.seconds then
		return false
	end
	self.entries[key] = tick()
	return true
end

return Debounce
"""

UNRELATED = """
local TweenService = game:GetService("TweenService")
local part = script.Parent
local goal = part.Position + Vector3.new(0, 10, 0)
local info = TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local tween = TweenService:Create(part, info, { Position = goal })
tween:Play()
tween.Completed:Wait()
print("done")
"""


def write_holdout(tmp_path, **overrides):
    task = {
        "task_id": "hold-fake-cooldown",
        "scenario": "code_generation",
        "category": "code_generation",
        "difficulty": "medium",
        "visibility": "holdout",
        "authored_on": "2026-04-01",
        "prompt": "Write a per-player ability cooldown that releases state on leave.",
        "files": [{"path": "src/shared/Cooldown.luau", "content": SOLUTION}],
        "fail_to_pass": [],
        "pass_to_pass": [],
    }
    task.update(overrides)
    root = tmp_path / "holdout"
    (root / "tasks").mkdir(parents=True, exist_ok=True)
    with open(root / "tasks" / "fake.json", "w", encoding="utf-8") as fh:
        json.dump(task, fh)
    return str(root)


def test_verbatim_copy_is_an_exact_byte_match(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    findings = index.match(CorpusRecord("r1", SOLUTION, TextKind.luau, "corpus/a.luau"))
    assert findings
    assert findings[0].match_kind is MatchKind.exact_bytes


def test_reformatted_copy_is_caught_at_the_alpha_level(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    reformatted = SOLUTION.replace("\t", "        ") + "\n\n\n"
    findings = index.match(CorpusRecord("r2", reformatted, TextKind.luau))
    assert findings and findings[0].match_kind in (
        MatchKind.exact_text,
        MatchKind.exact_token,
        MatchKind.exact_alpha,
    )


def test_laundered_copy_is_caught_as_a_near_duplicate(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    findings = index.match(CorpusRecord("r3", LAUNDERED, TextKind.luau))
    assert findings, "renaming and re-commenting must not defeat the detector"
    assert findings[0].jaccard > 0.5


def test_holdout_buried_in_a_large_file_is_caught_by_containment(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    padding = "\n".join(
        "local function pad%d(a, b) return a * %d + b end" % (i, i) for i in range(300)
    )
    buried = padding + "\n" + SOLUTION + "\n" + padding
    findings = index.match(CorpusRecord("r4", buried, TextKind.luau))
    assert findings, "a leak pasted into a big file must still be found"
    hit = findings[0]
    assert hit.containment_holdout_in_record > 0.9
    assert hit.jaccard < 0.35, "and Jaccard alone would have missed it"


def test_an_independent_solution_is_not_flagged(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    assert index.match(CorpusRecord("r5", INDEPENDENT, TextKind.luau)) == []


def test_unrelated_code_is_not_flagged(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    assert index.match(CorpusRecord("r6", UNRELATED, TextKind.luau)) == []


def test_a_leaked_prompt_is_found_even_though_it_is_prose(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    leaked = "Write a per-player ability cooldown that releases state on leave."
    findings = index.match(CorpusRecord("r7", leaked, TextKind.prose))
    assert findings, "a memorised prompt is a leak even without the solution"
    assert findings[0].holdout_unit == "prompt"


def test_units_are_named_so_prompt_and_answer_key_leaks_are_distinguishable(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    units = {u.unit for u in index.units}
    assert "prompt" in units
    assert "file:src/shared/Cooldown.luau" in units


def test_holdout_ref_does_not_reveal_the_task_id(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    for unit in index.units:
        assert "cooldown" not in unit.ref.lower()
        assert unit.task_id not in unit.ref


def test_scan_counts_every_record_even_the_clean_ones(tmp_path):
    index = HoldoutIndex.from_dir(write_holdout(tmp_path))
    records = [
        CorpusRecord("a", SOLUTION, TextKind.luau),
        CorpusRecord("b", INDEPENDENT, TextKind.luau),
        CorpusRecord("c", UNRELATED, TextKind.luau),
    ]
    findings, scanned = scan(index, records)
    assert scanned == 3
    assert {f.record_id for f in findings} == {"a"}


def test_missing_holdout_raises_rather_than_returning_an_empty_index(tmp_path):
    try:
        HoldoutIndex.from_dir(str(tmp_path / "nope"))
    except FileNotFoundError:
        return
    raise AssertionError("an absent holdout must not silently produce a clean scan")


def test_python_authored_holdout_is_indexed_too(tmp_path):
    """
    The holdout is co-owned and half of it is authored as Python objects. An
    index that only understood JSON would report CLEAN over an unprotected half.
    """
    root = tmp_path / "pyholdout"
    pkg = root / "tasks"
    pkg.mkdir(parents=True)
    (pkg / "__init__.py").write_text("")
    (pkg / "registry.py").write_text(
        "class _T:\n"
        "    task_id = 'py-task'\n"
        "    prompt = 'a prompt authored in python'\n"
        "    files = []\n"
        "    fail_to_pass = []\n"
        "    pass_to_pass = []\n"
        "    broken_source = None\n"
        "    expected_output = None\n"
        "    authored_on = None\n"
        "\n"
        "class _H:\n"
        "    task = _T()\n"
        "    solution = {'src/A.luau': %r}\n"
        "\n"
        "HOLDOUT = [_H()]\n" % SOLUTION
    )
    index = HoldoutIndex.from_dir(str(root))
    assert any(u.unit.startswith("solution:") for u in index.units), (
        "the reference solution is the answer key and must be indexed"
    )
    assert index.match(CorpusRecord("r", SOLUTION, TextKind.luau))
    # Leave no bytecode behind that a later test could import instead.
    assert os.path.isdir(str(pkg))


# ---------------------------------------------------------------------------
class TestBothFileShapesAreScanned:
    """
    A holdout artefact carries `files` in one of two shapes and both have to be
    indexed.

    An exported TASK serialises `files` as a list of {path, content}, because
    that is what the schema dataclass produces. An exported SOLUTION writes a
    plain {path: content} mapping. The detector assumed the list and raised
    AttributeError on the mapping, which aborted the repository leak scan
    entirely — so the scan that protects the benchmark had never completed.

    The solution is the worst thing to miss: it is the answer key. These pin
    that both shapes are actually indexed, not merely tolerated.
    """

    SECRET = (
        'local function resolveWithoutBlocking(parent, childName)\n'
        '\tlocal found = parent:FindFirstChild(childName)\n'
        '\tif found then return found end\n'
        '\tlocal conn\n'
        '\tconn = parent.ChildAdded:Connect(function(child)\n'
        '\t\tif child.Name == childName then conn:Disconnect() end\n'
        '\tend)\n'
        '\treturn nil\n'
        'end\n'
        'return resolveWithoutBlocking\n'
    )

    def _index_with(self, files):
        index = HoldoutIndex()
        n = index.add_task_dict({
            "task_id": "shape_probe",
            "prompt": "irrelevant prose that is long enough to shingle on its own",
            "files": files,
            "fail_to_pass": [{"name": "t", "source": "assert(true)"}],
        })
        return index, n

    def test_list_of_records_is_indexed(self):
        _, n = self._index_with([{"path": "src/A.luau", "content": self.SECRET}])
        assert n >= 3  # prompt + file + test

    def test_mapping_is_indexed_too(self):
        _, n = self._index_with({"src/A.luau": self.SECRET})
        assert n >= 3

    def test_the_two_shapes_index_the_same_number_of_units(self):
        _, as_list = self._index_with([{"path": "src/A.luau", "content": self.SECRET}])
        _, as_map = self._index_with({"src/A.luau": self.SECRET})
        assert as_list == as_map

    def test_the_answer_key_is_caught_from_the_mapping_shape(self):
        # The whole point: a solution exported as a mapping must still be found
        # when it turns up verbatim in a training corpus.
        index, _ = self._index_with({"src/A.luau": self.SECRET})
        findings, scanned = scan(index, [CorpusRecord("leaked", self.SECRET, TextKind.luau, "corpus/leaked.luau")])
        assert scanned == 1
        assert findings, "the answer key was not detected from the mapping shape"

    def test_a_malformed_files_value_narrows_the_scan_rather_than_aborting_it(self):
        # A broken artefact must not take the whole scan down with it; the
        # prompt and tests still get indexed.
        _, n = self._index_with("not a files collection at all")
        assert n >= 2
