/**
 * Which run endings this tab has already made a noise about.
 *
 * The workspace chimes the moment a stream ends, because that is when the user
 * watching it wants to hear it. The bell then polls the same event a few
 * seconds later and would chime again — the same class of bug as the Studio
 * panel firing its connection sound on every poll, just slower.
 *
 * So the workspace records that it announced a project's run locally, and the
 * bell skips the sound (never the badge) for a notification that lands inside
 * the window. Module scope is the right scope: this is one tab's ephemeral
 * memory, it never renders, and nothing should re-render when it changes.
 */

const announcedAt = new Map<string, number>();

/** How long after a local chime a matching notification stays silent. */
const WINDOW_MS = 120_000;

export function markRunAnnounced(projectId: string, at: number = Date.now()): void {
  announcedAt.set(projectId, at);
}

export function wasRunAnnounced(
  projectId: string | null | undefined,
  notifiedAt: string,
  now: number = Date.now(),
): boolean {
  if (!projectId) return false;

  const local = announcedAt.get(projectId);
  if (local === undefined) return false;

  // Expired local marks are dropped so a project announced an hour ago does not
  // silence tonight's build.
  if (now - local > WINDOW_MS) {
    announcedAt.delete(projectId);
    return false;
  }

  const created = new Date(notifiedAt).getTime();
  if (Number.isNaN(created)) return false;

  // The notification is written server-side as the run closes, which is the
  // same moment the client learns the stream ended — within a couple of
  // seconds either way.
  return Math.abs(created - local) <= WINDOW_MS;
}

/** Test seam. */
export function resetAnnounced(): void {
  announcedAt.clear();
}
