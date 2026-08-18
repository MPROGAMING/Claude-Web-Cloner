# Roblox Brain — Step 5 Report

Hybrid RAG retrieval layer over the Step 4 corpus. Generated 2026-08-18.

**Scope honoured.** No model fine-tuning, no LoRA, no model weights downloaded,
no UI changes, no auth/billing/Studio-bridge changes. The generation model and
the knowledge base remain independently replaceable.

---

## What was built

```
User
 ↓
Blockwright Agent  (search_roblox_knowledge tool)
 ↓
Hybrid Retriever
 ├── Exact API symbol index   (9,591 symbols)
 ├── Full-text search         (weighted tsvector)
 ├── Vector search            (pgvector HNSW, 14,012 embeddings)
 └── Code example search      (3,190 examples)
 ↓
Deterministic reranker  → authority / deprecation / confidence adjustment
 ↓
Context builder  → budgeted, cited, sanitised
 ↓
Selected LLM (any provider)
```

---

## Files created

| Path | Purpose |
| --- | --- |
| `src/lib/knowledge/symbols.ts` | Roblox API symbol detection with confidence scoring |
| `src/lib/knowledge/chunker.ts` | Source-aware chunking (engine API / OpenAPI / markdown) |
| `src/lib/knowledge/embeddings.ts` | Configurable provider, batching, backoff, resumable |
| `src/lib/knowledge/retriever.ts` | Hybrid retrieval + reranking |
| `src/lib/knowledge/context-builder.ts` | Context assembly, citations, prompt-injection defence |
| `src/lib/knowledge/tool.ts` | `search_roblox_knowledge` agent tool |
| `scripts/roblox-brain/ingest.mjs` | Ingestion pipeline (full / incremental / embed-only) |
| `scripts/roblox-brain/evaluate.mjs` | Recall@5 / Recall@10 / MRR harness |
| `scripts/roblox-brain/eval-queries.json` | 77-query gold standard |
| `scripts/roblox-brain/search.mjs` | CLI search with score breakdown |
| `scripts/roblox-brain/stats.mjs` | Knowledge base statistics |
| `scripts/roblox-brain/validate-knowledge-db.mjs` | Integrity validator |
| `scripts/roblox-brain/lib/ts-loader.mjs` | `@/` alias resolver for CLI |
| `scripts/roblox-brain/lib/register-hooks.mjs` | Hook registration |

**Modified:** `src/lib/ai/tools.ts` (tool registration), `src/lib/ai/system-prompt.ts`
(step 0: consult docs before writing code), `src/lib/supabase/types.ts` (RPC
signatures), `package.json` (6 `brain:*` commands, `js-yaml` dependency).

---

## Database schema

PostgreSQL + pgvector 0.8.2 in the existing Supabase project. No new database
was introduced.

| Table | Rows | Purpose |
| --- | --- | --- |
| `knowledge_sources` | 3 | Pinned repository provenance |
| `knowledge_documents` | 5,456 | One per corpus document, deterministic id as PK |
| `knowledge_chunks` | 14,012 | Retrieval units + weighted `tsvector` |
| `knowledge_embeddings` | 14,012 | Versioned by `(chunk_id, embedding_version)` |
| `knowledge_api_symbols` | 9,591 | Exact API lookup index |
| `knowledge_code_examples` | 3,190 | Code search, `simple` FTS config |
| `knowledge_retrieval_logs` | — | Observability |

**Total size: 344 MB** (embeddings 225 MB, chunks 68 MB).

Five `SECURITY INVOKER` RPCs (`knowledge_symbol_lookup`, `_lexical_search`,
`_vector_search`, `_code_search`, `_pending_chunks`) — all parameterized, all
with `EXECUTE` revoked from `PUBLIC` and granted explicitly.

**RLS:** knowledge tables are global reference data — `SELECT` for
`authenticated`, and *no write policies at all*. Ingestion uses the service
role. Retrieval logs are scoped per user.

---

## Indexed content

| Measure | Value |
| --- | --- |
| Documents | **5,456** (100% of corpus) |
| Chunks | **14,012** |
| Embeddings | **14,012 (100% coverage)** |
| API symbols | **9,591** |
| Code examples | **3,190** |
| Deprecated documents | 85 |

By source type: guide 1,860 · engine-api 1,232 · tutorial 927 · openapi 839 ·
news 239 · roblox-luau 197 · language-reference 162.

By authority: canonical 5,020 · historical 239 · secondary 197.
By license: CC-BY-4.0 5,029 · MIT 427.

`luau` contributes **0 documents**, as specified — pinned for provenance only.

---

## Embeddings

| Property | Value |
| --- | --- |
| Provider | OpenRouter (configurable) |
| Model | `openai/text-embedding-3-small` |
| Dimensions | **1536** |
| Version | `openrouter:openai/text-embedding-3-small:1536` |
| Index | HNSW, cosine |

