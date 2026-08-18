-- ===========================================================================
-- Roblox Brain — retrieval functions (Step 5)
--
-- All are SECURITY INVOKER (the default), so RLS applies to whoever calls
-- them. Every user-supplied value is a parameter — no string concatenation
-- anywhere, so query text can never become SQL.
--
-- Following the Step-3 lesson: EXECUTE is revoked from PUBLIC and granted
-- explicitly, because CREATE FUNCTION grants to PUBLIC by default and PostgREST
-- would otherwise expose these to anonymous callers.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Chunks still needing an embedding for a given version.
-- Done as a server-side anti-join: passing thousands of ids back through
-- PostgREST's query string overflows the URL and 400s.
-- ---------------------------------------------------------------------------
create or replace function public.knowledge_pending_chunks(
  p_version text,
  p_limit   integer default 1000,
  p_after   text default ''
)
returns table (id text, title text, symbols_text text, content text)
language sql
stable
set search_path = public
as $$
  select c.id, c.title, c.symbols_text, c.content
  from public.knowledge_chunks c
  where c.id > p_after
    and not exists (
      select 1 from public.knowledge_embeddings e
      where e.chunk_id = c.id and e.embedding_version = p_version
    )
  order by c.id
  limit least(greatest(p_limit, 1), 5000);
$$;

-- ---------------------------------------------------------------------------
-- Exact API symbol lookup.
-- match_score encodes match quality: exact qualified > exact member > prefix >
-- fuzzy. That ordering is what makes "Players.PlayerAdded" beat a page that
-- merely mentions players.
-- ---------------------------------------------------------------------------
create or replace function public.knowledge_symbol_lookup(
  p_symbols text[],
  p_limit   integer default 20
)
returns table (
  chunk_id text, source_id text, title text, heading_path text[], content text,
  api_symbols text[], source_repository text, source_type text, source_path text,
  source_url text, source_commit text, authority text, license text, category text,
  semantic_topic text, deprecated boolean, token_estimate integer, match_score real
)
language sql
stable
set search_path = public
as $$
  with needle as (
    select lower(trim(s)) as s from unnest(p_symbols) as s where trim(s) <> ''
  ),
  matched as (
    select
      sym.chunk_id,
      max(
        case
          when sym.symbol_lower = n.s then 1.0
          when lower(coalesce(sym.member, '')) = n.s then 0.85
          when sym.symbol_lower like n.s || '.%' or sym.symbol_lower like n.s || ':%' then 0.7
          when sym.symbol_lower like '%' || n.s || '%' then 0.45
          else 0.0
        end
      )::real as match_score
    from public.knowledge_api_symbols sym
    join needle n
      on sym.symbol_lower = n.s
      or lower(coalesce(sym.member, '')) = n.s
      or sym.symbol_lower like n.s || '.%'
      or sym.symbol_lower like n.s || ':%'
      or sym.symbol_lower like '%' || n.s || '%'
    where sym.chunk_id is not null
    group by sym.chunk_id
  )
  select
    c.id, c.source_id, c.title, c.heading_path, c.content, c.api_symbols,
    c.source_repository, c.source_type, d.source_path, d.source_url, d.source_commit,
    c.authority, d.license, c.category, c.semantic_topic, c.deprecated,
    c.token_estimate, m.match_score
  from matched m
  join public.knowledge_chunks c on c.id = m.chunk_id
  join public.knowledge_documents d on d.source_id = c.source_id
  where m.match_score > 0
  order by m.match_score desc, c.chunk_index asc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Lexical full-text search (weighted tsvector).
