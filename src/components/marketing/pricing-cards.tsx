import { Check } from "lucide-react";
import { CREDIT_PACKS, formatCredits } from "@/lib/credits/pricing";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

/**
 * Credit packs, priced from CREDIT_PACKS so the page and the product agree.
 * There is no checkout yet — the CTA is honest about that.
 */
const FREE_FEATURES = [
  "Every model available",
  "Unlimited projects",
  "Roblox Studio bridge",
  "Full file history",
];

export function PricingCards({
  className,
  headingLevel: Heading = "h3",
}: {
  className?: string;
  /**
   * The level for each plan name. h3 is right under the landing page's h2
   * section heading; /pricing makes its section heading the page h1, so there
   * the plans are h2 and passing h3 would leave a gap in the outline.
   */
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        <div className="flex flex-col rounded-xl border border-border bg-surface p-6">
          <Heading className="text-sm font-semibold">Free</Heading>
          <p className="mt-3">
            <span className="font-display text-3xl font-semibold">2,000</span>
            <span className="ml-1.5 text-sm text-muted-foreground">credits</span>
          </p>
          <p className="mt-2 text-[0.8125rem] text-muted-foreground">
            Granted once when you create an account.
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {FREE_FEATURES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.8125rem]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <LinkButton href="/sign-up" variant="outline" className="mt-6 w-full">
            Create an account
          </LinkButton>
        </div>

        {CREDIT_PACKS.slice(0, 2).map((pack) => (
          <div
            key={pack.id}
            className={cn(
              "relative flex flex-col rounded-xl border bg-surface p-6",
              pack.highlight ? "border-[var(--ember)]/45" : "border-border",
            )}
          >
            {pack.highlight && (
              <span className="absolute -top-2.5 left-6 rounded-full border border-[var(--ember)]/40 bg-background px-2.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-[var(--ember-text)]">
                Most credits per dollar
              </span>
            )}
            <Heading className="text-sm font-semibold">{pack.name}</Heading>
            <p className="mt-3">
              <span className="font-display text-3xl font-semibold">
                {formatCredits(pack.credits)}
              </span>
              <span className="ml-1.5 text-sm text-muted-foreground">credits</span>
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted-foreground">
              ${pack.priceUsd} one-off · {pack.blurb}
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              <li className="flex items-start gap-2 text-[0.8125rem]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                <span className="text-muted-foreground">Everything in Free</span>
              </li>
              <li className="flex items-start gap-2 text-[0.8125rem]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                <span className="text-muted-foreground">
                  Credits never expire
                </span>
              </li>
              <li className="flex items-start gap-2 text-[0.8125rem]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                <span className="text-muted-foreground">
                  {Math.round(pack.credits / pack.priceUsd).toLocaleString("en-US")} credits per dollar
                </span>
              </li>
            </ul>

            {/* No payment provider is configured, so there is nothing honest for a
                purchase button to do. Rather than show a disabled control, the
                card leads where the credits actually come from today: a free
                account with a starting balance. */}
            <LinkButton
              href="/sign-up"
              variant={pack.highlight ? "default" : "outline"}
              className="mt-6 w-full"
            >
              Start with free credits
            </LinkButton>
          </div>
        ))}
      </div>

      <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
        Credits are metered from the token usage each provider reports — a message
        that fails before reaching a provider costs nothing. Packs are priced but
        not yet purchasable; every account starts with free credits.
      </p>
    </div>
  );
}
