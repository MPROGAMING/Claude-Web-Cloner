import type { SoundName } from "@/lib/sound";

/**
 * What a notification *is*, as pure functions.
 *
 * Deliberately free of `server-only` and of any database import, for the same
 * reason `lib/agent/types.ts` is: the copy, the click-through target, the
 * dedupe key and the sound are all decisions, and decisions should be testable
 * without a Supabase client. `lib/notifications/service.ts` is the impure edge
 * that writes what these produce.
 */

export const NOTIFICATION_KINDS = [
  "run_completed",
  "run_failed",
  "changeset_awaiting_approval",
  "credits_low",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationDraft {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Where the row goes when clicked. Always an app-relative path. */
  href: string;
  /**
   * Identity of the underlying event, unique per account. The database has a
   * unique index on it, so emitting the same event twice writes one row.
   */
  dedupeKey: string;
  projectId?: string | null;
  runId?: string | null;
  changesetId?: string | null;
}

interface RunContext {
  runId: string;
  projectId: string;
  projectName: string;
}

function files(count: number): string {
  return `${count} file${count === 1 ? "" : "s"}`;
}

/**
 * A build finished and there is nothing left to decide.
 *
 * Goes to the project rather than the run record: the thing that happened is
 * the code, and that is where the code is.
 */
export function runCompleted(
  run: RunContext & { operationCount?: number },
): NotificationDraft {
  const changed = run.operationCount ?? 0;
  return {
    kind: "run_completed",
    title: "Build finished",
    body: changed > 0 ? `${run.projectName} · ${files(changed)} changed` : run.projectName,
    href: `/projects/${run.projectId}`,
    dedupeKey: `run:${run.runId}:completed`,
    projectId: run.projectId,
    runId: run.runId,
  };
}

/**
 * A build stopped.
 *
 * `errorCategory` is a controlled server-side vocabulary — "provider",
 * "generation", "validation" — never a provider message and never model output,
 * so it is safe to put in front of the user verbatim.
 */
export function runFailed(
  run: RunContext & { errorCategory?: string | null },
): NotificationDraft {
  return {
    kind: "run_failed",
    title: "Build stopped",
    body: run.errorCategory
      ? `${run.projectName} · stopped during ${run.errorCategory}`
      : run.projectName,
    // The run record is what explains a failure, so this one goes to the
    // history and opens the run that failed.
    href: `/activity?run=${run.runId}`,
    dedupeKey: `run:${run.runId}:failed`,
    projectId: run.projectId,
    runId: run.runId,
  };
}

/** The agent has staged changes and is waiting on a human. */
export function changesetAwaitingApproval(
  run: RunContext & { changesetId: string; operationCount: number },
): NotificationDraft {
  return {
    kind: "changeset_awaiting_approval",
    title: "Changes need your approval",
    body: `${run.projectName} · ${files(run.operationCount)} proposed`,
    href: `/projects/${run.projectId}`,
    dedupeKey: `changeset:${run.changesetId}:approval`,
    projectId: run.projectId,
    runId: run.runId,
    changesetId: run.changesetId,
  };
}

/**
 * Balance bands, warned once each.
 *
 * 50 sits above `MINIMUM_BALANCE_TO_START` (25) so the warning arrives while
 * there is still enough to finish something, rather than as an explanation of
 * a refusal.
 */
export const LOW_BALANCE_BANDS = [200, 50, 0] as const;

export type LowBalanceBand = (typeof LOW_BALANCE_BANDS)[number];

export function lowBalanceBand(balance: number): LowBalanceBand | null {
  if (!Number.isFinite(balance)) return null;
  if (balance <= 0) return 0;
  if (balance <= 50) return 50;
  if (balance <= 200) return 200;
  return null;
}

/**
 * Low balance.
 *
 * The dedupe key carries the band *and* the day. Band alone would warn once and
 * then never again, including after a top-up and a second slide down; no key at
 * all would warn on every turn of a long session. One nudge per band per day is
 * the shape that is useful in both cases.
 */
export function creditsLow(params: {
  balance: number;
  band: LowBalanceBand;
  now?: Date;
}): NotificationDraft {
  const day = (params.now ?? new Date()).toISOString().slice(0, 10);
  const out = params.band === 0;

  return {
    kind: "credits_low",
    title: out ? "You are out of credits" : "Credits running low",
    body: out
      ? "Top up to keep building."
      : `${Math.max(0, Math.floor(params.balance))} credits left.`,
    href: "/credits",
    dedupeKey: `credits:low:${params.band}:${day}`,
  };
}

/**
 * The one sound a batch of new notifications gets.
 *
 * A poll can surface several at once and playing all of them would be a chord
 * of unrelated events, so the most urgent kind wins. `credits_low` is silent on
 * purpose: it is information, not an interruption, and it always arrives
 * alongside the run notification that already made a noise.
 */
const SOUND_BY_KIND: Record<NotificationKind, SoundName | null> = {
  run_failed: "error",
  changeset_awaiting_approval: "approve",
  run_completed: "complete",
  credits_low: null,
};

const SOUND_PRIORITY: NotificationKind[] = [
  "run_failed",
  "changeset_awaiting_approval",
  "run_completed",
];

export function soundForArrivals(kinds: readonly NotificationKind[]): SoundName | null {
  for (const kind of SOUND_PRIORITY) {
    if (kinds.includes(kind)) return SOUND_BY_KIND[kind];
  }
  return null;
}
