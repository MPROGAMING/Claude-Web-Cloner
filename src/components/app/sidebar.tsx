"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Blocks,
  Coins,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Blocks },
  { href: "/templates", label: "Templates", icon: Sparkles },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/credits", label: "Credits", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Desktop rail. Collapses to icons under 1280px rather than disappearing —
 * the workspace needs the horizontal room, but losing navigation entirely
 * makes the app feel like it lost a level.
 */
export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex",
        "w-[3.75rem] xl:w-[13.5rem]",
        className,
      )}
    >
      <div className="flex h-14 items-center px-3 xl:px-4">
        <Link href="/dashboard" className="flex items-center rounded-md focus-ember" aria-label="Blockwright home">
          <span className="xl:hidden">
            <LogoMark />
          </span>
          <span className="hidden xl:inline-flex">
            <Logo />
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2 xl:p-3" aria-label="Main">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors",
                "justify-center xl:justify-start",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--ember)]" />
              )}
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="hidden xl:inline">{item.label}</span>
            </Link>
          );

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right" className="xl:hidden">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="hidden p-3 xl:block">
        <p className="label-meta">v0.1 · preview</p>
      </div>
    </aside>
  );
}

/** Mobile bottom bar. Deliberately a different component, not a shrunk rail. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
      aria-label="Main"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.filter((n) => n.href !== "/settings").map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.625rem] font-medium transition-colors",
              active ? "text-[var(--ember)]" : "text-muted-foreground",
            )}
          >
            <Icon className="size-[1.125rem]" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
