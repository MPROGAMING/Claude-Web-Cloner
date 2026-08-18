import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#studio", label: "Studio bridge" },
      { href: "/#models", label: "Models" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Start",
    links: [
      { href: "/sign-up", label: "Create an account" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/templates", label: "Templates" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            An AI build partner for Roblox creators. Describe the mechanic, get
            working Luau in your place.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="label-meta">{column.title}</h3>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Blockwright</p>
          <div className="space-y-1 sm:text-right">
            <p>
              Not affiliated with, endorsed by, or sponsored by Roblox Corporation. Roblox and Luau
              are trademarks of their respective owners.
            </p>
            <p>
              Template icons by{" "}
              <a
                href="https://game-icons.net"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Game-icons.net
              </a>{" "}
              (CC BY 3.0). Provider logos are trademarks of their respective owners, shown for
              identification only.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
