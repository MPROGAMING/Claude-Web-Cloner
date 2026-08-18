import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import type { CreditBalance, CreditTransaction, Database } from "@/lib/supabase/types";
import { MINIMUM_BALANCE_TO_START } from "@/lib/credits/pricing";

/**
 * Credit operations.
 *
 * These take the caller's own Supabase client, not a service-role one. That is
 * safe because `consume_credits` derives the account from `auth.uid()` inside
 * the function rather than taking it as an argument — a caller cannot spend
 * someone else's balance no matter what it passes — and `credit_balances` has
 * no write policy, so the browser still cannot touch a balance directly.
 *
 * Minting (`grant_credits`) is deliberately *not* reachable this way; it takes
 * an explicit user id and is granted to service_role only.
 */

type Client = SupabaseClient<Database>;

export async function getBalance(
  supabase: Client,
  userId: string,
): Promise<CreditBalance | null> {
  const { data, error } = await supabase
    .from("credit_balances")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new AppError("database_error", "Could not read your credit balance.", 500);
  return data;
}

/** Throws `insufficient_credits` before we spend money with a provider. */
export async function assertCanStartGeneration(
  supabase: Client,
  userId: string,
  estimate: number,
) {
  const balance = await getBalance(supabase, userId);
  const available = balance?.balance ?? 0;
  const threshold = Math.max(MINIMUM_BALANCE_TO_START, Math.ceil(estimate * 0.5));

  if (available < threshold) {
    throw new AppError(
      "insufficient_credits",
      "You do not have enough credits to start this generation.",
      402,
      { balance: available, required: threshold },
    );
  }
  return available;
}

/**
 * Atomically debit credits from the session user. Returns the new balance.
 * A zero charge is a no-op rather than an error.
 */
export async function chargeCredits(
  supabase: Client,
  params: { amount: number; description: string; referenceId?: string },
): Promise<number | null> {
  if (params.amount <= 0) return null;

  const { data, error } = await supabase.rpc("consume_credits", {
    p_amount: params.amount,
    p_description: params.description,
    p_reference_id: params.referenceId ?? null,
  });

  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      // The generation already happened, so take what is left rather than
      // letting the usage vanish.
      await drainRemaining(supabase, params);
      throw new AppError(
        "insufficient_credits",
        "That generation used your remaining credits.",
        402,
      );
    }
    throw new AppError("database_error", "Could not record credit usage.", 500);
  }

  return data as unknown as number;
}

async function drainRemaining(
  supabase: Client,
  params: { description: string; referenceId?: string },
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const balance = await getBalance(supabase, user.user.id);
  const remaining = balance?.balance ?? 0;
  if (remaining <= 0) return;

  await supabase.rpc("consume_credits", {
    p_amount: remaining,
    p_description: `${params.description} (partial — balance exhausted)`,
    p_reference_id: params.referenceId ?? null,
  });
}

export async function listTransactions(
  supabase: Client,
  userId: string,
  limit = 50,
): Promise<CreditTransaction[]> {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new AppError("database_error", "Could not load your usage history.", 500);
  return data ?? [];
}
