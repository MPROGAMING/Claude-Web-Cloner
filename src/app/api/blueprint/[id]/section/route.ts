import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { assertCanStartGeneration, chargeCredits } from "@/lib/credits/service";
import { regenerateSection } from "@/lib/blueprint/generate";
import { SECTION_KEYS, blueprintSchema, reviewBlueprint } from "@/lib/blueprint/schema";

/** Regenerate a single section, leaving every other decision intact. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const input = z
      .object({
        key: z.enum(SECTION_KEYS),
        guidance: z.string().max(400).optional(),
      })
      .parse(await request.json());

    const { data: row } = await supabase
      .from("game_blueprints")
      .select("id, blueprint, status")
      .eq("id", id)
      .maybeSingle();

    if (!row?.blueprint) throw new AppError("not_found", "That plan does not exist.", 404);
    if (row.status === "approved") {
      throw new AppError("conflict", "An approved plan cannot be edited.", 409);
    }

    const parsed = blueprintSchema.safeParse(row.blueprint);
    if (!parsed.success) throw new AppError("conflict", "That plan is not readable.", 409);

    await assertCanStartGeneration(supabase, user.id, 20);

    const { section, cost } = await regenerateSection({
      blueprint: parsed.data,
      sectionKey: input.key,
      guidance: input.guidance,
    });

    const next = {
      ...parsed.data,
      sections: parsed.data.sections.some((s) => s.key === input.key)
        ? parsed.data.sections.map((s) => (s.key === input.key ? section : s))
        : [...parsed.data.sections, section],
    };
    const issues = reviewBlueprint(next);

    const { error } = await supabase
      .from("game_blueprints")
      .update({
        blueprint: next as never,
        issues: issues as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new AppError("database_error", "Could not save that section.", 500);

    await chargeCredits(supabase, {
      amount: cost.credits,
      description: `Blueprint section · ${input.key}`,
      referenceId: id,
    });

    return NextResponse.json({ ok: true, section, issues, credits: cost.credits });
  } catch (error) {
    return errorResponse(error);
  }
}
