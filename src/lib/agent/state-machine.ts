import { TERMINAL_STATES, type AgentState, type StateTransition } from "@/lib/agent/types";

/**
 * The agent's execution state, as an explicit machine rather than an implicit
 * sequence of awaits.
 *
 * The value of writing it down is that illegal transitions become impossible
 * instead of merely unlikely: a run cannot reach EXECUTING_STUDIO without
 * having passed VALIDATING, and nothing can move once a run is terminal. That
 * matters because "apply changes" is the one operation here that is hard to
 * undo, and the guard against reaching it by accident should be structural.
 */

const TRANSITIONS: Record<AgentState, readonly AgentState[]> = {
  IDLE: ["ANALYZING", "CANCELLED"],
  ANALYZING: ["PLANNING", "RETRIEVING_KNOWLEDGE", "GENERATING", "FAILED", "CANCELLED"],
  PLANNING: ["RETRIEVING_KNOWLEDGE", "GENERATING", "FAILED", "CANCELLED"],
  RETRIEVING_KNOWLEDGE: ["PLANNING", "GENERATING", "FAILED", "CANCELLED"],
  GENERATING: ["VALIDATING", "RETRIEVING_KNOWLEDGE", "FAILED", "CANCELLED"],
  // A validated changeset may be applied to Studio, verified directly, repaired,
  // or simply completed — preview runs stop here without mutating anything.
  VALIDATING: ["EXECUTING_STUDIO", "VERIFYING", "REPAIRING", "COMPLETED", "FAILED", "CANCELLED"],
  EXECUTING_STUDIO: ["VERIFYING", "REPAIRING", "FAILED", "CANCELLED"],
  VERIFYING: ["COMPLETED", "REPAIRING", "FAILED", "CANCELLED"],
  // Repair goes back through generation; it may also give up.
  REPAIRING: ["GENERATING", "VALIDATING", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isTerminal(state: AgentState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from: AgentState, to: AgentState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: AgentState): readonly AgentState[] {
  return TRANSITIONS[from];
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: AgentState,
    readonly to: AgentState,
  ) {
    super(
      `Illegal agent transition ${from} -> ${to}. Allowed: ${
        TRANSITIONS[from].join(", ") || "(none — terminal)"
      }`,
    );
    this.name = "IllegalTransitionError";
  }
}

export interface MachineOptions {
  runId: string;
  userId: string;
  projectId: string;
  /** Called on every accepted transition. Kept sync so ordering is guaranteed. */
  onTransition?: (transition: StateTransition) => void;
}

/**
 * A single run's state.
 *
 * Cancellation is modelled as a flag checked at each transition rather than as
 * an exception thrown from elsewhere, so a cancelled run always stops at a
 * defined point instead of unwinding from the middle of a tool call.
 */
export class AgentStateMachine {
  private current: AgentState = "IDLE";
  private stepIndex = 0;
  private cancelRequested = false;
  private readonly history: StateTransition[] = [];

  constructor(private readonly options: MachineOptions) {}

  get state(): AgentState {
    return this.current;
  }

  get steps(): number {
    return this.stepIndex;
  }

  get transitions(): readonly StateTransition[] {
    return this.history;
  }

  get isCancelRequested(): boolean {
    return this.cancelRequested;
  }

  /** Ask the run to stop. Takes effect at the next transition. */
  requestCancel(): void {
    this.cancelRequested = true;
  }

  /**
   * Move to `to`, or throw. A pending cancellation diverts every non-terminal
   * transition to CANCELLED so a cancelled run cannot keep doing work.
   */
  transition(to: AgentState, reason: string): StateTransition {
    if (isTerminal(this.current)) {
      throw new IllegalTransitionError(this.current, to);
    }

    const target = this.cancelRequested && !isTerminal(to) ? "CANCELLED" : to;
    const effectiveReason =
      target === "CANCELLED" && target !== to ? `cancelled before ${to}: ${reason}` : reason;

    if (!canTransition(this.current, target)) {
      throw new IllegalTransitionError(this.current, target);
    }

    this.stepIndex += 1;
    const record: StateTransition = {
      runId: this.options.runId,
      userId: this.options.userId,
      projectId: this.options.projectId,
      from: this.current,
      to: target,
      stepIndex: this.stepIndex,
      reason,
      at: new Date().toISOString(),
    };
    record.reason = effectiveReason;

    this.current = target;
    this.history.push(record);
    this.options.onTransition?.(record);
    return record;
  }

  /** Transition only if legal; returns false instead of throwing. */
  tryTransition(to: AgentState, reason: string): boolean {
    if (isTerminal(this.current) || !canTransition(this.current, to)) return false;
    this.transition(to, reason);
    return true;
  }

  /** Terminal failure from wherever the run currently is. */
  fail(reason: string): StateTransition | null {
    if (isTerminal(this.current)) return null;
    return this.transition("FAILED", reason);
  }
}
