import { formatDiagnostics, validateLuau, type LuauValidationResult } from "@/lib/roblox/luau-validator";
import { formatSecurityReport, reviewFiles, type SecurityReport } from "@/lib/agent/security";
import { finalState } from "@/lib/agent/changesets";
import type { AgentBudget, BudgetUsage, ChangeOperation } from "@/lib/agent/types";

/**
 * The validate → repair loop.
 *
 * Two properties matter more than cleverness here. It must terminate: three
 * attempts, then stop and show the user the exact errors. And the repair prompt
 * must carry *only* the failure — re-sending the whole project on every attempt
 * is how an agentic loop turns a small mistake into a large bill.
 */

export const MAX_REPAIR_ATTEMPTS = 3;

export interface FileUnderReview {
  path: string;
  content: string;
}

export interface ValidationOutcome {
  ok: boolean;
  luauErrors: number;
  luauWarnings: number;
  securityErrors: number;
  securityWarnings: number;
  security: SecurityReport;
  perFile: { path: string; result: LuauValidationResult }[];
  /** Compact, model-readable failure text. Empty when everything passed. */
  report: string;
}

/**
 * Validate a set of files.
 *
 * Security errors count as failures alongside syntax errors: a script that
 * compiles but lets a client set its own currency is not a working script, and
 * discovering that after the user has approved and applied it is too late.
 */
export function validateFiles(files: FileUnderReview[]): ValidationOutcome {
  const luauFiles = files.filter((f) => /\.luau?$/i.test(f.path));
  const perFile = luauFiles.map((file) => ({
    path: file.path,
    result: validateLuau(file.content, file.path),
  }));

  const security = reviewFiles(files);

  const luauErrors = perFile.reduce((sum, r) => sum + r.result.errors, 0);
  const luauWarnings = perFile.reduce((sum, r) => sum + r.result.warnings, 0);

  const failing = perFile.filter((r) => r.result.errors > 0);
  const reportParts: string[] = [];

  if (failing.length) {
    reportParts.push(
      failing.map((r) => formatDiagnostics(r.path, r.result)).join("\n\n"),
    );
  }
  if (security.errors > 0) {
    reportParts.push(formatSecurityReport({ ...security, findings: security.findings.filter((f) => f.severity === "error") }));
  }

  return {
    ok: luauErrors === 0 && security.errors === 0,
    luauErrors,
    luauWarnings,
    securityErrors: security.errors,
    securityWarnings: security.warnings,
    security,
    perFile,
    report: reportParts.join("\n\n"),
  };
}

/**
 * Validate the files a changeset would produce, without touching the project.
 *
 * Uses the resulting state rather than every operation, so a run that corrected
 * itself is judged on what it ends up writing, not on its earlier drafts.
 */
export function validateChangesetFiles(operations: ChangeOperation[]): ValidationOutcome {
  return validateFiles(finalState(operations));
}

export interface RepairDecision {
  shouldRepair: boolean;
  attempt: number;
  exhausted: boolean;
  /** Only the failing files and their errors — never the whole project. */
  prompt?: string;
  reason: string;
}

/**
 * Decide whether to attempt another repair, and build the instruction if so.
 *
 * The prompt names the failing files and quotes their diagnostics verbatim. It
 * does not restate the original request: the conversation already holds it, and
 * repeating it invites the model to redesign rather than fix.
 */
export function decideRepair(
  outcome: ValidationOutcome,
  usage: BudgetUsage,
  budget: Pick<AgentBudget, "maxRepairAttempts">,
): RepairDecision {
  const attempt = usage.repairAttempts + 1;

  if (outcome.ok) {
    return { shouldRepair: false, attempt: usage.repairAttempts, exhausted: false, reason: "validation-passed" };
  }

  if (usage.repairAttempts >= budget.maxRepairAttempts) {
    return {
      shouldRepair: false,
      attempt: usage.repairAttempts,
      exhausted: true,
      reason: `repair-budget-exhausted after ${budget.maxRepairAttempts} attempts`,
    };
  }

  const failingPaths = [
    ...new Set([
      ...outcome.perFile.filter((r) => r.result.errors > 0).map((r) => r.path),
      ...outcome.security.findings.filter((f) => f.severity === "error").map((f) => f.path),
    ]),
  ];

  const prompt = [
    `Validation failed (attempt ${attempt} of ${budget.maxRepairAttempts}).`,
    "",
    "Fix exactly these problems and nothing else. Do not redesign the solution,",
    "do not rename files, and do not add features while fixing.",
    "",
    outcome.report,
    "",
    `Files to correct: ${failingPaths.join(", ")}`,
    "If a fix depends on an API you are unsure of, look it up before editing.",
  ].join("\n");

  return { shouldRepair: true, attempt, exhausted: false, prompt, reason: "validation-failed" };
}

/** Terminal message when repair gives up. Shows the real errors, not a summary. */
export function exhaustedMessage(outcome: ValidationOutcome, attempts: number): string {
  return [
    `Automatic repair stopped after ${attempts} attempt${attempts === 1 ? "" : "s"}.`,
    "",
    "The remaining problems are:",
    "",
    outcome.report || "(no diagnostics captured)",
  ].join("\n");
}
