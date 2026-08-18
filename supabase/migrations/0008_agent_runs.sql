-- ===========================================================================
-- Step 7 — agent run telemetry and changesets.
--
-- Four tables, all owner-scoped, all RLS. No functions are created here, which
-- is deliberate: the Step-6 lesson is that every new function in `public` is
-- born with EXECUTE granted to anon/authenticated/service_role via Supabase's
-- ALTER DEFAULT PRIVILEGES, so the safest new function is the one you do not
-- write. Everything below is plain table access governed by policy.
--
-- agent_changesets is the security-critical one. It holds the exact operations
-- a user approved, and apply replays that list rather than re-prompting the
-- model — so the row is the authorization record, not a log of one.
-- ===========================================================================

create table public.agent_runs (
  id              uuid primary key,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  ai_request_id   uuid references public.ai_requests(id) on delete set null,

  mode            text not null check (mode in ('preview','apply')),
  model_id        text not null,
  classification  text not null,
  requires_plan   boolean not null default false,

  state           text not null default 'IDLE'
                  check (state in (
                    'IDLE','ANALYZING','PLANNING','RETRIEVING_KNOWLEDGE','GENERATING',
                    'VALIDATING','EXECUTING_STUDIO','VERIFYING','REPAIRING',
                    'COMPLETED','FAILED','CANCELLED'
                  )),

  -- Set by the user to stop a run; polled between steps rather than signalled,
  -- so a cancelled run always stops at a defined point.
  cancelled       boolean not null default false,

  step_count      integer not null default 0,
  repair_attempts integer not null default 0,
  tool_calls      integer not null default 0,

  retrieval_ms    integer,
  generation_ms   integer,
  validation_ms   integer,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  credits_charged integer not null default 0,
  error_category  text,

  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index agent_runs_owner_idx   on public.agent_runs (owner_id, created_at desc);
create index agent_runs_project_idx on public.agent_runs (project_id, created_at desc);

-- Every state transition. `step_index` is the machine's own counter, so gaps or
-- repeats in it are themselves evidence of a bug.
create table public.agent_steps (
  id             bigserial primary key,
  run_id         uuid not null references public.agent_runs(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  step_index     integer not null,
  previous_state text not null,
  new_state      text not null,
  reason         text not null default '',
  created_at     timestamptz not null default now()
);

create index agent_steps_run_idx on public.agent_steps (run_id, step_index);

-- Tool invocations, summarised. Arguments and results are deliberately NOT
-- stored: script content already lives in project_files, and a tool result can
-- carry retrieved documentation, which is bulk with no audit value.
create table public.agent_tool_calls (
  id             bigserial primary key,
  run_id         uuid not null references public.agent_runs(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  tool_name      text not null,
  agent_state    text not null,
  ok             boolean not null,
  duration_ms    integer not null default 0,
  summary        text not null default '',
  error_category text,
  created_at     timestamptz not null default now()
);

create index agent_tool_calls_run_idx on public.agent_tool_calls (run_id, created_at);

create table public.agent_changesets (
  id              uuid primary key,
  run_id          uuid not null references public.agent_runs(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,

  status          text not null default 'draft'
                  check (status in (
                    'draft','pending_approval','approved','applied','rejected','failed','rolled_back'
                  )),

  operations      jsonb not null default '[]'::jsonb,
  issues          jsonb not null default '[]'::jsonb,
  operation_count integer not null default 0,

  created_at      timestamptz not null default now(),
  approved_at     timestamptz,
  applied_at      timestamptz
);

create index agent_changesets_run_idx     on public.agent_changesets (run_id);
create index agent_changesets_project_idx on public.agent_changesets (project_id, created_at desc);

-- --------------------------------------------------------------------------
-- RLS. A run is readable and writable only by the account that created it.
-- --------------------------------------------------------------------------
alter table public.agent_runs       enable row level security;
alter table public.agent_steps      enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_changesets enable row level security;

create policy "agent runs: read own"   on public.agent_runs
  for select to authenticated using (owner_id = auth.uid());
create policy "agent runs: insert own" on public.agent_runs
  for insert to authenticated with check (owner_id = auth.uid());
create policy "agent runs: update own" on public.agent_runs
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "agent steps: read own"   on public.agent_steps
  for select to authenticated using (owner_id = auth.uid());
create policy "agent steps: insert own" on public.agent_steps
  for insert to authenticated with check (owner_id = auth.uid());

create policy "agent tool calls: read own"   on public.agent_tool_calls
  for select to authenticated using (owner_id = auth.uid());
create policy "agent tool calls: insert own" on public.agent_tool_calls
  for insert to authenticated with check (owner_id = auth.uid());

-- A changeset may be read, created and transitioned by its owner. There is
-- deliberately no delete policy: an approval record that can be erased is not
-- an audit trail.
create policy "agent changesets: read own"   on public.agent_changesets
  for select to authenticated using (owner_id = auth.uid());
create policy "agent changesets: insert own" on public.agent_changesets
  for insert to authenticated with check (owner_id = auth.uid());
create policy "agent changesets: update own" on public.agent_changesets
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
