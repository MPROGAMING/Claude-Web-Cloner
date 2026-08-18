import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  inferKind,
  inferService,
  instanceNameFor,
  validateProjectPath,
} from "@/lib/roblox/project-model";

/**
 * Path validation is a security boundary — the model proposes paths and we must
 * never let one escape the project sandbox. These cases are the attack surface.
 */
describe("validateProjectPath", () => {
  it("accepts paths under the allowed roots", () => {
    for (const path of [
      "src/server/Currency.server.luau",
      "src/client/Input.client.luau",
      "src/shared/Config.luau",
      "src/ui/Shop.luau",
      "docs/design.md",
      "src/shared/data.json",
    ]) {
      expect(validateProjectPath(path)).toMatchObject({ ok: true, path });
    }
  });

  it("rejects traversal in every form", () => {
    for (const path of [
      "../secrets.luau",
      "src/../../etc/passwd",
      "src/server/../../../root.luau",
      "src/./server/A.luau",
      "src//server/A.luau",
    ]) {
      expect(validateProjectPath(path).ok).toBe(false);
    }
  });

  it("rejects absolute paths, including Windows drives", () => {
    expect(validateProjectPath("/etc/passwd").ok).toBe(false);
    expect(validateProjectPath("C:/Windows/system.luau").ok).toBe(false);
  });

  it("rejects paths outside src/ and docs/", () => {
    expect(validateProjectPath("node_modules/evil.luau").ok).toBe(false);
    expect(validateProjectPath(".env").ok).toBe(false);
    expect(validateProjectPath("package.json").ok).toBe(false);
  });

  it("rejects disallowed extensions", () => {
    expect(validateProjectPath("src/server/run.sh").ok).toBe(false);
    expect(validateProjectPath("src/server/app.js").ok).toBe(false);
    expect(validateProjectPath("src/server/noext").ok).toBe(false);
  });

  it("rejects null bytes and control characters", () => {
    expect(validateProjectPath("src/server/a\0.luau").ok).toBe(false);
    expect(validateProjectPath("src/server/a b.luau").ok).toBe(false);
  });

  it("rejects an over-long path", () => {
    expect(validateProjectPath(`src/${"a".repeat(300)}.luau`).ok).toBe(false);
  });

  it("normalises backslashes and a leading ./ before validating", () => {
    expect(validateProjectPath("src\\server\\A.luau")).toMatchObject({
      ok: true,
      path: "src/server/A.luau",
    });
    expect(validateProjectPath("./src/shared/B.luau")).toMatchObject({
      ok: true,
      path: "src/shared/B.luau",
    });
  });

  it("rejects empty input", () => {
    expect(validateProjectPath("").ok).toBe(false);
    expect(validateProjectPath("   ").ok).toBe(false);
  });
});

describe("inferService", () => {
  it.each([
    ["src/server/A.luau", "ServerScriptService"],
    ["src/client/B.luau", "StarterPlayer.StarterPlayerScripts"],
    ["src/ui/C.luau", "StarterGui"],
    ["src/shared/D.luau", "ReplicatedStorage"],
    ["docs/notes.md", "ReplicatedStorage"],
  ])("maps %s to %s", (path, service) => {
    expect(inferService(path)).toBe(service);
  });
});

describe("inferKind", () => {
  it.each([
    ["src/server/Shop.server.luau", "script"],
    ["src/client/Input.client.luau", "localscript"],
    ["src/shared/Util.luau", "module"],
    ["src/ui/Hud.luau", "ui"],
    ["docs/plan.md", "doc"],
  ])("maps %s to %s", (path, kind) => {
    expect(inferKind(path)).toBe(kind);
  });
});

describe("instanceNameFor", () => {
  it.each([
    ["src/server/CurrencyService.server.luau", "CurrencyService"],
    ["src/client/Camera.client.luau", "Camera"],
    ["src/shared/GameConfig.luau", "GameConfig"],
    ["docs/design.md", "design"],
  ])("names %s as %s", (path, name) => {
    expect(instanceNameFor(path)).toBe(name);
  });
});

describe("buildFileTree", () => {
  it("nests paths and puts directories before files", () => {
    const tree = buildFileTree([
      { path: "src/shared/Config.luau", kind: "module" },
      { path: "docs/readme.md", kind: "doc" },
      { path: "src/server/Main.server.luau", kind: "script" },
    ]);

    expect(tree.map((node) => node.name)).toEqual(["docs", "src"]);

    const src = tree.find((node) => node.name === "src")!;
    expect(src.children?.map((node) => node.name)).toEqual(["server", "shared"]);

    const server = src.children!.find((node) => node.name === "server")!;
    expect(server.children?.[0]).toMatchObject({
      name: "Main.server.luau",
      type: "file",
      path: "src/server/Main.server.luau",
    });
  });

  it("returns an empty tree for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("does not duplicate a shared parent directory", () => {
    const tree = buildFileTree([
      { path: "src/server/A.luau", kind: "script" },
      { path: "src/server/B.luau", kind: "script" },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].children).toHaveLength(2);
  });
});
