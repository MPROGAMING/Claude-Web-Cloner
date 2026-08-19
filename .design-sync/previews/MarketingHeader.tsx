import { MarketingHeader } from "blockwright";

// The header is driven by one prop: whether the visitor has a session. Both
// states ship on every marketing page via src/app/(marketing)/layout.tsx.
// It starts transparent and gains its border + blur on scroll, which a static
// capture cannot show — this is the top-of-page state.

export const SignedOut = () => <MarketingHeader signedIn={false} />;

export const SignedIn = () => <MarketingHeader signedIn />;
