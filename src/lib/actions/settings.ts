"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/queries";
import { toAppError } from "@/lib/errors";
import { getModel } from "@/lib/ai/registry";
import type { ActionResult } from "@/lib/actions/projects";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  robloxUsername: z.string().trim().max(30).optional().or(z.literal("")),
  defaultModelId: z.string().max(120),
});

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();

    const parsed = profileSchema.safeParse({
      displayName: formData.get("displayName"),
      robloxUsername: formData.get("robloxUsername") ?? "",
      defaultModelId: formData.get("defaultModelId"),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    }

    const model = getModel(parsed.data.defaultModelId);
    if (!model) return { ok: false, error: "That model is not available." };

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        roblox_username: parsed.data.robloxUsername || null,
        default_model_id: model.id,
      })
      .eq("id", user.id);

    if (error) return { ok: false, error: "Could not save your settings." };

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}
