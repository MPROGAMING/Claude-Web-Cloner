import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { EmptyState } from "@/components/app/empty-state";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { getCreditBalance, getProfile, listActivity, listProjects, requireUser } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const { user } = await requireUser();
  const [profile, balance, events, projects] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listActivity({ limit: 120 }),
    listProjects(),
  ]);

  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  // Group by calendar day so a long feed stays scannable.
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const day = new Date(event.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }

  return (
    <>
      <Topbar balance={balance?.balance ?? 0} email={user.email ?? ""} displayName={profile?.display_name} />

      <PageBody className="max-w-3xl">
        <PageHeader
          title="Activity"
          description="Every file the AI wrote, every validation it ran, and every action sent to Roblox Studio."
        />

        {events.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={Activity}
            title="No activity yet"
            description="Once you start a build, each step the AI takes is recorded here."
            action={<NewProjectDialog />}
          />
        ) : (
          <div className="mt-9 space-y-9">
            {[...groups.entries()].map(([day, dayEvents]) => (
              <section key={day}>
                <h2 className="label-meta sticky top-14 z-10 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">
                  {day}
                </h2>
                <div className="mt-2">
                  <ActivityTimeline
                    events={dayEvents.map((event) => ({
                      ...event,
                      summary: event.project_id
                        ? `${event.summary} · ${projectNames.get(event.project_id) ?? "project"}`
                        : event.summary,
                    }))}
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
