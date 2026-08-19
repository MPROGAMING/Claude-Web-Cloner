"""
The leakage detector: an exact inverted index over the holdout.

The holdout is small and the training corpus is large, and that asymmetry
decides the algorithm. Every shingle of every holdout unit fits in one dict in
memory, so a corpus record is scored against the *entire* holdout in a single
pass over its own shingles -- exactly, with no sketch and therefore no sketching
false negatives. MinHash/LSH is used for the corpus-against-itself problem
(`bench.factory.dedup`), where N^2 makes sketching necessary; importing its miss
rate into the gate that protects the benchmark would be paying a cost for
nothing. `minhash.py` states that miss rate for the place it is actually paid.

The residual false negatives here are therefore entirely normalisation's, not
the algorithm's:

1. A leak shorter than `MIN_TOKENS_FOR_NEAR_DUP` that has been reformatted.
   Below the floor, set-overlap statistics are noise, so only exact matching
   applies. Reported in the report header rather than hidden.
2. A leak rewritten structurally -- loop style changed, helper extracted,
   branches inverted. Token shingles do not survive that. `calibrate.py`
   measures how far it survives and the number is in the report.
3. A leak that renames the Roblox API surface itself (aliasing
   `game:GetService` into a local and calling that). Keeping the API surface is
   what makes the false-positive rate liveable; see `normalize.py`.

What a unit is
--------------
A holdout Task is not one blob. Its prompt, each project file, each test's
source, the broken source and the expected output are indexed separately,
because they leak separately: a memorised *prompt* means the model has seen the
task even if it never saw a solution. A finding names the unit, so "the prompt
leaked" and "the answer key leaked" are never confused.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Iterable, Iterator, Sequence

from .normalize import (
    NormLevel,
    normalize,
    normalize_prose,
    normalize_text,
    normalizer_signature,
)
from .shingle import (
    DEFAULT_K,
    MIN_TOKENS_FOR_NEAR_DUP,
    ShingleSet,
    containment,
    jaccard,
    shingle,
)

# Prose needs wider shingles than code: English has a much smaller effective
# vocabulary per position, so 5-word windows collide between unrelated task
# statements ("create a new part in workspace and") far more often than 5-token
# windows of Luau do.
PROSE_K = 8

# Operating thresholds, set from the measurement in calibrate.py rather than
# from taste. On the calibration corpus at (alpha, k=5):
#
#   mechanical positives  n=264  jaccard  min 0.470  median 1.000
#   structural positives  n= 11  jaccard  min 0.080  median 0.292  max 0.478
#   same-problem negatives n=33  jaccard  min 0.000  median 0.089  max 0.299
#                                contain  max 0.506
#   cross-problem negatives n=495 jaccard max 0.129  contain max 0.270
#
# So 0.35 is the lowest Jaccard with zero measured false positives and a real
# margin (0.05) over the hardest negative, and 0.60 is the same for containment
# (margin 0.09). Going lower buys structural recall and starts flagging
# independent solutions; going higher buys nothing measurable and loses recall.
#
# The costs are asymmetric and the thresholds are set for that asymmetry: a
# false positive drops one training record, a false negative silently voids a
# benchmark. Aggressive is the correct direction.
#
# The honest caveat, which the report prints: zero false positives over 528
# negative pairs bounds the rate at roughly 0.6% (95%), not at zero. At corpus
# scale that is thousands of spurious drops, which is exactly why the gate drops
# records rather than raising alarms.
DEFAULT_JACCARD_THRESHOLD = 0.35
# Containment sits higher than Jaccard because it is asymmetric and easier to
# reach by accident: a short generic unit is "contained in" any large file that
# uses the same idiom.
DEFAULT_CONTAINMENT_THRESHOLD = 0.60


class TextKind(str, Enum):
    luau = "luau"
    prose = "prose"


class MatchKind(str, Enum):
    exact_bytes = "exact_bytes"
    exact_text = "exact_text"
    exact_token = "exact_token"
    exact_alpha = "exact_alpha"
    near_jaccard = "near_jaccard"
    # The holdout unit sits inside a larger corpus record.
    holdout_inside_record = "holdout_inside_record"
    # The corpus record is a fragment of a holdout unit.
    record_inside_holdout = "record_inside_holdout"


# Ordered strongest-first so a finding reports the most damning kind it earned.
# Whole-document similarity outranks containment: when both fire the documents
# *are* each other, and "holdout_inside_record" would understate that. The
# containment kinds exist for the case Jaccard structurally cannot see -- a
# holdout unit pasted into a much larger file.
_MATCH_RANK = [
    MatchKind.exact_bytes,
    MatchKind.exact_text,
    MatchKind.exact_token,
    MatchKind.exact_alpha,
    MatchKind.near_jaccard,
    MatchKind.holdout_inside_record,
    MatchKind.record_inside_holdout,
]


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class HoldoutUnit:
    """One indexable piece of one holdout task."""

    task_id: str
    unit: str
    kind: TextKind
    sha256: str
    text_sha256: str
    token_sha256: str
    alpha_sha256: str
    n_tokens: int
    n_bytes: int
    authored_on: date | None
    # Never serialised. Individual shingle hashes of a private file are a
    # dictionary attack away from being the file, which is exactly why the
    # committed manifest carries whole-unit digests only.
    shingles: ShingleSet = field(repr=False, default=None)

    @property
    def ref(self) -> str:
        """
        Stable, non-revealing handle for reports.

        Task ids are descriptive English ("holdout-security-remote-validation")
        and this repository is public, so the default handle for a holdout unit
        is a hash of its identity, not its identity.
        """
        return hashlib.sha256(("%s\x00%s" % (self.task_id, self.unit)).encode()).hexdigest()[:16]


@dataclass
class CorpusRecord:
    """Minimal view of a training record that the detector needs."""

    record_id: str
    text: str
    kind: TextKind = TextKind.luau
    source: str = ""


@dataclass
class Finding:
    holdout_ref: str
    holdout_task_id: str | None
    holdout_unit: str | None
    record_id: str
    record_source: str
    match_kind: MatchKind
    score: float
    jaccard: float
    containment_holdout_in_record: float
    containment_record_in_holdout: float
    level: NormLevel
    holdout_tokens: int
    record_tokens: int

    def to_json(self, reveal_ids: bool) -> dict:
        d = {
            "holdout_ref": self.holdout_ref,
            "record_id": self.record_id,
            "record_source": self.record_source,
            "match_kind": self.match_kind.value,
            "score": round(self.score, 4),
            "jaccard": round(self.jaccard, 4),
            "containment_holdout_in_record": round(self.containment_holdout_in_record, 4),
            "containment_record_in_holdout": round(self.containment_record_in_holdout, 4),
            "level": self.level.value,
            "holdout_tokens": self.holdout_tokens,
            "record_tokens": self.record_tokens,
        }
        if reveal_ids:
            d["holdout_task_id"] = self.holdout_task_id
            d["holdout_unit"] = self.holdout_unit
        return d


def _iter_files(files: object) -> Iterator[tuple[str, str]]:
    """
    Normalise the two file shapes a holdout artefact can use.

    Yields (path, content) for either a list of {path, content} records or a
    {path: content} mapping. Anything else yields nothing rather than raising,
    because a malformed artefact should narrow the scan and be reported, not
    abort the scan that protects the benchmark.
    """
    if isinstance(files, dict):
        for path, content in files.items():
            if isinstance(content, str):
                yield str(path), content
        return
    if isinstance(files, list):
        for entry in files:
            if isinstance(entry, dict):
                content = entry.get("content")
                if isinstance(content, str):
                    yield str(entry.get("path", "?")), content
            elif isinstance(entry, str):
                # A bare string carries content with no path worth naming.
                yield "?", entry
        return


def _unit_texts(task: dict) -> Iterator[tuple[str, str, TextKind]]:
    """Yield (unit_name, text, kind) for every leakable piece of a task dict."""
    prompt = task.get("prompt")
    if prompt:
        yield "prompt", prompt, TextKind.prose
    # Two shapes reach here and both are legitimate. An exported TASK carries
    # `files` as a list of {path, content} because that is what the schema
    # dataclass serialises to. An exported SOLUTION carries it as a plain
    # {path: content} mapping. Assuming one of them crashed on the other, which
    # meant the repository leak scan never completed at all — and the solution
    # is the single most important thing to scan, because it is the answer key.
    for path, content in _iter_files(task.get("files")):
        if content:
            yield "file:%s" % path, content, TextKind.luau
    for bucket in ("fail_to_pass", "pass_to_pass"):
        for t in task.get(bucket) or []:
            src = t.get("source")
            if src:
                yield "%s:%s" % (bucket, t.get("name", "?")), src, TextKind.luau
    if task.get("broken_source"):
        yield "broken_source", task["broken_source"], TextKind.luau
    if task.get("expected_output"):
        yield "expected_output", task["expected_output"], TextKind.prose


def normalized_forms(text: str, kind: TextKind, k: int | None = None):
    """
    (text_hash_input, token_list, alpha_token_list, shingle_set) for a text.

    Prose has no token/alpha distinction -- there are no locals to rename -- so
    both levels collapse to the word stream. Keeping the same shape for both
    kinds means the index and the scorer have one code path, not two.
    """
    if kind is TextKind.prose:
        words = normalize_prose(text)
        kk = k if k is not None else PROSE_K
        return normalize_text(text), words, words, shingle(words, kk)
    tok = normalize(text, NormLevel.token)
    alpha = normalize(text, NormLevel.alpha)
    kk = k if k is not None else DEFAULT_K
    return normalize_text(text), tok.tokens, alpha.tokens, shingle(alpha.tokens, kk)


def _module_lives_under(mod, root: str) -> bool:
    """
    Guard against importing an unrelated `registry` or `tasks` from site-packages
    and treating whatever it exports as the holdout.
    """
    path = getattr(mod, "__file__", None)
    if path:
        return os.path.abspath(path).startswith(root + os.sep)
    for entry in getattr(mod, "__path__", ()) or ():
        if os.path.abspath(entry).startswith(root + os.sep):
            return True
    return False


def import_registry_items(root: str, module_names: Sequence[str] = ()) -> list:
    """
    Import a holdout authored as Python and return whatever it exposes.

    Discovery is by convention over a small set of names rather than by a fixed
    API, so the other builder who owns the authoring modules can rename things
    without silently turning the leak gate off. Returns [] when nothing is
    found; the caller decides whether that is acceptable, and never guesses.

    Shared by the leakage index and by the date check. They were separate once,
    and the date check quietly covered only the JSON half of a co-owned holdout
    -- the same "reports clean over an unprotected half" failure the index had.
    """
    import importlib
    import sys

    root = os.path.abspath(os.path.expanduser(root))
    candidates = list(module_names) or ["tasks.registry", "registry", "tasks"]
    top_levels = {name.split(".")[0] for name in candidates}

    # Import hermetically. `tasks` is a generic name and a plain directory of
    # JSON files imports fine as a namespace package, so without this a first
    # load caches `tasks` pointing at one holdout tree and every later load in
    # the same process finds nothing there. Found by a test that loads two
    # different holdouts in one process.
    stashed = {k: v for k, v in sys.modules.items() if k.split(".")[0] in top_levels}
    for key in stashed:
        del sys.modules[key]

    sys.path.insert(0, root)
    try:
        importlib.invalidate_caches()
        for mod_name in candidates:
            try:
                mod = importlib.import_module(mod_name)
            except Exception:
                continue
            if not _module_lives_under(mod, root):
                continue
            for attr in ("HOLDOUT", "HOLDOUTS", "TASKS", "ALL", "ALL_TASKS"):
                value = getattr(mod, attr, None)
                if callable(value):
                    try:
                        value = value()
                    except Exception:
                        continue
                if not isinstance(value, (list, tuple)) or not value:
                    continue
                items = [i for i in value if hasattr(i, "task") or hasattr(i, "task_id")]
                if items:
                    return items
    finally:
        if root in sys.path:
            sys.path.remove(root)
        for key in [k for k in sys.modules if k.split(".")[0] in top_levels]:
            del sys.modules[key]
        sys.modules.update(stashed)
    return []


def _shallow_task_dict(obj) -> dict:
    """
    Pull the leakable fields off a Task-shaped object without importing its
    class. `dataclasses.asdict` would be neater but recurses into fields that a
    stand-in may not have, and this only ever needs the text.
    """
    def seq(name):
        out = []
        for item in getattr(obj, name, None) or []:
            if isinstance(item, dict):
                out.append(item)
            else:
                out.append({
                    "path": getattr(item, "path", None),
                    "content": getattr(item, "content", None),
                    "name": getattr(item, "name", None),
                    "source": getattr(item, "source", None),
                })
        return out

    authored = getattr(obj, "authored_on", None)
    return {
        "task_id": getattr(obj, "task_id", "<unknown>"),
        "prompt": getattr(obj, "prompt", None),
        "files": seq("files"),
        "fail_to_pass": seq("fail_to_pass"),
        "pass_to_pass": seq("pass_to_pass"),
        "broken_source": getattr(obj, "broken_source", None),
        "expected_output": getattr(obj, "expected_output", None),
        "authored_on": authored.isoformat() if hasattr(authored, "isoformat") else authored,
    }


class HoldoutIndex:
    def __init__(self, k: int = DEFAULT_K, prose_k: int = PROSE_K):
        self.k = k
        self.prose_k = prose_k
        self.units: list[HoldoutUnit] = []
        self._by_sha: dict = defaultdict(list)
        self._by_text: dict = defaultdict(list)
        self._by_token: dict = defaultdict(list)
        self._by_alpha: dict = defaultdict(list)
        # shingle hash -> unit indices. The whole point: exact, no sketching.
        self._inverted: dict = defaultdict(list)
        self.source_root: str | None = None
        self.task_count = 0

    # -- construction --------------------------------------------------------

    def add_text(
        self,
        task_id: str,
        unit: str,
        text: str,
        kind: TextKind,
        authored_on: date | None = None,
    ) -> HoldoutUnit:
        k = self.prose_k if kind is TextKind.prose else self.k
        text_norm, tokens, alpha_tokens, sh = normalized_forms(text, kind, k)
        u = HoldoutUnit(
            task_id=task_id,
            unit=unit,
            kind=kind,
            sha256=sha256(text),
            text_sha256=sha256(text_norm),
            token_sha256=sha256("\x1f".join(tokens)),
            alpha_sha256=sha256("\x1f".join(alpha_tokens)),
            n_tokens=len(alpha_tokens),
            n_bytes=len(text.encode("utf-8")),
            authored_on=authored_on,
            shingles=sh,
        )
        idx = len(self.units)
        self.units.append(u)
        self._by_sha[u.sha256].append(idx)
        self._by_text[u.text_sha256].append(idx)
        self._by_token[u.token_sha256].append(idx)
        self._by_alpha[u.alpha_sha256].append(idx)
        for h in sh.hashes:
            self._inverted[h].append(idx)
        return u

    def add_task_dict(self, task: dict) -> int:
        task_id = task.get("task_id", "<unknown>")
        authored = task.get("authored_on")
        authored_on = date.fromisoformat(authored[:10]) if authored else None
        n = 0
        for unit, text, kind in _unit_texts(task):
            self.add_text(task_id, unit, text, kind, authored_on)
            n += 1
        self.task_count += 1
        return n

    def add_task_object(self, obj) -> int:
        """
        Index a `bench.schema.task.Task`, or anything shaped like one.

        Duck-typed rather than isinstance-checked because the holdout is
        co-owned: tasks arrive both as JSON and as Python objects built by
        another builder's authoring modules, and an index that only understood
        one of those shapes would report CLEAN while half the holdout sat
        unprotected.
        """
        if hasattr(obj, "to_json"):
            return self.add_task_dict(obj.to_json())
        return self.add_task_dict(_shallow_task_dict(obj))

    def add_holdout_object(self, obj) -> int:
        """
        Index a wrapper carrying a task plus its reference solution.

        The reference solution is the single most damaging thing in the tree --
        it is the answer key -- so it is indexed under its own unit names rather
        than being left to whatever the task itself happens to contain.
        """
        n = 0
        task = getattr(obj, "task", None)
        if task is not None:
            n += self.add_task_object(task)
            task_id = getattr(task, "task_id", "<unknown>")
        else:
            task_id = "<unknown>"
        solution = getattr(obj, "solution", None) or {}
        authored = getattr(task, "authored_on", None) if task is not None else None
        for path, content in sorted(solution.items()):
            if content:
                self.add_text(task_id, "solution:%s" % path, content, TextKind.luau, authored)
                n += 1
        return n

    def add_python_registry(self, root: str, module_names: Sequence[str] = ()) -> int:
        """
        Index a holdout authored as Python. See `import_registry_items`.
        """
        added = 0
        for item in import_registry_items(root, module_names):
            if hasattr(item, "task"):
                added += self.add_holdout_object(item)
                self.task_count += 1
            elif hasattr(item, "task_id"):
                added += self.add_task_object(item)
                self.task_count += 1
        return added

    @classmethod
    def from_dir(
        cls,
        root: str,
        k: int = DEFAULT_K,
        prose_k: int = PROSE_K,
        include_python: bool = True,
    ) -> "HoldoutIndex":
        """
        Load every holdout task from a directory tree.

        `*.json` / `*.jsonl` are read as Task records; loose `*.luau` files are
        indexed as bare units so a holdout can also hold reference solutions
        that are not yet wrapped in a Task. If the tree also carries a Python
        authoring package, it is imported and indexed too -- see
        `add_python_registry`.
        """
        root = os.path.expanduser(root)
        idx = cls(k=k, prose_k=prose_k)
        idx.source_root = root
        if not os.path.isdir(root):
            raise FileNotFoundError("holdout root does not exist: %s" % root)
        for dirpath, _dirnames, filenames in os.walk(root):
            for name in sorted(filenames):
                path = os.path.join(dirpath, name)
                rel = os.path.relpath(path, root)
                if name.endswith(".json"):
                    with open(path, "r", encoding="utf-8") as fh:
                        payload = json.load(fh)
                    for task in payload if isinstance(payload, list) else [payload]:
                        if isinstance(task, dict) and "task_id" in task:
                            idx.add_task_dict(task)
                elif name.endswith(".jsonl"):
                    with open(path, "r", encoding="utf-8") as fh:
                        for line in fh:
                            line = line.strip()
                            if not line:
                                continue
                            task = json.loads(line)
                            if isinstance(task, dict) and "task_id" in task:
                                idx.add_task_dict(task)
                elif name.endswith((".luau", ".lua")):
                    with open(path, "r", encoding="utf-8", errors="replace") as fh:
                        idx.add_text("file::%s" % rel, "raw", fh.read(), TextKind.luau)
                        idx.task_count += 1
        if include_python:
            idx.add_python_registry(root)
        return idx

    # -- querying ------------------------------------------------------------

    def __len__(self) -> int:
        return len(self.units)

    @property
    def short_units(self) -> int:
        """Units below the near-duplicate floor -- exact-match protection only."""
        return sum(1 for u in self.units if u.n_tokens < MIN_TOKENS_FOR_NEAR_DUP)

    def match(
        self,
        record: CorpusRecord,
        jaccard_threshold: float = DEFAULT_JACCARD_THRESHOLD,
        containment_threshold: float = DEFAULT_CONTAINMENT_THRESHOLD,
    ) -> list[Finding]:
        k = self.prose_k if record.kind is TextKind.prose else self.k
        text_norm, tokens, alpha_tokens, sh = normalized_forms(record.text, record.kind, k)
        r_sha = sha256(record.text)
        r_text = sha256(text_norm)
        r_token = sha256("\x1f".join(tokens))
        r_alpha = sha256("\x1f".join(alpha_tokens))

        # unit index -> strongest match found for it
        best: dict = {}

        def offer(uidx: int, kind: MatchKind, score: float, j: float, chr_: float, crh: float, level: NormLevel):
            prev = best.get(uidx)
            if prev is not None and _MATCH_RANK.index(prev[0]) <= _MATCH_RANK.index(kind):
                return
            best[uidx] = (kind, score, j, chr_, crh, level)

        for uidx in self._by_alpha.get(r_alpha, ()):  # cheapest strong signals first
            offer(uidx, MatchKind.exact_alpha, 1.0, 1.0, 1.0, 1.0, NormLevel.alpha)
        for uidx in self._by_token.get(r_token, ()):
            offer(uidx, MatchKind.exact_token, 1.0, 1.0, 1.0, 1.0, NormLevel.token)
        for uidx in self._by_text.get(r_text, ()):
            offer(uidx, MatchKind.exact_text, 1.0, 1.0, 1.0, 1.0, NormLevel.text)
        for uidx in self._by_sha.get(r_sha, ()):
            offer(uidx, MatchKind.exact_bytes, 1.0, 1.0, 1.0, 1.0, NormLevel.exact)

        # Exact overlap counting against the inverted index. One pass over the
        # record's own shingles, so cost is O(record) regardless of holdout size.
        overlap: dict = defaultdict(int)
        for h in sh.hashes:
            for uidx in self._inverted.get(h, ()):
                overlap[uidx] += 1

        for uidx, shared in overlap.items():
            u = self.units[uidx]
            if u.kind is not record.kind:
                continue
            j = jaccard(u.shingles, sh)
            c_h_in_r = containment(u.shingles, sh)
            c_r_in_h = containment(sh, u.shingles)
            # Below the floor, set statistics are noise; exact matching already
            # had its chance above.
            both_long = (
                u.n_tokens >= MIN_TOKENS_FOR_NEAR_DUP and sh.n_tokens >= MIN_TOKENS_FOR_NEAR_DUP
            )
            if both_long and j >= jaccard_threshold:
                offer(uidx, MatchKind.near_jaccard, j, j, c_h_in_r, c_r_in_h, NormLevel.alpha)
            # Containment is asserted only when the *contained* side clears the
            # floor: a 6-token record being "inside" a holdout unit is not news.
            if u.n_tokens >= MIN_TOKENS_FOR_NEAR_DUP and c_h_in_r >= containment_threshold:
                offer(
                    uidx,
                    MatchKind.holdout_inside_record,
                    c_h_in_r,
                    j,
                    c_h_in_r,
                    c_r_in_h,
                    NormLevel.alpha,
                )
            if sh.n_tokens >= MIN_TOKENS_FOR_NEAR_DUP and c_r_in_h >= containment_threshold:
                offer(
                    uidx,
                    MatchKind.record_inside_holdout,
                    c_r_in_h,
                    j,
                    c_h_in_r,
                    c_r_in_h,
                    NormLevel.alpha,
                )

        findings = []
        for uidx, (kind, score, j, c_h_in_r, c_r_in_h, level) in best.items():
            u = self.units[uidx]
            findings.append(
                Finding(
                    holdout_ref=u.ref,
                    holdout_task_id=u.task_id,
                    holdout_unit=u.unit,
                    record_id=record.record_id,
                    record_source=record.source,
                    match_kind=kind,
                    score=score,
                    jaccard=j,
                    containment_holdout_in_record=c_h_in_r,
                    containment_record_in_holdout=c_r_in_h,
                    level=level,
                    holdout_tokens=u.n_tokens,
                    record_tokens=sh.n_tokens,
                )
            )
        findings.sort(key=lambda f: (-f.score, f.holdout_ref))
        return findings

    def is_leaked(
        self,
        record: CorpusRecord,
        jaccard_threshold: float = DEFAULT_JACCARD_THRESHOLD,
        containment_threshold: float = DEFAULT_CONTAINMENT_THRESHOLD,
    ) -> bool:
        return bool(self.match(record, jaccard_threshold, containment_threshold))

    def config(self) -> dict:
        return {
            "normalizer": normalizer_signature(),
            "k": self.k,
            "prose_k": self.prose_k,
            "min_tokens_for_near_dup": MIN_TOKENS_FOR_NEAR_DUP,
        }


def scan(
    index: HoldoutIndex,
    records: Iterable[CorpusRecord],
    jaccard_threshold: float = DEFAULT_JACCARD_THRESHOLD,
    containment_threshold: float = DEFAULT_CONTAINMENT_THRESHOLD,
) -> tuple[list[Finding], int]:
    """Scan a corpus. Returns (findings, records_scanned)."""
    findings: list[Finding] = []
    scanned = 0
    for rec in records:
        scanned += 1
        findings.extend(index.match(rec, jaccard_threshold, containment_threshold))
    return findings, scanned
