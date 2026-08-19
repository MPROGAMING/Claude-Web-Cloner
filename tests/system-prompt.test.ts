import { describe, expect, it } from "vitest";
import { buildSystemPrompt, deriveConversationTitle } from "@/lib/ai/system-prompt";
import { inferService } from "@/lib/roblox/project-model";

const base = {
  projectName: "Crystal Islands",
  projectDescription: "A collect-and-sell simulator",
  existingFiles: [{ path: "src/shared/Config.luau", kind: "module", bytes: 420 }],
  studioConnected: false,
};

describe("buildSystemPrompt", () => {
  it("includes the project context the agent needs", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("Crystal Islands");
    expect(prompt).toContain("A collect-and-sell simulator");
    expect(prompt).toContain("src/shared/Config.luau");
  });

  it("says the project is empty when it has no files", () => {
    const prompt = buildSystemPrompt({ ...base, existingFiles: [] });
    expect(prompt).toContain("empty project");
  });

  it("changes the Studio instruction based on the live connection", () => {
    const offline = buildSystemPrompt(base);
    expect(offline).toContain("NOT connected");

    const online = buildSystemPrompt({
      ...base,
      studioConnected: true,
      placeName: "My Place",
    });
    expect(online).toContain("IS connected");
    expect(online).toContain("My Place");
    expect(online).toContain("sync_files");
  });

  it("states the non-negotiable Luau rules", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("--!strict");
    expect(prompt).toContain("game:GetService");
    expect(prompt).toContain("task.wait");
    expect(prompt).toContain("validate_scripts");
  });

  it("tells the agent to build rather than paste code into chat", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("Do not paste whole files into the chat");
    expect(prompt).toContain("plan_build");
  });
});

describe("deriveConversationTitle", () => {
  it("uses the first sentence, capitalised", () => {
    expect(deriveConversationTitle("add a shop system. then a leaderboard")).toBe(
      "Add a shop system",
    );
  });

  it("truncates a long first sentence", () => {
    const title = deriveConversationTitle("a".repeat(200));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back for empty input", () => {
    expect(deriveConversationTitle("")).toBe("New conversation");
    expect(deriveConversationTitle("   \n  ")).toBe("New conversation");
  });

  it("collapses whitespace", () => {
    expect(deriveConversationTitle("make   a\n\n  tycoon")).toBe("Make a tycoon");
  });
});

// ---------------------------------------------------------------------------
describe("Studio placement is stated, not left to be inferred", () => {
  /**
   * A real playtest failed here. The agent wrote
   * `ReplicatedStorage:WaitForChild("Remotes")` because that is what the
   * repository layout suggests, but the bridge parents everything under a
   * "Blockwright" folder inside the service. Both that and
   * `ServerScriptService.Shared` yielded forever, and the game never started.
   *
   * The model was not wrong so much as uninformed: nothing in the prompt
   * described the mapping. These pin that it now does, and that the examples
   * stay true to `inferService` in lib/roblox/project-model.ts — if that
   * mapping changes and the prompt does not, generated require paths break
   * again in a way only a playtest would catch.
   */
  const prompt = () =>
    buildSystemPrompt({
      projectName: "Hotel",
      projectDescription: null,
      existingFiles: [],
      studioConnected: true,
      mode: "preview",
      classification: "multi_file_implementation",
      requiresPlan: true,
      maxSteps: 12,
    });

  it("names the folder the bridge actually parents files under", () => {
    expect(prompt()).toContain("Blockwright");
    expect(prompt()).toMatch(/not directly\s*\n?into the service/);
  });

  it("gives a worked require path rather than only a rule", () => {
    const p = prompt();
    expect(p).toContain('ReplicatedStorage:WaitForChild("Blockwright")');
    expect(p).toContain('require(');
  });

  it("keeps its examples consistent with inferService", () => {
    const p = prompt();
    for (const [path, service] of [
      ["src/server/Foo.server.luau", "ServerScriptService"],
      ["src/client/Bar.client.luau", "StarterPlayer.StarterPlayerScripts"],
      ["src/shared/Baz.luau", "ReplicatedStorage"],
      ["src/ui/Panel.luau", "StarterGui"],
    ] as const) {
      expect(inferService(path)).toBe(service);
      expect(p).toContain(`${service}.Blockwright.`);
    }
  });
});

// ---------------------------------------------------------------------------
describe("the .server suffix decides class, and the prompt says so", () => {
  /**
   * The same playtest that found the folder-nesting bug also produced
   * `WardenModule.server.luau` and `EntityLoop.server.luau` — both required by
   * MainServer. The suffix makes them Scripts, and a Script cannot be
   * require()d, so every server script in the build failed to load. The prompt
   * mentioned the suffix but only as a naming detail, which is not what bites.
   */
  it("spells out that a Script cannot be required", () => {
    const p = buildSystemPrompt({
      projectName: "Hotel",
      projectDescription: null,
      existingFiles: [],
      studioConnected: true,
      mode: "preview",
      classification: "multi_file_implementation",
      requiresPlan: true,
      maxSteps: 12,
    });

    expect(p).toMatch(/CANNOT be require/i);
    expect(p).toContain("ModuleScript");
    expect(p).toMatch(/must NOT carry \.server or \.client/i);
  });
});
