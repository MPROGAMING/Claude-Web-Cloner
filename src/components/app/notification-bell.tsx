"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Check, CheckCheck, Coins, ShieldQuestion } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { relativeTime } from "@/lib/format";
import { playSound } from "@/lib/sound";
import { soundForArrivals, type NotificationKind } from "@/lib/notifications/events";
import { wasRunAnnounced } from "@/lib/notifications/announced";
import { cn } from "@/lib/utils";

/**
 * The inbox.
 *
 * A build takes minutes and people leave, so the thing that tells them it
 * finished has to work from any page. Polling rather than realtime: one cheap
 * indexed read every 20 seconds needs no socket, no extra service and no
 * reconnection logic, and the cost of being 20 seconds late on a five-minute
 * build is nothing. Polling stops entirely while the tab is hidden — this is
 * mounted on every page in the app, so leaving it running in a background tab
 * would be a battery drain with no reader.
 */

interface Item {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface Inbox {
  unread: number;
  items: Item[];
}

const POLL_MS = 20_000;

const ICON: Record<NotificationKind, typeof Bell> = {
  run_completed: Check,
  run_failed: AlertTriangle,
  changeset_awaiting_approval: ShieldQuestion,
  credits_low: Coins,
};

const TONE: Record<NotificationKind, string> = {
  run_completed: "text-[var(--success)]",
  run_failed: "text-[var(--danger)]",
  changeset_awaiting_approval: "text-[var(--ember)]",
  credits_low: "text-[var(--warning)]",
};

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);

  /**
   * Ids that were already unread last time we looked.
   *
   * A ref, not state, and deliberately not a dependency of `refresh`: a
   * callback memoized on state reads that state frozen at its first render, and
   * an "have we seen this?" guard that is permanently true (or permanently
   * false) is how you end up with a sound firing on every poll forever. `null`
   * means "we have not looked yet", which is what stops the whole backlog
   * chiming on first paint.
   */
  const seen = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;

      const data: { unread: number; notifications: Item[] } = await response.json();
      setInbox({ unread: data.unread, items: data.notifications });

      const unread = data.notifications.filter((item) => !item.readAt);

      if (seen.current === null) {
        // First look. Anything already waiting is history, not news.
        seen.current = new Set(unread.map((item) => item.id));
        return;
      }

      const arrivals = unread.filter((item) => !seen.current?.has(item.id));
      // Rebuilding rather than adding bounds the set to the current page, and
      // an id that has left the unread page can never come back to it.
      seen.current = new Set(unread.map((item) => item.id));
      if (arrivals.length === 0) return;

      // Whatever the workspace already chimed for stays silent here; the badge
      // still counts it.
      const audible = arrivals.filter(
        (item) => !wasRunAnnounced(item.projectId, item.createdAt),
      );
      const sound = soundForArrivals(audible.map((item) => item.kind));
      if (sound) playSound(sound);
    } catch {
      // A blip must not empty a good inbox; the next poll corrects it.
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;

    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => void refresh(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        // Coming back is exactly when the answer is most likely to have
        // changed, so read before waiting out another interval.
        void refresh();
        start();
      }
    };

    // One read on mount even if hidden, so the badge is right the moment the
    // tab is looked at and `seen` is primed against the existing backlog. From
    // a task rather than the effect body, so first paint is not waiting on it.
    const initial = window.setTimeout(() => void refresh(), 0);
    // A page opened into a background tab (cmd-click, session restore) must not
    // start an interval nobody is watching.
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const markRead = useCallback(async (body: { ids?: string[]; all?: boolean }) => {
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return;
      const data: { unread: number } = await response.json();
      setInbox((current) => ({
        unread: data.unread,
        items: current.items.map((item) =>
          body.all || body.ids?.includes(item.id)
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      }));
    } catch {
      // The next poll re-reads the truth.
    }
  }, []);

  const openItem = (item: Item) => {
    setOpen(false);
    if (!item.readAt) void markRead({ ids: [item.id] });
    if (item.href) router.push(item.href);
  };

  const { unread, items } = inbox;
  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications, none unread"
            }
            className="tap-target relative flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute right-0 top-0 min-w-4 rounded-full bg-[var(--ember)] px-1 text-[0.5625rem] font-semibold leading-4 text-[var(--ember-ink)]",
                  unread > 9 && "px-0.5",
                )}
              >
                {badge}
              </span>
            )}
          </button>
        }
      />

      <PopoverContent align="end" className={cn("w-[21rem] gap-0 p-0", className)}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <p className="text-[0.8125rem] font-medium">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markRead({ all: true })}
              className="tap-row ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.75rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
            >
              <CheckCheck className="size-3" />
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[0.8125rem] text-muted-foreground">
            Nothing yet. Blockwright will tell you here when a build finishes or needs you.
          </p>
        ) : (
          <ul className="max-h-[24rem] overflow-y-auto">
            {items.map((item) => {
              const Icon = ICON[item.kind];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "tap-row flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-ember",
                      !item.readAt && "bg-accent/25",
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-3.5 shrink-0", TONE[item.kind])} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-medium">{item.title}</span>
                      {item.body && (
                        <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                    {!item.readAt && (
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--ember)]"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
