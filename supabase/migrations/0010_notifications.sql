-- ===========================================================================
-- Notifications.
--
-- A build takes minutes. People open another tab, or another page, and the
-- four agent tables record a run finishing, failing or stopping for approval
-- with nothing to tell the creator it happened. This table is that telling.
--
-- No functions are created here, deliberately, for the same reason as 0008 and
-- 0009: a new function in `public` is born with EXECUTE granted to
-- anon/authenticated/service_role via Supabase's ALTER DEFAULT PRIVILEGES and
-- is published by PostgREST at /rest/v1/rpc/<name>, so the safest new function
-- is the one you do not write. Everything below is plain table access governed
-- by policy.
-- ===========================================================================

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,

  -- All three references are optional and all cascade: a notification about a
  -- deleted project is a dead link, not history worth keeping.
  project_id   uuid references public.projects(id) on delete cascade,
  run_id       uuid references public.agent_runs(id) on delete cascade,
  changeset_id uuid references public.agent_changesets(id) on delete cascade,

  kind         text not null check (kind in (
                 'run_completed','run_failed','changeset_awaiting_approval','credits_low'
               )),

  title        text not null,
  body         text not null default '',
  -- Where clicking the row goes. Written by the server from ids it already
  -- holds; never taken from a request body.
  href         text,

  -- One row per real-world event. The chat route can close a run from either
  -- onError or onEnd and both handlers may fire, so "notify once" cannot rest
  -- on an in-process boolean — the unique index below is what actually
  -- enforces it, and a duplicate insert is a no-op rather than an error.
  dedupe_key   text not null,

  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create unique index notifications_dedupe_idx on public.notifications (owner_id, dedupe_key);
create index notifications_owner_idx on public.notifications (owner_id, created_at desc);

-- The unread badge is read on every poll, from every page. A partial index
-- keeps that count off the full history.
create index notifications_unread_idx on public.notifications (owner_id, created_at desc)
  where read_at is null;

-- --------------------------------------------------------------------------
-- RLS. Same shape as the agent tables: a row belongs to exactly one account,
-- which may read it, create it and mark it read. There is deliberately no
-- delete policy — the inbox is capped on read, not pruned by the browser.
-- --------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications: read own"   on public.notifications
  for select to authenticated using (owner_id = auth.uid());
create policy "notifications: insert own" on public.notifications
  for insert to authenticated with check (owner_id = auth.uid());
create policy "notifications: update own" on public.notifications
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
