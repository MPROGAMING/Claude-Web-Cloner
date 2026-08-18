-- ===========================================================================
-- Blockwright — initial schema
--
-- Design notes:
--   * Every user-owned table carries owner_id and is protected by RLS.
--   * The Studio bridge authenticates with a hashed token via the service role
--     and therefore performs its own authorization in application code.
--   * Credit mutations go through consume_credits()/grant_credits(), which are
--     SECURITY DEFINER so the balance can never be moved from the browser.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  display_name      text,
  avatar_url        text,
  roblox_username   text,
  default_model_id  text not null default 'anthropic:claude-sonnet-4-5',
  plan              text not null default 'free' check (plan in ('free','creator','studio')),
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- credit_balances  (one row per user, mutated only by SECURITY DEFINER fns)
-- ---------------------------------------------------------------------------
create table public.credit_balances (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  balance         bigint not null default 0 check (balance >= 0),
  lifetime_granted bigint not null default 0,
  lifetime_spent  bigint not null default 0,
  updated_at      timestamptz not null default now()
);

alter table public.credit_balances enable row level security;
create policy "credits: read own" on public.credit_balances
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy: the browser can never write the balance.

-- ---------------------------------------------------------------------------
-- credit_transactions (append-only ledger)
-- ---------------------------------------------------------------------------
create table public.credit_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       bigint not null,                      -- negative = spend
  kind         text not null check (kind in ('grant','signup_bonus','purchase','usage','refund','adjustment')),
  description  text,
  balance_after bigint not null,
  reference_id uuid,                                 -- ai_requests.id for usage
  created_at   timestamptz not null default now()
);

create index credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);

alter table public.credit_transactions enable row level security;
create policy "credit tx: read own" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  description   text check (char_length(description) <= 500),
  status        text not null default 'active' check (status in ('active','archived')),
  model_id      text not null default 'anthropic:claude-sonnet-4-5',
  template_slug text,
  icon          text not null default 'blocks',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;
create policy "projects: read own" on public.projects
  for select using (auth.uid() = owner_id);
create policy "projects: insert own" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "projects: update own" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "projects: delete own" on public.projects
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- project_files  (the generated Roblox project tree)
-- ---------------------------------------------------------------------------
create table public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  path        text not null check (char_length(path) between 1 and 240),
  content     text not null default '',
  kind        text not null default 'script'
              check (kind in ('script','localscript','module','config','doc','ui')),
  roblox_parent text,   -- e.g. ServerScriptService, ReplicatedStorage.Modules
  size_bytes  integer not null default 0,
  revision    integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, path)
);

create index project_files_project_idx on public.project_files (project_id, path);

alter table public.project_files enable row level security;
create policy "files: read own" on public.project_files
  for select using (auth.uid() = owner_id);
