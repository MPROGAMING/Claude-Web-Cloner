-- ===========================================================================
-- Roblox Brain — knowledge retrieval schema (Step 5)
--
-- Global reference data, not user data: every signed-in user reads the same
-- Roblox documentation. The RLS model therefore differs deliberately from the
-- rest of the app — authenticated users may SELECT, and there are NO write
-- policies. Ingestion runs server-side with the service role.
--
-- Embeddings live in their own table keyed by (chunk, embedding_version) so a
-- model change creates a new version alongside the old rather than destroying
-- it.
--
-- Note on FTS: array_to_string() is only STABLE, not IMMUTABLE, so it cannot
-- appear in a generated column. Arrays are kept for filtering (GIN) and a
-- plain-text mirror column is written alongside for the tsvector.
-- ===========================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create table public.knowledge_sources (
  id            text primary key,
  remote        text not null,
  branch        text not null,
  commit        text not null check (char_length(commit) = 40),
  commit_date   timestamptz not null,
  license       text not null,
  attribution_required boolean not null default false,
  retrieved_at  timestamptz not null,
  document_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.knowledge_documents (
  source_id         text primary key,
  source_repository text not null references public.knowledge_sources(id) on delete cascade,
  source_commit     text not null,
  source_path       text not null,
  source_url        text,
  source_type       text not null,
  authority         text not null check (authority in ('canonical','secondary','historical')),
  license           text not null,
  retrieved_at      timestamptz not null,
  content_date      timestamptz not null,
  category          text not null,
  topic             text not null,
  semantic_topic    text,
  deprecated        boolean not null default false,
  title             text,
  heading_path      text[],
  structured        boolean not null default false,
  payload           jsonb not null,
  content_hash      text not null,
  chunk_total       integer not null default 0,
  created_at        timestamptz not null default now()
);

create index knowledge_documents_repo_idx       on public.knowledge_documents (source_repository);
create index knowledge_documents_type_idx       on public.knowledge_documents (source_type);
create index knowledge_documents_category_idx   on public.knowledge_documents (category);
create index knowledge_documents_authority_idx  on public.knowledge_documents (authority);
create index knowledge_documents_semantic_idx   on public.knowledge_documents (semantic_topic);
create index knowledge_documents_deprecated_idx on public.knowledge_documents (deprecated) where deprecated;
create index knowledge_documents_hash_idx       on public.knowledge_documents (content_hash);

create table public.knowledge_chunks (
  id                text primary key,
  source_id         text not null references public.knowledge_documents(source_id) on delete cascade,
  chunk_index       integer not null,
  chunk_total       integer not null,
  source_repository text not null,
  source_type       text not null,
  authority         text not null,
  category          text not null,
  semantic_topic    text,
  deprecated        boolean not null default false,
  title             text,
  heading_path      text[],
  heading_text      text not null default '',
  api_symbols       text[] not null default '{}',
  symbols_text      text not null default '',
  content           text not null,
  token_estimate    integer not null default 0,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(symbols_text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(heading_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored,
  created_at        timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create index knowledge_chunks_fts_idx        on public.knowledge_chunks using gin (fts);
create index knowledge_chunks_symbols_idx    on public.knowledge_chunks using gin (api_symbols);
create index knowledge_chunks_title_trgm_idx on public.knowledge_chunks using gin (title gin_trgm_ops);
create index knowledge_chunks_source_idx     on public.knowledge_chunks (source_id);
create index knowledge_chunks_type_idx       on public.knowledge_chunks (source_type);
create index knowledge_chunks_authority_idx  on public.knowledge_chunks (authority);

create table public.knowledge_embeddings (
  chunk_id             text not null references public.knowledge_chunks(id) on delete cascade,
  embedding_version    text not null,
  embedding_model      text not null,
  embedding_dimensions integer not null,
  embedding            vector(1536) not null,
  created_at           timestamptz not null default now(),
  primary key (chunk_id, embedding_version)
);

-- Build this AFTER bulk loading. HNSW insertion cost per row makes large
-- embedding upserts exceed the statement timeout; loading first and indexing
-- once is faster and produces a better-connected graph.
create index knowledge_embeddings_hnsw_idx
  on public.knowledge_embeddings using hnsw (embedding vector_cosine_ops);
create index knowledge_embeddings_version_idx on public.knowledge_embeddings (embedding_version);

create table public.knowledge_api_symbols (
  id            bigserial primary key,
  symbol        text not null,
  symbol_lower  text not null,
  parent        text,
  member        text,
  symbol_kind   text not null,
  partition     text,
  source_id     text not null references public.knowledge_documents(source_id) on delete cascade,
  chunk_id      text references public.knowledge_chunks(id) on delete set null,
  deprecated    boolean not null default false,
  summary       text,
  created_at    timestamptz not null default now()
);

create index knowledge_api_symbols_lower_idx  on public.knowledge_api_symbols (symbol_lower);
create index knowledge_api_symbols_member_idx on public.knowledge_api_symbols (lower(member));
create index knowledge_api_symbols_parent_idx on public.knowledge_api_symbols (lower(parent));
create index knowledge_api_symbols_trgm_idx   on public.knowledge_api_symbols using gin (symbol_lower gin_trgm_ops);
create index knowledge_api_symbols_kind_idx   on public.knowledge_api_symbols (symbol_kind);

-- Roblox documents overloaded functions as separate entries sharing a name
-- (Random:NextNumber, debug.info, table.insert and others). Including chunk_id
-- keeps every overload while still making re-ingestion idempotent.
create unique index knowledge_api_symbols_natural_key
  on public.knowledge_api_symbols (source_id, symbol, symbol_kind, chunk_id);

create table public.knowledge_code_examples (
  example_id        text primary key,
  source_id         text not null references public.knowledge_documents(source_id) on delete cascade,
  source_repository text not null,
  source_commit     text not null,
  source_path       text not null,
  source_url        text,
  language          text,
  code              text not null,
  context           text,
  authority         text not null,
  license           text not null,
  api_symbols       text[] not null default '{}',
  symbols_text      text not null default '',
  -- 'simple' rather than 'english': stemming would mangle identifiers such as
  -- FireServer into fireserv.
  fts tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(symbols_text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(context, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(code, '')), 'C')
  ) stored,
  created_at        timestamptz not null default now()
);

create index knowledge_code_fts_idx     on public.knowledge_code_examples using gin (fts);
create index knowledge_code_symbols_idx on public.knowledge_code_examples using gin (api_symbols);
create index knowledge_code_lang_idx    on public.knowledge_code_examples (language);

create table public.knowledge_retrieval_logs (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid references auth.users(id) on delete set null,
  project_id       uuid references public.projects(id) on delete set null,
  query            text not null,
  detected_symbols text[],
  filters          jsonb,
  strategy         text,
  result_count     integer not null default 0,
  top_score        real,
  latency_ms       integer,
  created_at       timestamptz not null default now()
);

create index knowledge_retrieval_logs_owner_idx on public.knowledge_retrieval_logs (owner_id, created_at desc);

alter table public.knowledge_sources        enable row level security;
alter table public.knowledge_documents      enable row level security;
alter table public.knowledge_chunks         enable row level security;
alter table public.knowledge_embeddings     enable row level security;
alter table public.knowledge_api_symbols    enable row level security;
alter table public.knowledge_code_examples  enable row level security;
alter table public.knowledge_retrieval_logs enable row level security;

create policy "knowledge sources: read"  on public.knowledge_sources       for select to authenticated using (true);
create policy "knowledge docs: read"     on public.knowledge_documents     for select to authenticated using (true);
create policy "knowledge chunks: read"   on public.knowledge_chunks        for select to authenticated using (true);
create policy "knowledge embed: read"    on public.knowledge_embeddings    for select to authenticated using (true);
create policy "knowledge symbols: read"  on public.knowledge_api_symbols   for select to authenticated using (true);
create policy "knowledge code: read"     on public.knowledge_code_examples for select to authenticated using (true);

create policy "retrieval logs: read own" on public.knowledge_retrieval_logs
  for select to authenticated using (auth.uid() = owner_id);
create policy "retrieval logs: insert own" on public.knowledge_retrieval_logs
  for insert to authenticated with check (auth.uid() = owner_id);
