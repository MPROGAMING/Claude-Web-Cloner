"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/credits/pricing";
import { AnimatedNumber } from "@/components/app/animated-number";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Credit balance chip. Turns amber below 2,000 and red below 200 so the state
 * is legible before the user hits a hard stop mid-generation.
 */
export function CreditBadge({ balance, className }: { balance: number; className?: string }) {
  const tone =
    balance < 200 ? "critical" : balance < 2000 ? "low" : "normal";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href="/credits"
            className={cn(
              "tap-row inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8125rem] font-medium tabular-nums transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] focus-ember",
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
          ? "Almost out of credits"
          : tone === "low"
            ? "Running low on credits"
            : "Credits remaining"}
      </TooltipContent>
    </Tooltip>
  );
}
