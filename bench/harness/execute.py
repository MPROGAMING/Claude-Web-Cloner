"""
Sandboxed Luau execution.

SWE-bench runs every instance in its own Docker container. Docker is not
available here, so this is process-level isolation instead, and it is weaker in
a way worth stating plainly rather than papering over:

  * a wall-clock timeout and SIGKILL, so a `while true do end` cannot wedge a run
  * an address-space cap via RLIMIT_AS, so a runaway allocation dies rather than
    taking the machine with it
  * a file-descriptor cap
  * a fresh temp directory per execution, removed afterwards
  * an emptied environment, so nothing leaks from the runner's shell into the
    program under test

What it does NOT give, and what Docker would: filesystem isolation and a network
namespace. A task's Luau can still read the wider filesystem. Plain `luau` ships
no socket or HTTP library so network access is not reachable from the language
surface, but that is a property of the interpreter, not a boundary this code
enforces. Do not run untrusted third-party submissions through this without
putting a real sandbox underneath it first.
"""

from __future__ import annotations

import json
import os
import resource
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

LUAU_BIN = os.environ.get("BW_LUAU_BIN", "/opt/homebrew/bin/luau")

# 512 MB of address space is far more than any benchmark task needs and far less
# than it takes to hurt the host.
MEM_LIMIT_BYTES = 512 * 1024 * 1024
FD_LIMIT = 256


@dataclass
class ExecResult:
    ok: bool
    exit_code: int
    stdout: str
    stderr: str
    duration_s: float
    timed_out: bool = False
    """
    Set when the runner itself failed — the binary is missing, the temp dir
    could not be made. Kept separate from `ok` because SWE-bench's report map
    separates infra failure from model failure, and conflating them reports
    noise as signal.
    """
    infra_error: str | None = None


def _limits() -> None:
    """
    Applied in the child between fork and exec.

    Every limit is best-effort. macOS does not honour RLIMIT_AS and raises when
    you try to set it, and a raise here kills the whole subprocess launch with
    an opaque "Exception occurred in preexec_fn" — so an unavailable limit must
    degrade to no limit rather than to no execution. `applied_limits()` reports
    which ones actually took, so a run never claims isolation it does not have.
    """
    for res, value in (
        (getattr(resource, "RLIMIT_AS", None), (MEM_LIMIT_BYTES, MEM_LIMIT_BYTES)),
        (getattr(resource, "RLIMIT_NOFILE", None), (FD_LIMIT, FD_LIMIT)),
        (getattr(resource, "RLIMIT_CORE", None), (0, 0)),
    ):
        if res is None:
            continue
        try:
            resource.setrlimit(res, value)
        except (ValueError, OSError):
            pass

    # Detach from the runner's process group so a timeout kill takes the whole
    # tree, not just the parent that spawned something else.
    try:
        os.setsid()
    except OSError:
        pass


def applied_limits() -> dict[str, bool]:
    """
    Which resource limits this platform actually accepts.

    The harness reports this alongside a score. A benchmark that says it
    sandboxes and does not is worse than one that says it does not.
    """
    # Probed in a child, with the value actually used. An earlier version
    # re-set each limit to its CURRENT value in this process, which always
    # succeeds and therefore reported every limit as applied — including
    # RLIMIT_AS on macOS, which in fact raises. A probe that cannot fail is not
    # a probe, and this function exists precisely so a run cannot overstate its
    # own isolation.
    out: dict[str, bool] = {}
    for name, value in (
        ("RLIMIT_AS", MEM_LIMIT_BYTES),
        ("RLIMIT_NOFILE", FD_LIMIT),
        ("RLIMIT_CORE", 0),
    ):
        if getattr(resource, name, None) is None:
            out[name] = False
            continue
        probe = (
            "import resource,sys;"
            f"resource.setrlimit(resource.{name}, ({value}, {value}));"
            "sys.exit(0)"
        )
        try:
            done = subprocess.run(
                [sys.executable, "-c", probe],
                capture_output=True, timeout=10,
            )
            out[name] = done.returncode == 0
        except (OSError, subprocess.SubprocessError):
            out[name] = False
    return out


def luau_available() -> bool:
    return Path(LUAU_BIN).exists() or shutil.which(LUAU_BIN) is not None


# Where a task's own modules live, and the alias its tests import them through.
# Holdout tasks are written as `require("@proj/shared/Inventory")` against files
# laid out under `src/`, mirroring how a Roblox project is actually organised.
# Luau resolves that through a `.luaurc` in the working directory — without one
# every such require fails and the task looks broken when it is not. That is
# exactly what happened: all 25 runnable holdout tasks reported "a pass_to_pass
# test fails on the UNMODIFIED project" and every one of them was this.
PROJECT_ALIASES = {"proj": "./src"}


def run_luau(
    files: dict[str, str],
    entry: str,
    timeout_s: float = 5.0,
    aliases: dict[str, str] | None = None,
) -> ExecResult:
    """
    Write `files` into a throwaway directory and run `entry` under `luau`.

    `files` maps relative path to content, so a task can lay out a small project
    and have `require` resolve between its modules the way it would in a real
    tree. `aliases` becomes the `.luaurc` require-alias map; pass None for the
    project default, or an explicit dict to add more (the Roblox stub runtime
    mounts itself this way).
    """
    if not luau_available():
        return ExecResult(
            ok=False, exit_code=-1, stdout="", stderr="", duration_s=0.0,
            infra_error=f"luau binary not found at {LUAU_BIN}",
        )

    workdir = None
    try:
        workdir = tempfile.mkdtemp(prefix="bwbench-")

        alias_map = dict(PROJECT_ALIASES if aliases is None else aliases)
        # Written before the task files so a task that ships its own .luaurc
        # overwrites ours rather than being silently overridden by it.
        (Path(workdir) / ".luaurc").write_text(
            json.dumps({"aliases": alias_map}), encoding="utf-8"
        )

        for rel, content in files.items():
            target = Path(workdir) / rel
            # A task path must not escape the sandbox directory. This is the same
            # class of check the product applies to model-proposed paths, and it
            # matters more here because the content is executed.
            resolved = target.resolve()
            if not str(resolved).startswith(str(Path(workdir).resolve())):
                return ExecResult(
                    ok=False, exit_code=-1, stdout="", stderr="", duration_s=0.0,
                    infra_error=f"task file path escapes the sandbox: {rel}",
                )
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        started = time.monotonic()
        try:
            proc = subprocess.run(
                [LUAU_BIN, entry],
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=timeout_s,
                preexec_fn=_limits,
                # Emptied on purpose: nothing from the runner's shell should be
                # visible to the program being scored.
                env={"PATH": "/usr/bin:/bin"},
            )
        except subprocess.TimeoutExpired as exc:
            return ExecResult(
                ok=False,
                exit_code=-9,
                stdout=(exc.stdout or b"").decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""),
                stderr=(exc.stderr or b"").decode("utf-8", "replace") if isinstance(exc.stderr, bytes) else (exc.stderr or ""),
                duration_s=timeout_s,
                timed_out=True,
            )

        duration = time.monotonic() - started
        return ExecResult(
            ok=proc.returncode == 0,
            exit_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            duration_s=duration,
        )
    except OSError as exc:
        return ExecResult(
            ok=False, exit_code=-1, stdout="", stderr="", duration_s=0.0,
            infra_error=f"{type(exc).__name__}: {exc}",
        )
    finally:
        if workdir:
            shutil.rmtree(workdir, ignore_errors=True)
