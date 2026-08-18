import { ArrowDown, Check, Monitor, MousePointerClick, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/status-dot";

/**
 * The pairing flow, drawn rather than described. Three states, one arrow each —
 * the point is that the user's mental model is "code in, place updated", and
 * the transport is deliberately invisible.
 */
const STAGES = [
  {
    icon: Globe,
    surface: "Blockwright",
    title: "Connect Roblox Studio",
    body: "Generates a six-character pairing code.",
    code: "K7M2QX",
  },
  {
    icon: MousePointerClick,
    surface: "Studio plugin",
    title: "Paste the code",
    body: "The plugin exchanges it for a session token.",
  },
  {
    icon: Monitor,
    surface: "Both",
    title: "Connected",
    body: "Scripts appear under the right services as you build.",
    connected: true,
  },
];

export function StudioFlow({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {STAGES.map((stage, index) => (
        <div key={stage.title}>
          <div
            className={cn(
              "rounded-xl border bg-surface p-5 transition-colors",
              stage.connected
                ? "border-[var(--signal)]/35 shadow-[0_0_0_1px_var(--signal-soft)]"
                : "border-border",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
                <stage.icon
                  className={cn(
                    "size-4",
                    stage.connected ? "text-[var(--signal)]" : "text-muted-foreground",
                  )}
                  strokeWidth={1.75}
                />
              </span>
              <div className="min-w-0">
                <p className="label-meta">{stage.surface}</p>
                <h3 className="text-sm font-medium">{stage.title}</h3>
              </div>

              {stage.code && (
                <span className="ml-auto rounded-md border border-border bg-surface-sunken px-2.5 py-1 font-mono text-sm tracking-[0.22em] text-[var(--ember)]">
                  {stage.code}
                </span>
              )}
              {stage.connected && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--signal)]/30 bg-[var(--signal)]/10 px-2 py-1 text-[0.6875rem] font-medium text-[var(--signal)]">
                  <StatusDot tone="live" pulse />
                  Live
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{stage.body}</p>

            {stage.connected && (
              <ul className="mt-4 space-y-1.5 border-t border-hairline pt-3.5">
                {[
                  "CurrencyService → ReplicatedStorage",
                  "CrystalNodes → ServerScriptService",
                  "ShopPanel → StarterGui",
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground"
                  >
                    <Check className="size-3 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                    <span className="truncate">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {index < STAGES.length - 1 && (
            <div className="flex justify-center py-1.5" aria-hidden>
              <ArrowDown className="size-3.5 text-muted-foreground/40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
