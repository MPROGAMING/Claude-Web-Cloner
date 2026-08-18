import type { Metadata } from "next";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { TemplateGallery } from "@/components/app/template-gallery";
import { TEMPLATES } from "@/lib/templates";
import { getCreditBalance, getProfile, requireUser } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { user } = await requireUser();
  const [profile, balance] = await Promise.all([getProfile(), getCreditBalance()]);

  return (
    <>
      <Topbar
        balance={balance?.balance ?? 0}
        email={user.email ?? ""}
        displayName={profile?.display_name}
      />

      <PageBody>
        <PageHeader
          title="Templates"
          description={`${TEMPLATES.length} starting points across every popular Roblox genre. Each one is a well-specified prompt — the AI generates fresh code against current Roblox APIs, so nothing here is frozen boilerplate.`}
        />
        <TemplateGallery className="mt-8" />
      </PageBody>
    </>
  );
}
