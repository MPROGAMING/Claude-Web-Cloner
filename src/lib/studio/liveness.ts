import { CONNECTION_STALE_MS } from "@/lib/studio/protocol";

/**
 * A Studio connection is "live" if the plugin polled recently. Kept out of
 * component bodies so the clock read stays outside of render.
 */
export function isStudioLive(
  connection: { status: string; last_seen_at: string | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!connection || connection.status !== "connected" || !connection.last_seen_at) {
    return false;
  }
  return now - new Date(connection.last_seen_at).getTime() < CONNECTION_STALE_MS;
}

export function liveProjectIds(
  connections: { project_id: string; status: string; last_seen_at: string | null }[],
  now: number = Date.now(),
): Set<string> {
  return new Set(
    connections.filter((c) => isStudioLive(c, now)).map((c) => c.project_id),
  );
}
