/**
 * A single error shape shared by routes, server actions and the client.
 *
 * `code` is stable and machine-readable; `message` is written for a human and
 * is safe to display. Internal details (stack traces, provider payloads) are
 * logged server-side and never sent to the browser.
 */
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
export function errorResponse(error: unknown): Response {
  const appError = toAppError(error);
  return Response.json(
    { error: { code: appError.code, message: appError.message } },
    { status: appError.status },
  );
}
