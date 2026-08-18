import type { Metadata } from "next";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings-form";
import { getCreditBalance, getProfile, requireUser } from "@/lib/data/queries";
import { listClientModels } from "@/lib/ai/providers";
import { DEFAULT_MODEL_ID } from "@/lib/ai/registry";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireUser();
  const [profile, balance, catalog] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listClientModels(),
  ]);
  const models = catalog.models;

  return (
    <>
      <Topbar
        balance={balance?.balance ?? 0}
        email={user.email ?? ""}
        displayName={profile?.display_name}
      />

      <PageBody className="max-w-3xl">
        <PageHeader title="Settings" description="Your profile and generation defaults." />

        <div className="mt-8 space-y-6">
          <SettingsForm
            email={user.email ?? ""}
            displayName={profile?.display_name ?? ""}
            robloxUsername={profile?.roblox_username ?? ""}
            defaultModelId={profile?.default_model_id ?? DEFAULT_MODEL_ID}
            models={models}
          />

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold">Account</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-hairline pb-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-hairline pb-3">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="capitalize">{profile?.plan ?? "free"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Member since</dt>
                <dd>{profile ? formatDateTime(profile.created_at) : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold">Roblox Studio plugin</h2>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
              Pairing happens per project, from the Studio panel inside a workspace. Install the
              plugin once and it remembers each project it has been paired with.
            </p>
            <ol className="mt-4 space-y-2 text-[0.8125rem] text-muted-foreground">
              <li>
                1. Download <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">roblox-plugin/Blockwright.server.lua</code>{" "}
                from the repository.
              </li>
              <li>
                2. Drop it into your local Roblox{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Plugins</code> folder.
              </li>
              <li>3. Open a project here, click Connect Studio, and paste the code.</li>
            </ol>
          </section>
        </div>
      </PageBody>
    </>
  );
}
