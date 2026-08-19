import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pickUsableModel, resolveLanguageModel } from "@/lib/ai/providers";
import { buildTools } from "@/lib/ai/tools";
import { buildSystemPrompt, deriveConversationTitle } from "@/lib/ai/system-prompt";
import type { BlockwrightUIMessage } from "@/lib/ai/types";
import { AppError, errorResponse, toAppError } from "@/lib/errors";
import { calculateCredits, estimateCredits } from "@/lib/credits/pricing";
import { assertCanStartGeneration, chargeCredits } from "@/lib/credits/service";
import { getConnection } from "@/lib/studio/service";
import { preRetrieveForTurn, toPublicCitations } from "@/lib/knowledge/pre-retrieval";
import { getBrainGenerationConfig, resolveChatModelId } from "@/lib/knowledge/generation-config";
import { classifyRequest } from "@/lib/agent/classifier";
import { blueprintSchema, blueprintToContext } from "@/lib/blueprint/schema";
import { AgentStateMachine } from "@/lib/agent/state-machine";
import { ChangesetBuilder, reviewChangeset, toPreview as toChangesetPreview } from "@/lib/agent/changesets";
import { budgetFor } from "@/lib/agent/budgets";
import { resolveMode } from "@/lib/agent/authorization";
import { finishRun, persistChangeset, recordToolCall, recordTransition, startRun } from "@/lib/agent/audit";
import { runRepairLoop, describeRepair } from "@/lib/agent/repair-loop";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  modelId: z.string().max(120).optional(),
  // Preview is the default. A run may only mutate the project when the client
  // asks for apply, and apply is reachable only from the approval control.
  mode: z.enum(["preview", "apply"]).optional(),
  message: z.custom<UIMessage>(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as { id?: unknown }).id === "string" &&
      Array.isArray((v as { parts?: unknown }).parts),
    { message: "message must be a UIMessage" },
  ),
});

