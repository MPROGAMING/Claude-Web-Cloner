import { LinkButton } from "blockwright";
import { ArrowRight, Coins, ExternalLink } from "lucide-react";

// docs/DESIGN_SYSTEM.md § Components › Buttons: "Navigation uses
// `<LinkButton href>`, never `<Button render={<Link/>}>`." Base UI's Button
// asserts native button semantics, so forcing an anchor through it breaks
// Enter/Space and announces the wrong role. LinkButton therefore carries the
// whole button variant/size vocabulary on a real anchor — inside this bundle
// next/link is a plain-anchor stand-in, so a rendered `<a href>` is correct.
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <LinkButton href="/dashboard">Go to your projects</LinkButton>
    <LinkButton href="/pricing" variant="outline">
      See pricing
    </LinkButton>
    <LinkButton href="/templates" variant="secondary">
      Browse templates
    </LinkButton>
    <LinkButton href="/" variant="ghost">
      Home
    </LinkButton>
    <LinkButton href="/settings" variant="destructive">
      Disconnect Studio
    </LinkButton>
    <LinkButton href="/docs/studio-bridge" variant="link">
      Read the docs
    </LinkButton>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <LinkButton href="/credits" size="xs">
      Buy credits
    </LinkButton>
    <LinkButton href="/dashboard" size="sm">
      Open Blockwright
    </LinkButton>
    <LinkButton href="/sign-up">Start building</LinkButton>
    <LinkButton href="/projects/bloxburg-tycoon" size="lg">
      Open Bloxburg Tycoon
    </LinkButton>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <LinkButton href="/projects/bloxburg-tycoon">
      Open project
      <ArrowRight data-icon="inline-end" />
    </LinkButton>
    <LinkButton href="/credits" variant="outline">
      <Coins data-icon="inline-start" />
      2,000 credits
    </LinkButton>
    <LinkButton href="https://create.roblox.com" variant="ghost">
      Roblox Creator Hub
      <ExternalLink data-icon="inline-end" />
    </LinkButton>
  </div>
);

// Ported from src/app/not-found.tsx — a primary destination plus an escape
// hatch, which is the shape every error and empty surface in the app uses.
export const NotFoundActions = () => (
  <div className="max-w-md text-center">
    <p className="font-display text-3xl font-semibold">Nothing here</p>
    <p className="mt-2 text-sm text-muted-foreground">
      That project may have been deleted, or the link was mistyped.
    </p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <LinkButton href="/dashboard">Go to your projects</LinkButton>
      <LinkButton href="/" variant="outline">
        Home
      </LinkButton>
    </div>
  </div>
);

// Ported from src/components/marketing/pricing-cards.tsx — the CTA stretches
// the card, so the anchor takes `w-full` like a submit button would.
export const InPricingCard = () => (
  <div className="flex max-w-xs flex-col rounded-xl border border-border bg-surface p-6">
    <h3 className="text-sm font-semibold">Free</h3>
    <p className="mt-3">
      <span className="font-display text-3xl font-semibold tabular-nums">2,000</span>
      <span className="ml-1 text-sm text-muted-foreground">credits</span>
    </p>
    <p className="mt-2 text-[0.8125rem] text-muted-foreground">
      Granted once when you create an account.
    </p>
    <LinkButton href="/sign-up" variant="outline" className="mt-6 w-full">
      Create an account
    </LinkButton>
  </div>
);
