"""
A Luau lexer, written here rather than borrowed.

Leakage detection lives or dies on normalisation, and normalisation cannot be
better than the tokeniser under it. A regex that splits on `\\w+` cannot tell
`--[[ a comment mentioning game:GetService ]]` from a real call, so a copy that
moves code into a comment block hides from it. It also cannot tell a `[[long
string]]` from an index-of-an-index, so it invents tokens inside string data and
two unrelated files that both embed a big JSON blob start to look alike.

Luau is not Lua 5.1 lexically. The pieces that matter here and that a Lua lexer
gets wrong: interpolated strings (`` `count: {n}` ``), binary literals (`0b1010`),
digit separators (`1_000_000`), compound assignment (`+=`, `..=`), and the type
syntax (`::`, `->`, `?`, `&`, `|`) which appears in ordinary Roblox code and must
not be shredded into single characters.

Deliberately no error recovery beyond "emit what you can": this runs over
scraped material and an unterminated string must not raise, it must produce a
token stream that the caller can still score. `Lexed.ok` says whether anything
was malformed, and the quality filter in the factory is what acts on it.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Iterator

# Bump when a change to this file would alter the token stream for input that
# previously lexed cleanly. Every hash the manifest commits is a hash of this
# lexer's output, so a silent change here would silently invalidate a manifest.
LEXER_VERSION = 1


class Tok(str, Enum):
    name = "name"
    number = "number"
    string = "string"
    keyword = "keyword"
    op = "op"
    comment = "comment"
    error = "error"


# Reserved words. Luau's `continue`, `type`, `export` and `typeof` are
# *contextual* keywords -- `local type = 1` is legal -- so they lex as names and
# the binder scanner treats them as names too. Calling them keywords here would
# make `type` un-renameable in a file that genuinely uses it as a variable.
KEYWORDS = frozenset(
    """and break do else elseif end false for function if in local nil not or
    repeat return then true until while""".split()
)

# Longest-first so `..=` beats `..` beats `.`, and `::` beats `:`.
OPERATORS = tuple(
    sorted(
        [
            "...",
            "//=",
            "..=",
            "==",
            "~=",
            "<=",
            ">=",
            "..",
            "::",
            "->",
            "+=",
            "-=",
            "*=",
            "/=",
            "%=",
            "^=",
            "//",
            "+",
            "-",
            "*",
            "/",
            "%",
            "^",
            "#",
            "<",
            ">",
            "=",
            "(",
            ")",
            "{",
            "}",
            "[",
            "]",
            ";",
            ":",
            ",",
            ".",
            "?",
            "|",
            "&",
        ],
        key=len,
        reverse=True,
    )
)

_NAME_START = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_")
_NAME_BODY = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789")
_DIGITS = frozenset("0123456789")


@dataclass(frozen=True)
class Token:
    kind: Tok
    text: str
    # Byte offset into the source. Kept so a finding can point at a location
    # without the reporter having to re-lex, and so tests can assert positions.
    start: int
    end: int


@dataclass
class Lexed:
    tokens: list[Token]
    ok: bool
    error: str | None = None

    def code_tokens(self) -> list[Token]:
        """Tokens excluding comments -- what normalisation actually consumes."""
        return [t for t in self.tokens if t.kind is not Tok.comment]


def _long_bracket_len(src: str, i: int) -> int | None:
    """
    Length of a `[==[` opener at `i`, or None. Returns the count of `=` signs
    plus 2 (for the brackets), i.e. the number of characters to skip.
    """
    if i >= len(src) or src[i] != "[":
        return None
    j = i + 1
    eq = 0
    while j < len(src) and src[j] == "=":
        eq += 1
        j += 1
    if j < len(src) and src[j] == "[":
        return eq + 2
    return None


def _scan_long_bracket(src: str, i: int, opener_len: int) -> tuple[int, bool]:
    """Scan a long string/comment body. Returns (end_index, terminated)."""
    eq = opener_len - 2
    close = "]" + "=" * eq + "]"
    body = src.find(close, i + opener_len)
    if body == -1:
        return len(src), False
    return body + len(close), True


def _scan_quoted(src: str, i: int) -> tuple[int, bool]:
    """
    Scan a `'`/`"` string. Returns (end_index, terminated).

    Luau allows a backslash-newline continuation and `\\z` whitespace skipping;
    both are handled by the generic "backslash consumes the next char" rule, so
    they need no special case. An unterminated string stops at the newline
    rather than swallowing the rest of the file -- a scraped file with one stray
    quote should degrade to one bad token, not to one bad file.
    """
    quote = src[i]
    j = i + 1
    n = len(src)
    while j < n:
        c = src[j]
        if c == "\\":
            j += 2
            continue
        if c == quote:
            return j + 1, True
        if c == "\n":
            return j, False
        j += 1
    return n, False


def _scan_interp(src: str, i: int) -> tuple[int, bool]:
    """
    Scan a Luau interpolated string: `` `text {expr} more` ``.

    The `{expr}` holes are left inside the string token rather than lexed as
    code. That is a deliberate loss: it under-tokenises interpolation-heavy
    code, but the alternative -- recursive lexing -- lets a copier hide a rename
    inside a hole and still match, which is the wrong direction to be wrong in.
    Brace depth is tracked only so a `}` inside a hole does not end the string.
    """
    j = i + 1
    n = len(src)
    depth = 0
    while j < n:
        c = src[j]
        if c == "\\":
            j += 2
            continue
        if c == "{":
            depth += 1
        elif c == "}" and depth > 0:
            depth -= 1
        elif c == "`" and depth == 0:
            return j + 1, True
        elif c == "\n" and depth == 0:
            return j, False
        j += 1
    return n, False


def _scan_number(src: str, i: int) -> int:
    n = len(src)
    j = i
    if src[j] == "0" and j + 1 < n and src[j + 1] in "xX":
        j += 2
        while j < n and (src[j] in "0123456789abcdefABCDEF_"):
            j += 1
        return j
    if src[j] == "0" and j + 1 < n and src[j + 1] in "bB":
        j += 2
        while j < n and src[j] in "01_":
            j += 1
        return j
    seen_dot = False
    seen_exp = False
    while j < n:
        c = src[j]
        if c in _DIGITS or c == "_":
            j += 1
        elif c == "." and not seen_dot and not seen_exp:
            # `1..2` is concat, not a malformed number.
            if j + 1 < n and src[j + 1] == ".":
                break
            seen_dot = True
            j += 1
        elif c in "eE" and not seen_exp:
            seen_exp = True
            j += 1
            if j < n and src[j] in "+-":
                j += 1
        else:
            break
    return j


def lex(src: str) -> Lexed:
    """Tokenise Luau source. Never raises on malformed input."""
    tokens: list[Token] = []
    ok = True
    error: str | None = None
    i = 0
    n = len(src)

    # A shebang is legal at the top of a `luau` script and is not Luau.
    if src.startswith("#!"):
        nl = src.find("\n")
        i = n if nl == -1 else nl

    while i < n:
        c = src[i]

        if c in " \t\r\n\v\f":
            i += 1
            continue

        # Comments before operators, because `--` would otherwise lex as two
        # subtractions and a `-- [[` block would leak its contents into code.
        if c == "-" and i + 1 < n and src[i + 1] == "-":
            opener = _long_bracket_len(src, i + 2)
            if opener is not None:
                end, term = _scan_long_bracket(src, i + 2, opener)
                if not term:
                    ok, error = False, "unterminated long comment"
                tokens.append(Token(Tok.comment, src[i:end], i, end))
                i = end
                continue
            nl = src.find("\n", i)
            end = n if nl == -1 else nl
            tokens.append(Token(Tok.comment, src[i:end], i, end))
            i = end
            continue

        if c in "\"'":
            end, term = _scan_quoted(src, i)
            if not term:
                ok, error = False, "unterminated string"
                tokens.append(Token(Tok.error, src[i:end], i, end))
            else:
                tokens.append(Token(Tok.string, src[i:end], i, end))
            i = end
            continue

        if c == "`":
            end, term = _scan_interp(src, i)
            if not term:
                ok, error = False, "unterminated interpolated string"
                tokens.append(Token(Tok.error, src[i:end], i, end))
            else:
                tokens.append(Token(Tok.string, src[i:end], i, end))
            i = end
            continue

        if c == "[":
            opener = _long_bracket_len(src, i)
            if opener is not None:
                end, term = _scan_long_bracket(src, i, opener)
                if not term:
                    ok, error = False, "unterminated long string"
                    tokens.append(Token(Tok.error, src[i:end], i, end))
                else:
                    tokens.append(Token(Tok.string, src[i:end], i, end))
                i = end
                continue

        if c in _DIGITS or (c == "." and i + 1 < n and src[i + 1] in _DIGITS):
            end = _scan_number(src, i)
            tokens.append(Token(Tok.number, src[i:end], i, end))
            i = end
            continue

        if c in _NAME_START:
            j = i + 1
            while j < n and src[j] in _NAME_BODY:
                j += 1
            word = src[i:j]
            kind = Tok.keyword if word in KEYWORDS else Tok.name
            tokens.append(Token(kind, word, i, j))
            i = j
            continue

        for opsym in OPERATORS:
            if src.startswith(opsym, i):
                tokens.append(Token(Tok.op, opsym, i, i + len(opsym)))
                i += len(opsym)
                break
        else:
            # Unknown byte (stray `$`, a UTF-8 continuation from a mangled
            # encoding). Emit it as an error token so it still contributes to
            # the stream -- dropping it would let two files differing only in
            # junk normalise identically.
            ok = False
            error = error or "unexpected character %r" % c
            tokens.append(Token(Tok.error, c, i, i + 1))
            i += 1

    return Lexed(tokens=tokens, ok=ok, error=error)


def iter_code(lexed: Lexed) -> Iterator[Token]:
    for t in lexed.tokens:
        if t.kind is not Tok.comment:
            yield t
