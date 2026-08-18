-- ===========================================================================
-- Close unintended `authenticated` EXECUTE grants on server-only functions.
--
-- Found by querying live ACLs during Step 6 verification: the migration that
-- created `knowledge_pending_chunks` granted it to `service_role` only, yet the
-- live grant included `authenticated`.
--
-- Why: this project already learned that CREATE FUNCTION grants EXECUTE to
-- PUBLIC. On Supabase there is a *second*, independent channel. Supabase ships
--
--   alter default privileges in schema public
--     grant execute on functions to anon, authenticated, service_role;
--
-- Once a pg_default_acl entry exists, Postgres applies it INSTEAD of the
-- built-in PUBLIC default. So a new function is born with three explicit role
-- grants and no PUBLIC entry at all. `revoke ... from public, anon` therefore
-- looks correct, passes review, and still leaves `authenticated` holding
-- EXECUTE.
--
-- The rule this establishes: revoke from `public, anon, authenticated`, then
-- grant back only the roles that are actually intended.
--
-- Impact of the specific leak being closed here was limited, and is recorded
-- honestly rather than overstated: knowledge_pending_chunks is SECURITY INVOKER
-- and knowledge_chunks/knowledge_embeddings both carry `for select to
-- authenticated using (true)` policies, so a signed-in caller could already
-- read the same rows directly. No privilege escalation occurred. What it did
-- expose is an unbilled, compute-heavy anti-join over every chunk, and — more
-- importantly — a pattern that would silently expose the next function meant to
-- be server-only.
-- ===========================================================================

-- Ingestion helper: service_role only. Never reached from a browser.
revoke all on function public.knowledge_pending_chunks(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.knowledge_pending_chunks(text, integer, text)
  to service_role;

-- Re-assert the intended grants on the read-side retrieval functions. These are
-- deliberately callable by `authenticated`: they are SECURITY INVOKER, so RLS
-- decides what comes back, and the corpus they read is public documentation
-- (CC-BY-4.0 prose, MIT code) already exposed by the knowledge_* read policies.
revoke all on function public.knowledge_symbol_lookup(text[], integer)
  from public, anon;
revoke all on function public.knowledge_lexical_search(text, integer, text, text)
  from public, anon;
revoke all on function public.knowledge_vector_search(text, text, integer, text, text)
  from public, anon;
revoke all on function public.knowledge_code_search(text, text[], integer)
  from public, anon;

grant execute on function public.knowledge_symbol_lookup(text[], integer)
  to authenticated, service_role;
grant execute on function public.knowledge_lexical_search(text, integer, text, text)
  to authenticated, service_role;
grant execute on function public.knowledge_vector_search(text, text, integer, text, text)
  to authenticated, service_role;
grant execute on function public.knowledge_code_search(text, text[], integer)
  to authenticated, service_role;

-- Credit functions: unchanged intent, restated so the whole invariant lives in
-- one place. grant_credits takes a user id and must never reach a browser;
-- consume_credits reads auth.uid() and is safe for signed-in callers.
revoke all on function public.grant_credits(uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, bigint, text, text)
  to service_role;

revoke all on function public.consume_credits(bigint, text, uuid)
  from public, anon;
grant execute on function public.consume_credits(bigint, text, uuid)
  to authenticated, service_role;
