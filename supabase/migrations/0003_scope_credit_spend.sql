-- ===========================================================================
-- Narrow the blast radius of the service-role key.
--
-- Spending credits and logging AI requests both happen while a user session
-- exists, so neither needs to bypass RLS. Moving them onto the user-scoped
-- client leaves the service-role key required by exactly one subsystem: the
-- Roblox Studio bridge, which authenticates with a plugin token and genuinely
-- has no session.
--
-- The safety property is preserved by construction: consume_credits derives
-- the account from auth.uid() rather than taking it as an argument, so a caller
-- cannot spend someone else's balance no matter what it passes.
-- ===========================================================================

drop function if exists public.consume_credits(uuid, bigint, text, uuid);

create function public.consume_credits(
  p_amount bigint,
  p_description text default null,
  p_reference_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  new_balance bigint;
begin
  if v_user_id is null then
    raise exception 'consume_credits: no authenticated user';
  end if;
  if p_amount < 0 then
    raise exception 'consume_credits: amount must be non-negative';
  end if;

  update public.credit_balances
     set balance        = balance - p_amount,
         lifetime_spent = lifetime_spent + p_amount,
         updated_at     = now()
   where user_id = v_user_id
     and balance >= p_amount
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.credit_transactions
    (user_id, amount, kind, description, balance_after, reference_id)
  values
    (v_user_id, -p_amount, 'usage', p_description, new_balance, p_reference_id);

  return new_balance;
end;
$$;

revoke all on function public.consume_credits(bigint, text, uuid) from public, anon;
grant execute on function public.consume_credits(bigint, text, uuid) to authenticated, service_role;

create policy "ai_requests: insert own" on public.ai_requests
  for insert with check (auth.uid() = owner_id);
create policy "ai_requests: update own" on public.ai_requests
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
