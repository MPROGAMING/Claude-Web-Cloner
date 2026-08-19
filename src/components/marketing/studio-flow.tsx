import { ArrowDown, Check, Monitor, MousePointerClick, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { PairingShape } from "@/components/marketing/pairing-shape";

/**
 * The pairing handshake, drawn rather than described.
 *
 * The third stage used to render a pulsing "Live" badge, which is a claim about
 * a Studio session a marketing page cannot have. It now describes what the
 * bridge does once it is connected — true whether or not anyone is paired —
 * and the file lines under it are the shape of the result, not a report.
 */
const STAGES = [
  {
    icon: Globe,
    surface: "Blockwright",
    title: "Ask for a code",
    body: "Your project makes a six-character code. It works for one plugin, and only once.",
    pairing: true,
  },
  {
    icon: MousePointerClick,
    surface: "Studio plugin",
    title: "Type it into Studio",
    body: "The plugin swaps the code for a key of its own and keeps the link open.",
  },
  {
    icon: Monitor,
    surface: "Both",
    title: "Say yes, and it lands",
    body: "Each script is written into the service it belongs to, in the place you have open.",
    lands: ["CurrencyService → ReplicatedStorage", "CrystalNodes → ServerScriptService"],
  },
];

export function StudioFlow({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {STAGES.map((stage, index) => (
        <div key={stage.title}>
          <div className="mount rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken">
                <stage.icon className="size-4 text-[var(--signal)]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="label-meta">{stage.surface}</p>
                <h3 className="text-sm font-semibold">{stage.title}</h3>
              </div>
              {stage.pairing && <PairingShape className="ml-auto" />}
            </div>

            <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {stage.body}
            </p>

            {stage.lands && (
              <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                {stage.lands.map((line) => (
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
            <div className="flex justify-center py-1" aria-hidden>
              <ArrowDown className="size-3.5 text-[var(--signal)]" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
