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
      className="rounded-xl border border-border bg-surface p-6"
      action={(formData) => {
        formData.set("defaultModelId", modelId);
        startTransition(async () => {
          const result = await updateProfile(formData);
          if (result.ok) toast.success("Settings saved");
          else toast.error(result.error ?? "Could not save.");
        });
      }}
    >
      <h2 className="text-sm font-semibold">Profile</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

      <div className="mt-4 space-y-1.5">
        <Label>Default model for new projects</Label>
        <div>
          <ModelSelector models={models} value={modelId} onChange={setModelId} align="start" />
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t border-hairline pt-5">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
