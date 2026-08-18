import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let signedIn = false;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
