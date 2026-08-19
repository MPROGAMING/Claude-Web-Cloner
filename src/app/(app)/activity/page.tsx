import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { EmptyState } from "@/components/app/empty-state";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { getCreditBalance, getProfile, listActivity, listProjects, requireUser } from "@/lib/data/queries";
import { RunHistory, type RunRow } from "@/components/app/run-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const { supabase, user } = await requireUser();
  const [profile, balance, events, projects] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listActivity({ limit: 120 }),
    listProjects(),
  ]);

  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  // Agent runs. Four tables have been recording these since the agent shipped
  // and nothing ever surfaced them, so a creator had no way to ask what a run
  // did, whether it worked, or what it cost.
  const { data: runRows } = await supabase
    .from("agent_runs")
    .select(
      "id, project_id, state, mode, classification, model_id, step_count, repair_attempts, tool_calls, input_tokens, output_tokens, credits_charged, retrieval_ms, generation_ms, error_category, created_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(40);

  const runIds = (runRows ?? []).map((r) => r.id);
  const [{ data: changesets }, { data: steps }] = await Promise.all([
    runIds.length
      ? supabase
          .from("agent_changesets")
          .select("id, run_id, status, operation_count, issues")
          .in("run_id", runIds)
      : Promise.resolve({ data: [] as never[] }),
    runIds.length
      ? supabase
          .from("agent_steps")
          .select("run_id, step_index, new_state, reason")
          .in("run_id", runIds)
          .order("step_index")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const changesetByRun = new Map((changesets ?? []).map((c) => [c.run_id, c]));
  const stepsByRun = new Map<string, { state: string; reason: string }[]>();
  for (const step of steps ?? []) {
    const list = stepsByRun.get(step.run_id) ?? [];
    list.push({ state: step.new_state, reason: step.reason });
    stepsByRun.set(step.run_id, list);
  }

  const runs: RunRow[] = (runRows ?? []).map((r) => {
    const cs = changesetByRun.get(r.id);
    return {
      id: r.id,
      projectId: r.project_id,
      projectName: projectNames.get(r.project_id) ?? "Deleted project",
      state: r.state,
      mode: r.mode,
      classification: r.classification,
      modelId: r.model_id,
      stepCount: r.step_count,
      repairAttempts: r.repair_attempts,
      toolCalls: r.tool_calls,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      creditsCharged: r.credits_charged,
      retrievalMs: r.retrieval_ms,
      generationMs: r.generation_ms,
      errorCategory: r.error_category,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      changeset: cs
        ? {
            id: cs.id,
            status: cs.status,
            operationCount: cs.operation_count,
            hasErrors: ((cs.issues ?? []) as { severity?: string }[]).some(
              (i) => i.severity === "error",
            ),
          }
        : null,
      steps: stepsByRun.get(r.id) ?? [],
    };
  });

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
          description="Every build Blockwright has run for you — what it made, whether it worked, and what it cost."
        />

        <Tabs defaultValue="runs" className="mt-8">
          <TabsList>
            <TabsTrigger value="runs">Builds ({runs.length})</TabsTrigger>
            <TabsTrigger value="feed">Everything ({events.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="mt-6">
            <RunHistory runs={runs} />
          </TabsContent>

          <TabsContent value="feed" className="mt-6">
            {events.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Once you start a build, each step the AI takes is recorded here."
                action={<NewProjectDialog />}
              />
            ) : (
              <div className="space-y-9">
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
          </TabsContent>
        </Tabs>

      </PageBody>
    </>
  );
}
