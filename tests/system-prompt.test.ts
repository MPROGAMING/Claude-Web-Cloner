import { describe, expect, it } from "vitest";
import { buildSystemPrompt, deriveConversationTitle } from "@/lib/ai/system-prompt";

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
