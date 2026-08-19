"""
Quality filters, plus the claim that motivates the whole syntax stage: the
obvious gate (`luau file.luau`) rejects ordinary Roblox code, and the one used
here does not.
"""

import pytest

from bench.factory.quality import (
    LUAU,
    SyntaxChecker,
    find_secrets,
    judge,
    measure,
    score,
)

ROBLOX = """
local Players = game:GetService("Players")

local function onAdded(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player
end

Players.PlayerAdded:Connect(onAdded)
"""


def ok(text, **kw):
    return judge(text, True, "", measure(text), **kw)


# --- the syntax gate --------------------------------------------------------


def test_the_parse_only_gate_accepts_ordinary_roblox_code():
    checker = SyntaxChecker()
    if not checker.available:
        pytest.skip("no luau binary on this machine")
    assert checker.check_many([ROBLOX])[0][0] is True


def test_running_the_file_instead_would_reject_it():
    """
    This is the reason the gate is `luau-compile --only-parse` and not `luau`.
    Plain `luau` has no `game`, so a valid Roblox script exits 1 -- a syntax
    gate built on it would drop the entire Roblox corpus and keep only the
    subset that happens to run standalone. It also executes whatever it is fed.
    """
    if not LUAU:
        pytest.skip("no luau interpreter on this machine")
    import os
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "r.luau")
        with open(path, "w") as fh:
            fh.write(ROBLOX)
        run = subprocess.run([LUAU, path], capture_output=True, text=True, timeout=30)
    assert run.returncode == 1
    assert "GetService" in (run.stdout + run.stderr)


def test_syntax_failures_are_attributed_to_the_right_file_in_a_batch():
    checker = SyntaxChecker(batch_size=8)
    if not checker.available:
        pytest.skip("no luau binary on this machine")
    texts = [ROBLOX, "local x = = 1\n", ROBLOX, "return\n", "local y = ((\n"]
    results = checker.check_many(texts)
    assert [r[0] for r in results] == [True, False, True, True, False]
    assert "Expected" in results[1][1]


def test_a_syntax_failure_is_a_named_drop():
    verdict = judge("local x = = 1", False, "SyntaxError: nope", measure("local x = = 1"))
    assert verdict.reason == "quality.syntax"


# --- beyond the floor -------------------------------------------------------


def test_a_valid_but_tiny_file_is_dropped():
    assert ok("return 1\n").reason == "quality.too_small"


def test_a_minified_file_is_dropped():
    body = ";".join("local a%d=b(c,d) local e%d=f(g,h)" % (i, i) for i in range(40))
    minified = "local a=1 local b=2 local c=3 local d=4 " + body
    verdict = ok(minified, require_roblox_signal=False)
    assert verdict.reason in ("quality.line_too_long", "quality.minified")


def test_a_generated_data_table_is_dropped_as_repetitive():
    text = 'local t = {}\n' + "\n".join('t[#t+1] = "row"' for _ in range(200))
    assert ok(text, require_roblox_signal=False).reason == "quality.repetitive"


def test_a_file_that_is_almost_all_comment_is_dropped():
    text = "\n".join("-- explanation line %d, which says a great deal" % i for i in range(60))
    text += "\n" + ROBLOX
    assert ok(text).reason == "quality.mostly_comment"


def test_a_non_printable_blob_is_dropped():
    text = ROBLOX + "".join(chr(i % 32) for i in range(4000))
    assert ok(text).reason == "quality.non_printable"


def test_off_domain_lua_is_dropped_unless_allowed():
    generic = """
local function fib(n)
	if n < 2 then
		return n
	end
	return fib(n - 1) + fib(n - 2)
end

local results = {}
for i = 1, 20 do
	results[i] = fib(i)
end
return results
"""
    assert ok(generic).reason == "quality.off_domain"
    assert ok(generic, require_roblox_signal=False).ok


# --- secrets ----------------------------------------------------------------


@pytest.mark.parametrize(
    "needle,expected",
    [
        ('local cookie = ".ROBLOSECURITY=abc"', "roblox_cookie"),
        ('local k = "-----BEGIN RSA PRIVATE KEY-----"', "private_key"),
        ('local id = "AKIAIOSFODNN7EXAMPLE"', "aws_key"),
        ('local api_key = "sk-abcdefghijklmnopqrstuvwxyz"', "assigned_secret"),
        (
            'local hook = "https://discord.com/api/webhooks/1/abcdef"',
            "webhook_url",
        ),
    ],
)
def test_secrets_are_detected(needle, expected):
    assert expected in find_secrets(ROBLOX + "\n" + needle)


def test_a_secret_drops_the_record_without_echoing_it():
    text = ROBLOX + '\nlocal api_key = "sk-abcdefghijklmnopqrstuvwxyz"\n'
    verdict = ok(text)
    assert verdict.reason == "quality.secret"
    assert "sk-abcdefghij" not in verdict.detail, "a drop reason must not become the leak"


def test_an_asset_id_is_not_mistaken_for_a_secret():
    assert find_secrets(ROBLOX + '\nlocal id = "rbxassetid://1234567890123"\n') == []


# --- deprecated APIs and metrics -------------------------------------------


def test_deprecated_calls_are_annotated_by_default_and_dropped_on_request():
    text = ROBLOX + "\nwait(1)\nspawn(function() end)\n"
    lenient = ok(text)
    assert lenient.ok
    assert any(w.startswith("quality.deprecated_api") for w in lenient.warnings)
    strict = ok(text, drop_deprecated=True)
    assert strict.reason == "quality.deprecated_api"


def test_task_wait_is_not_flagged_as_the_deprecated_wait():
    m = measure(ROBLOX + "\ntask.wait(1)\n")
    assert m["deprecated_total"] == 0


def test_metrics_are_the_numbers_the_filters_key_on():
    m = measure(ROBLOX)
    assert m["roblox_signal_count"] >= 3
    assert m["n_tokens"] > 20
    assert m["comment_ratio"] == 0.0, "the sample has no comments"
    assert m["printable_ratio"] == 1.0
    commented = measure("-- one short note about leaderstats\n" + ROBLOX)
    assert 0.0 < commented["comment_ratio"] < 0.2


def test_score_prefers_a_longer_on_domain_file_without_deprecated_calls():
    good = score(measure(ROBLOX * 4))
    worse = score(measure(ROBLOX * 4 + "\nwait(1)\nspawn(f)\ndelay(1, f)\n"))
    assert good > worse
