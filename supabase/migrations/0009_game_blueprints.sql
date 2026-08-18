-- ===========================================================================
-- Game Blueprints.
--
-- The artefact between "I want a zombie game" and thirty Luau files: the plan
-- the creator actually reviews, edits and approves. An approved blueprint
-- becomes durable project context the agent follows on every later build.
--
-- No functions are created here, deliberately. The Step-6 finding was that a
-- new function in `public` is born with EXECUTE granted to anon/authenticated
-- via Supabase's ALTER DEFAULT PRIVILEGES, so the safest new function is the
-- one you do not write. This is plain table access governed by policy.
-- ===========================================================================

create table public.game_blueprints (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,

  idea           text not null,
  questions      jsonb not null default '[]'::jsonb,
  answers        jsonb not null default '[]'::jsonb,
  blueprint      jsonb,
  issues         jsonb not null default '[]'::jsonb,

  status         text not null default 'questions'
                 check (status in ('questions','draft','approved','superseded')),
  version        integer not null default 1,

  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  credits_charged integer not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  approved_at    timestamptz
);

create index game_blueprints_project_idx on public.game_blueprints (project_id, created_at desc);
create index game_blueprints_owner_idx   on public.game_blueprints (owner_id, created_at desc);

-- One approved blueprint per project: approving a new one supersedes the old,
-- so the agent never has two conflicting sets of approved decisions to follow.
create unique index game_blueprints_one_approved
  on public.game_blueprints (project_id)
  where status = 'approved';

alter table public.game_blueprints enable row level security;

create policy "blueprints: read own"   on public.game_blueprints
  for select to authenticated using (owner_id = auth.uid());
create policy "blueprints: insert own" on public.game_blueprints
  for insert to authenticated with check (owner_id = auth.uid());
create policy "blueprints: update own" on public.game_blueprints
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "blueprints: delete own" on public.game_blueprints
  for delete to authenticated using (owner_id = auth.uid());
