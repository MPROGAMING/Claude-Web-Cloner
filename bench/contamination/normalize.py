"""
Normalisation: what a leaked copy is allowed to change and still be a copy.

Every normalisation is a bet in two directions at once. Erase too little and a
copy hides behind reformatting; erase too much and two people who independently
wrote "connect Touched, check for a Humanoid, damage it" become indistinguishable
and the detector cries leak on honest work. `calibrate.py` measures where this
module's bet actually lands; the reasoning for the bet is here.

What is erased
--------------
* Whitespace and indentation. Free to change, carries no meaning.
* Comments. The cheapest possible edit, and the first thing a launderer touches.
* Quote style, number spelling (`0x1F` -> `31`, `1_000` -> `1000`, `1.0` -> `1`).
* **Local identifier names only**, all mapped to one placeholder `ID`.

What is kept, on purpose
------------------------
* Globals, field names, and method names. In Roblox Luau these *are* the
  content: `game:GetService("Players")`, `Instance.new("Part")`, `:Connect`,
  `.Touched`, `RemoteEvent`, `task.wait`. Normalise them away and every script
  that touches a Humanoid collapses onto every other one. This is the single
  decision that keeps the false-positive rate liveable on a Roblox corpus, and
  it is also the reason a launderer who renames `Players` to a local alias can
  partially evade -- a trade taken knowingly.
* Short string literals verbatim (<= 24 chars of decoded content). Those are
  service names, attribute names, remote names. Long strings collapse to an
  opaque `S#` because prose and embedded data are noise, not signal.
* Keywords, operators, and structure. Control flow shape is most of what
  survives a rename, and it is what the shingles ride on.

Why locals become one placeholder rather than numbered slots
------------------------------------------------------------
Numbering by first-binding order (`L1`, `L2`, ...) preserves repetition structure
and is strictly more discriminating -- but inserting a single new local at the
top of a file renumbers everything below it and every shingle changes. That
turns a one-line edit into a total miss. A single `ID` is stable under
insertion, and the discriminating power it gives up is bought back by keeping
the whole API surface.

Binder detection is lexical, not scoped
---------------------------------------
A real scope analysis would distinguish a shadowed `part` in an inner block from
the outer one. This does not: a name bound by `local`, by a parameter list, or
by a `for` clause *anywhere* in the file is treated as local *everywhere* it
appears unqualified. The failure this creates is a name that is both a local
somewhere and a global elsewhere in the same file, which over-normalises and
biases towards false positives -- the direction a leak detector should err in.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Sequence

from .luau_lex import LEXER_VERSION, Lexed, Tok, Token, lex

# Bump alongside LEXER_VERSION when normalised output changes for input that
# previously normalised cleanly. Manifests record it; a mismatch is a hard error
# rather than a quietly wrong comparison.
NORMALIZER_VERSION = 1

# Decoded string content at or below this length is kept verbatim. Chosen to
# cover Roblox's vocabulary -- "Players", "ReplicatedStorage", "Humanoid",
# "PlayerAdded", "TextLabel" -- while collapsing prose, JSON and base64 blobs.
MAX_LITERAL_CHARS = 24

LOCAL_PLACEHOLDER = "ID"
OPAQUE_STRING = "S#"

# Statement keywords that can never appear inside a type expression. Used to
# stop a runaway type skip when a file is malformed.
_TYPE_STOP_KEYWORDS = frozenset(
    "local return end if elseif else while repeat until do break in then".split()
)
_OPEN = {"(": ")", "{": "}", "[": "]", "<": ">"}
_CLOSE = {")", "}", "]", ">"}


class NormLevel(str, Enum):
    """
    Ordered from least to most forgiving. A finding always reports which level
    produced it, because "identical bytes" and "identical after renaming" are
    very different claims to make about someone's corpus.
    """

    exact = "exact"
    text = "text"
    token = "token"
    alpha = "alpha"


@dataclass
class Normalized:
    level: NormLevel
    # Canonical string form, suitable for hashing.
    text: str
    # Token list for the token/alpha levels; empty for exact/text.
    tokens: list[str]
    lex_ok: bool
    lex_error: str | None


def normalize_text(src: str) -> str:
    """
    Reformat-insensitive raw text. Comments survive -- this level exists to
    catch the copy that was only ever run through a formatter, and to give the
    report a rung between "identical bytes" and "identical tokens".
    """
    out = []
    for raw in src.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.replace("\t", " ").strip()
        if line:
            out.append(line)
    return "\n".join(out)


def _decode_string_literal(text: str) -> str:
    """
    Best-effort decode of a Luau string literal to its content.

    Best-effort is enough: the decoded value is only used to decide "short
    enough to keep" and to canonicalise quote style. A mis-decoded exotic escape
    changes one token, not a verdict.
    """
    if not text:
        return ""
    if text[0] == "[":
        j = 1
        while j < len(text) and text[j] == "=":
            j += 1
        # `[[` opener plus matching `]]` closer.
        return text[j + 1 : -(j + 1)] if len(text) > 2 * (j + 1) else ""
    if text[0] == "`":
        return text[1:-1]
    body = text[1:-1]
    if "\\" not in body:
        return body
    out = []
    i = 0
    simple = {
        "n": "\n",
        "t": "\t",
        "r": "\r",
        "a": "\a",
        "b": "\b",
        "f": "\f",
        "v": "\v",
        "\\": "\\",
        '"': '"',
        "'": "'",
        "\n": "\n",
    }
    while i < len(body):
        c = body[i]
        if c != "\\":
            out.append(c)
            i += 1
            continue
        i += 1
        if i >= len(body):
            break
        e = body[i]
        if e in simple:
            out.append(simple[e])
            i += 1
        elif e == "z":
            i += 1
            while i < len(body) and body[i] in " \t\n\r":
                i += 1
        elif e == "x":
            out.append(chr(int(body[i + 1 : i + 3] or "0", 16)) if i + 3 <= len(body) else "")
            i += 3
        elif e.isdigit():
            j = i
            while j < len(body) and j < i + 3 and body[j].isdigit():
                j += 1
            out.append(chr(int(body[i:j])))
            i = j
        else:
            out.append(e)
            i += 1
    return "".join(out)


def _canon_number(text: str) -> str:
    """`0x1F`, `1_000`, `1.0`, `1e3` -> a single canonical spelling."""
    cleaned = text.replace("_", "")
    try:
        if cleaned[:2].lower() == "0x":
            value = float(int(cleaned, 16))
        elif cleaned[:2].lower() == "0b":
            value = float(int(cleaned[2:], 2))
        else:
            value = float(cleaned)
    except (ValueError, IndexError):
        return "N?" + cleaned
    if value.is_integer() and abs(value) < 1e15:
        return str(int(value))
    return repr(value)


def _canon_string(text: str) -> str:
    content = _decode_string_literal(text)
    if len(content) <= MAX_LITERAL_CHARS:
        return "S" + repr(content)
    return OPAQUE_STRING


def _skip_type(toks: Sequence[Token], i: int, stop: frozenset) -> int:
    """
    Advance past a type annotation starting at `i` (which points just after the
    `:`). Stops at a depth-0 token in `stop`, at a statement keyword, or at the
    end. `<`/`>` count as brackets because in type position they are generics,
    never comparisons.
    """
    depth = 0
    n = len(toks)
    while i < n:
        t = toks[i]
        if t.kind is Tok.op:
            if t.text in _OPEN:
                depth += 1
            elif t.text in _CLOSE:
                if depth == 0:
                    if t.text in stop:
                        return i
                    # A closing bracket we never opened ends the enclosing
                    # construct (e.g. `)` closing the param list).
                    return i
                depth -= 1
            elif depth == 0 and t.text in stop:
                return i
        elif t.kind is Tok.keyword and depth == 0 and t.text in _TYPE_STOP_KEYWORDS:
            return i
        i += 1
    return n


def _skip_generics(toks: Sequence[Token], i: int) -> int:
    """Skip a balanced `<...>` generic parameter list starting at `i`."""
    if i >= len(toks) or toks[i].kind is not Tok.op or toks[i].text != "<":
        return i
    depth = 0
    n = len(toks)
    while i < n:
        t = toks[i]
        if t.kind is Tok.op:
            if t.text == "<":
                depth += 1
            elif t.text == ">":
                depth -= 1
                if depth == 0:
                    return i + 1
            elif t.text == "->":
                pass
        i += 1
    return n


def find_local_binders(toks: Sequence[Token]) -> set[str]:
    """
    Names introduced by `local`, by a parameter list, or by a `for` clause.

    Scope-free by design (see module docstring). Type annotations are skipped so
    `local part: BasePart` binds `part` and not `BasePart` -- getting that wrong
    would erase Roblox class names, which are exactly the signal worth keeping.
    """
    binders: set[str] = set()
    i = 0
    n = len(toks)
    stop_decl = frozenset({",", "="})
    stop_param = frozenset({",", ")"})

    while i < n:
        t = toks[i]

        if t.kind is Tok.keyword and t.text == "local":
            i += 1
            if i < n and toks[i].kind is Tok.keyword and toks[i].text == "function":
                # `local function f(...)` -- f is a binder. `i` is left pointing
                # at `function` so the next loop iteration runs the `function`
                # rule and picks up the parameters; advancing past it here would
                # silently leave every parameter in the file un-renamed.
                if i + 1 < n and toks[i + 1].kind is Tok.name:
                    binders.add(toks[i + 1].text)
                continue
            while i < n and toks[i].kind is Tok.name:
                binders.add(toks[i].text)
                i += 1
                if i < n and toks[i].kind is Tok.op and toks[i].text == ":":
                    i = _skip_type(toks, i + 1, stop_decl)
                if i < n and toks[i].kind is Tok.op and toks[i].text == ",":
                    i += 1
                    continue
                break
            continue

        if t.kind is Tok.keyword and t.text == "function":
            i += 1
            # Optional name path: NAME ('.' NAME)* (':' NAME)?  -- never binders.
            if i < n and toks[i].kind is Tok.name:
                i += 1
                while i + 1 < n and toks[i].kind is Tok.op and toks[i].text in (".", ":"):
                    i += 2
            i = _skip_generics(toks, i)
            if i < n and toks[i].kind is Tok.op and toks[i].text == "(":
                i += 1
                while i < n:
                    p = toks[i]
                    if p.kind is Tok.op and p.text == ")":
                        i += 1
                        break
                    if p.kind is Tok.name:
                        binders.add(p.text)
                        i += 1
                        if i < n and toks[i].kind is Tok.op and toks[i].text == ":":
                            i = _skip_type(toks, i + 1, stop_param)
                    elif p.kind is Tok.op and p.text in (",", "..."):
                        i += 1
                    elif p.kind is Tok.op and p.text == ":":
                        i = _skip_type(toks, i + 1, stop_param)
                    else:
                        # Default values are not Luau, so anything else here
                        # means malformed input; bail rather than spin.
                        i += 1
            continue

        if t.kind is Tok.keyword and t.text == "for":
            i += 1
            while i < n:
                p = toks[i]
                if p.kind is Tok.name:
                    binders.add(p.text)
                    i += 1
                    if i < n and toks[i].kind is Tok.op and toks[i].text == ":":
                        i = _skip_type(toks, i + 1, frozenset({",", "="}))
                elif p.kind is Tok.op and p.text == ",":
                    i += 1
                else:
                    break
            continue

        i += 1

    return binders


def _is_qualified(toks: Sequence[Token], idx: int) -> bool:
    """True if this name is a field/method access (`a.name`, `a:name`)."""
    if idx == 0:
        return False
    prev = toks[idx - 1]
    return prev.kind is Tok.op and prev.text in (".", ":")


def _is_table_key(toks: Sequence[Token], idx: int) -> bool:
    """
    True if this name is a table-constructor key: `{ name = v }`.

    Table keys name a field of the resulting value, so they belong with field
    names, not with locals -- `{ Damage = 10 }` and `{ Cooldown = 10 }` must not
    normalise to the same thing.
    """
    if idx + 1 >= len(toks):
        return False
    nxt = toks[idx + 1]
    if not (nxt.kind is Tok.op and nxt.text == "="):
        return False
    if idx == 0:
        return False
    prev = toks[idx - 1]
    return prev.kind is Tok.op and prev.text in ("{", ",", ";")


def token_stream(lexed: Lexed, alpha: bool) -> list[str]:
    """Canonical token strings. `alpha=True` replaces local names with `ID`."""
    toks = lexed.code_tokens()
    binders = find_local_binders(toks) if alpha else set()
    out: list[str] = []
    for idx, t in enumerate(toks):
        if t.kind is Tok.number:
            out.append(_canon_number(t.text))
        elif t.kind is Tok.string:
            out.append(_canon_string(t.text))
        elif t.kind is Tok.name:
            if (
                alpha
                and t.text in binders
                and not _is_qualified(toks, idx)
                and not _is_table_key(toks, idx)
            ):
                out.append(LOCAL_PLACEHOLDER)
            else:
                out.append(t.text)
        elif t.kind is Tok.error:
            # Keep malformed bytes in the stream so two files that differ only
            # in junk do not normalise identically.
            out.append("E" + repr(t.text))
        else:
            out.append(t.text)
    return out


def normalize(src: str, level: NormLevel = NormLevel.alpha) -> Normalized:
    if level is NormLevel.exact:
        return Normalized(level, src, [], True, None)
    if level is NormLevel.text:
        return Normalized(level, normalize_text(src), [], True, None)
    lexed = lex(src)
    toks = token_stream(lexed, alpha=(level is NormLevel.alpha))
    # \x1f (unit separator) cannot appear in a canonical token, so the joined
    # form is unambiguous and two different token lists cannot collide.
    return Normalized(level, "\x1f".join(toks), toks, lexed.ok, lexed.error)


def normalizer_signature() -> str:
    """Identifies the exact normalisation a set of hashes was produced under."""
    return "luau-lex/%d+norm/%d+lit%d" % (
        LEXER_VERSION,
        NORMALIZER_VERSION,
        MAX_LITERAL_CHARS,
    )


# --- prose ------------------------------------------------------------------
# Task prompts are English, not Luau, and a leaked *prompt* is a leak: a model
# that memorised the statement has seen the task even if it never saw the
# answer. Running prose through the Luau lexer would work by accident (words
# lex as names) but would also silently apply number and string canonicalisation
# to things that are neither, so prose gets its own three-line normaliser.

_PROSE_KEEP = frozenset("abcdefghijklmnopqrstuvwxyz0123456789_")


def normalize_prose(src: str) -> list[str]:
    """Lowercase word tokens, punctuation dropped. Word order is the signal."""
    out: list[str] = []
    cur: list[str] = []
    for ch in src.lower():
        if ch in _PROSE_KEEP:
            cur.append(ch)
        elif cur:
            out.append("".join(cur))
            cur = []
    if cur:
        out.append("".join(cur))
    return out
