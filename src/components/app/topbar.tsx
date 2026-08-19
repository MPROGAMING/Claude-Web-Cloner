import Link from "next/link";
import { SoundToggle } from "@/components/app/sound-toggle";
import { CreditBadge } from "@/components/app/credit-badge";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import { CommandPaletteTrigger } from "@/components/app/command-palette";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * A thin, quiet top bar. Page titles live in the page body, not here — the bar
 * is for identity and account state only, so it never competes with content.
 *
 * It keeps the *page's* tokens rather than the plate's, deliberately: the rail
 * beside it is a moulded plate, and a machined strip above a plate is what
 * gives the shell two notes instead of brown against brown.
 */
export function Topbar({
  balance,
  email,
  displayName,
  children,
  className,
}: {
  balance: number;
  email: string;
  displayName?: string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md md:gap-3 md:px-6",
        // A machined seam rather than a hairline: lit on top, cut underneath.
        "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_1px_0_0_rgb(0_0_0/0.4)]",
        className,
      )}
    >
      <Link
        href="/dashboard"
        className="tap-target flex items-center justify-center rounded-md focus-ember md:hidden"
        aria-label="Blockwright home"
      >
        <LogoMark className="size-6" />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>

      <CommandPaletteTrigger />
      <SoundToggle />
      <NotificationBell />
      <CreditBadge balance={balance} />
      <UserMenu email={email} displayName={displayName} />
    </header>
  );
}
