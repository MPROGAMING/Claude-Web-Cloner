import { PricingCards } from "blockwright";

// Free plan plus the first two credit packs, priced from CREDIT_PACKS so the
// page and the product agree. The highlighted pack carries the "Most credits
// per dollar" tag and the filled CTA; nothing here is purchasable yet, which is
// what the footnote says.

// As `/` composes it, under the "Credits" section heading.
export const CreditPacks = () => <PricingCards />;

// /pricing makes its section heading the page h1, so the plan names move up a
// level to keep the outline intact. Same render, different heading semantics.
export const PricingPageHeadings = () => <PricingCards headingLevel="h2" />;