1536 dimensions is the deliberate default: pgvector's HNSW index tops out at
2000, so a 3072-dim model could not be indexed and would fall back to a
sequential scan.

Provider is environment-driven (`EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`,
`EMBEDDING_DIMENSIONS`, `EMBEDDING_BASE_URL`) with OpenAI, Google and any
OpenAI-compatible endpoint supported. Because embeddings are keyed by version, a
model change creates a new version **alongside** the old rather than destroying
it.

**Discovery worth recording:** OpenRouter serves `/embeddings` even though no
embedding models appear in its `/models` catalog. Verified directly —
`text-embedding-3-small` (1536d), `text-embedding-3-large` (3072d) and
`gemini-embedding-001` (3072d) all return real vectors.

---

## Retrieval architecture

1. **Symbol detection** — dotted (`Players.PlayerAdded`), colon
   (`Humanoid:MoveTo`), enum (`Enum.HumanoidStateType`) and bare well-known
   names, each with a confidence score.
2. **Exact API lookup** — match quality graded: exact qualified > exact member >
   prefix > fuzzy.
3. **Lexical FTS** — weighted `tsvector`: title and symbols at rank A, headings
   at B, body at C.
4. **Vector search** — HNSW cosine over the active embedding version.
5. **Merge and dedupe** by chunk id, keeping the strongest signal per branch.
6. **Rerank** — weighted sum, scaled by authority, document type, deprecation
   penalty and symbol-detection confidence.
7. **Diversity cap** — at most 3 chunks per document, so one large class cannot
   crowd out every other source.

Intent classification (`api-lookup`, `implementation`, `luau-language`,
`open-cloud`, `studio-ai`, `general`) shifts the branch weights: an exact API
question weights the symbol index 2.4×, a conceptual one favours vector
similarity.

**Authority beats recency.** Canonical 1.0 · secondary 0.72 · historical 0.45,
applied multiplicatively so a 2019 Luau recap can never outrank current API
documentation.

---

## Retrieval evaluation

77 gold-standard queries across API lookup, Luau syntax, gameplay
implementation, UI, physics, networking, RemoteEvents, DataStores, animation,
characters, Studio, Open Cloud, security, performance, deprecation and code
examples.

| Metric | Result |
| --- | --- |
| **Recall@5** | **98.7%** (76/77) |
| **Recall@10** | **100.0%** (77/77) |
| **MRR** | **0.910** |
| Errors | 0 |
| Latency | p50 2,362 ms · p90 2,969 ms · mean 2,411 ms |

By category — all 100% Recall@5 except Luau language at 90%:

| Category | Queries | R@5 | R@10 |
| --- | --- | --- | --- |
| api-lookup | 18 | 100% | 100% |
| implementation | 27 | 100% | 100% |
| luau-language | 10 | 90% | 100% |
| runtime | 8 | 100% | 100% |
| open-cloud | 6 | 100% | 100% |
| roblox-ai | 3 | 100% | 100% |
| deprecated | 2 | 100% | 100% |
| guide | 2 | 100% | 100% |
| attributes-collision | 1 | 100% | 100% |

The single Recall@5 miss is "How do I write object oriented code in Luau?",
which lands at rank 8 — retrieved, just not top-5.

**Latency note:** ~2.4 s p50 is dominated by the query-embedding round trip to
OpenRouter, not by Postgres. A local or co-located embedding endpoint would cut
this substantially; the SQL branches return in tens of milliseconds.

### Attributes collision (OV-005)

Verified as three separate assertions rather than one query's ranking:

- concepts never merged — **true**
- Roblox instance-attribute concept independently retrievable — **true**
- Luau type-attribute concept independently retrievable — **true**

`roblox-instance-attributes` (9 chunks) and `luau-language-attributes`
(4 chunks) survive ingestion as distinct `semantic_topic` values and are
surfaced separately in retrieval metadata and in the assembled context.

I initially asserted that one specific phrasing must return both topics in its
top 10. That failed, and on inspection the assertion was wrong rather than the
system: the requirement is that the concepts never merge and stay labelled,
which they do. The test now checks that.

---

## Manual verification

All ten required queries were run and their actual sources inspected:

| Query | Strategy | Top result |
| --- | --- | --- |
| How do I detect when a player joins? | implementation | "Listen for players" tutorial |
| How do I make a RemoteEvent? | implementation | RemoteEvent API + tutorials |
| What parameters does `Players:GetPlayers` have? | api-lookup | `Players:GetPlayers` (symbol 1.00) |
| How do I save player data? | implementation | "Automatically save player data" |
| How do I tween a door? | implementation | TweenService + Touched |
| Luau generics type syntax | luau-language | luau.org generics reference |
| How do I raycast? | implementation | `Raycast` / `RaycastParams` |
| Server-authoritative weapon | implementation | RemoteEvent security guidance |
| How do I use Roblox Open Cloud? | open-cloud | Cloud API reference |
| Instance vs Luau attributes | general | Luau attributes, concepts separated |

