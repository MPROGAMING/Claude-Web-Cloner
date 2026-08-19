import { describe, expect, it } from "vitest";
import { scorePath } from "@/lib/editor/fuzzy";

const PATHS = [
  "src/server/RoundService.luau",
  "src/server/Shop.luau",
  "src/client/RoundHud.client.luau",
  "src/shared/Config.luau",
  "docs/design-notes.md",
];

const best = (query: string) =>
  [...PATHS].sort((a, b) => scorePath(b, query) - scorePath(a, query))[0];

describe("scorePath", () => {
  it("matches characters spread across a path", () => {
    expect(scorePath("src/server/RoundService.luau", "srvround")).toBeGreaterThan(0);
  });

  it("returns nothing for a character the path does not contain", () => {
    expect(scorePath("src/server/Shop.luau", "zzz")).toBe(0);
  });

  it("requires the characters in order", () => {
    expect(scorePath("src/server/Shop.luau", "pohs")).toBe(0);
  });

  it("prefers the file the query obviously means", () => {
    expect(best("shop")).toBe("src/server/Shop.luau");
    expect(best("config")).toBe("src/shared/Config.luau");
    expect(best("notes")).toBe("docs/design-notes.md");
    expect(best("roundhud")).toBe("src/client/RoundHud.client.luau");
  });

  it("rewards a contiguous run over a scattered one", () => {
    const contiguous = scorePath("src/server/Shop.luau", "shop");
    const scattered = scorePath("src/server/Shop.luau", "srvp");
    expect(contiguous).toBeGreaterThan(scattered);
  });

  it("is case-insensitive and ignores spaces", () => {
    expect(scorePath("src/server/Shop.luau", "SHOP")).toBe(scorePath("src/server/Shop.luau", "shop"));
    expect(scorePath("src/server/Shop.luau", "s hop")).toBe(scorePath("src/server/Shop.luau", "shop"));
  });

  it("keeps everything when the query is empty", () => {
    for (const path of PATHS) expect(scorePath(path, "")).toBeGreaterThan(0);
  });
});
