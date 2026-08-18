import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, MobileNav } from "@/components/app/sidebar";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupRequired } from "@/components/app/setup-required";
import { CommandPalette } from "@/components/app/command-palette";

/**
 * Authenticated shell. The proxy already redirects anonymous users, but this
 * layout re-checks: a layout is the last place a page can be rendered from, and
 * "the proxy will have handled it" is not an authorization model.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-14 md:pb-0">{children}</div>
      <MobileNav />
      {/* Mounted once in the shell so the shortcut works on every page and
          there is exactly one keyboard listener. */}
      <CommandPalette />
    </div>
  );
}
