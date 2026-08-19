"""
The Roblox stub runtime's own gate.

`bench/runtime/roblox.luau` stands in for an API the benchmark cannot otherwise
reach, so every semantic it gets wrong is a place a task silently grades
something other than what it claims to. The Luau suites under
`bench/runtime/tests/` are the substance of this file; each one runs through the
same sandboxed executor the benchmark uses, so what is verified here is what
tasks actually execute against.

Three things are asserted from Python rather than Luau, because they are
properties of the runtime across processes and files:

  * the module resolves at all through the alias the tasks require it by,
  * the same scenario produces byte-identical output on repeated runs in
    separate processes,
  * mounting the runtime never overwrites a file the task itself declared.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from harness.execute import luau_available, run_luau  # noqa: E402
from runtime import (  # noqa: E402
    LUAURC,
    RUNTIME_MODULE,
    inject_runtime,
    needs_runtime,
    runtime_files,
)

LUAU_TESTS = sorted((Path(__file__).resolve().parents[1] / "runtime" / "tests").glob("*.luau"))

requires_luau = pytest.mark.skipif(
    not luau_available(), reason="luau is not installed; the runtime cannot be exercised"
)


def run_source(source: str, timeout_s: float = 20.0, **files: str):
    """
    Run one Luau chunk with the stub runtime mounted, as a task would.

    Keyword files land under `src/`, which is what `@proj` resolves to, with
    `__` standing in for a path separator: `server__Greeter=` writes
    `src/server/Greeter.luau`.
    """
    tree = {"main.luau": source}
    tree.update({"src/" + name.replace("__", "/") + ".luau": text for name, text in files.items()})
    return run_luau(inject_runtime(tree), "main.luau", timeout_s=timeout_s)


# --------------------------------------------------------------------------
# The Luau suites. One test per file so a failure names the semantic that
# broke rather than "the runtime".
# --------------------------------------------------------------------------


def test_there_are_luau_suites():
    """A guard against this file passing because it found nothing to run."""
    assert len(LUAU_TESTS) >= 6, [p.name for p in LUAU_TESTS]


@requires_luau
@pytest.mark.parametrize("suite", LUAU_TESTS, ids=lambda p: p.stem)
def test_luau_suite(suite: Path):
    result = run_luau(
        inject_runtime({"suite.luau": suite.read_text(encoding="utf-8")}),
        "suite.luau",
        timeout_s=30.0,
    )
    assert not result.infra_error, result.infra_error
    assert not result.timed_out, f"{suite.name} timed out — something is waiting on real time"
    assert result.exit_code == 0, f"{suite.name} failed:\n{result.stderr}"
    assert result.stdout.strip().endswith("ok")


# --------------------------------------------------------------------------
# Wiring: the alias the tasks require the runtime by has to resolve inside the
# harness sandbox, from a task file as well as from the test file.
# --------------------------------------------------------------------------


@requires_luau
def test_require_alias_resolves_from_a_test_and_from_a_project_file():
    result = run_source(
        """
        local rbx = require("@bench/roblox")
        local Greeter = require("@proj/server/Greeter")
        assert(type(rbx.Instance.new) == "function")
        assert(Greeter.classOf() == "Folder")
        print("ok")
        """,
        server__Greeter="""
        local rbx = require("@bench/roblox")
        return { classOf = function() return rbx.Instance.new("Folder").ClassName end }
        """,
    )
    assert result.exit_code == 0, result.stderr
    assert result.stdout.strip() == "ok"


@requires_luau
def test_the_whole_declared_surface_is_present():
    """
    Every member `tasks/audit.py` extracted from the holdout sources. A missing
    one is a task that cannot run, and it should fail here rather than there.
    """
    result = run_source(
        """
        local rbx = require("@bench/roblox")
        for _, name in ipairs({ "Instance", "game", "localPlayer", "newSignal", "reset", "scheduler", "task" }) do
            assert(rbx[name] ~= nil, "rbx." .. name .. " is missing")
        end
        for _, name in ipairs({ "wait", "spawn", "delay" }) do
            assert(type(rbx.task[name]) == "function", "task." .. name .. " is missing")
        end
        for _, name in ipairs({ "clock", "drain", "pendingCount", "step" }) do
            assert(type(rbx.scheduler[name]) == "function", "scheduler." .. name .. " is missing")
        end
        for _, class in ipairs({ "Folder", "IntValue", "Model", "Part", "RemoteEvent" }) do
            local made = rbx.Instance.new(class)
            assert(made.ClassName == class)
            for _, member in ipairs({ "Clone", "Destroy", "FindFirstChild", "GetChildren",
                                     "GetDescendants", "IsA", "WaitForChild" }) do
                assert(type(made[member]) == "function", class .. ":" .. member .. " is missing")
            end
            assert(made.Name ~= nil and made.Parent == nil)
        end
        local remote = rbx.Instance.new("RemoteEvent")
        for _, member in ipairs({ "FireServer", "FireClient", "FireAllClients" }) do
            assert(type(remote[member]) == "function", "RemoteEvent:" .. member .. " is missing")
        end
        for _, signal in ipairs({ remote.OnServerEvent, remote.OnClientEvent,
                                 rbx.Instance.new("Folder").ChildAdded, rbx.newSignal() }) do
            for _, member in ipairs({ "Connect", "Once", "Wait" }) do
                assert(type(signal[member]) == "function", "signal:" .. member .. " is missing")
            end
            assert(type(signal:Connect(function() end).Disconnect) == "function", "connection:Disconnect is missing")
        end
        assert(rbx.Instance.new("IntValue").Value == 0)
        assert(rbx.game:GetService("ReplicatedStorage") ~= nil)
        print("ok")
        """
    )
    assert result.exit_code == 0, result.stderr


# --------------------------------------------------------------------------
# Determinism, across processes rather than within one.
# --------------------------------------------------------------------------

_TRACE_SCENARIO = """
local rbx = require("@bench/roblox")
local task, scheduler = rbx.task, rbx.scheduler

