"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelector } from "@/components/workspace/model-selector";
import { updateProfile } from "@/lib/actions/settings";
import type { ClientModel } from "@/lib/ai/registry";

/**
 * Profile and generation defaults.
 *
 * The model selector is the consequential control here — it decides what every
 * new project costs per message — so it gets a row of its own with the reason
 * stated, rather than sitting in the grid as if it were another text field.
 */
export function SettingsForm({
  email,
  displayName,
  robloxUsername,
  defaultModelId,
  models,
}: {
  email: string;
  displayName: string;
  robloxUsername: string;
  defaultModelId: string;
  models: ClientModel[];
}) {
  const [modelId, setModelId] = useState(defaultModelId);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="rounded-xl border border-border bg-surface"
      action={(formData) => {
        formData.set("defaultModelId", modelId);
        startTransition(async () => {
          const result = await updateProfile(formData);
          if (result.ok) toast.success("Settings saved");
          else toast.error(result.error ?? "Could not save.");
        });
      }}
    >
      <div className="border-b border-hairline px-5 py-4 sm:px-6">
        <h2 className="text-[0.9375rem] font-semibold">Profile</h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          How you are named in the app, and what new projects start on.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={displayName || email.split("@")[0]}
              maxLength={60}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="robloxUsername">Roblox username (optional)</Label>
            <Input
              id="robloxUsername"
              name="robloxUsername"
              defaultValue={robloxUsername}
              maxLength={30}
              placeholder="builderman"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Label>Default model for new projects</Label>
            <p className="mt-1 max-w-md text-[0.8125rem] leading-relaxed text-muted-foreground">
              Every project keeps its own model afterwards. Faster models cost fewer credits per
              message; the per-model spend is on the Credits page.
            </p>
          </div>
          <div className="shrink-0">
            <ModelSelector models={models} value={modelId} onChange={setModelId} align="end" />
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-hairline px-5 py-4 sm:px-6">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
