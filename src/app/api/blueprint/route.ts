import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { assertCanStartGeneration, chargeCredits } from "@/lib/credits/service";
import { rateLimit } from "@/lib/rate-limit";
import { generateBlueprint, generateQuestions } from "@/lib/blueprint/generate";
import { reviewBlueprint, type BlueprintQuestion } from "@/lib/blueprint/schema";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

const questionsBody = z.object({
  step: z.literal("questions"),
  projectId: z.string().uuid(),
  idea: z.string().min(8).max(2000),
});

const blueprintBody = z.object({
  step: z.literal("blueprint"),
  blueprintId: z.string().uuid(),
  answers: z.array(z.object({ id: z.string().max(40), answer: z.string().max(600) })).max(8),
});

const body = z.discriminatedUnion("step", [questionsBody, blueprintBody]);

/**
 * Blueprint generation, in two steps.
 *
 * Questions first, then the plan. Splitting them is the point: the questions are
 * cheap and fast, and the expensive call only happens once the creator has told
 * us the handful of things that change the answer.
 *
 * Both steps are metered like any other generation — a blueprint is real model
 * output and is billed from real reported usage, not estimated.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const limit = rateLimit(`blueprint:${user.id}`, { limit: 12, windowMs: 60_000 });
    if (!limit.ok) throw new AppError("rate_limited", "You are going too quickly.", 429);

    const input = body.parse(await request.json());
    await assertCanStartGeneration(supabase, user.id, 40);

    if (input.step === "questions") {
      // Ownership is enforced by RLS; the explicit read gives a usable error.
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", input.projectId)
        .maybeSingle();
      if (!project) throw new AppError("not_found", "That project does not exist.", 404);

      const { questions, cost } = await generateQuestions(input.idea);

      const { data: row, error } = await supabase
        .from("game_blueprints")
        .insert({
          project_id: input.projectId,
          owner_id: user.id,
          idea: input.idea,
          questions: questions as never,
          status: "questions",
          input_tokens: cost.inputTokens,
          output_tokens: cost.outputTokens,
          credits_charged: cost.credits,
        })
        .select("id")
        .single();

      if (error || !row) throw new AppError("database_error", "Could not save that plan.", 500);

      await chargeCredits(supabase, {
        amount: cost.credits,
        description: "Blueprint questions",
        referenceId: row.id,
      });

      logger.info("blueprint.questions.done", { blueprintId: row.id, credits: cost.credits });
      return NextResponse.json({ ok: true, blueprintId: row.id, questions });
    }

    // --- step: blueprint ---------------------------------------------------
    const { data: existing } = await supabase
      .from("game_blueprints")
      .select("id, idea, questions, status")
      .eq("id", input.blueprintId)
      .maybeSingle();

    if (!existing) throw new AppError("not_found", "That plan does not exist.", 404);
    if (existing.status === "approved") {
      throw new AppError("conflict", "That plan is already approved.", 409);
    }

    const { blueprint, cost, retrievalMs } = await generateBlueprint({
      idea: existing.idea,
      answers: input.answers,
      questions: existing.questions as BlueprintQuestion[],
    });

    const issues = reviewBlueprint(blueprint);

    const { error } = await supabase
      .from("game_blueprints")
      .update({
        answers: input.answers as never,
        blueprint: blueprint as never,
        issues: issues as never,
        status: "draft",
        updated_at: new Date().toISOString(),
        input_tokens: cost.inputTokens,
        output_tokens: cost.outputTokens,
        credits_charged: cost.credits,
      })
      .eq("id", input.blueprintId);

    if (error) throw new AppError("database_error", "Could not save that plan.", 500);

    await chargeCredits(supabase, {
      amount: cost.credits,
      description: `Blueprint · ${blueprint.title}`,
      referenceId: input.blueprintId,
    });

    logger.info("blueprint.done", {
      blueprintId: input.blueprintId,
      sections: blueprint.sections.length,
      credits: cost.credits,
      retrievalMs,
    });

    return NextResponse.json({ ok: true, blueprint, issues, credits: cost.credits });
  } catch (error) {
    return errorResponse(error);
  }
}
