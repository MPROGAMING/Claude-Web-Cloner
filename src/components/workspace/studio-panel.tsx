"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Plug2,
  RefreshCw,
  Unplug,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { relativeTime } from "@/lib/format";
import {
  endStudioSession,
  startStudioPairing,
  syncProjectToStudio,
} from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

interface StudioState {
  status: "pending" | "connected" | "disconnected" | "expired";
  placeName: string | null;
  lastSeenAt: string | null;
  commands: {
    id: string;
    action: string;
    status: string;
    summary: string | null;
    createdAt: string;
  }[];
}

/**
 * Studio connection panel.
 *
 * Polls /api/studio/status while the panel is visible. Polling stops when the
 * tab is hidden, because a background tab pinging every three seconds is how
 * you burn someone's battery for nothing.
 */
export function StudioPanel({ projectId }: { projectId: string }) {
  const [state, setState] = useState<StudioState | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/studio/status?projectId=${projectId}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const next: StudioState = await response.json();
      setState(next);
      // Once the plugin pairs, the code is spent — stop showing it.
      if (next.status === "connected") setPairCode(null);
    } catch {
      // A transient network blip should not clear a good connection display.
    }
  }, [projectId]);

  useEffect(() => {
    let timer: number | undefined;

    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => void refresh(), 3000);
    };
    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        void refresh();
        start();
      }
    };

    // Kick off the first read from a task rather than the effect body, so the
    // initial paint is not blocked on a fetch resolving.
    const initial = window.setTimeout(() => void refresh(), 0);
    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const connected = state?.status === "connected";

  const connect = () =>
    startTransition(async () => {
      const result = await startStudioPairing(projectId);
      if (result.ok && result.data) {
        setPairCode(result.data.code);
      } else {
        toast.error(result.error ?? "Could not start pairing.");
      }
    });

  const disconnect = () =>
    startTransition(async () => {
      const result = await endStudioSession(projectId);
      if (result.ok) {
        setPairCode(null);
        toast.success("Studio disconnected");
        refresh();
      } else {
        toast.error(result.error ?? "Could not disconnect.");
      }
    });

  const sync = () =>
    startTransition(async () => {
      const result = await syncProjectToStudio(projectId);
      if (result.ok) {
        toast.success("Queued a full sync to Studio");
        refresh();
      } else {
        toast.error(result.error ?? "Could not queue the sync.");
      }
    });

  const copyCode = async () => {
    if (!pairCode) return;
    await navigator.clipboard.writeText(pairCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-3 p-3">
      <div
        className={cn(
          "rounded-lg border p-3 transition-colors",
          connected ? "border-[var(--signal)]/35 bg-[var(--signal)]/6" : "border-border bg-surface",
        )}
      >
        <div className="flex items-center gap-2">
          <StatusDot tone={connected ? "live" : "idle"} pulse={connected} />
          <p className="text-[0.8125rem] font-medium">
            {connected ? "Studio connected" : "Studio not connected"}
          </p>
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh connection status"
            className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-ember"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>

        {connected ? (
          <>
            <p className="mt-1.5 truncate font-mono text-[0.625rem] text-muted-foreground">
              {state?.placeName ?? "Unnamed place"}
              {state?.lastSeenAt && ` · seen ${relativeTime(state.lastSeenAt)}`}
            </p>
            <div className="mt-3 flex gap-1.5">
              <Button size="sm" onClick={sync} disabled={pending} className="flex-1">
                {pending ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                Sync all files
              </Button>
              <Button size="sm" variant="outline" onClick={disconnect} disabled={pending}>
                <Unplug className="size-3" />
              </Button>
            </div>
          </>
        ) : pairCode ? (
          <div className="mt-3">
            <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
              In Roblox Studio, open the Blockwright plugin and enter this code:
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ember)]/40 bg-[var(--ember)]/8 py-2.5 font-mono text-xl tracking-[0.3em] text-[var(--ember)] transition-colors hover:bg-[var(--ember)]/12 focus-ember"
              aria-label={`Pairing code ${pairCode.split("").join(" ")}. Click to copy.`}
            >
              {pairCode}
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5 opacity-60" />}
            </button>
            <p className="mt-2 text-center font-mono text-[0.5625rem] text-muted-foreground">
              expires in 10 minutes
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">
              Link this project to the place you have open, and generated scripts land in Studio
              automatically.
            </p>
            <Button size="sm" onClick={connect} disabled={pending} className="mt-3 w-full">
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Plug2 className="size-3" />}
              Connect Roblox Studio
            </Button>
          </>
        )}
      </div>

      {state && state.commands.length > 0 && (
        <div>
          <p className="label-meta mb-2 px-0.5">Recent actions</p>
          <ul className="space-y-1">
            {state.commands.map((command) => (
              <li
                key={command.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5"
              >
                {command.status === "succeeded" ? (
                  <Check className="size-3 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                ) : command.status === "failed" ? (
                  <AlertTriangle className="size-3 shrink-0 text-[var(--danger)]" />
                ) : (
                  <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-[0.625rem]">
                  {command.action}
                </span>
                <span className="shrink-0 font-mono text-[0.5625rem] text-muted-foreground">
                  {relativeTime(command.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!connected && (
        <p className="rounded-lg bg-surface-sunken px-2.5 py-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Studio is optional. Files are saved to the project either way — sync whenever you next
          open Studio.
        </p>
      )}
    </div>
  );
}
