import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { logger } from "@/lib/logger";
import type { AgentMode, AgentState, Changeset, RequestKind, StateTransition } from "@/lib/agent/types";

/**
 * Agent run telemetry.
 *
 * Everything here is written with the *user's* Supabase client, so RLS decides
 * what may be recorded — an audit trail that bypassed RLS to write rows would
 * be a way to write into another tenant's history.
 *
 * What is deliberately never recorded: tool arguments and results are summarised
 * to counts and paths rather than stored verbatim. Script content is already in
 * project_files; copying it into an audit table would duplicate user data into a
 * second place with its own retention, and a tool result can contain retrieved
 * documentation, which is bulk and not worth persisting.
 */

type Client = SupabaseClient<Database>;

export interface StartRunParams {
  runId: string;
  userId: string;
  projectId: string;
  conversationId: string | null;
  aiRequestId: string | null;
  mode: AgentMode;
  modelId: string;
  classification: RequestKind;
  requiresPlan: boolean;
}

export async function startRun(supabase: Client, params: StartRunParams): Promise<void> {
  const { error } = await supabase.from("agent_runs").insert({
    id: params.runId,
    owner_id: params.userId,
    project_id: params.projectId,
    conversation_id: params.conversationId,
    ai_request_id: params.aiRequestId,
    mode: params.mode,
    model_id: params.modelId,
    classification: params.classification,
    requires_plan: params.requiresPlan,
    state: "ANALYZING",
  });

  if (error) {
    // Telemetry must never take the run down with it.
    logger.warn("agent.run.start_failed", { runId: params.runId, error: error.message });
  }
}

export async function recordTransition(
  supabase: Client,
  transition: StateTransition,
): Promise<void> {
  const [{ error: stepError }, { error: runError }] = await Promise.all([
    supabase.from("agent_steps").insert({
      run_id: transition.runId,
      owner_id: transition.userId,
      step_index: transition.stepIndex,
      previous_state: transition.from,
      new_state: transition.to,
      reason: transition.reason.slice(0, 500),
    }),
    supabase
      .from("agent_runs")
      .update({ state: transition.to, step_count: transition.stepIndex })
      .eq("id", transition.runId),
  ]);

  if (stepError || runError) {
    logger.warn("agent.step.record_failed", {
      runId: transition.runId,
      error: stepError?.message ?? runError?.message,
    });
  }
}

export interface ToolCallRecord {
  runId: string;
  userId: string;
  toolName: string;
  state: AgentState;
  ok: boolean;
  durationMs: number;
  /** Short, non-sensitive: a path, a count, an error code. Never file content. */
  summary: string;
  errorCategory?: string;
}

export async function recordToolCall(supabase: Client, call: ToolCallRecord): Promise<void> {
  const { error } = await supabase.from("agent_tool_calls").insert({
    run_id: call.runId,
    owner_id: call.userId,
    tool_name: call.toolName,
    agent_state: call.state,
    ok: call.ok,
    duration_ms: call.durationMs,
    summary: call.summary.slice(0, 300),
    error_category: call.errorCategory ?? null,
  });

  if (error) logger.warn("agent.tool.record_failed", { runId: call.runId, error: error.message });
}

export async function persistChangeset(supabase: Client, changeset: Changeset): Promise<boolean> {
  const { error } = await supabase.from("agent_changesets").insert({
    id: changeset.changesetId,
    run_id: changeset.runId,
    owner_id: changeset.ownerId,
    project_id: changeset.projectId,
    status: changeset.status,
    operations: changeset.operations as never,
    issues: changeset.issues as never,
    operation_count: changeset.operations.length,
  });

  if (error) {
    logger.error("agent.changeset.persist_failed", {
      runId: changeset.runId,
      error: error.message,
    });
    return false;
  }
  return true;
}

/**
 * Load a changeset for an apply.
 *
 * RLS restricts this to the caller's own rows; the explicit owner check is a
 * second, independent gate so a policy regression cannot silently widen it.
 */
export async function loadChangeset(
  supabase: Client,
  changesetId: string,
  userId: string,
): Promise<Changeset | null> {
  const { data, error } = await supabase
    .from("agent_changesets")
    .select("id, run_id, owner_id, project_id, status, operations, issues, created_at, approved_at, applied_at")
    .eq("id", changesetId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.owner_id !== userId) return null;

  return {
    changesetId: data.id,
    runId: data.run_id,
    projectId: data.project_id,
    ownerId: data.owner_id,
    status: data.status as Changeset["status"],
    operations: (data.operations ?? []) as Changeset["operations"],
    issues: (data.issues ?? []) as Changeset["issues"],
    createdAt: data.created_at,
    approvedAt: data.approved_at ?? undefined,
    appliedAt: data.applied_at ?? undefined,
  };
}

export async function setChangesetStatus(
  supabase: Client,
  changesetId: string,
  status: Changeset["status"],
  extra: { approvedAt?: string; appliedAt?: string } = {},
): Promise<void> {
  const patch: Partial<Database["public"]["Tables"]["agent_changesets"]["Row"]> = { status };
  if (extra.approvedAt) patch.approved_at = extra.approvedAt;
  if (extra.appliedAt) patch.applied_at = extra.appliedAt;

  const { error } = await supabase.from("agent_changesets").update(patch).eq("id", changesetId);
  if (error) logger.warn("agent.changeset.status_failed", { changesetId, error: error.message });
}

export interface FinishRunParams {
  runId: string;
  state: AgentState;
  repairAttempts: number;
  toolCalls: number;
  retrievalMs: number;
  generationMs: number;
  validationMs: number;
  inputTokens: number;
  outputTokens: number;
  credits: number;
  errorCategory?: string;
}

export async function finishRun(supabase: Client, params: FinishRunParams): Promise<void> {
  const { error } = await supabase
    .from("agent_runs")
    .update({
      state: params.state,
      repair_attempts: params.repairAttempts,
      tool_calls: params.toolCalls,
      retrieval_ms: params.retrievalMs,
      generation_ms: params.generationMs,
      validation_ms: params.validationMs,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      credits_charged: params.credits,
      error_category: params.errorCategory ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.runId);

  if (error) logger.warn("agent.run.finish_failed", { runId: params.runId, error: error.message });
}

/** Has the user asked this run to stop? Polled between steps. */
export async function isCancelled(supabase: Client, runId: string): Promise<boolean> {
  const { data } = await supabase.from("agent_runs").select("cancelled").eq("id", runId).maybeSingle();
  return Boolean(data?.cancelled);
}
