import type { AgentMode, Changeset, ChangesetStatus } from "@/lib/agent/types";

/**
 * Who may mutate what, and on what evidence.
 *
 * The rule that matters: authorization is a property of an explicit UI action
 * recorded against a specific changeset, never of anything the user typed or
 * the model inferred. "Do it", "looks good" and "yes please" are conversation,
 * not consent — a model that could talk itself into APPLY would make the
 * preview step decorative.
 */

/** Phrases that read like approval and must never be treated as such. */
const CONVERSATIONAL_ASSENT =
  /^\s*(yes|yep|yeah|sure|ok(ay)?|do it|go ahead|sounds good|looks good|nice|great|perfect|please do|make it so|ship it|approved?|lgtm)[\s!.?]*$/i;

export function looksLikeAssent(text: string): boolean {
  return CONVERSATIONAL_ASSENT.test(text ?? "");
}

export type AuthorizationDenial =
  | "not_authenticated"
  | "not_owner"
  | "no_changeset"
  | "changeset_not_approved"
  | "changeset_already_applied"
  | "changeset_run_mismatch"
  | "changeset_has_errors"
  | "conversational_assent_is_not_approval";

export interface AuthorizationResult {
  ok: boolean;
  mode: AgentMode;
  denial?: AuthorizationDenial;
  message?: string;
}

const APPLYABLE: readonly ChangesetStatus[] = ["approved"];

export interface ApplyRequest {
  userId: string | null;
  projectOwnerId: string | null;
  changeset: Changeset | null;
  /** Free text from the turn, used only to produce a better refusal message. */
  userText?: string;
}

/**
 * Decide whether an APPLY may proceed.
 *
 * Every gate is checked independently rather than short-circuiting into one
 * generic "denied", because the caller needs to tell the user which thing to
 * fix — an unapproved changeset and someone else's project are very different
 * problems.
 */
export function authorizeApply(request: ApplyRequest): AuthorizationResult {
  if (!request.userId) {
    return {
      ok: false,
      mode: "preview",
      denial: "not_authenticated",
      message: "Sign in to apply changes.",
    };
  }

  if (!request.changeset) {
    const denial: AuthorizationDenial = request.userText && looksLikeAssent(request.userText)
      ? "conversational_assent_is_not_approval"
      : "no_changeset";

    return {
      ok: false,
      mode: "preview",
      denial,
      message:
        denial === "conversational_assent_is_not_approval"
          ? "Saying yes in chat does not approve a change. Use the Approve button on the proposed changes."
          : "There is no proposed change set to apply.",
    };
  }

  if (request.projectOwnerId && request.projectOwnerId !== request.userId) {
    return {
      ok: false,
      mode: "preview",
      denial: "not_owner",
      message: "You do not have access to that project.",
    };
  }

  if (request.changeset.ownerId !== request.userId) {
    return {
      ok: false,
      mode: "preview",
      denial: "not_owner",
      message: "That change set belongs to a different account.",
    };
  }

  if (request.changeset.status === "applied") {
    return {
      ok: false,
      mode: "preview",
      denial: "changeset_already_applied",
      message: "Those changes have already been applied.",
    };
  }

  if (!APPLYABLE.includes(request.changeset.status)) {
    return {
      ok: false,
      mode: "preview",
      denial: "changeset_not_approved",
      message: "Those changes have not been approved yet.",
    };
  }

  if (request.changeset.issues.some((issue) => issue.severity === "error")) {
    return {
      ok: false,
      mode: "preview",
      denial: "changeset_has_errors",
      message: "Those changes did not pass validation and cannot be applied.",
    };
  }

  return { ok: true, mode: "apply" };
}

/**
 * Resolve the mode a run should execute in.
 *
 * Defaults to preview. A request may only reach apply by naming an approved
 * changeset, so an omitted or unrecognised mode degrades safely.
 */
export function resolveMode(requested: string | null | undefined): AgentMode {
  return requested === "apply" ? "apply" : "preview";
}
