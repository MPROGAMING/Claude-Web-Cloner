/**
 * A single error shape shared by routes, server actions and the client.
 *
 * `code` is stable and machine-readable; `message` is written for a human and
 * is safe to display. Internal details (stack traces, provider payloads) are
 * logged server-side and never sent to the browser.
 */
import { logger } from "@/lib/logger";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "invalid_model"
  | "provider_unconfigured"
  | "provider_error"
  | "rate_limited"
  | "insufficient_credits"
  | "conflict"
  | "validation_failed"
  | "changeset_not_approved"
  | "studio_disconnected"
  | "studio_timeout"
  | "database_error"
  | "timeout"
  | "internal";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const FALLBACK_MESSAGES: Record<ErrorCode, string> = {
  unauthorized: "You need to be signed in to do that.",
  forbidden: "You do not have access to this resource.",
  not_found: "We could not find what you were looking for.",
  invalid_request: "That request was not valid.",
  invalid_model: "That model is not available.",
  provider_unconfigured: "This model provider is not configured on this deployment.",
  provider_error: "The AI provider had a problem. Try again in a moment.",
  rate_limited: "Too many requests. Give it a few seconds and try again.",
  insufficient_credits: "You are out of credits.",
  conflict: "That conflicts with the current state.",
  validation_failed: "Those changes did not pass validation.",
  changeset_not_approved: "Those changes have not been approved.",
  studio_disconnected: "Roblox Studio is not connected to this project.",
  studio_timeout: "Roblox Studio did not respond in time.",
  database_error: "We could not reach the database. Try again shortly.",
  timeout: "That took too long and was stopped.",
  internal: "Something went wrong on our side.",
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  // Zod rejections are the caller's fault, not ours. Surface the first issue's
  // path so a plugin or client author can see which field was wrong, but never
  // echo the received value back.
  // Provider credit exhaustion is the user's problem to fix, not an internal
  // fault, so it gets a message that says what to do instead of "something went
  // wrong on our side".
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/requires more credits|insufficient_quota|quota exceeded|billing/i.test(raw)) {
    return new AppError(
      "provider_error",
      "The AI provider account is out of credit. Top it up to keep generating.",
      402,
    );
  }

  // The model answered, but not in a shape the schema accepts. Blaming "our
  // side" for this is both wrong and unhelpful: the fix is to retry or pick a
  // stronger model, and only the person at the keyboard can do either. Weaker
  // models — the free router especially — fail this way regularly.
  if (/No object generated|NoObjectGenerated|could not parse the response/i.test(raw)) {
    return new AppError(
      "provider_error",
      "The model did not return a usable plan. Try again, or switch to a stronger model.",
      502,
    );
  }

  if (isZodError(error)) {
    const issue = error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "request body";
    return new AppError("invalid_request", `Invalid ${path}.`, 400);
  }

  if (error instanceof Error) {
    if (/Missing required environment variable/.test(error.message)) {
      return new AppError(
        "provider_unconfigured",
        "This deployment is not fully configured yet.",
        503,
      );
    }
    // Normalise the provider errors we can recognise.
    const message = error.message ?? "";
    if (/rate.?limit|429/i.test(message)) {
      return new AppError("rate_limited", FALLBACK_MESSAGES.rate_limited, 429);
    }
    if (/abort/i.test(error.name)) {
      return new AppError("timeout", FALLBACK_MESSAGES.timeout, 408);
    }
    if (/INSUFFICIENT_CREDITS/.test(message)) {
      return new AppError("insufficient_credits", FALLBACK_MESSAGES.insufficient_credits, 402);
    }
  }

  return new AppError("internal", FALLBACK_MESSAGES.internal, 500);
}

interface ZodLikeError {
  issues: { path: (string | number)[]; message: string }[];
}

/**
 * Structural check rather than `instanceof ZodError` — the zod instance that
 * threw may come from a different module copy (a provider SDK bundling its own),
 * and instanceof silently fails across copies.
 */
function isZodError(error: unknown): error is ZodLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as ZodLikeError).issues)
  );
}

/** JSON body for API routes. Shape is stable for the client error components. */
/**
 * The one place every route turns a thrown error into a response.
 *
 * The header of this file promises internal detail is "logged server-side and
 * never sent to the browser". The second half was true; the first was not —
 * nothing here logged anything, so an unexpected 500 left no trace at all. A
 * blueprint run failed with `POST /api/blueprint 500 in 57s` and an otherwise
 * empty log, which is how the gap was found.
 *
 * 5xx is logged as an error with the original cause, because nobody asked for
 * it and someone has to look. 4xx is logged at debug: those are the caller
 * being told no, which is the system working, and logging them at error level
 * would bury the ones that matter.
 */
export function errorResponse(error: unknown, context?: Record<string, unknown>): Response {
  const appError = toAppError(error);

  const detail = {
    ...context,
    code: appError.code,
    status: appError.status,
    // The original throw, not the sanitised message the browser gets.
    cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? ""),
    ...(appError.details ? { details: appError.details } : {}),
  };

  if (appError.status >= 500) {
    logger.error("request.failed", {
      ...detail,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined,
    });
  } else {
    logger.debug("request.rejected", detail);
  }

  return Response.json(
    { error: { code: appError.code, message: appError.message } },
    { status: appError.status },
  );
}
