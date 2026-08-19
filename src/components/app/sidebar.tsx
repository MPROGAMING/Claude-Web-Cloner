"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Blocks, Coins, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Blocks },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/credits", label: "Credits", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Desktop rail.
 *
 * `.plate` rather than the sidebar tokens: the rail is the one piece of chrome
 * on every screen, so making it a moulded plate is what carries the workshop
 * into pages this bundle does not own. Every token inside is remapped by the
 * class, so the logo, the icons and the labels pick up plate tones without
 * knowing the plate exists.
 *
 * Collapses to icons under 1280px rather than disappearing — the workspace
 * needs the horizontal room, but losing navigation entirely makes the app feel
 * like it lost a level.
 */
export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "plate relative hidden shrink-0 flex-col border-r md:flex",
        "w-[3.75rem] xl:w-[13.5rem]",
        className,
      )}
    >
      {/* The lattice rides on its own layer, dialled back until it is a
          surface you notice second rather than a pattern behind the labels. */}
      <div
        aria-hidden
        className="stud-plate pointer-events-none absolute inset-0 opacity-[0.17] [--stud-pitch:34px]"
      />

      <div className="relative flex h-14 items-center px-3 xl:px-4">
        <Link
          href="/dashboard"
          className="flex items-center rounded-md focus-ember"
          aria-label="Blockwright home"
        >
          <span className="xl:hidden">
            <LogoMark />
          </span>
          <span className="hidden xl:inline-flex">
            <Logo />
          </span>
        </Link>
      </div>

      <nav className="relative flex flex-1 flex-col gap-1 p-2 xl:p-3" aria-label="Main">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg py-2 pl-4 pr-2.5 text-[0.8125rem] font-medium",
                "transition-[background-color,color,transform] duration-150",
                "justify-center xl:justify-start",
                active
                  ? "bg-surface text-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.11),inset_0_-2px_0_0_rgb(0_0_0/0.2),0_2px_0_0_rgb(0_0_0/0.32)]"
                  : "text-muted-foreground hover:-translate-y-px hover:text-foreground",
              )}
            >
              {/* A stud, not a bar. Rounded square, because that is what the
                  material is made of. */}
              <span
                aria-hidden
                className={cn(
                  "absolute left-1.5 size-1.5 rounded-[2px] transition-colors",
                  active ? "bg-[var(--ember)]" : "bg-transparent group-hover:bg-foreground/25",
                )}
              />
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

      <div className="relative hidden p-3 xl:block">
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
      className="plate fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      <div
        aria-hidden
        className="stud-plate pointer-events-none absolute inset-0 opacity-[0.18] [--stud-pitch:30px]"
      />
      {NAV.filter((n) => n.href !== "/settings").map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.625rem] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-1.5 inset-y-1 -z-0 rounded-lg transition-opacity",
                active
                  ? "bg-surface opacity-100 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.11),0_2px_0_0_rgb(0_0_0/0.32)]"
                  : "opacity-0",
              )}
            />
            <Icon
              className={cn("relative size-[1.125rem]", active && "text-[var(--ember)]")}
              strokeWidth={1.75}
            />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