rbx.reset()
local trace = {}
local function note(what)
    table.insert(trace, string.format("%.2f:%s", scheduler.clock(), what))
end

local folder = rbx.Instance.new("Folder")
local signal = rbx.newSignal()

for index = 1, 5 do
    task.spawn(function()
        note("spawn" .. index)
        task.wait(index * 0.1)
        note("woke" .. index)
    end)
    task.delay(index * 0.15, function()
        note("delay" .. index)
        signal:Fire(index)
    end)
end
task.spawn(function()
    local child = folder:WaitForChild("Kid", 5)
    note("waited:" .. tostring(child and child.Name))
end)
task.delay(0.42, function()
    local kid = rbx.Instance.new("Part")
    kid.Name = "Kid"
    kid.Parent = folder
end)
signal:Connect(function(value)
    note("heard" .. value)
end)
signal:Once(function(value)
    note("once" .. value)
end)

assert(scheduler.drain(30), "the scenario deadlocked")
print(table.concat(trace, " "))
"""


@requires_luau
def test_the_interleaving_is_identical_across_runs():
    runs = [run_source(_TRACE_SCENARIO) for _ in range(4)]
    for result in runs:
        assert result.exit_code == 0, result.stderr
    traces = {result.stdout for result in runs}
    assert len(traces) == 1, f"the scheduler is not deterministic across processes: {traces}"
    trace = runs[0].stdout.split()
    # Non-trivial on purpose: a scenario that produced nothing would compare
    # equal to itself and prove nothing.
    assert len(trace) >= 20, trace
    assert trace[0].startswith("0.00:"), trace[0]
    # Monotonic, because a virtual clock that went backwards would still be
    # deterministic and still be wrong.
    stamps = [float(entry.split(":")[0]) for entry in trace]
    assert stamps == sorted(stamps), stamps
    # The scenario fires the signal five times; Once has to appear exactly once,
    # and the WaitForChild has to have resolved rather than timed out.
    assert len([e for e in trace if ":once" in e]) == 1, trace
    assert "0.42:waited:Kid" in trace, trace


@requires_luau
def test_nothing_waits_on_real_time():
    """
    Thirty minutes of virtual time, in a fraction of a second of real time. If
    any of this reached the wall clock the benchmark would be unrunnable, and a
    task that waits a minute would cost a minute.
    """
    result = run_source(
        """
        local rbx = require("@bench/roblox")
        local done = false
        rbx.task.spawn(function()
            for _ = 1, 60 do
                rbx.task.wait(30)
            end
            done = true
        end)
        assert(rbx.scheduler.drain(3600), "the queue never drained")
        assert(done, "the thread never finished")
        assert(rbx.scheduler.clock() == 1800, "the clock is at " .. rbx.scheduler.clock())
        print("ok")
        """,
        timeout_s=10.0,
    )
    assert result.exit_code == 0, result.stderr
    assert result.duration_s < 5.0, f"took {result.duration_s:.2f}s of wall clock"


# --------------------------------------------------------------------------
# The semantics a naive stub gets wrong, asserted here as well as in Luau, so
# that a regression is reported as the thing it breaks.
# --------------------------------------------------------------------------


@requires_luau
def test_waitforchild_does_not_return_early_for_an_absent_child():
    result = run_source(
        """
        local rbx = require("@bench/roblox")
        local folder = rbx.Instance.new("Folder")
        local returned = false
        rbx.task.spawn(function()
            folder:WaitForChild("NotThere")
            returned = true
        end)
        assert(not returned, "WaitForChild returned immediately for an absent child")
        assert(rbx.scheduler.pendingCount() == 1, "it is not waiting on the scheduler either")
        assert(rbx.scheduler.drain(60) == false, "a wait that cannot resolve reported as drained")
        print("ok")
        """
    )
    assert result.exit_code == 0, result.stderr


@requires_luau
def test_fireserver_identity_is_not_client_controllable():
    result = run_source(
        """
        local rbx = require("@bench/roblox")
        local remote = rbx.Instance.new("RemoteEvent")
        local seen = {}
        remote.OnServerEvent:Connect(function(player, first)
            table.insert(seen, player.Name .. "/" .. tostring(first))
        end)
        rbx.localPlayer = { Name = "Ann", UserId = 1 }
        remote:FireServer({ Name = "Admin" })
        remote:FireServer("Admin")
        assert(seen[1]:sub(1, 4) == "Ann/", "seen " .. seen[1])
        assert(seen[2] == "Ann/Admin", "seen " .. seen[2])
        print("ok")
        """
    )
    assert result.exit_code == 0, result.stderr


# --------------------------------------------------------------------------
# The Python side of the mount.
# --------------------------------------------------------------------------


def test_inject_runtime_adds_the_module_and_the_alias_map():
    files = inject_runtime({"src/server/Shop.luau": "return {}"})
    assert RUNTIME_MODULE in files
    assert "return rbx" in files[RUNTIME_MODULE]
    assert '"bench"' in files[LUAURC] and '"proj"' in files[LUAURC]
    assert files["src/server/Shop.luau"] == "return {}"


def test_a_task_file_wins_over_the_mount():
    """
    A task is allowed to be more specific than the harness. Silently overwriting
    a file the task declared would be the harness editing what it measures.
    """
    files = inject_runtime({LUAURC: '{"aliases": {}}', RUNTIME_MODULE: "return {}"})
    assert files[LUAURC] == '{"aliases": {}}'
    assert files[RUNTIME_MODULE] == "return {}"


def test_runtime_files_are_only_the_two():
    assert set(runtime_files()) == {LUAURC, RUNTIME_MODULE}


def test_needs_runtime_spots_the_marker():
    assert needs_runtime('local rbx = require("@bench/roblox")')
    assert needs_runtime("nothing", 'x = require("@bench/roblox")')
    assert not needs_runtime('require("@proj/shared/Cooldown")', "", None)
