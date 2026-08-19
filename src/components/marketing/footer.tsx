import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * The page above this is four sections long. A three-column sitemap under it
 * was a bigger navigation surface than the site it indexed, so the same links
 * ride in one band. Nothing was dropped — every destination the columns held
 * is still here.
 */
const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#studio", label: "Studio bridge" },
  { href: "/#brain", label: "The knowledge base" },
  { href: "/pricing", label: "Pricing" },
  { href: "/sign-up", label: "Create an account" },
  { href: "/sign-in", label: "Sign in" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 sm:px-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="lg:max-w-xs">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            An AI build partner for Roblox creators. Say what you want to
            happen in your game, and get working Luau in your place.
          </p>
        </div>

        <nav aria-label="Footer" className="lg:ml-auto">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="tap-target inline-flex items-center justify-center rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-ember"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Blockwright</p>
          <p className="max-w-md sm:text-right">
            Not affiliated with, endorsed by, or sponsored by Roblox Corporation. Roblox and Luau
            are trademarks of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
