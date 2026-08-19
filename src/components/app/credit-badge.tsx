"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { MINIMUM_BALANCE_TO_START, formatCredits } from "@/lib/credits/pricing";
import { lowBalanceBand } from "@/lib/notifications/events";
import { AnimatedNumber } from "@/components/app/animated-number";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Credit balance chip.
 *
 * The bands are the product's own, not new numbers: amber once the balance
 * enters `LOW_BALANCE_BANDS` (200, the point the low-balance notification
 * fires) and red below `MINIMUM_BALANCE_TO_START`, where a generation is
 * refused outright. It used to go amber below 2,000, which is precisely the
 * signup grant in `0001_init.sql` — so the chip was warning-coloured for every
 * account from its first request, on every screen, including the one people
 * land on. A warning that is always on is not a warning.
 *
 * Moulded rather than flat, and it *travels* when pressed: a scale tween is a
 * screen effect, a part that gets shorter is the material. The tint/ink pairing
 * is untouched — `--warning` and `--danger` on a wash of themselves fall under
 * the text floor, which is what the `-ink` tokens exist to fix.
 */
export function CreditBadge({ balance, className }: { balance: number; className?: string }) {
  const tone =
    balance < MINIMUM_BALANCE_TO_START
      ? "critical"
      : lowBalanceBand(balance) !== null
        ? "low"
        : "normal";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href="/credits"
            className={cn(
              "tap-row inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8125rem] font-medium tabular-nums focus-ember",
              "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.1),0_2px_0_0_rgb(0_0_0/0.32)]",
              "transition-[background-color,border-color,transform,box-shadow] duration-100",
              "active:translate-y-[2px] active:shadow-[inset_0_1px_0_0_rgb(0_0_0/0.18)]",
              tone === "normal" &&
                "border-border bg-surface text-foreground hover:bg-accent",
              tone === "low" &&
                "border-[var(--warning)]/35 bg-[var(--warning)]/10 text-[var(--warning-ink)]",
              tone === "critical" &&
                "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger-ink)]",
              className,
            )}
          >
            <Coins className="size-3.5" strokeWidth={1.75} />
            <AnimatedNumber value={balance} format={formatCredits} />
          </Link>
        }
      />
      <TooltipContent>
        {tone === "critical"
          ? "Too low to start a build"
          : tone === "low"
            ? "Running low on credits"
            : "Credits remaining"}
      </TooltipContent>
    </Tooltip>
  );
}