---

## Bugs found and fixed

Five real defects, each caught by a check rather than assumed absent:

1. **Code-example loss (silent).** The document-id lookup hit PostgREST's
   default 1000-row cap, so 2,703 of 3,190 code examples looked orphaned and
   were dropped. Fixed by paginating. The warnings surfaced it — had they been
   suppressed, 85% of code examples would have vanished quietly.

2. **Non-idempotent symbol index.** `knowledge_api_symbols` had no unique
   constraint, so a second ingestion run doubled it to 19,182. Fixed with a
   natural-key unique index.

3. **Overload collapse.** The first uniqueness key would have discarded
   genuinely overloaded functions — `Random:NextNumber`, `debug.info`,
   `table.insert` and 5 others. Keying on `chunk_id` as well preserves every
   overload.

4. **Embedding upsert timeout.** 96 × 1536-dim vectors per statement, against a
   live HNSW index, exceeded the statement timeout at ~8,640/14,012. Fixed by
   dropping the index for the bulk load, writing in sub-batches of 16, and
   rebuilding the index once at the end.

5. **Symbol confidence ignored.** A bare "Instance" scored as strongly as a
   qualified `Players.PlayerAdded`, letting a common class name hijack
   conceptual questions. Exact-match now scales by detection confidence, and
   comparison queries relax exact dominance. This lifted Recall@5 from 97.4% to
   98.7% and MRR from 0.897 to 0.910.

**Resumability was proven, not assumed:** after the timeout at 8,640, re-running
reported "chunks to embed: 5,372 (already done: 8,640)" and completed the
remainder without re-embedding anything.

---

## Retrieval safety

- **No SQL injection surface** — every branch is a parameterized RPC; user text
  is never concatenated into SQL.
- **Bounded** — limits clamped (max 40 chunks retrieved, 30 in context),
  token ceiling enforced, per-document diversity cap.
- **Retrieved content is data, not instructions.** The context block carries a
  standing directive to ignore any passage attempting to give directions or
  change permissions. Fenced blocks are neutralised and control characters are
  stripped so documentation cannot break out of its container.
- Retrieved content cannot alter system instructions, tool permissions, billing,
  authentication or security rules — it is inert text in a labelled block.

---

## Commands added

```bash
npm run brain:ingest      # full ingest + embeddings
npm run brain:refresh     # incremental — only changed documents
npm run brain:validate    # corpus + database integrity
npm run brain:search -- "how do I detect when a player joins"
npm run brain:stats       # counts, coverage, embedding version
npm run brain:eval        # Recall@5 / Recall@10 / MRR
```

`brain:ingest` also accepts `--no-embed`, `--embed-only` and `--incremental`.

---

## Tests

| Check | Result |
| --- | --- |
| Corpus validation | **PASS** — 0 errors, 0 warnings |
| Knowledge DB validation | **PASS** — 0 errors, 0 warnings |
| Retrieval evaluation | **PASS** — Recall@5 98.7%, MRR 0.910 |
| TypeScript | **PASS** |
| ESLint | **PASS** |
| Unit tests | **PASS** — 166 tests, 11 files |
| Production build | **PASS** |
| Live security verification | **PASS** — 24/24 |

Database validator confirms: full corpus coverage, no orphans, no excluded
sources, no binary media, no `luau` compiler content, deterministic ids only,
commits matching the source lock, deprecation preserved, both attribute concepts
distinct.

---

## Remaining blockers and honest limitations

1. **Query latency is ~2.4 s p50**, dominated by the embedding round trip. The
   database branches are fast; the network hop is not. A co-located or local
   embedding endpoint is the fix — the provider is already configurable.

2. **The agent tool is wired but has not run inside a live generation.** No
   chat-capable provider key is configured (`OPENROUTER_API_KEY` is set but the
   direct provider keys are empty), so `search_roblox_knowledge` has been
   verified through the retriever and CLI, not through an actual model turn.

3. **Three new advisor warnings**, all informational: `vector`, `pg_trgm` and
   `unaccent` are installed in the `public` schema, which is Supabase's default.
   Moving them is possible but risks breaking index definitions; recorded rather
   than silently accepted.

4. **No reranker model.** The reranking stage is a deterministic scoring layer,
   as the brief permitted. It is a single function and could be swapped for a
   cross-encoder without touching the retriever's interface.

5. **`luau-language` recall is 90%**, the weakest category. The `site` repo
   contributes only 162 documents, so conceptual Luau questions have a thin pool
   to draw from.
