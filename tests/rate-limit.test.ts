import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits, rateLimit } from "@/lib/rate-limit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests up to the limit and blocks the next", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit("user-1", { limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
    expect(rateLimit("user-1", { limit: 5, windowMs: 60_000 }).ok).toBe(false);
  });

  it("counts each key independently", () => {
    rateLimit("a", { limit: 1, windowMs: 60_000 });
    expect(rateLimit("a", { limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit("b", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("reports the remaining allowance", () => {
    expect(rateLimit("c", { limit: 3, windowMs: 60_000 }).remaining).toBe(2);
    expect(rateLimit("c", { limit: 3, windowMs: 60_000 }).remaining).toBe(1);
    expect(rateLimit("c", { limit: 3, windowMs: 60_000 }).remaining).toBe(0);
  });

  it("resets once the window has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    expect(rateLimit("d", { limit: 1, windowMs: 1000 }).ok).toBe(true);
    expect(rateLimit("d", { limit: 1, windowMs: 1000 }).ok).toBe(false);

    vi.advanceTimersByTime(1500);
    expect(rateLimit("d", { limit: 1, windowMs: 1000 }).ok).toBe(true);
  });

  it("does not reset early", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    rateLimit("e", { limit: 1, windowMs: 10_000 });
    vi.advanceTimersByTime(9000);
    expect(rateLimit("e", { limit: 1, windowMs: 10_000 }).ok).toBe(false);
  });
});
