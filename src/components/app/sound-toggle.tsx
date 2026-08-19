"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { playSound, setSoundEnabled, soundEnabled } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Mute control.
 *
 * Lazy initial state rather than an effect: the preference is known
 * synchronously from localStorage, and writing it in an effect would be a
 * derived-state write the React Compiler rejects — and would flash the wrong
 * icon on first paint.
 */
export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(() => soundEnabled());

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    // Play the confirmation *after* enabling, so turning sound on demonstrates
    // what it sounds like and turning it off is silent.
    if (next) playSound("toggle");
  };

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
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember",
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
