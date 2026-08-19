-- ===========================================================================
-- Project Memory.
--
-- Every chat turn rebuilds context from the file tree and the recent messages,
-- so a decision the creator made three days ago ("crystals respawn every 45s",
-- "the currency is called Sparks", "we are not doing a shop") is gone the
-- moment it scrolls out of the window. The agent then contradicts itself, and
-- the creator has to re-litigate settled choices.
--
-- This table is the durable half of that context: short, atomic, attributable
-- facts that outlive a conversation.
--
-- Three shape decisions worth the ink:
--
--   * Corrections SUPERSEDE, they do not overwrite. `superseded_by` points
--     forward at the row that replaced this one, so "we renamed Sparks to
--     Embers" keeps both halves and the agent can be told which won. A
--     correction that erases its own history cannot be audited or undone.
--
--   * `content_key` is the normalised form of `content`, and the unique index
--     over it covers only LIVE rows. That is the dedup: an agent that hears
--     the same decision on five turns stores it once, and a superseded fact
--     does not block re-learning the same thing later.
--
--   * Hard DELETE is allowed, unlike agent_changesets. This table is not an
--     audit trail — it is context the agent acts on, so a creator who says
--     "forget that" must actually be able to remove it. Memory the user cannot
--     correct is worse than no memory at all.
--
-- No functions are created here, deliberately, for the reason established in
-- 0006: a new function in `public` is born with EXECUTE granted to
-- anon/authenticated by Supabase's ALTER DEFAULT PRIVILEGES, so the safest new
-- function is the one you do not write. The one function referenced below,
-- touch_updated_at(), already exists and was already revoked in 0001.
-- ===========================================================================

create table public.project_memory (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,

  -- Coarse buckets, not a taxonomy. They exist so the prompt can group facts
  -- and so the UI can show a creator what sort of thing was remembered.
  kind           text not null default 'fact'
                 check (kind in ('decision','constraint','preference','terminology','fact')),

  -- Short and atomic on purpose. A remembered paragraph is a summary, and a
  -- summary cannot be superseded cleanly when one clause of it changes.
  content        text not null check (char_length(content) between 3 and 400),

  -- Who produced this. 'user' outranks 'agent' when the two disagree.
  source         text not null default 'agent'
                 check (source in ('agent','user','blueprint')),

  -- Attribution. Both are nullable and both null out rather than cascade: a
  -- deleted run must not delete the decision it recorded.
  source_run_id     uuid references public.agent_runs(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,

  -- Correction chain. Live facts are exactly those with superseded_by is null.
  --
  -- ON DELETE CASCADE, not SET NULL: deleting the fact that corrected an older
  -- one must not resurrect the older one as live. Postgres walks the chain, so
  -- "forget this" removes the fact and the history behind it in one statement.
  superseded_by  uuid references public.project_memory(id) on delete cascade,
  superseded_at  timestamptz,

  -- Normalised content, maintained by the writer. Stored rather than computed
  -- in an expression index so the dedup rule is one obvious column a reader
  -- can select, and so normalisation can change without a schema migration.
  content_key    text not null check (char_length(content_key) between 1 and 400),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A row is superseded, or it is not. Half-set state would make "live" mean
  -- two different things depending on which column you read.
  constraint project_memory_supersession_complete
    check ((superseded_by is null) = (superseded_at is null)),
  -- A fact cannot supersede itself; that would make it both live and dead.
  constraint project_memory_no_self_supersede check (superseded_by is distinct from id)
);

create index project_memory_project_idx on public.project_memory (project_id, created_at desc);
create index project_memory_owner_idx   on public.project_memory (owner_id, created_at desc);

-- The dedup rule. Partial on live rows so a superseded fact neither blocks the
-- row that replaced it nor prevents the same decision being made again later.
create unique index project_memory_live_key
  on public.project_memory (project_id, content_key)
  where superseded_by is null;

-- Reading live memory is the hot path: it happens on every chat turn.
create index project_memory_live_idx
  on public.project_memory (project_id, created_at desc)
  where superseded_by is null;

create trigger project_memory_touch before update on public.project_memory
  for each row execute function public.touch_updated_at();

alter table public.project_memory enable row level security;

create policy "project memory: read own"   on public.project_memory
  for select to authenticated using (owner_id = auth.uid());
create policy "project memory: insert own" on public.project_memory
  for insert to authenticated with check (owner_id = auth.uid());
create policy "project memory: update own" on public.project_memory
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "project memory: delete own" on public.project_memory
  for delete to authenticated using (owner_id = auth.uid());
