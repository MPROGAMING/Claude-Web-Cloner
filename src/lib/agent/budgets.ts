import type { AgentBudget, BudgetUsage, BudgetViolation, RequestKind } from "@/lib/agent/types";

/**
 * Cost and runaway control.
 *
 * Step 6 measured ~70,000 input tokens for a single multi-step turn, because an
 * agentic loop re-sends its context at every step. That is expected, not a bug —
 * but it means a loop that fails to converge is expensive, so the limits are
 * explicit and checked rather than implied by a step count buried in the route.
 *
 * A violated budget fails the run. It never silently downgrades the model:
 * substituting a cheaper model would bill the user for something they did not
 * choose and would quietly change the quality of the result.
 */

export const DEFAULT_BUDGET: AgentBudget = {
  maxSteps: 24,
  maxRepairAttempts: 3,
  maxOutputTokens: 32_000,
  maxRetrievedChunks: 8,
  maxCodeExamples: 4,
  maxProjectFilesInContext: 40,
  maxCredits: 400,
  maxWallClockMs: 5 * 60_000,
};

/**
 * Simple work needs far less headroom than a multi-file build, and a tighter
 * budget on a question is a real safeguard: it bounds the damage when
 * classification is wrong.
 */
const BY_KIND: Partial<Record<RequestKind, Partial<AgentBudget>>> = {
  explanation: { maxSteps: 6, maxRepairAttempts: 0, maxOutputTokens: 8_000, maxCredits: 60 },
  debugging: { maxSteps: 12, maxRepairAttempts: 2, maxOutputTokens: 16_000, maxCredits: 150 },
  code_generation: { maxSteps: 14, maxOutputTokens: 20_000, maxCredits: 200 },
  code_modification: { maxSteps: 16, maxCredits: 250 },
  multi_file_implementation: { maxSteps: 24, maxCredits: 400 },
  project_structure: { maxSteps: 18, maxCredits: 300 },
  studio_execution: { maxSteps: 18, maxCredits: 300 },
  asset_generation: { maxSteps: 12, maxCredits: 200 },
};

export function budgetFor(kind: RequestKind, overrides: Partial<AgentBudget> = {}): AgentBudget {
  return { ...DEFAULT_BUDGET, ...(BY_KIND[kind] ?? {}), ...overrides };
}

export function newUsage(): BudgetUsage {
  return { steps: 0, repairAttempts: 0, outputTokens: 0, credits: 0, startedAt: Date.now() };
}

export interface BudgetCheck {
  ok: boolean;
  violation?: BudgetViolation;
  message?: string;
}

/**
 * Check usage against a budget.
 *
 * `now` is injectable so wall-clock expiry is testable without waiting.
 */
export function checkBudget(
  budget: AgentBudget,
  usage: BudgetUsage,
  now: number = Date.now(),
): BudgetCheck {
  if (usage.steps > budget.maxSteps) {
    return {
      ok: false,
      violation: "max_steps",
      message: `This run reached its ${budget.maxSteps}-step limit without finishing.`,
    };
  }
  if (usage.repairAttempts > budget.maxRepairAttempts) {
    return {
      ok: false,
      violation: "max_repair_attempts",
      message: `Automatic repair failed ${budget.maxRepairAttempts} times; stopping so the errors can be read.`,
    };
  }
  if (usage.outputTokens > budget.maxOutputTokens) {
    return {
      ok: false,
      violation: "max_output_tokens",
      message: `This run exceeded its ${budget.maxOutputTokens}-token output budget.`,
    };
  }
  if (usage.credits > budget.maxCredits) {
    return {
      ok: false,
      violation: "max_credits",
      message: `This run exceeded its ${budget.maxCredits}-credit budget.`,
    };
  }
  if (now - usage.startedAt > budget.maxWallClockMs) {
    return {
      ok: false,
      violation: "max_wall_clock",
      message: `This run exceeded its ${Math.round(budget.maxWallClockMs / 1000)}s time limit.`,
    };
  }
  return { ok: true };
}

/** Would one more step exceed the budget? Checked *before* spending. */
export function canTakeStep(budget: AgentBudget, usage: BudgetUsage): boolean {
  return usage.steps < budget.maxSteps;
}

export function canRepair(budget: AgentBudget, usage: BudgetUsage): boolean {
  return usage.repairAttempts < budget.maxRepairAttempts;
}
