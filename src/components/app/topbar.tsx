import Link from "next/link";
import { SoundToggle } from "@/components/app/sound-toggle";
import { CreditBadge } from "@/components/app/credit-badge";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * A thin, quiet top bar. Page titles live in the page body, not here — the bar
 * is for identity and account state only, so it never competes with content.
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
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6",
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

      <SoundToggle />
      <NotificationBell />
      <CreditBadge balance={balance} />
      <UserMenu email={email} displayName={displayName} />
    </header>
  );
}
