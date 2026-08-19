import { afterEach, describe, expect, it, vi } from "vitest";
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

// ---------------------------------------------------------------------------
describe("errorResponse logging", () => {
  /**
   * This file's own header promises internal detail is "logged server-side and
   * never sent to the browser". The second half held; the first did not —
   * errorResponse logged nothing, so an unexpected 500 left no trace anywhere.
   * A blueprint run failed with `POST /api/blueprint 500 in 57s` against a
   * completely empty error log, which is how it was noticed.
   */
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the original cause for a 500, and still hides it from the caller", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(new Error("provider returned malformed JSON at offset 812"));
    const body = await response.json();

    expect(response.status).toBe(500);
    // The browser gets the sanitised message.
    expect(JSON.stringify(body)).not.toContain("offset 812");
    expect(body.error.code).toBe("internal");

    // The log gets the real one.
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0][0]);
    expect(logged).toContain("request.failed");
    expect(logged).toContain("offset 812");
  });

  it("carries caller-supplied context into the log", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    errorResponse(new Error("boom"), { route: "blueprint", blueprintId: "abc-123" });

    const logged = String(consoleError.mock.calls[0][0]);
    expect(logged).toContain("blueprint");
    expect(logged).toContain("abc-123");
  });

  it("does not log a 4xx as an error — being told no is the system working", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(new AppError("not_found", "Nope.", 404));

    expect(response.status).toBe(404);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("redacts anything key-shaped that reaches the log through context", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    errorResponse(new Error("boom"), { apiKey: "sk-live-should-never-appear" });

    const logged = String(consoleError.mock.calls[0][0]);
    expect(logged).not.toContain("sk-live-should-never-appear");
    expect(logged).toContain("[redacted]");
  });
});

// ---------------------------------------------------------------------------
describe("structured-output failures are the model's, not ours", () => {
  /**
   * The free router returned prose where the schema wanted an object, and the
   * creator was told "Something went wrong on our side." Nothing went wrong on
   * our side: the model failed to hold the shape. The distinction matters
   * because the two have completely different fixes, and only one of them is
   * available to the person reading the message.
   */
  it("maps a no-object-generated failure to an actionable provider error", () => {
    const mapped = toAppError(
      new Error("AI_NoObjectGeneratedError: No object generated: could not parse the response."),
    );

    expect(mapped.code).toBe("provider_error");
    expect(mapped.status).toBe(502);
    expect(mapped.message).toMatch(/try again|stronger model/i);
    expect(mapped.message).not.toMatch(/our side/i);
  });
});
