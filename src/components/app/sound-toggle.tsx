"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { playSound, setSoundEnabled, soundEnabled } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Mute control.
 *
 * The preference lives in localStorage, which the server cannot see:
 * `soundEnabled()` answers `false` during SSR and `true` (the default) in the
 * browser, so a lazy `useState` initialiser rendered one thing in the HTML and
 * another on hydration — a mismatch that threw on every page in the app and
 * made React discard and re-render the whole tree.
 *
 * `useSyncExternalStore` is the fix rather than an effect: `getServerSnapshot`
 * states what the HTML actually says, React reconciles to the client value
 * immediately after hydrating, and no state is written from an effect — which
 * the React Compiler rejects outright.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** What the server rendered. `soundEnabled()` has no storage to read there. */
function serverSnapshot(): boolean {
  return false;
}

export function SoundToggle({ className }: { className?: string }) {
  const on = useSyncExternalStore(subscribe, soundEnabled, serverSnapshot);

  const toggle = useCallback(() => {
    const next = !soundEnabled();
    setSoundEnabled(next);
    for (const listener of listeners) listener();
    // Play the confirmation *after* enabling, so turning sound on demonstrates
    // what it sounds like and turning it off is silent.
    if (next) playSound("toggle");
  }, []);

  const Icon = on ? Volume2 : VolumeX;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={toggle}
            aria-pressed={on}
            aria-label={on ? "Turn interface sounds off" : "Turn interface sounds on"}
            className={cn(
              "tap-target flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember",
              className,
            )}
          >
            <Icon className="size-4" />
          </button>
        }
      />
      <TooltipContent>{on ? "Sounds on" : "Sounds off"}</TooltipContent>
    </Tooltip>
  );
}
