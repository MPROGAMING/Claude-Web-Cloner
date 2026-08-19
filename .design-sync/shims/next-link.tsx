// Stand-in for next/link inside the design-system bundle.
//
// Importing the real next/link pulls Next's client router runtime, which reads
// process.env.__NEXT_* at module scope. In a browser IIFE with no `process`
// that throws before any component mounts — one `ReferenceError: process is not
// defined` blanked all 118 cards. Nothing downstream of this bundle (preview
// cards, or a design the claude.ai/design agent builds) runs inside Next, so
// there is no router to talk to and no prefetching to do: a plain anchor is
// what Link renders here anyway.
import * as React from "react";

type Props = Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  href?: string | { pathname?: string };
  // Accepted and dropped: router-only knobs with no meaning outside Next.
  prefetch?: unknown;
  replace?: unknown;
  scroll?: unknown;
  shallow?: unknown;
  passHref?: unknown;
  locale?: unknown;
  legacyBehavior?: unknown;
};

function Link({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  locale: _locale,
  legacyBehavior: _legacyBehavior,
  ...props
}: Props) {
  const url = typeof href === "string" ? href : href?.pathname;
  return <a href={url} {...props} />;
}

export default Link;