create policy "files: write own" on public.project_files
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- file_revisions (undo / diff history)
-- ---------------------------------------------------------------------------
create table public.file_revisions (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.project_files(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  revision    integer not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index file_revisions_file_idx on public.file_revisions (file_id, revision desc);

alter table public.file_revisions enable row level security;
create policy "revisions: read own" on public.file_revisions
  for select using (auth.uid() = owner_id);
create policy "revisions: insert own" on public.file_revisions
  for insert with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- conversations + messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_project_idx on public.conversations (project_id, updated_at desc);

alter table public.conversations enable row level security;
create policy "conversations: all own" on public.conversations
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  -- UIMessage.parts, stored verbatim so tool calls/results survive a reload
  parts           jsonb not null default '[]'::jsonb,
  model_id        text,
  seq             bigserial,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, seq);

alter table public.messages enable row level security;
create policy "messages: all own" on public.messages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- ai_requests (observability + usage accounting)
-- ---------------------------------------------------------------------------
create table public.ai_requests (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  provider        text not null,
  model_id        text not null,
  status          text not null default 'running'
                  check (status in ('running','succeeded','failed','aborted')),
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  reasoning_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  credits_charged bigint not null default 0,
  latency_ms      integer,
  tool_calls      integer not null default 0,
  error_code      text,
  error_message   text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index ai_requests_owner_created_idx on public.ai_requests (owner_id, created_at desc);
create index ai_requests_project_idx on public.ai_requests (project_id, created_at desc);

alter table public.ai_requests enable row level security;
create policy "ai_requests: read own" on public.ai_requests
  for select using (auth.uid() = owner_id);
create policy "ai_requests: insert own" on public.ai_requests
  for insert with check (auth.uid() = owner_id);
create policy "ai_requests: update own" on public.ai_requests
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- activity_events (human-readable project timeline)
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind       text not null,
  summary    text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index activity_owner_created_idx on public.activity_events (owner_id, created_at desc);
create index activity_project_created_idx on public.activity_events (project_id, created_at desc);

alter table public.activity_events enable row level security;
create policy "activity: read own" on public.activity_events
  for select using (auth.uid() = owner_id);
create policy "activity: insert own" on public.activity_events
  for insert with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- studio_connections  (one pairing per project)
-- ---------------------------------------------------------------------------
create table public.studio_connections (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null unique references public.projects(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  pair_code     text,                    -- 8 chars, cleared once claimed
  pair_expires_at timestamptz,
  token_hash    text,                    -- sha-256 of the plugin token
  status        text not null default 'pending'
                check (status in ('pending','connected','disconnected','expired')),
  place_name    text,
  place_id      text,
  studio_version text,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index studio_connections_pair_idx on public.studio_connections (pair_code);
create index studio_connections_token_idx on public.studio_connections (token_hash);

alter table public.studio_connections enable row level security;
create policy "studio: read own" on public.studio_connections
  for select using (auth.uid() = owner_id);
create policy "studio: write own" on public.studio_connections
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- studio_commands  (queue drained by the plugin)
-- ---------------------------------------------------------------------------
create table public.studio_commands (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.studio_connections(id) on delete set null,
  action        text not null,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'queued'
                check (status in ('queued','dispatched','succeeded','failed','expired')),
  result        jsonb,
  error_message text,
  created_at    timestamptz not null default now(),
  dispatched_at timestamptz,
  completed_at  timestamptz
);

create index studio_commands_queue_idx
  on public.studio_commands (project_id, status, created_at);

alter table public.studio_commands enable row level security;
create policy "studio commands: read own" on public.studio_commands
  for select using (auth.uid() = owner_id);
create policy "studio commands: insert own" on public.studio_commands
  for insert with check (auth.uid() = owner_id);

-- ===========================================================================
-- Functions
-- ===========================================================================

-- Provision profile + starting credits on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  starting_credits constant bigint := 2000;
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,'creator'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.credit_balances (user_id, balance, lifetime_granted)
  values (new.id, starting_credits, starting_credits)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, amount, kind, description, balance_after)
  values (new.id, starting_credits, 'signup_bonus', 'Welcome credits', starting_credits);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically spend credits.
--
-- The account comes from auth.uid(), never from an argument, so this is safe to
-- expose to `authenticated` — a caller cannot spend someone else's balance no
-- matter what it passes. That in turn keeps the service-role key out of the
-- generation hot path.
create or replace function public.consume_credits(
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

  -- Single statement = the row lock is held for the whole check-and-set, so
  -- two concurrent generations can never both pass the balance test.
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

-- Grant credits (used by signup bonus top-ups, admin adjustments, and later by
-- the Stripe webhook once billing is switched on).
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount bigint,
  p_kind text default 'grant',
  p_description text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if p_amount <= 0 then
    raise exception 'grant_credits: amount must be positive';
  end if;

  insert into public.credit_balances (user_id, balance, lifetime_granted)
  values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update
    set balance = public.credit_balances.balance + p_amount,
        lifetime_granted = public.credit_balances.lifetime_granted + p_amount,
        updated_at = now()
  returning balance into new_balance;

  insert into public.credit_transactions
    (user_id, amount, kind, description, balance_after)
  values (p_user_id, p_amount, p_kind, p_description, new_balance);

  return new_balance;
end;
$$;

-- IMPORTANT: CREATE FUNCTION grants EXECUTE to PUBLIC by default, and every
-- role inherits from PUBLIC. Revoking from anon/authenticated alone does
-- NOTHING — they keep the inherited grant, and PostgREST exposes the function
-- at /rest/v1/rpc/<name> to anyone holding the anon key. Revoke from PUBLIC.
revoke all on function public.consume_credits(bigint, text, uuid) from public, anon;
revoke all on function public.grant_credits(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Spending is safe for a session user (the function reads auth.uid()).
grant execute on function public.consume_credits(bigint, text, uuid) to authenticated, service_role;
-- Minting is not: it takes an explicit user id, so server only.
grant execute on function public.grant_credits(uuid, bigint, text, text) to service_role;

-- Keep updated_at fresh. search_path is pinned so a caller who can create
-- objects cannot shadow an unqualified reference inside the function body.
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

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger project_files_touch before update on public.project_files
  for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
