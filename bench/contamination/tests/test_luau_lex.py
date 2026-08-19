"""
Lexer tests. Each one is a construct that a naive `\\w+` splitter gets wrong in
a way that would let a copy hide, or would invent similarity that is not there.
"""

from bench.contamination.luau_lex import Tok, lex


def kinds(src):
    return [(t.kind, t.text) for t in lex(src).tokens]


def test_line_comment_is_one_token_not_two_minus_signs():
    toks = kinds("local a = 1 -- a - b - c\n")
    assert (Tok.comment, "-- a - b - c") in toks
    assert sum(1 for k, _ in toks if k is Tok.op and _ == "-") == 0


def test_long_comment_contents_do_not_leak_into_code():
    src = "--[[ game:GetService('Players') ]]\nlocal a = 1\n"
    code = [t.text for t in lex(src).code_tokens()]
    assert "GetService" not in code
    assert code == ["local", "a", "=", "1"]


def test_nested_level_long_comment():
    src = "--[==[ ]] still inside ]==]\nreturn 1\n"
    code = [t.text for t in lex(src).code_tokens()]
    assert code == ["return", "1"]


def test_long_string_is_one_token():
    lexed = lex("local s = [[a]]b]]\n")
    strings = [t for t in lexed.tokens if t.kind is Tok.string]
    assert len(strings) == 1
    assert strings[0].text == "[[a]]"


def test_interpolated_string_holes_stay_inside_the_string():
    lexed = lex('local s = `hi {name} and {other}`\n')
    strings = [t for t in lexed.tokens if t.kind is Tok.string]
    assert len(strings) == 1
    assert "name" in strings[0].text
    assert "name" not in [t.text for t in lexed.code_tokens() if t.kind is Tok.name]


def test_luau_number_forms():
    for src, expected in (
        ("0x1F", "0x1F"),
        ("0b1010", "0b1010"),
        ("1_000_000", "1_000_000"),
        ("1e-3", "1e-3"),
        ("1.5", "1.5"),
    ):
        lexed = lex("local n = %s\n" % src)
        numbers = [t.text for t in lexed.tokens if t.kind is Tok.number]
        assert numbers == [expected], src


def test_concat_after_integer_is_not_a_number():
    lexed = lex("return 1 ..2\n")
    texts = [t.text for t in lexed.code_tokens()]
    assert ".." in texts


def test_type_operators_are_single_tokens():
    lexed = lex("local x = y :: number\nlocal f: (a: number) -> string? = g\n")
    texts = [t.text for t in lexed.code_tokens()]
    assert "::" in texts and "->" in texts and "?" in texts


def test_compound_assignment_operators():
    texts = [t.text for t in lex("a += 1 b ..= 'x' c //= 2\n").code_tokens()]
    assert "+=" in texts and "..=" in texts and "//=" in texts


def test_unterminated_string_does_not_raise_and_is_flagged():
    lexed = lex('local s = "oops\nlocal t = 1\n')
    assert lexed.ok is False
    assert "unterminated" in lexed.error
    # The rest of the file still lexes -- one bad token, not one bad file.
    assert "local" in [t.text for t in lexed.code_tokens()]


def test_shebang_is_skipped():
    texts = [t.text for t in lex("#!/usr/bin/env luau\nreturn 1\n").code_tokens()]
    assert texts == ["return", "1"]


def test_unknown_byte_is_kept_as_an_error_token():
    lexed = lex("local a = $\n")
    assert lexed.ok is False
    assert any(t.kind is Tok.error for t in lexed.tokens)
