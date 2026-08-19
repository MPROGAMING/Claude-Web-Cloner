import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  LOW_BALANCE_BANDS,
  NOTIFICATION_KINDS,
  changesetAwaitingApproval,
  creditsLow,
  lowBalanceBand,
  runCompleted,
  runFailed,
  soundForArrivals,
} from "@/lib/notifications/events";
import {
  markRunAnnounced,
  resetAnnounced,
  wasRunAnnounced,
} from "@/lib/notifications/announced";
import { MINIMUM_BALANCE_TO_START } from "@/lib/credits/pricing";

/**
 * Notifications.
 *
 * The properties worth pinning are the ones about *not* doing something: not
 * telling someone the same thing twice, not chiming for an event they already
 * heard, and not going silent forever once a threshold has been crossed. Those
 * are the failure modes that make a notification system worse than none.
 */

const RUN = {
  runId: "33333333-3333-4333-8333-333333333333",
  projectId: "22222222-2222-4222-8222-222222222222",
  projectName: "Tower Defence",
};

describe("notification drafts", () => {
  it("gives every kind a click-through target inside the app", () => {
    const drafts = [
      runCompleted({ ...RUN, operationCount: 2 }),
      runFailed({ ...RUN, errorCategory: "provider" }),
      changesetAwaitingApproval({ ...RUN, changesetId: "cs-1", operationCount: 3 }),
      creditsLow({ balance: 10, band: 50 }),
    ];

    for (const draft of drafts) {
      expect(NOTIFICATION_KINDS).toContain(draft.kind);
      expect(draft.href.startsWith("/")).toBe(true);
      expect(draft.href).not.toContain("//");
      expect(draft.title.length).toBeGreaterThan(0);
      expect(draft.dedupeKey.length).toBeGreaterThan(0);
    }
  });

  it("sends a finished build to the project and a failed one to its record", () => {
    expect(runCompleted({ ...RUN, operationCount: 1 }).href).toBe(`/projects/${RUN.projectId}`);
    expect(changesetAwaitingApproval({ ...RUN, changesetId: "cs", operationCount: 1 }).href).toBe(
      `/projects/${RUN.projectId}`,
    );
    // A failure is explained by the run record, and the link opens that run.
    expect(runFailed({ ...RUN }).href).toBe(`/activity?run=${RUN.runId}`);
  });

  it("pluralises file counts", () => {
    expect(runCompleted({ ...RUN, operationCount: 1 }).body).toContain("1 file changed");
    expect(runCompleted({ ...RUN, operationCount: 4 }).body).toContain("4 files changed");
  });

  it("omits the count when a run changed nothing", () => {
    const draft = runCompleted({ ...RUN, operationCount: 0 });
    expect(draft.body).toBe(RUN.projectName);
    expect(draft.body).not.toContain("file");
  });
});

describe("dedupe keys", () => {
  /**
   * The chat route can close a run from either onError or onEnd and both may
   * fire. An in-process boolean is not the guarantee — the key is, because the
   * database has a unique index on it.
   */
  it("are stable for the same event and distinct across events", () => {
    expect(runCompleted({ ...RUN }).dedupeKey).toBe(runCompleted({ ...RUN }).dedupeKey);
    expect(runFailed({ ...RUN }).dedupeKey).toBe(runFailed({ ...RUN }).dedupeKey);

    // A run that completed and a run that failed are different events even
    // though they share a run id.
    expect(runCompleted({ ...RUN }).dedupeKey).not.toBe(runFailed({ ...RUN }).dedupeKey);
  });

  it("separates one run from another", () => {
    const other = { ...RUN, runId: "44444444-4444-4444-8444-444444444444" };
    expect(runCompleted(RUN).dedupeKey).not.toBe(runCompleted(other).dedupeKey);
  });

  it("keys a change set on the change set, not the run", () => {
    const a = changesetAwaitingApproval({ ...RUN, changesetId: "cs-a", operationCount: 1 });
    const b = changesetAwaitingApproval({ ...RUN, changesetId: "cs-b", operationCount: 1 });
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
  });
});

