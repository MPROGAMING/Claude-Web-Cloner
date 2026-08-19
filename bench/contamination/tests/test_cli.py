"""
CLI behaviour that CI depends on: exit codes, and the date check covering the
whole holdout rather than the half it happens to understand.
"""

import json

from bench.contamination.cli import EXIT_CANNOT_RUN, EXIT_CLEAN, EXIT_SUSPECT, collect_task_views, main

CODE = """
local Players = game:GetService("Players")

local function award(player: Player, amount: number)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	if coins then
		coins.Value += amount
	end
end

Players.PlayerAdded:Connect(function(player)
	award(player, 10)
end)

return award
"""

OTHER = """
local Lighting = game:GetService("Lighting")
Lighting.ClockTime = 14
Lighting.Brightness = 2
local sky = Instance.new("Sky")
sky.Parent = Lighting
print("day set")
"""


def build_holdout(tmp_path):
    root = tmp_path / "holdout"
    (root / "tasks").mkdir(parents=True)
    with open(root / "tasks" / "a.json", "w", encoding="utf-8") as fh:
        json.dump(
            {
                "task_id": "hold-json-task",
                "authored_on": "2026-04-01",
                "prompt": "Award coins to a joining player.",
                "files": [{"path": "src/Award.luau", "content": CODE}],
            },
            fh,
        )
    return root


def test_scan_exits_clean_on_a_clean_corpus(tmp_path, capsys):
    root = build_holdout(tmp_path)
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "a.luau").write_text(OTHER)
    code = main(["--holdout", str(root), "scan", "--corpus-dir", str(corpus)])
    assert code == EXIT_CLEAN
    assert "CLEAN" in capsys.readouterr().out


def test_scan_exits_suspect_when_something_leaked(tmp_path, capsys):
    root = build_holdout(tmp_path)
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "leak.luau").write_text(CODE.replace("player", "plr").replace("\t", "  "))
    code = main(["--holdout", str(root), "scan", "--corpus-dir", str(corpus)])
    assert code == EXIT_SUSPECT
    out = capsys.readouterr().out
    assert "SUSPECT" in out
    assert "leak.luau" in out


def test_a_scan_with_no_corpus_cannot_run_rather_than_reporting_clean(tmp_path, capsys):
    root = build_holdout(tmp_path)
    assert main(["--holdout", str(root), "scan"]) == EXIT_CANNOT_RUN


def test_a_scan_against_a_missing_holdout_cannot_run(tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "a.luau").write_text(OTHER)
    code = main(
        ["--holdout", str(tmp_path / "nope"), "scan", "--corpus-dir", str(corpus)]
    )
    assert code == EXIT_CANNOT_RUN, "a scan that could not run is not a clean scan"


def test_manifest_and_verify_round_trip(tmp_path, capsys):
    root = build_holdout(tmp_path)
    out = tmp_path / "manifest.json"
    assert main(["--holdout", str(root), "manifest", "--out", str(out)]) == EXIT_CLEAN
    assert main(["--holdout", str(root), "verify", "--manifest", str(out)]) == EXIT_CLEAN
    # Edit the holdout in place; verify must notice.
    (root / "tasks" / "a.json").write_text(
        json.dumps(
            {
                "task_id": "hold-json-task",
                "authored_on": "2026-04-01",
                "prompt": "Award coins to a joining player.",
                "files": [{"path": "src/Award.luau", "content": CODE + "\nreturn nil\n"}],
            }
        )
    )
    assert main(["--holdout", str(root), "verify", "--manifest", str(out)]) == EXIT_SUSPECT
    assert "DRIFT" in capsys.readouterr().out


def test_datecheck_covers_json_and_python_authored_tasks(tmp_path):
    """
    The holdout is co-owned. A date check that understood only JSON would report
    an eligibility split over half the tasks and never say so.
    """
    root = build_holdout(tmp_path)
    pkg = root / "tasks"
    (pkg / "__init__.py").write_text("")
    (pkg / "registry.py").write_text(
        "import datetime\n"
        "class _T:\n"
        "    task_id = 'hold-python-task'\n"
        "    authored_on = datetime.date(2026, 7, 1)\n"
        "class _H:\n"
        "    task = _T()\n"
        "    solution = {}\n"
        "HOLDOUT = [_H()]\n"
    )
    views = collect_task_views(str(root))
    ids = {v.task_id for v in views}
    assert "hold-json-task" in ids
    assert "hold-python-task" in ids


def test_datecheck_needs_an_asterisk_when_the_model_is_unknown(tmp_path):
    root = build_holdout(tmp_path)
    code = main(
        ["datecheck", "--model", "lab/never-heard-of-it", "--tasks", str(root / "tasks")]
    )
    assert code == EXIT_SUSPECT, "an unknown cutoff must not read as a clean run"
