import type { FileKind } from "@/lib/supabase/types";

/**
 * Agent layer types.
 *
 * Deliberately free of `server-only` and of any database import: the state
 * machine, changeset rules, budgets and security checks are pure functions over
 * these shapes, which is what makes them testable without a Supabase client.
 * The impure edges (audit, executor, context) live in their own modules.
 */

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export const AGENT_STATES = [
  "IDLE",
  "ANALYZING",
  "PLANNING",
  "RETRIEVING_KNOWLEDGE",
  "GENERATING",
  "VALIDATING",
  "EXECUTING_STUDIO",
  "VERIFYING",
  "REPAIRING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

/** States from which no transition is legal. */
export const TERMINAL_STATES: readonly AgentState[] = ["COMPLETED", "FAILED", "CANCELLED"];

export interface StateTransition {
  runId: string;
  userId: string;
  projectId: string;
  from: AgentState;
  to: AgentState;
  stepIndex: number;
  reason: string;
  at: string;
}

// ---------------------------------------------------------------------------
// Request classification
// ---------------------------------------------------------------------------

/**
 * Section 2 of the brief: not every request deserves the same pipeline. A
 * question about why a RemoteEvent misfires should not trigger a build plan,
 * and a request for a round system should never skip one.
 */
export const REQUEST_KINDS = [
  "explanation",
  "code_generation",
  "code_modification",
  "multi_file_implementation",
  "project_structure",
  "studio_execution",
  "debugging",
  "asset_generation",
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number];

export interface Classification {
  kind: RequestKind;
  /** Multi-file work must plan first; a one-line question must not. */
  requiresPlan: boolean;
  requiresRetrieval: boolean;
  mutatesProject: boolean;
  confidence: number;
  signals: string[];
}

// ---------------------------------------------------------------------------
// Execution mode and authorization
// ---------------------------------------------------------------------------

export type AgentMode = "preview" | "apply";

export type ChangesetStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "applied"
  | "rejected"
  | "failed"
  | "rolled_back";

// ---------------------------------------------------------------------------
// Changesets
// ---------------------------------------------------------------------------

export const CHANGE_OPERATIONS = ["create", "update", "delete", "move", "rename"] as const;

export type ChangeOperationKind = (typeof CHANGE_OPERATIONS)[number];

/**
 * One proposed mutation.
 *
 * `rollback` is captured at *build* time from the file's current state, not
 * derived at apply time, so an operation can be undone even if a later
 * operation in the same changeset has already changed the file.
 */
export interface ChangeOperation {
  kind: ChangeOperationKind;
  /** Project-relative path, already through validateProjectPath. */
  path: string;
  /** Destination for move/rename. */
  toPath?: string;
  /** New content for create/update. */
  content?: string;
  fileKind?: FileKind;
  /** Roblox service this file materialises under. */
  robloxParent?: string;
  /** What must be true before this runs. */
  precondition: Precondition;
  rollback: RollbackInfo;
  summary: string;
}

export interface Precondition {
  /** Whether the path must already exist. */
  mustExist: boolean;
  /** Revision the operation was planned against; a mismatch means stale. */
  expectedRevision?: number;
}

export interface RollbackInfo {
  kind: "restore_content" | "delete_created" | "restore_path" | "none";
  path: string;
  content?: string;
  fileKind?: FileKind;
  revision?: number;
}

export interface ChangesetValidationIssue {
  severity: "error" | "warning";
  rule: string;
  message: string;
  path?: string;
}

export interface Changeset {
  changesetId: string;
  runId: string;
  projectId: string;
  ownerId: string;
  operations: ChangeOperation[];
  status: ChangesetStatus;
  createdAt: string;
  approvedAt?: string;
  appliedAt?: string;
  issues: ChangesetValidationIssue[];
}

/** What the user sees before approving. */
export interface ChangesetPreview {
  changesetId: string;
  status: ChangesetStatus;
  summary: string;
  operations: {
    kind: ChangeOperationKind;
    path: string;
    toPath?: string;
    summary: string;
    bytes?: number;
    validation?: { errors: number; warnings: number };
  }[];
  issues: ChangesetValidationIssue[];
  totals: Record<ChangeOperationKind, number>;
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface AgentBudget {
  maxSteps: number;
  maxRepairAttempts: number;
  maxOutputTokens: number;
  maxRetrievedChunks: number;
  maxCodeExamples: number;
  maxProjectFilesInContext: number;
  maxCredits: number;
  maxWallClockMs: number;
}

export interface BudgetUsage {
  steps: number;
  repairAttempts: number;
  outputTokens: number;
  credits: number;
  startedAt: number;
}

export type BudgetViolation =
  | "max_steps"
  | "max_repair_attempts"
  | "max_output_tokens"
  | "max_credits"
  | "max_wall_clock";

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export interface AgentRunRecord {
  runId: string;
  userId: string;
  projectId: string;
  conversationId: string | null;
  mode: AgentMode;
  modelId: string;
  state: AgentState;
  classification: RequestKind;
  stepCount: number;
  repairAttempts: number;
  cancelled: boolean;
}
