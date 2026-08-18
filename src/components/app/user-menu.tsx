"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { CreditCard, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions/auth";

export function UserMenu({
  email,
  displayName,
}: {
  email: string;
  displayName?: string | null;
}) {
  const { theme, setTheme } = useTheme();
  const name = displayName || email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-surface-raised text-[0.6875rem] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56 min-w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-[0.8125rem] font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/credits" />}>
          <CreditCard className="size-4" />
          Credits &amp; usage
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="flex items-center gap-1 px-2 py-1.5">
          <span className="mr-auto text-xs text-muted-foreground">Theme</span>
          {(
            [
              ["light", Sun],
              ["dark", Moon],
              ["system", Monitor],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} theme`}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={`rounded-md p-1.5 transition-colors ${
                theme === value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>

        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem
            render={
              <button type="submit" className="w-full">
                <LogOut className="size-4" />
                Sign out
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
