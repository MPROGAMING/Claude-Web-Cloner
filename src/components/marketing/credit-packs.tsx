import { CREDIT_PACKS, formatCredits } from "@/lib/credits/pricing";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

/**
 * Credit packs as moulded parts, priced from `CREDIT_PACKS` so the page and the
 * product cannot drift.
 *
 * They used to be a three-column SaaS pricing table with tick-lists — a shape
 * that promises tiers, and this product has none. There is one balance, one
 * feature set and one thing that differs between packs: how many credits you
 * get for a dollar. So the pack is a part with a number on it, and the number
 * that actually decides is spelled out underneath.
 *
 * No payment provider is configured, so nothing here pretends to be buyable.
 */
export function CreditPacks({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)}>
      <ul className="grid gap-4 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <li
            key={pack.id}
            className={cn(
              "mount flex flex-col rounded-xl border p-5",
              // .mount owns box-shadow, so the emphasis has to be a border —
              // a ring is a box-shadow and would be overwritten silently.
              pack.highlight ? "border-[var(--ember)]/45" : "border-transparent",
            )}
          >
            <p className="label-meta">{pack.name}</p>
            <p className="mt-3 font-display text-[2rem] font-extrabold leading-none tabular-nums tracking-[-0.03em]">
              {formatCredits(pack.credits)}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">credits</p>
            <p className="mt-4 border-t border-hairline pt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">${pack.priceUsd}</span> one
              off ·{" "}
              <span className="font-mono tabular-nums text-[var(--ember-text)]">
                {Math.round(pack.credits / pack.priceUsd).toLocaleString("en-US")}
              </span>{" "}
              credits per dollar
            </p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {pack.blurb}
            </p>
          </li>
        ))}
      </ul>

      <div className="mount flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center">
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          You cannot buy a pack yet — there is no checkout, so there is nothing
          honest for a buy button to do. Every account starts with 2,000
          credits, and they do not expire.
        </p>
        <LinkButton href="/sign-up" className="shrink-0 sm:ml-auto">
          Create an account
        </LinkButton>
      </div>
    </div>
  );
}
