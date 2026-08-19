"""
Normalisation tests, split along the axis that matters: what a copy is allowed
to change (must still match) and what it is not (must not collapse).
"""

import re

from bench.contamination.luau_lex import lex
from bench.contamination.normalize import (
    NormLevel,
    find_local_binders,
    normalize,
    normalize_prose,
)


def alpha(src):
    return normalize(src, NormLevel.alpha).text


ORIGINAL = """
local Players = game:GetService("Players")

-- give every joining player a leaderstats folder
local function onAdded(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player
end

Players.PlayerAdded:Connect(onAdded)
"""


def test_reformatting_does_not_change_the_alpha_form():
    reformatted = ORIGINAL.replace("\t", "    ").replace("\n\n", "\n\n\n") + "\n\n"
    assert alpha(ORIGINAL) == alpha(reformatted)


def test_comments_do_not_change_the_alpha_form():
    stripped = "\n".join(l for l in ORIGINAL.split("\n") if not l.strip().startswith("--"))
    assert alpha(ORIGINAL) == alpha(stripped)


def test_renaming_locals_does_not_change_the_alpha_form():
    # Word-boundary renaming so the substitution touches identifiers only. A
    # plain str.replace would also rewrite the "leaderstats" literal, and that
    # literal is content the normaliser is meant to keep -- see the next test.
    renamed = ORIGINAL
    for old, new in (("onAdded", "handleJoin"), ("player", "p"), ("stats", "folder")):
        renamed = re.sub(r"\b%s\b" % old, new, renamed)
    renamed = renamed.replace('"leaderfolder"', '"leaderstats"')
    assert alpha(ORIGINAL) == alpha(renamed)


def test_renaming_a_string_literal_does_change_the_alpha_form():
    moved = ORIGINAL.replace('"leaderstats"', '"playerstats"')
    assert alpha(ORIGINAL) != alpha(moved)


def test_quote_style_and_number_spelling_do_not_change_the_alpha_form():
    a = alpha('local a = "x" local b = 0x1F local c = 1_000 local d = 10.0')
    b = alpha("local a = 'x' local b = 31 local c = 1000 local d = 10")
    assert a == b


# --- and now the things that must NOT collapse -----------------------------


def test_service_names_are_not_erased():
    a = alpha('local s = game:GetService("Players")')
    b = alpha('local s = game:GetService("Lighting")')
    assert a != b


def test_method_names_are_not_erased():
    assert alpha("part.Touched:Connect(f)") != alpha("part.Touched:Once(f)")


def test_field_names_are_not_erased():
    assert alpha("local h = c.Humanoid") != alpha("local h = c.Torso")


def test_table_constructor_keys_are_not_erased():
    assert alpha("local t = { Damage = 10 }") != alpha("local t = { Cooldown = 10 }")


def test_long_strings_collapse_but_short_ones_do_not():
    long_a = alpha('local s = "%s"' % ("a" * 80))
    long_b = alpha('local s = "%s"' % ("b" * 80))
    assert long_a == long_b, "long literals are noise and collapse together"
    assert alpha('local s = "Players"') != alpha('local s = "Lighting"')


# --- binder detection -------------------------------------------------------


def binders(src):
    return find_local_binders(lex(src).code_tokens())


def test_local_function_parameters_are_binders():
    assert binders("local function f(a, b) return a + b end") == {"f", "a", "b"}


def test_type_annotations_are_not_binders():
    found = binders("local part: BasePart = nil")
    assert "part" in found
    assert "BasePart" not in found, "class names carry the signal and must survive"


def test_generic_parameters_are_not_treated_as_value_binders():
    found = binders("local function map<T, U>(list: {T}, fn: (T) -> U): {U} return {} end")
    assert {"map", "list", "fn"} <= found
    assert "T" not in found and "U" not in found


def test_for_loop_bindings():
    assert binders("for i = 1, 10 do end") == {"i"}
    assert binders("for k, v in pairs(t) do end") == {"k", "v"}


def test_method_name_path_is_not_a_binder():
    found = binders("function M.thing:run(x) return x end")
    assert "x" in found
    assert "M" not in found and "thing" not in found and "run" not in found


def test_token_level_keeps_identifiers_that_alpha_removes():
    src = "local counter = 1 return counter"
    assert "counter" in normalize(src, NormLevel.token).tokens
    assert "counter" not in normalize(src, NormLevel.alpha).tokens


def test_prose_normalisation_is_word_order():
    assert normalize_prose("Damage the Humanoid, then wait!") == [
        "damage",
        "the",
        "humanoid",
        "then",
        "wait",
    ]


def test_malformed_input_still_normalises():
    result = normalize('local s = "unterminated\nlocal x = 1', NormLevel.alpha)
    assert result.lex_ok is False
    assert result.tokens, "a malformed file must still produce a comparable stream"
