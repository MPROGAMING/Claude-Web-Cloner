-- ===========================================================================
-- Fix: SECURITY DEFINER functions were callable over the public REST API.
--
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default. 0001 revoked from
-- `anon` and `authenticated`, which does nothing while PUBLIC still holds the
-- grant — both roles inherit it. The practical effect was that anyone holding
-- the anon key could POST /rest/v1/rpc/grant_credits and mint unlimited
-- credits for any known user id.
--
-- 0001 has since been corrected, so a fresh database never has the hole. This
-- migration repairs a database created before that fix. It is idempotent.
-- ===========================================================================

revoke all on function public.consume_credits(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

grant execute on function public.consume_credits(uuid, bigint, text, uuid) to service_role;
grant execute on function public.grant_credits(uuid, bigint, text, text) to service_role;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
