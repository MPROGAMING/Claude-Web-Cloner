"""
Quality filters. Every criterion is a number with a threshold, and every drop
has a name.

The syntax floor, and a correction to the obvious way to build it
-----------------------------------------------------------------
`luau file.luau` *runs* the file. Two things follow, and both matter.

1. It is arbitrary code execution over scraped material. A training-data
   pipeline that runs everything it ingests is a pipeline that can be made to
   do anything by anyone who can get a file into the corpus.
2. It rejects almost all real Roblox code anyway. Plain `luau` has no `game`, no
   `workspace`, no `Instance`, so a perfectly valid server script exits 1 with
   "attempt to index nil with 'GetService'". Measured on this machine:

       $ luau roblox_script.luau       -> exit 1, runtime error on line 1
       $ luau-compile --only-parse ... -> exit 0

   A syntax gate built on `luau` would therefore drop the entire Roblox corpus
   and keep only the code that happens to run standalone -- precisely backwards.

So the gate is `luau-compile --only-parse`, which parses and does not execute.
`luau` remains as a last-resort fallback if `luau-compile` is missing, with the
false-drop behaviour above recorded as a warning on the run rather than hidden.

Beyond the floor
----------------
Syntactic validity is a low bar: minified bundles, generated tables, obfuscated
loaders and files that are 95% comment all parse fine. The rest of the filters
are the ones that decide whether the corpus is worth training on:

    size            too small to teach anything / too large to be a hand-written file
    line_length     a 4,000-character line is minified or generated, not written
    printable       binary or mangled-encoding blobs
    repetition      generated data tables masquerading as code
    comment_ratio   prose filed under .luau
    identifiers     single-character identifiers everywhere means minified
    secrets         API keys, .ROBLOSECURITY cookies, private keys
    roblox_signal   on-domain: does this file know it is Roblox code
    deprecated      annotated always; dropped only on request

Thresholds are module constants so the run report can print the configuration it
actually ran under, rather than a description of it.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field

from bench.contamination.luau_lex import Tok, lex
from bench.contamination.normalize import NormLevel, normalize

MIN_TOKENS = 24
MAX_BYTES = 256 * 1024
MAX_LINE_LENGTH = 512
MIN_PRINTABLE_RATIO = 0.95
MIN_UNIQUE_LINE_RATIO = 0.35
MAX_COMMENT_RATIO = 0.80
MIN_MEAN_IDENTIFIER_LENGTH = 2.0
MAX_SINGLE_CHAR_IDENTIFIER_RATIO = 0.50
# Below this many lines, "unique line ratio" and "comment ratio" are noise.
REPETITION_MIN_LINES = 12

LUAU_COMPILE = os.environ.get("BLOCKWRIGHT_LUAU_COMPILE") or shutil.which("luau-compile") or (
    "/opt/homebrew/bin/luau-compile" if os.path.exists("/opt/homebrew/bin/luau-compile") else None
)
LUAU = os.environ.get("BLOCKWRIGHT_LUAU") or shutil.which("luau") or (
    "/opt/homebrew/bin/luau" if os.path.exists("/opt/homebrew/bin/luau") else None
)

# Roblox-specific vocabulary. One hit is enough -- this is an on-domain check,
# not a style score.
_ROBLOX_SIGNALS = [
    re.compile(p)
    for p in (
        r"\bgame\s*[:.]",
        r"\bworkspace\b",
        r"\bInstance\.new\b",
        r"\bGetService\b",
        r"\bscript\.(Parent|Name|Source)\b",
        r"\bEnum\.[A-Z]",
        r"\b(Vector3|CFrame|UDim2|Color3|BrickColor|TweenInfo|NumberSequence)\.",
        r":(Connect|Once|Wait|FireServer|FireClient|FireAllClients|InvokeServer)\b",
        r"\b(RemoteEvent|RemoteFunction|BindableEvent|Humanoid|BasePart|Tool|ProximityPrompt)\b",
        r"\btask\.(wait|spawn|delay|defer)\b",
        r"\b(ReplicatedStorage|ServerScriptService|ServerStorage|StarterGui|StarterPack)\b",
        r"\brbxassetid://",
    )
]

_DEPRECATED = {
    "wait": re.compile(r"(?<![\w.:])wait\s*\("),
    "spawn": re.compile(r"(?<![\w.:])spawn\s*\("),
    "delay": re.compile(r"(?<![\w.:])delay\s*\("),
    "LoadLibrary": re.compile(r"\bLoadLibrary\b"),
    "Instance:remove": re.compile(r":remove\s*\("),
    "BodyMovers": re.compile(r"\b(BodyVelocity|BodyPosition|BodyGyro|BodyThrust)\b"),
    "KeyDown": re.compile(r"\.(KeyDown|KeyUp)\b"),
    "FindPartOnRay": re.compile(r"\bFindPartOnRay(WithIgnoreList|WithWhitelist)?\b"),
}

# Secrets. Each pattern is specific enough that a hit is worth a drop; a generic
# "long base64 string" rule was tried and flagged every embedded mesh id.
_SECRETS = [
    ("roblox_cookie", re.compile(r"\.ROBLOSECURITY|_\|WARNING:-DO-NOT-SHARE-THIS")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("aws_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("slack_token", re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,}")),
    ("github_token", re.compile(r"\bgh[pousr]_[0-9A-Za-z]{30,}")),
    (
        "assigned_secret",
        re.compile(
            r"""(?ix)
            \b(api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token|password|passwd)
            \b \s* = \s* ['"][^'"\n]{16,}['"]
            """
        ),
    ),
    ("webhook_url", re.compile(r"https://(discord(app)?\.com|hooks\.slack\.com)/api/webhooks/\S+")),
]


@dataclass
class QualityVerdict:
    ok: bool
    reason: str | None = None
    detail: str = ""
    metrics: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)


class SyntaxChecker:
    """
    Parse-only Luau validation, batched.

    Batched because a subprocess per record dominates the runtime of a real
    corpus pass. `luau-compile` takes a file list and prefixes every diagnostic
    with the offending path, so failures are attributable from one invocation.
    Anything unattributable falls back to a per-file re-check rather than being
    guessed at.
    """

    def __init__(self, binary: str | None = None, batch_size: int = 64):
        self.binary = binary or LUAU_COMPILE
        self.batch_size = batch_size
        self.parse_only = self.binary is not None and self.binary.endswith("luau-compile")
        self.fallback_executes = not self.parse_only
        self.available = self.binary is not None

    def _args(self, paths):
        if self.parse_only:
            return [self.binary, "--only-parse"] + list(paths)
        # Fallback: the plain interpreter, which EXECUTES. Used only when
        # luau-compile is absent; the pipeline records that it happened.
        return [self.binary] + list(paths)

    def check_many(self, texts: list) -> list:
        """[(ok, message)] aligned with `texts`."""
        if not self.available:
            return [(True, "luau binary not available -- syntax gate skipped")] * len(texts)
        results: list = [None] * len(texts)
        with tempfile.TemporaryDirectory(prefix="bw-syntax-") as td:
            for start in range(0, len(texts), self.batch_size):
                chunk = list(range(start, min(start + self.batch_size, len(texts))))
                paths = {}
                for i in chunk:
                    path = os.path.join(td, "r%08d.luau" % i)
                    with open(path, "w", encoding="utf-8") as fh:
                        fh.write(texts[i])
                    paths[path] = i
                proc = subprocess.run(
                    self._args(paths), capture_output=True, text=True, timeout=120
                )
                if proc.returncode == 0:
                    for i in chunk:
                        results[i] = (True, "")
                    continue
                blamed = {}
                for line in (proc.stdout + "\n" + proc.stderr).splitlines():
                    for path, i in paths.items():
                        if line.startswith(path):
                            blamed.setdefault(i, line[len(path) :].strip(": "))
                for i in chunk:
                    if i in blamed:
                        results[i] = (False, blamed[i])
                    elif blamed:
                        # Some file in the batch failed and this one was not
                        # named, so it parsed.
                        results[i] = (True, "")
                    else:
                        results[i] = None
                # Nothing was attributable: re-run those individually rather
                # than declaring the whole batch bad.
                for i in chunk:
                    if results[i] is None:
                        single = subprocess.run(
                            self._args([os.path.join(td, "r%08d.luau" % i)]),
                            capture_output=True,
                            text=True,
                            timeout=60,
                        )
                        results[i] = (
                            single.returncode == 0,
                            (single.stdout + single.stderr).strip()[:200],
                        )
        return results


def measure(text: str) -> dict:
    """Every number the filters key on, computed once."""
    raw_lines = text.split("\n")
    lines = [ln for ln in raw_lines if ln.strip()]
    lexed = lex(text)
    code = lexed.code_tokens()
    comments = [t for t in lexed.tokens if t.kind is Tok.comment]
    idents = [t.text for t in code if t.kind is Tok.name]
    comment_chars = sum(len(t.text) for t in comments)
    printable = sum(1 for ch in text if ch.isprintable() or ch in "\n\t\r")

    norm_tokens = normalize(text, NormLevel.alpha).tokens
    roblox_hits = sum(1 for p in _ROBLOX_SIGNALS if p.search(text))
    deprecated = {name: len(p.findall(text)) for name, p in _DEPRECATED.items()}
    deprecated = {k: v for k, v in deprecated.items() if v}

    return {
        "n_bytes": len(text.encode("utf-8")),
        "n_lines": len(lines),
        "n_tokens": len(norm_tokens),
        "max_line_length": max((len(ln) for ln in raw_lines), default=0),
        "printable_ratio": (printable / len(text)) if text else 0.0,
        "unique_line_ratio": (len({ln.strip() for ln in lines}) / len(lines)) if lines else 1.0,
        "comment_ratio": (comment_chars / len(text)) if text else 0.0,
        "mean_identifier_length": (
            sum(len(i) for i in idents) / len(idents) if idents else 0.0
        ),
        "single_char_identifier_ratio": (
            sum(1 for i in idents if len(i) == 1) / len(idents) if idents else 0.0
        ),
        "roblox_signal_count": roblox_hits,
        "deprecated_api_calls": deprecated,
        "deprecated_total": sum(deprecated.values()),
        "lex_ok": lexed.ok,
        "lex_error": lexed.error,
    }


def find_secrets(text: str) -> list:
    return [name for name, pattern in _SECRETS if pattern.search(text)]


def judge(
    text: str,
    syntax_ok: bool,
    syntax_message: str = "",
    metrics: dict | None = None,
    require_roblox_signal: bool = True,
    drop_deprecated: bool = False,
) -> QualityVerdict:
    m = metrics if metrics is not None else measure(text)
    warnings: list = []

    if not syntax_ok:
        return QualityVerdict(False, "quality.syntax", syntax_message[:200], m)
    if m["n_bytes"] > MAX_BYTES:
        return QualityVerdict(False, "quality.too_large", str(m["n_bytes"]), m)
    if m["n_tokens"] < MIN_TOKENS:
        return QualityVerdict(False, "quality.too_small", str(m["n_tokens"]), m)
    if m["printable_ratio"] < MIN_PRINTABLE_RATIO:
        return QualityVerdict(
            False, "quality.non_printable", "%.3f" % m["printable_ratio"], m
        )
    if m["max_line_length"] > MAX_LINE_LENGTH:
        return QualityVerdict(
            False, "quality.line_too_long", str(m["max_line_length"]), m
        )
    if m["n_lines"] >= REPETITION_MIN_LINES:
        if m["unique_line_ratio"] < MIN_UNIQUE_LINE_RATIO:
            return QualityVerdict(
                False, "quality.repetitive", "%.3f" % m["unique_line_ratio"], m
            )
        if m["comment_ratio"] > MAX_COMMENT_RATIO:
            return QualityVerdict(
                False, "quality.mostly_comment", "%.3f" % m["comment_ratio"], m
            )
    if m["mean_identifier_length"] and (
        m["mean_identifier_length"] < MIN_MEAN_IDENTIFIER_LENGTH
        and m["single_char_identifier_ratio"] > MAX_SINGLE_CHAR_IDENTIFIER_RATIO
    ):
        return QualityVerdict(
            False,
            "quality.minified",
            "mean_ident=%.2f single_char=%.2f"
            % (m["mean_identifier_length"], m["single_char_identifier_ratio"]),
            m,
        )

    secrets = find_secrets(text)
    if secrets:
        # Never echo the matched text -- a drop reason must not become the leak.
        return QualityVerdict(False, "quality.secret", ",".join(secrets), m)

    if require_roblox_signal and m["roblox_signal_count"] == 0:
        return QualityVerdict(False, "quality.off_domain", "0 roblox signals", m)

    if m["deprecated_total"]:
        detail = ",".join("%s=%d" % kv for kv in sorted(m["deprecated_api_calls"].items()))
        if drop_deprecated:
            return QualityVerdict(False, "quality.deprecated_api", detail, m)
        warnings.append("quality.deprecated_api:" + detail)
    if not m["lex_ok"]:
        # The parser accepted it, so this is a lexer disagreement worth seeing
        # rather than a drop.
        warnings.append("quality.lex_warning:%s" % (m["lex_error"] or "unknown"))

    return QualityVerdict(True, metrics=m, warnings=warnings)


def score(m: dict) -> float:
    """
    A single number for ranking survivors, used only to pick the representative
    of a duplicate cluster. Never a pass/fail: the filters already decided that.
    """
    s = 0.0
    s += min(m.get("n_tokens", 0) / 400.0, 1.0) * 2.0
    s += min(m.get("roblox_signal_count", 0) / 4.0, 1.0) * 2.0
    s += m.get("unique_line_ratio", 0.0)
    s += min(m.get("comment_ratio", 0.0) / 0.15, 1.0)
    s -= min(m.get("deprecated_total", 0) / 5.0, 1.0)
    return round(s, 4)


def config() -> dict:
    return {
        "min_tokens": MIN_TOKENS,
        "max_bytes": MAX_BYTES,
        "max_line_length": MAX_LINE_LENGTH,
        "min_printable_ratio": MIN_PRINTABLE_RATIO,
        "min_unique_line_ratio": MIN_UNIQUE_LINE_RATIO,
        "max_comment_ratio": MAX_COMMENT_RATIO,
        "min_mean_identifier_length": MIN_MEAN_IDENTIFIER_LENGTH,
        "max_single_char_identifier_ratio": MAX_SINGLE_CHAR_IDENTIFIER_RATIO,
        "repetition_min_lines": REPETITION_MIN_LINES,
    }