describe("low balance", () => {
  it("warns before the balance is too low to start a generation", () => {
    // 50 sits above the pre-flight floor, so the warning arrives while there is
    // still enough left to finish something.
    expect(lowBalanceBand(MINIMUM_BALANCE_TO_START)).not.toBeNull();
    expect(LOW_BALANCE_BANDS.some((band) => band > MINIMUM_BALANCE_TO_START)).toBe(true);
  });

  it("says nothing at a healthy balance", () => {
    expect(lowBalanceBand(201)).toBeNull();
    expect(lowBalanceBand(50_000)).toBeNull();
  });

  it("bands downward as the balance falls", () => {
    expect(lowBalanceBand(200)).toBe(200);
    expect(lowBalanceBand(51)).toBe(200);
    expect(lowBalanceBand(50)).toBe(50);
    expect(lowBalanceBand(1)).toBe(50);
    expect(lowBalanceBand(0)).toBe(0);
    expect(lowBalanceBand(-5)).toBe(0);
  });

  it("ignores a balance that is not a number", () => {
    expect(lowBalanceBand(Number.NaN)).toBeNull();
  });

  /**
   * Band alone would warn once and then never again, including after a top-up
   * and a second slide down. No key at all would warn on every turn of a long
   * session. One nudge per band per day is the shape that survives both.
   */
  it("nudges once per band per day", () => {
    const monday = new Date("2026-08-17T09:00:00Z");
    const mondayLater = new Date("2026-08-17T23:30:00Z");
    const tuesday = new Date("2026-08-18T09:00:00Z");

    const a = creditsLow({ balance: 40, band: 50, now: monday });
    const b = creditsLow({ balance: 30, band: 50, now: mondayLater });
    const c = creditsLow({ balance: 30, band: 50, now: tuesday });
    const lower = creditsLow({ balance: 0, band: 0, now: monday });

    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(a.dedupeKey).not.toBe(c.dedupeKey);
    expect(a.dedupeKey).not.toBe(lower.dedupeKey);
  });

  it("says you are out rather than counting down to zero", () => {
    expect(creditsLow({ balance: 0, band: 0 }).title).toMatch(/out of credits/i);
    expect(creditsLow({ balance: 30, band: 50 }).body).toContain("30");
  });
});

describe("sound selection", () => {
  it("plays one sound for a batch, and the most urgent one", () => {
    expect(soundForArrivals(["run_completed", "run_failed"])).toBe("error");
    expect(soundForArrivals(["run_completed", "changeset_awaiting_approval"])).toBe("approve");
    expect(soundForArrivals(["run_completed"])).toBe("complete");
  });

  it("stays silent for information", () => {
    // A low balance always rides alongside a run that already made a noise.
    expect(soundForArrivals(["credits_low"])).toBeNull();
    expect(soundForArrivals([])).toBeNull();
  });
});

/**
 * The double-chime guard.
 *
 * The workspace chimes the instant its stream ends; the bell polls the same
 * event seconds later. Without this the product would announce every single
 * build twice — the same shape as the Studio panel bug where a memoized
 * callback read frozen state and re-fired its sound on every poll.
 */
describe("local announcements", () => {
  const PROJECT = RUN.projectId;
  const now = Date.UTC(2026, 7, 19, 12, 0, 0);
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

  it("silences a notification for a run this tab already announced", () => {
    resetAnnounced();
    markRunAnnounced(PROJECT, now);
    expect(wasRunAnnounced(PROJECT, iso(1500), now + 1500)).toBe(true);
  });

  it("does not silence a different project", () => {
    resetAnnounced();
    markRunAnnounced(PROJECT, now);
    expect(wasRunAnnounced("another-project", iso(1000), now + 1000)).toBe(false);
  });

  it("does not silence anything when nothing was announced", () => {
    resetAnnounced();
    expect(wasRunAnnounced(PROJECT, iso(0), now)).toBe(false);
    expect(wasRunAnnounced(null, iso(0), now)).toBe(false);
  });

  it("expires, so this morning's build cannot mute tonight's", () => {
    resetAnnounced();
    markRunAnnounced(PROJECT, now);
    const hourLater = now + 60 * 60 * 1000;
    expect(wasRunAnnounced(PROJECT, iso(60 * 60 * 1000), hourLater)).toBe(false);
  });

  it("ignores an unparseable timestamp rather than silencing on it", () => {
    resetAnnounced();
    markRunAnnounced(PROJECT, now);
    expect(wasRunAnnounced(PROJECT, "not a date", now)).toBe(false);
  });
});
