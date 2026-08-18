import { describe, expect, it } from "vitest";
import { formatDiagnostics, validateLuau } from "@/lib/roblox/luau-validator";

const clean = `--!strict
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Wallet = {}

function Wallet.award(player: Player, amount: number)
	assert(amount > 0, "amount must be positive")
	task.wait(0.1)
	return amount
end

Players.PlayerAdded:Connect(function(player)
	print("joined", player.Name)
end)

return Wallet
`;

const rules = (source: string, path?: string) =>
  validateLuau(source, path).diagnostics.map((d) => d.rule);

describe("validateLuau", () => {
  it("passes idiomatic Roblox code with no diagnostics", () => {
    const result = validateLuau(clean, "src/shared/Wallet.luau");
    expect(result.ok).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("catches a missing end", () => {
    const result = validateLuau(`local function f()\n\tprint("hi")\n`);
    expect(result.ok).toBe(false);
    expect(rules(`local function f()\n\tprint("hi")\n`)).toContain("unbalanced-blocks");
  });

  it("catches a surplus end", () => {
    const result = validateLuau(`local x = 1\nend\n`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toMatch(/unexpected 'end'/);
  });

  it("balances for/while loops, which open with both the keyword and do", () => {
    expect(
      validateLuau(`for i = 1, 10 do\n\tprint(i)\nend\n`).ok,
    ).toBe(true);
    expect(
      validateLuau(`while true do\n\ttask.wait(1)\nend\n`).ok,
    ).toBe(true);
  });

  it("balances a function passed as an argument", () => {
    expect(
      validateLuau(`local c = signal:Connect(function()\n\tprint("x")\nend)\n`).ok,
    ).toBe(true);
  });

  it("flags deprecated globals but does not call them errors", () => {
    const result = validateLuau(`wait(1)\nspawn(function() end)\ndelay(1, function() end)\n`);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBeGreaterThanOrEqual(3);
    expect(rules(`wait(1)\n`)).toContain("deprecated-globals");
  });

  it("does not flag task.wait as the deprecated global", () => {
    expect(validateLuau(`task.wait(1)\n`).warnings).toBe(0);
  });

  it("flags direct service indexing", () => {
    expect(rules(`local p = game.Players\n`)).toContain("service-access");
    expect(rules(`local w = game.Workspace\n`)).toContain("service-access");
    expect(validateLuau(`local p = game:GetService("Players")\n`).warnings).toBe(0);
  });

  it("rejects C-style operators that are not valid Luau", () => {
    expect(rules(`if a != b then end\n`)).toContain("syntax");
    expect(rules(`if a && b then end\n`)).toContain("syntax");
    expect(rules(`local x = a || b\n`)).toContain("syntax");
  });

  it("rejects APIs Roblox removed", () => {
    const result = validateLuau(`part.Touched:connect(handler)\n`);
    expect(result.ok).toBe(false);
    expect(rules(`part.Touched:connect(handler)\n`)).toContain("removed-api");
  });

  it("catches client-only APIs inside a server script", () => {
    const source = `--!strict\nlocal player = game.Players.LocalPlayer\n`;
    const result = validateLuau(source, "src/server/Bad.server.luau");
    expect(result.ok).toBe(false);
    expect(rules(source, "src/server/Bad.server.luau")).toContain("context-mismatch");
  });

  it("allows client-only APIs inside a client script", () => {
    const source = `--!strict\nlocal Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\n`;
    expect(validateLuau(source, "src/client/Good.client.luau").ok).toBe(true);
  });

  it("ignores tokens that appear inside strings and comments", () => {
    const source = `--!strict\n-- this comment mentions wait( and game.Players\nlocal message = "use wait() or game.Players here"\n`;
    expect(validateLuau(source).warnings).toBe(0);
  });

  it("ignores a multi-line comment block", () => {
    const source = `--[[\nwait(1)\ngame.Players\n]]\nlocal x = 1\n`;
    expect(validateLuau(source).warnings).toBe(0);
  });

  it("handles an empty file without crashing", () => {
    expect(validateLuau("")).toMatchObject({ ok: true, errors: 0, warnings: 0 });
  });
});

describe("formatDiagnostics", () => {
  it("reports a clean file plainly", () => {
    expect(formatDiagnostics("a.luau", validateLuau(clean, "a.luau"))).toBe(
      "a.luau: no issues found.",
    );
  });

  it("includes line numbers and rule names so the model can act on it", () => {
    const result = validateLuau(`if a != b then end\n`, "b.luau");
    const report = formatDiagnostics("b.luau", result);
    expect(report).toContain("ERROR");
    expect(report).toContain("L1");
    expect(report).toContain("[syntax]");
  });
});
