import { describe, expect, it } from "vitest";
import {
  STUDIO_ACTIONS,
  studioActionSchema,
  studioPairSchema,
  studioPollSchema,
  studioResultSchema,
} from "@/lib/studio/protocol";
import { isStudioLive, liveProjectIds } from "@/lib/studio/liveness";

/**
 * The Studio protocol is the boundary between our server and code running on
 * someone else's machine. Everything crossing it is schema-validated, and these
 * tests pin the shape of that allowlist.
 */
describe("studioActionSchema", () => {
  it("accepts each supported action", () => {
    expect(studioActionSchema.safeParse({ action: "sync_files" }).success).toBe(true);
    expect(
      studioActionSchema.safeParse({ action: "sync_files", paths: ["src/server/A.luau"] }).success,
    ).toBe(true);
    expect(studioActionSchema.safeParse({ action: "inspect_place" }).success).toBe(true);
    expect(
      studioActionSchema.safeParse({
        action: "create_folder",
        service: "ReplicatedStorage",
        name: "Modules",
      }).success,
    ).toBe(true);
    expect(
      studioActionSchema.safeParse({
        action: "remove_instance",
        service: "ServerScriptService",
        path: "Modules.OldShop",
      }).success,
    ).toBe(true);
  });

  it("rejects an action outside the allowlist", () => {
    expect(studioActionSchema.safeParse({ action: "run_script" }).success).toBe(false);
    expect(studioActionSchema.safeParse({ action: "eval", code: "os.exit()" }).success).toBe(false);
    expect(studioActionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects create_folder without its required fields", () => {
    expect(studioActionSchema.safeParse({ action: "create_folder" }).success).toBe(false);
    expect(
      studioActionSchema.safeParse({ action: "create_folder", service: "ReplicatedStorage" })
        .success,
    ).toBe(false);
  });

  it("caps the number of paths a single sync may carry", () => {
    const tooMany = Array.from({ length: 81 }, (_, i) => `src/shared/F${i}.luau`);
    expect(studioActionSchema.safeParse({ action: "sync_files", paths: tooMany }).success).toBe(
      false,
    );
  });

  it("keeps STUDIO_ACTIONS in step with the schema", () => {
    for (const action of STUDIO_ACTIONS) {
      const candidate: Record<string, unknown> = { action };
      if (action === "create_folder") {
        candidate.service = "ReplicatedStorage";
        candidate.name = "X";
      }
      if (action === "remove_instance") {
        candidate.service = "ReplicatedStorage";
        candidate.path = "X";
      }
      expect(studioActionSchema.safeParse(candidate).success).toBe(true);
    }
  });
});

describe("studioResultSchema", () => {
  it("requires a uuid command id", () => {
    expect(
      studioResultSchema.safeParse({
        commandId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        ok: true,
      }).success,
    ).toBe(true);
    expect(studioResultSchema.safeParse({ commandId: "nope", ok: true }).success).toBe(false);
  });

  it("caps the error string so a plugin cannot flood the log", () => {
    expect(
      studioResultSchema.safeParse({
        commandId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        ok: false,
        error: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("studioPollSchema / studioPairSchema", () => {
  it("requires a plausibly-long token", () => {
    expect(studioPollSchema.safeParse({ token: "short" }).success).toBe(false);
    expect(studioPollSchema.safeParse({ token: "a".repeat(43) }).success).toBe(true);
  });

  it("accepts a numeric or string place id", () => {
    expect(studioPairSchema.safeParse({ code: "K7M2QX", placeId: 12345 }).success).toBe(true);
    expect(studioPairSchema.safeParse({ code: "K7M2QX", placeId: "12345" }).success).toBe(true);
  });

  it("rejects a pairing code that is too short to be real", () => {
    expect(studioPairSchema.safeParse({ code: "AB" }).success).toBe(false);
  });
});

describe("isStudioLive", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

  it("treats a recent heartbeat as live", () => {
    expect(isStudioLive({ status: "connected", last_seen_at: at(5) }, now)).toBe(true);
  });

  it("treats a stale heartbeat as not live", () => {
    expect(isStudioLive({ status: "connected", last_seen_at: at(120) }, now)).toBe(false);
  });

  it("is false for any non-connected status", () => {
    expect(isStudioLive({ status: "pending", last_seen_at: at(1) }, now)).toBe(false);
    expect(isStudioLive({ status: "disconnected", last_seen_at: at(1) }, now)).toBe(false);
  });

  it("is false when nothing has ever polled", () => {
    expect(isStudioLive({ status: "connected", last_seen_at: null }, now)).toBe(false);
    expect(isStudioLive(null, now)).toBe(false);
    expect(isStudioLive(undefined, now)).toBe(false);
  });

  it("returns only the live project ids", () => {
    const live = liveProjectIds(
      [
        { project_id: "a", status: "connected", last_seen_at: at(2) },
        { project_id: "b", status: "connected", last_seen_at: at(600) },
        { project_id: "c", status: "disconnected", last_seen_at: at(1) },
      ],
      now,
    );
    expect(live).toEqual(new Set(["a"]));
  });
});
