import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationRow } from "@/lib/supabase/types";
import { logger } from "@/lib/logger";
import type { NotificationDraft } from "@/lib/notifications/events";

/**
 * Writing and reading the inbox.
 *
 * Everything here uses the *user's* client, so RLS decides what may be written
 * — same rule as `lib/agent/audit.ts`. A notification that could be inserted
 * into another tenant's inbox would be a way to put arbitrary text and an
 * arbitrary link in front of someone else, which is worse than it sounds given
 * the row renders as a clickable link.
 *
 * `notify` never throws. It is called from the chat route's onEnd, next to
 * credit charging and run accounting; a failed notification must not be the
 * thing that loses a completed build.
 */

type Client = SupabaseClient<Database>;

/** Postgres unique violation — the dedupe index doing its job. */
const UNIQUE_VIOLATION = "23505";

/** How many rows the inbox ever shows. There is no pruning job; this is it. */
export const INBOX_LIMIT = 30;

export interface Inbox {
  unread: number;
  items: NotificationRow[];
}

/**
 * Record one event. Returns whether a new row was written — false covers both
 * "already notified" and "could not notify", because neither is actionable at
 * the call site.
 */
export async function notify(
  supabase: Client,
  userId: string,
  draft: NotificationDraft,
): Promise<boolean> {
  const { error } = await supabase.from("notifications").insert({
    owner_id: userId,
    project_id: draft.projectId ?? null,
    run_id: draft.runId ?? null,
    changeset_id: draft.changesetId ?? null,
    kind: draft.kind,
    title: draft.title.slice(0, 200),
    body: draft.body.slice(0, 500),
    href: draft.href,
    dedupe_key: draft.dedupeKey,
  });

  if (!error) return true;

  // Both handlers that close a run may fire, and both may notify. That is the
  // expected path, not a fault.
  if (error.code === UNIQUE_VIOLATION) return false;

  logger.warn("notification.insert_failed", {
    kind: draft.kind,
    dedupeKey: draft.dedupeKey,
    error: error.message,
  });
  return false;
}

/**
 * The inbox and the badge in one read pair.
 *
 * The unread count is a separate `head` count rather than a filter over the
 * fetched page: the page is capped, and a badge that silently stopped counting
 * past 30 would under-report exactly when it matters most.
 */
export async function getInbox(
  supabase: Client,
  userId: string,
  limit = INBOX_LIMIT,
): Promise<Inbox> {
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("read_at", null),
  ]);

  if (error || countError) {
    logger.warn("notification.read_failed", {
      error: error?.message ?? countError?.message,
    });
  }

  return { unread: count ?? 0, items: data ?? [] };
}

export async function markRead(
  supabase: Client,
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("owner_id", userId)
    .is("read_at", null)
    .in("id", ids);

  if (error) logger.warn("notification.mark_read_failed", { error: error.message });
}

export async function markAllRead(supabase: Client, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("owner_id", userId)
    .is("read_at", null);

  if (error) logger.warn("notification.mark_all_read_failed", { error: error.message });
}