-- ---------------------------------------------------------------------------
create or replace function public.knowledge_lexical_search(
  p_query       text,
  p_limit       integer default 30,
  p_category    text default null,
  p_source_type text default null
)
returns table (
  chunk_id text, source_id text, title text, heading_path text[], content text,
  api_symbols text[], source_repository text, source_type text, source_path text,
  source_url text, source_commit text, authority text, license text, category text,
  semantic_topic text, deprecated boolean, token_estimate integer, rank real
)
language sql
stable
set search_path = public
as $$
  select
    c.id, c.source_id, c.title, c.heading_path, c.content, c.api_symbols,
    c.source_repository, c.source_type, d.source_path, d.source_url, d.source_commit,
    c.authority, d.license, c.category, c.semantic_topic, c.deprecated,
    c.token_estimate,
    ts_rank_cd(c.fts, websearch_to_tsquery('english', p_query))::real as rank
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.source_id = c.source_id
  where c.fts @@ websearch_to_tsquery('english', p_query)
    and (p_category is null or c.category = p_category)
    and (p_source_type is null or c.source_type = p_source_type)
  order by rank desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Vector similarity search (cosine).
-- ---------------------------------------------------------------------------
create or replace function public.knowledge_vector_search(
  p_embedding   text,
  p_version     text,
  p_limit       integer default 30,
  p_category    text default null,
  p_source_type text default null
)
returns table (
  chunk_id text, source_id text, title text, heading_path text[], content text,
  api_symbols text[], source_repository text, source_type text, source_path text,
  source_url text, source_commit text, authority text, license text, category text,
  semantic_topic text, deprecated boolean, token_estimate integer, similarity real
)
language sql
stable
set search_path = public
as $$
  select
    c.id, c.source_id, c.title, c.heading_path, c.content, c.api_symbols,
    c.source_repository, c.source_type, d.source_path, d.source_url, d.source_commit,
    c.authority, d.license, c.category, c.semantic_topic, c.deprecated,
    c.token_estimate,
    (1 - (e.embedding <=> p_embedding::vector))::real as similarity
  from public.knowledge_embeddings e
  join public.knowledge_chunks c on c.id = e.chunk_id
  join public.knowledge_documents d on d.source_id = c.source_id
  where e.embedding_version = p_version
    and (p_category is null or c.category = p_category)
    and (p_source_type is null or c.source_type = p_source_type)
  order by e.embedding <=> p_embedding::vector
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Code example search: symbol overlap first, then lexical over code text.
-- ---------------------------------------------------------------------------
create or replace function public.knowledge_code_search(
  p_query   text,
  p_symbols text[] default '{}',
  p_limit   integer default 6
)
returns table (
  example_id text, source_id text, language text, code text, context text,
  api_symbols text[], source_path text, source_url text, source_commit text,
  authority text, license text, rank real
)
language sql
stable
set search_path = public
as $$
  select
    ex.example_id, ex.source_id, ex.language, ex.code, ex.context, ex.api_symbols,
    ex.source_path, ex.source_url, ex.source_commit, ex.authority, ex.license,
    (
      coalesce(ts_rank_cd(ex.fts, websearch_to_tsquery('simple', p_query)), 0)
      + case when cardinality(p_symbols) > 0
               and ex.api_symbols && p_symbols then 0.6 else 0 end
    )::real as rank
  from public.knowledge_code_examples ex
  where (
      ex.fts @@ websearch_to_tsquery('simple', p_query)
      or (cardinality(p_symbols) > 0 and ex.api_symbols && p_symbols)
    )
  order by rank desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Grants: never leave these on the PUBLIC default.
-- ---------------------------------------------------------------------------
revoke all on function public.knowledge_pending_chunks(text, integer, text) from public, anon;
revoke all on function public.knowledge_symbol_lookup(text[], integer) from public, anon;
revoke all on function public.knowledge_lexical_search(text, integer, text, text) from public, anon;
revoke all on function public.knowledge_vector_search(text, text, integer, text, text) from public, anon;
revoke all on function public.knowledge_code_search(text, text[], integer) from public, anon;

grant execute on function public.knowledge_pending_chunks(text, integer, text) to service_role;
grant execute on function public.knowledge_symbol_lookup(text[], integer) to authenticated, service_role;
grant execute on function public.knowledge_lexical_search(text, integer, text, text) to authenticated, service_role;
grant execute on function public.knowledge_vector_search(text, text, integer, text, text) to authenticated, service_role;
grant execute on function public.knowledge_code_search(text, text[], integer) to authenticated, service_role;
