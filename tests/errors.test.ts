import { describe, expect, it } from "vitest";
import { AppError, errorResponse, toAppError } from "@/lib/errors";

describe("toAppError", () => {
  it("passes an AppError through unchanged", () => {
    const original = new AppError("not_found", "Nope.", 404);
    expect(toAppError(original)).toBe(original);
  });

  it("maps a provider rate-limit error to 429", () => {
    const mapped = toAppError(new Error("429 Too Many Requests: rate limit exceeded"));
    expect(mapped.code).toBe("rate_limited");
    expect(mapped.status).toBe(429);
  });

  it("maps the SQL insufficient-credits signal to 402", () => {
    const mapped = toAppError(new Error("INSUFFICIENT_CREDITS"));
    expect(mapped.code).toBe("insufficient_credits");
    expect(mapped.status).toBe(402);
  });

  it("maps an abort to a timeout", () => {
    const aborted = new Error("The operation was aborted");
    aborted.name = "AbortError";
    expect(toAppError(aborted).code).toBe("timeout");
  });

  it("never leaks an unrecognised error's message to the user", () => {
    const leaky = new Error("connection to postgres://user:hunter2@db failed");
    const mapped = toAppError(leaky);
    expect(mapped.code).toBe("internal");
    expect(mapped.status).toBe(500);
    expect(mapped.message).not.toContain("hunter2");
    expect(mapped.message).not.toContain("postgres");
  });

  it("handles non-Error values", () => {
    expect(toAppError("just a string").code).toBe("internal");
    expect(toAppError(null).code).toBe("internal");
    expect(toAppError(undefined).status).toBe(500);
  });
});

describe("errorResponse", () => {
  it("returns the AppError status and a stable body shape", async () => {
    const response = errorResponse(new AppError("insufficient_credits", "Out of credits.", 402));
    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: { code: "insufficient_credits", message: "Out of credits." },
    });
  });

  it("returns 500 with a generic message for an unexpected throw", async () => {
    const response = errorResponse(new Error("internal detail nobody should see"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("internal detail");
  });
});

describe("zod rejections", () => {
  it("maps a schema failure to 400 with the offending field", async () => {
    const zodLike = {
      issues: [{ path: ["code"], message: "String must contain at least 4 character(s)" }],
    };
    const mapped = toAppError(zodLike);
    expect(mapped.code).toBe("invalid_request");
    expect(mapped.status).toBe(400);
    expect(mapped.message).toContain("code");
  });

  it("handles a top-level schema failure with no path", () => {
    const mapped = toAppError({ issues: [{ path: [], message: "Expected object" }] });
    expect(mapped.status).toBe(400);
    expect(mapped.message).toContain("request body");
  });

  it("does not echo the rejected value back to the caller", () => {
    const mapped = toAppError({
      issues: [{ path: ["token"], message: 'Received "super-secret-token-value"' }],
    });
    expect(mapped.message).not.toContain("super-secret-token-value");
  });
});

describe("configuration errors", () => {
  it("maps a missing environment variable to 503, not 500", () => {
    const mapped = toAppError(
      new Error("Missing required environment variable NEXT_PUBLIC_SUPABASE_URL. See .env.example."),
    );
    expect(mapped.code).toBe("provider_unconfigured");
    expect(mapped.status).toBe(503);
    expect(mapped.message).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});
