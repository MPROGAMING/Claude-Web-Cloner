import { describe, expect, it } from "vitest";
import { generateId } from "ai";

/**
 * Regression guard.
 *
 * `messages.id` is a Postgres `uuid` column and the server persists the id the
 * client sent. The AI SDK's default id generator emits a 16-character nanoid,
 * which Postgres rejects — so both ends must generate real UUIDs.
 *
 * If this test ever starts failing because the SDK changed its default, the fix
 * is still to keep our explicit `generateId`, not to remove it.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("message ids", () => {
  it("documents that the SDK default is NOT a uuid", () => {
    expect(UUID_PATTERN.test(generateId())).toBe(false);
  });

  it("crypto.randomUUID satisfies the column, which is why we override", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(UUID_PATTERN.test(crypto.randomUUID())).toBe(true);
    }
  });

  it("the route's guard pattern accepts uuids and rejects SDK ids", () => {
    expect(UUID_PATTERN.test(crypto.randomUUID())).toBe(true);
    expect(UUID_PATTERN.test("EIMd7Cms7k19tMMt")).toBe(false);
    expect(UUID_PATTERN.test("")).toBe(false);
    expect(UUID_PATTERN.test("not-a-uuid-at-all")).toBe(false);
  });
});
