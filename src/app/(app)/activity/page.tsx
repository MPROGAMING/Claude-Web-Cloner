import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody } from "@/components/app/page-header";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { EmptyState } from "@/components/app/empty-state";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { BrickText } from "@/components/marketing/brick-text";
import { getCreditBalance, getProfile, listActivity, listProjects, requireUser } from "@/lib/data/queries";
import { formatCredits } from "@/lib/credits/pricing";
import { relativeTime } from "@/lib/format";
import {
  RunHistory,
  type RunIssue,
  type RunRow,
  type RunToolCall,
} from "@/components/app/run-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Activity" };

/** Per-run cap, so one pathological run cannot crowd out every other run's. */
const TOOLS_PER_RUN = 25;

/**
 * The build log.
 *
 * Two records of the same work at two resolutions: the agent runs, which are
 * the unit a creator actually thinks in ("what did that build do?"), and the
 * raw event feed underneath them. Runs lead because the feed is a firehose and
 * a run is a decision.
 *
 * The plate carries only what can be read at a glance — how much was built,
 * what it cost, and whether anything is waiting on you. Everything below it is
 * the detail, on the page's own surface where dense rows belong.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  // searchParams is async in Next 16.
  const [{ run: focusRunId }, { supabase, user }] = await Promise.all([
    searchParams,
    requireUser(),
  ]);
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
      "id, project_id, state, mode, classification, model_id, step_count, repair_attempts, tool_calls, input_tokens, output_tokens, credits_charged, retrieval_ms, generation_ms, validation_ms, error_category, created_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(40);

  const runIds = (runRows ?? []).map((r) => r.id);
  const [{ data: changesets }, { data: steps }, { data: toolCalls }] = await Promise.all([
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
    // The tool call table has existed since Step 7 and only its row *count*
    // was ever surfaced. These rows are small by design — a name, a verdict, a
    // duration and a one-line summary, with arguments and results deliberately
    // never stored — so reading them alongside the runs is cheap.
    runIds.length
      ? supabase
          .from("agent_tool_calls")
          .select("run_id, tool_name, ok, duration_ms, summary, created_at")
          .in("run_id", runIds)
          .order("created_at")
          .limit(600)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const changesetByRun = new Map((changesets ?? []).map((c) => [c.run_id, c]));

  const toolsByRun = new Map<string, RunToolCall[]>();
  for (const call of toolCalls ?? []) {
    const list = toolsByRun.get(call.run_id) ?? [];
    if (list.length >= TOOLS_PER_RUN) continue;
    list.push({
      name: call.tool_name,
      ok: call.ok,
      durationMs: call.duration_ms,
      summary: call.summary,
    });
    toolsByRun.set(call.run_id, list);
  }
  const stepsByRun = new Map<string, { state: string; reason: string }[]>();
  for (const step of steps ?? []) {
    const list = stepsByRun.get(step.run_id) ?? [];
    list.push({ state: step.new_state, reason: step.reason });
    stepsByRun.set(step.run_id, list);
  }

  const runs: RunRow[] = (runRows ?? []).map((r) => {
    const cs = changesetByRun.get(r.id);
    const issues = cs ? issuesOf(cs.issues) : [];
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
      validationMs: r.validation_ms,
      errorCategory: r.error_category,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      changeset: cs
        ? {
            id: cs.id,
            status: cs.status,
            operationCount: cs.operation_count,
            hasErrors: issues.some((i) => i.severity === "error"),
            issues,
          }
        : null,
      steps: stepsByRun.get(r.id) ?? [],
      tools: toolsByRun.get(r.id) ?? [],
    };
  });

  // Summary, all of it arithmetic over the rows above — nothing modelled.
  const awaiting = runs.filter((r) => r.changeset?.status === "pending_approval");
  const filesChanged = runs.reduce((sum, r) => sum + (r.changeset?.operationCount ?? 0), 0);
  const creditsSpent = runs.reduce((sum, r) => sum + r.creditsCharged, 0);
  const toolsRun = runs.reduce((sum, r) => sum + r.toolCalls, 0);
  const lastRun = runs[0];

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

      <PageBody className="max-w-5xl">
        <section className="plate relative overflow-hidden rounded-[1.5rem] px-5 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-7">
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.38] [--stud-pitch:38px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.075),transparent_34%,rgb(0_0_0/0.16))]"
          />

          <div className="relative">
            <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--signal)]" />
              Build log
            </p>

            <h1 className="mt-4 font-display text-[clamp(2.25rem,7vw,3.5rem)] font-semibold uppercase leading-[0.9]">
              <BrickText>Activity</BrickText>
            </h1>

            <div className="mount mt-6 rounded-2xl px-4 py-4 sm:px-6 sm:py-5">
              <p className="max-w-[46rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
                Every build Blockwright has run for you — what it made, whether it worked, and what
                it cost. The tool-by-tool replay is inside each row.
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
                <Figure label="Files changed" value={filesChanged.toLocaleString("en-US")} />
                <Figure label="Credits spent" value={formatCredits(creditsSpent)} />
                <Figure label="Tools run" value={toolsRun.toLocaleString("en-US")} />
                <Figure
                  label="Last build"
                  value={lastRun ? relativeTime(lastRun.createdAt) : "—"}
                />
              </dl>
            </div>

            {/* The one thing on this page that is a decision rather than a
                record, so it gets the ember and the only link on the plate. */}
            {awaiting.length > 0 && (
              <div className="mount mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--ember)]/45 px-4 py-3.5">
                <p className="min-w-0 flex-1 text-[0.875rem] leading-relaxed">
                  <span className="font-semibold">
                    {awaiting.length} change set{awaiting.length === 1 ? "" : "s"}
                  </span>{" "}
                  {awaiting.length === 1 ? "is" : "are"} waiting for your approval
                  {awaiting.length === 1 && ` in ${awaiting[0].projectName}`}. Nothing reaches your
                  place until you say so.
                </p>
                <Link
                  href={awaiting.length === 1 ? `/projects/${awaiting[0].projectId}` : "/projects"}
                  className="brick tap-row inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-semibold text-[var(--ember-ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]"
                >
                  Review {awaiting.length === 1 ? "the changes" : "in projects"}
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <Tabs defaultValue="runs" className="mt-8">
          <TabsList>
            <TabsTrigger value="runs">Builds ({runs.length})</TabsTrigger>
            <TabsTrigger value="feed">Everything ({events.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="mt-6">
            <RunHistory runs={runs} initialOpenRunId={focusRunId} />
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
              <div className="space-y-8">
                {[...groups.entries()].map(([day, dayEvents]) => (
                  <section key={day}>
                    <h2 className="label-meta sticky top-14 z-10 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">
                      {day}
                      <span className="ml-2 normal-case tracking-normal opacity-70">
                        {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                      </span>
                    </h2>
                    <div className="mt-2 rounded-xl border border-border bg-surface px-4 py-4">
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-meta leading-[1.4]">{label}</dt>
      <dd className="mt-1 truncate font-display text-xl font-semibold tabular-nums sm:text-2xl">
        {value}
      </dd>
    </div>
  );
}

/**
 * `issues` is jsonb, so it arrives as `unknown` and has to be narrowed before
 * anything renders it. Rows without a message are dropped rather than rendered
 * blank.
 */
function issuesOf(raw: unknown): RunIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => typeof item.message === "string" && item.message.length > 0)
    .map((item) => ({
      severity: typeof item.severity === "string" ? item.severity : "warning",
      rule: typeof item.rule === "string" ? item.rule : "",
      message: String(item.message),
      path: typeof item.path === "string" ? item.path : undefined,
    }));
}
