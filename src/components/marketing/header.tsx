"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#studio", label: "Studio bridge" },
  { href: "/#models", label: "Models" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="rounded-md focus-ember" aria-label="Blockwright home">
          <Logo />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Marketing">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-ember"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <LinkButton href="/dashboard" size="sm">
              Open Blockwright
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/sign-up" size="sm">
                Start building
              </LinkButton>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto rounded-md p-2 text-muted-foreground md:hidden focus-ember"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col p-3" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {signedIn ? (
                <LinkButton href="/dashboard">Open Blockwright</LinkButton>
              ) : (
                <>
                  <LinkButton href="/sign-in" variant="outline">
                    Sign in
                  </LinkButton>
                  <LinkButton href="/sign-up">Start building</LinkButton>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