/**
 * The single AI entry point.
 *
 * Order of operations matters:
 *   auth → ownership → rate limit → credit pre-flight → provider call →
 *   persist → charge. Credits are charged from the provider's real reported
 *   token usage after the stream ends, never from the pre-flight estimate.
 *
 * Only the newest message comes over the wire (see the transport's
 * prepareSendMessagesRequest); history is loaded here so the client can never
 * forge or replay a conversation it does not own.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new AppError("unauthorized", "Sign in to use Blockwright.", 401);

    const body = requestSchema.parse(await request.json());

    const limit = rateLimit(`chat:${user.id}`, { limit: 30, windowMs: 60_000 });
    if (!limit.ok) {
      throw new AppError("rate_limited", "You are sending requests too quickly.", 429);
    }

    // --- ownership. RLS enforces this too; the explicit read gives a good error.
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, description, model_id")
      .eq("id", body.projectId)
      .maybeSingle();

    if (!project) throw new AppError("not_found", "That project does not exist.", 404);

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, project_id, title")
      .eq("id", body.id)
      .maybeSingle();

    if (!conversation || conversation.project_id !== project.id) {
      throw new AppError("not_found", "That conversation does not exist.", 404);
    }

    // --- model resolution
    // An explicit choice always wins: the model selector is a real product
    // feature and silently overriding it would bill someone for a model they
    // did not pick. The Roblox Brain's configured model is the *default* for a
    // project that has never chosen one, which is what ROBLOX_BRAIN_MODEL
    // controls.
    const brainConfig = getBrainGenerationConfig();
    const definition = pickUsableModel(
      resolveChatModelId(body.modelId, project.model_id),
      undefined,
      brainConfig.registryId,
    );
    if (!definition) {
      throw new AppError(
        "provider_unconfigured",
        "No AI provider is configured on this deployment. Add a provider API key to enable generation.",
        503,
      );
    }
    const { model } = resolveLanguageModel(definition.id);

    // --- credit pre-flight, before we spend anything with the provider
    const promptText = extractText(body.message);
    const estimate = estimateCredits(definition, promptText.length, 4000);
    await assertCanStartGeneration(supabase, user.id, estimate);

    // --- history
    const { data: history } = await supabase
      .from("messages")
      .select("id, role, parts, created_at, model_id")
      .eq("conversation_id", conversation.id)
      .order("seq")
      .limit(200);

    const previousMessages: BlockwrightUIMessage[] = (history ?? []).map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      parts: row.parts as BlockwrightUIMessage["parts"],
      metadata: { modelId: row.model_id ?? undefined, createdAt: row.created_at },
    }));

    const incoming = body.message as BlockwrightUIMessage;
    const messages = [...previousMessages, incoming];

    // Persist the user turn immediately so a dropped stream never loses it.
    // The client generates uuids, but fall back rather than 500 if one is not.
    await supabase.from("messages").insert({
      id: UUID_PATTERN.test(incoming.id) ? incoming.id : randomUUID(),
      conversation_id: conversation.id,
      owner_id: user.id,
      role: "user",
      parts: incoming.parts as never,
    });

    if (conversation.title === "New conversation" && promptText) {
      await supabase
        .from("conversations")
        .update({ title: deriveConversationTitle(promptText) })
        .eq("id", conversation.id);
    }

    // --- context for the system prompt
    const [{ data: files }, studioConnection] = await Promise.all([
      supabase
        .from("project_files")
        .select("path, kind, size_bytes")
        .eq("project_id", project.id)
        .order("path"),
      getConnection(supabase, project.id, user.id),
    ]);

    const studioConnected = studioConnection?.status === "connected";

    // An approved blueprint is settled context: the creator already reviewed and
    // accepted these decisions, so the agent follows them instead of re-deciding
    // — and instead of asking the same questions on every turn.
    const { data: approvedPlan } = await supabase
      .from("game_blueprints")
      .select("blueprint")
      .eq("project_id", project.id)
      .eq("status", "approved")
      .maybeSingle();

    const parsedPlan = approvedPlan?.blueprint
      ? blueprintSchema.safeParse(approvedPlan.blueprint)
      : null;
    const planContext = parsedPlan?.success ? blueprintToContext(parsedPlan.data) : null;

    // --- Agent run -----------------------------------------------------------
    // Classification decides the pipeline and the budget before a single token
    // is spent: a question must not trigger a build plan, and a multi-file build
    // must not proceed without one.
    const classification = classifyRequest(promptText);
    const budget = budgetFor(classification.kind);
    const mode = resolveMode(body.mode);
    const runId = randomUUID();

    // The run row must exist before any transition is recorded: agent_steps has
    // a foreign key to it, so a step written first is rejected and lost.
    await startRun(supabase, {
      runId,
      userId: user.id,
      projectId: project.id,
      conversationId: conversation.id,
      aiRequestId: null,
      mode,
      modelId: definition.id,
      classification: classification.kind,
      requiresPlan: classification.requiresPlan,
    });

    const machine = new AgentStateMachine({
      runId,
      userId: user.id,
      projectId: project.id,
      onTransition: (transition) => {
        // Fire-and-forget: telemetry must never delay or fail the turn.
        void recordTransition(supabase, transition);
      },
    });

    // In preview the model's writes are staged against a snapshot of the project
    // rather than applied, so the builder needs to know what already exists.
    const changesetBuilder =
      mode === "preview"
        ? new ChangesetBuilder(
            runId,
            project.id,
            user.id,
            (
              await supabase
                .from("project_files")
                .select("path, content, kind, revision")
                .eq("project_id", project.id)
            ).data ?? [],
          )
        : null;

    machine.transition("ANALYZING", `classified as ${classification.kind}`);

    // --- Roblox Brain --------------------------------------------------------
    // Retrieval happens BEFORE generation, so the model receives the relevant
    // documentation rather than the bare question. The knowledge tool remains
    // available for follow-up lookups inside the turn.
    if (classification.requiresRetrieval) {
      machine.transition("RETRIEVING_KNOWLEDGE", "gathering Roblox documentation");
    }
    const brain = await preRetrieveForTurn(promptText, {
      maxChunks: budget.maxRetrievedChunks,
      maxTokens: 6000,
    });
    const citations = toPublicCitations(brain.citations);

    logger.info("brain.pre_retrieval", {
      requestId: undefined,
      reason: brain.reason,
      retrieved: brain.retrieved,
      strategy: brain.strategy,
      chunks: brain.chunk_count,
      codeExamples: brain.code_example_count,
      symbols: brain.detected_symbols.length,
      vector: brain.vector_search_available,
      retrievalMs: brain.latency_ms,
    });

    const { data: aiRequest } = await supabase
      .from("ai_requests")
      .insert({
        owner_id: user.id,
        project_id: project.id,
        conversation_id: conversation.id,
        provider: definition.provider,
        model_id: definition.id,
        status: "running",
      })
      .select("id")
      .single();

    const requestId = aiRequest?.id;

    if (requestId) {
      await supabase.from("agent_runs").update({ ai_request_id: requestId }).eq("id", runId);
    }

    logger.info("agent.run.start", {
      runId,
      mode,
      classification: classification.kind,
      requiresPlan: classification.requiresPlan,
      confidence: classification.confidence,
      signals: classification.signals,
      maxSteps: budget.maxSteps,
    });

    logger.info("ai.request.start", {
      requestId,
      userId: user.id,
      projectId: project.id,
      provider: definition.provider,
      model: definition.id,
    });

    // The writer only exists once the stream opens, but the tools are needed
    // beforehand (convertToModelMessages validates tool parts against them), so
    // status writes go through this holder.
    let writerRef: UIMessageStreamWriter<BlockwrightUIMessage> | null = null;
    const activityBuffer: { kind: string; summary: string; detail?: unknown }[] = [];
    let toolCallCount = 0;

    const tools = buildTools({
      supabase,
      projectId: project.id,
      userId: user.id,
      mode,
      changeset: changesetBuilder,
      runId,
      onActivity: (event) => {
        activityBuffer.push(event);
        toolCallCount += 1;

        // Audited separately from the activity feed: the feed is for the user
        // and is trimmed for display, this is the record of what the agent did.
        void recordToolCall(supabase, {
          runId,
          userId: user.id,
          toolName: event.kind,
          state: machine.state,
          ok: true,
          durationMs: 0,
          summary: event.summary,
        });
        const writer = writerRef;
        if (!writer) return;

        // Transient: drives the live status rail, not stored in history.
        writer.write({
          type: "data-status",
          data: {
            id: `${event.kind}-${activityBuffer.length}`,
            label: event.summary,
            state: "done",
          },
          transient: true,
        });

        if (event.kind === "plan") {
          const detail = event.detail as { steps?: string[] } | undefined;
          writer.write({
            type: "data-plan",
            id: "plan",
            data: { goal: event.summary, steps: detail?.steps ?? [] },
          });
        }

        if (event.kind.startsWith("file.")) {
          const detail = event.detail as
            | { path?: string; kind?: string; bytes?: number }
            | undefined;
          const change = event.kind.split(".")[1];
          if (detail?.path && (change === "created" || change === "updated" || change === "deleted")) {
            writer.write({
              type: "data-artifact",
              id: `artifact-${detail.path}`,
              data: {
                path: detail.path,
                kind: detail.kind ?? "module",
                change,
                bytes: detail.bytes,
              },
            });
          }
        }
      },
    });

    // Resolved before the stream opens so malformed history fails with a proper
    // status code instead of mid-stream. `ignoreIncompleteToolCalls` keeps a
    // conversation that was stopped mid-tool-call replayable.
    const modelMessages = await convertToModelMessages(messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    });

    const stream = createUIMessageStream<BlockwrightUIMessage>({
      originalMessages: messages,
      // Assistant ids must also be uuids to match the messages table.
      generateId: () => randomUUID(),

      execute: ({ writer }) => {
        writerRef = writer;
        machine.tryTransition("GENERATING", "calling the model");

        // Citations are persisted with the message so a reloaded conversation
        // still shows which documentation backed the answer.
        if (citations.length) {
          writer.write({ type: "data-citations", id: "citations", data: { citations } });
        }

        const result = streamText({
          model,
          instructions: buildSystemPrompt({
            projectName: project.name,
            projectDescription: project.description,
            existingFiles: (files ?? []).map((f) => ({
              path: f.path,
              kind: f.kind,
              bytes: f.size_bytes,
            })),
            studioConnected,
            placeName: studioConnection?.place_name,
            knowledgeContext: brain.context,
            knowledgeReason: brain.reason,
            mode,
            classification: classification.kind,
            requiresPlan: classification.requiresPlan,
            maxSteps: budget.maxSteps,
            blueprintContext: planContext,
          }),
          messages: modelMessages,
          tools,
          stopWhen: isStepCount(budget.maxSteps),
          // The output ceiling was declared in the budget and never applied, so
          // every request asked for the model's full 65k window. That is both
          // the cost-control gap section 19 asked for and a hard failure on any
          // account whose remaining balance cannot cover the reservation.
          maxOutputTokens: budget.maxOutputTokens,
          onError: ({ error }) => {
            logger.error("ai.stream.error", { requestId, error: String(error) });
          },
          onEnd: async ({ usage, finishReason }) => {
            const inputTokens = usage.inputTokens ?? 0;
            const outputTokens = usage.outputTokens ?? 0;
            const credits = calculateCredits(definition, { inputTokens, outputTokens });

            // --- close out the agent run -------------------------------------
            const validationStart = Date.now();
            machine.tryTransition("GENERATING", "model finished");
            machine.tryTransition("VALIDATING", "checking generated output");

            let changesetPreview: ReturnType<typeof toChangesetPreview> | null = null;
            let repairAttempts = 0;

            if (changesetBuilder && changesetBuilder.size > 0) {
              // Server-driven repair, before the user ever sees the change set.
              // Leaving this to the model meant a run could declare success while
              // its own validator was still reporting errors.
              const repair = await runRepairLoop(changesetBuilder.list(), {
                maxAttempts: budget.maxRepairAttempts,
              });
              repairAttempts = repair.attempts.length;

              if (repair.attempts.length > 0) {
                machine.tryTransition("REPAIRING", "fixing validation failures");
                machine.tryTransition("VALIDATING", "re-checking after repair");

                logger.info("agent.repair.summary", {
                  runId,
                  attempts: repair.attempts.length,
                  repaired: repair.repaired,
                  stoppedBecause: repair.stoppedBecause,
                  credits: repair.totalCredits,
                });

                const note = describeRepair(repair);
                if (note && writerRef) {
                  writerRef.write({
                    type: "data-status",
                    data: { id: "repair", label: note, state: repair.outcome.ok ? "done" : "failed" },
                    transient: true,
                  });
                }
              }

              const changeset = { ...changesetBuilder.build(), operations: repair.operations };
              changeset.issues = reviewChangeset(repair.operations);

              const persisted = await persistChangeset(supabase, changeset);
              changesetPreview = toChangesetPreview(changeset);

              if (persisted && writerRef) {
                // The approval card. Persisted with the message so a reloaded
                // conversation can still be approved.
                writerRef.write({
                  type: "data-changeset",
                  id: `changeset-${changeset.changesetId}`,
                  data: changesetPreview,
                });
              }
            }

            const blocked =
              changesetPreview?.issues.some((issue) => issue.severity === "error") ?? false;

            machine.tryTransition(
              finishReason === "error" || blocked ? "FAILED" : "COMPLETED",
              finishReason === "error"
                ? "generation error"
                : blocked
                  ? "change set failed validation"
                  : "run finished",
            );

            await finishRun(supabase, {
              runId,
              state: machine.state,
              repairAttempts,
              toolCalls: toolCallCount,
              retrievalMs: brain.latency_ms,
              generationMs: Math.max(0, Date.now() - startedAt - brain.latency_ms),
              validationMs: Date.now() - validationStart,
              inputTokens,
              outputTokens,
              credits,
              errorCategory: finishReason === "error" ? "generation" : blocked ? "validation" : undefined,
            });

            try {
              if (credits > 0) {
                await chargeCredits(supabase, {
                  amount: credits,
                  description: `${definition.name} · ${project.name}`,
                  referenceId: requestId,
                });
              }
            } catch (chargeError) {
              // The generation already happened — log rather than fail the response.
              logger.error("ai.charge.failed", { requestId, error: String(chargeError) });
            }

            if (requestId) {
              await supabase
                .from("ai_requests")
                .update({
                  status: finishReason === "error" ? "failed" : "succeeded",
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  reasoning_tokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
                  cached_input_tokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                  credits_charged: credits,
                  latency_ms: Date.now() - startedAt,
                  tool_calls: toolCallCount,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", requestId);
            }

            if (activityBuffer.length) {
              await supabase.from("activity_events").insert(
                activityBuffer.slice(0, 40).map((event) => ({
                  owner_id: user.id,
                  project_id: project.id,
                  kind: event.kind,
                  summary: event.summary,
                  detail: (event.detail ?? {}) as never,
                })),
              );
            }

            await supabase
              .from("projects")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", project.id);

            logger.info("agent.run.end", {
              runId,
              mode,
              state: machine.state,
              classification: classification.kind,
              steps: machine.steps,
              stagedOperations: changesetBuilder?.size ?? 0,
            });

            logger.info("ai.request.end", {
              requestId,
              latencyMs: Date.now() - startedAt,
              retrievalMs: brain.latency_ms,
              generationMs: Date.now() - startedAt - brain.latency_ms,
              brainChunks: brain.chunk_count,
              citations: citations.length,
              inputTokens,
              outputTokens,
              credits,
              toolCalls: toolCallCount,
              finishReason,
            });
          },
        });

        writer.merge(
          toUIMessageStream({
            stream: result.stream,
            messageMetadata: () => ({
              modelId: definition.id,
              createdAt: new Date().toISOString(),
            }),
          }),
        );
      },

      // Never leak provider internals to the browser.
      onError: (error) => toAppError(error).message,

      onEnd: async ({ responseMessage, isAborted }) => {
        if (!responseMessage || responseMessage.role !== "assistant") return;

        await supabase.from("messages").insert({
          id: responseMessage.id,
          conversation_id: conversation.id,
          owner_id: user.id,
          role: "assistant",
          parts: responseMessage.parts as never,
          model_id: definition.id,
        });

        if (isAborted && requestId) {
          logger.info("ai.request.aborted", { requestId });
          await supabase.from("ai_requests").update({ status: "aborted" }).eq("id", requestId);
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const appError = toAppError(error);
    logger.warn("ai.request.rejected", {
      code: appError.code,
      message: appError.message,
      latencyMs: Date.now() - startedAt,
    });
    return errorResponse(error);
  }
}

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
