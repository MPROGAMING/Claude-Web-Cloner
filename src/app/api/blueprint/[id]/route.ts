import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { blueprintSchema, reviewBlueprint } from "@/lib/blueprint/schema";

/** Read one blueprint. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const { data } = await supabase.from("game_blueprints").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AppError("not_found", "That plan does not exist.", 404);

    return NextResponse.json({ ok: true, blueprint: data });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Save a user's edit.
 *
 * The whole blueprint is re-validated on the way in. An edit arrives from a
 * browser, which makes it untrusted input no matter how it was produced.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const parsed = z.object({ blueprint: blueprintSchema }).parse(await request.json());

    const { data: existing } = await supabase
      .from("game_blueprints")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) throw new AppError("not_found", "That plan does not exist.", 404);
    if (existing.status === "approved") {
      throw new AppError("conflict", "An approved plan cannot be edited. Create a new version.", 409);
    }

    const issues = reviewBlueprint(parsed.blueprint);

    const { error } = await supabase
      .from("game_blueprints")
      .update({
        blueprint: parsed.blueprint as never,
        issues: issues as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new AppError("database_error", "Could not save that change.", 500);
    return NextResponse.json({ ok: true, issues });
  } catch (error) {
    return errorResponse(error);
  }
}
