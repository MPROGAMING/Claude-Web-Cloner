# Roblox Brain — Step 4 Report

Source normalization and corpus build. Generated 2026-08-18.

**Scope honoured.** No embeddings, no vector database, no retrieval or RAG, no
model training, no AI-provider changes, no Blockwright UI / auth / credits
changes, no production chat connection, no LFS media downloaded. The corpus is a
local normalized set of JSON documents on disk and nothing else.

---

## What was processed

Inputs are the three Step 3 locked commits. The normalizer verifies each
repository's HEAD against `source-lock.json` before doing any work and refuses
to run on drift — a corpus built from an unknown commit would carry provenance
that is simply false.

| Repository | Locked commit | Verified | Role |
| --- | --- | --- | --- |
| creator-docs | `bac0b51429b324e4cc2dd76c93b94e8f64d0a2e0` | yes | Engine API, cloud, tutorials, guides, AI docs |
| site | `28edb95d3c67e8c140181efdc027d44b534d5106` | yes | Canonical Luau language reference |
| luau | `6dafc0dd9909efe534c825d1b1184644e1f7a4e4` | yes | **Reference only — 0 documents** |

`luau` contributed nothing to the corpus, as specified. Its compiler sources,
tests, benchmarks and fuzz corpus were never read for content.

---

## Corpus statistics

**5,456 normalized documents**, 34 MB on disk.

| Category | Documents |
| --- | --- |
| Engine API | 1,232 |
| Open Cloud operations | 839 |
| Guides (Roblox topics + cloud + scripting) | 1,595 |
| Tutorials | 927 |
| Luau news / history | 239 |
| creator-docs Luau (secondary) | 197 |
| Luau language reference (canonical) | 162 |
| Roblox runtime / scripting | 164 |
| Assistant / AI | 101 |

Layout:

```
docs/roblox-brain/corpus/
├── api/          1,232 engine documents (11 MB)
├── cloud/          839 operations + schema registry (6.7 MB)
├── guides/       1,595 documents (5.9 MB)
├── tutorials/      927 documents (5.0 MB)
├── language/       359 documents (1.6 MB)
├── documents/      340 documents (1.5 MB)
├── metadata/     code-examples.json, duplicates.json (2.7 MB)
├── reports/      failures.json
└── manifest.json
```

---

## Engine API statistics

| Measure | Value |
| --- | --- |
| Documents | 1,232 |
| Members preserved | **8,359** |
| Structure preserved (validator-confirmed) | 1,232 / 1,232 |
| Deprecated | 85 |

Each document keeps its typed shape under an `api` object — `properties`,
`methods`, `events`, `callbacks`, `functions`, `items` remain arrays of member
objects, each with its own `name`, `summary`, `description`, `parameters`,
`returns`, `tags`, `security`, `thread_safety`, `deprecation_message` and
`code_samples`. Nothing was flattened into prose.

Fields Roblox emits that the schema did not anticipate are kept under
`preserved_unknown_fields` rather than silently dropped. Source YAML was never
modified.

---

## OpenAPI statistics

| Measure | Value |
| --- | --- |
| Operations normalized | **839** |
| Schemas in registry | **1,330** |
| Operations with an upstream `operationId` | 197 |
| Duplicate operations skipped | 94 |

One document per operation, preserving `operationId`, `summary`, `description`,
`tags`, `parameters`, `requestBody`, `responses`, `security`, `servers` and
`deprecated`.

Schemas live in a shared registry at `cloud/_schema-registry.json`, keyed
`<specFile>#<SchemaName>`. Operations carry `schema_refs` pointing into it
rather than inlining large definitions — 1,330 schemas duplicated across 839
operations would have bloated the corpus for no gain.

All 13 specs declared OpenAPI 3.0.0–3.0.4 and validated against their declared
version. The 94 skipped operations are per-service specs re-stating an operation
the aggregate `openapi.json` already defines; the aggregate wins by
`(method, path)`. Every skip is recorded in `reports/failures.json` — none were
silent.

`operationId` is absent upstream for 642 operations. That is Roblox's data, not
a normalization loss, so the key is preserved as `null` rather than invented.

---

## Luau statistics

| Source | Documents | Authority |
| --- | --- | --- |
| site — language reference | 162 | **canonical** |
| site — guides | included in guides | canonical |
| site — news | 239 | **historical** |
| creator-docs — Luau pages | 197 | **secondary** |

Heading-aware extraction throughout: heading hierarchy preserved as
`heading_path`, code fences preserved byte-for-byte, tables and links retained
and counted. The splitter tracks fence state, so a `#` inside a code block is
never mistaken for a heading and no sample is ever cut in half.

News documents carry `content_date` parsed from the filename date prefix, plus
`retrieval_weight: "low"` and `historical: true`, so a 2019 recap can never
outrank current API material.

---

## Tutorial statistics

927 documents, **all 927** carrying `tutorial_sequence` metadata.

Sequence is derived from the directory structure — `course`, `series`, `lesson`,
`step` — and every document records `sequence_inferred_from: "path structure"`.
Where the path gives no deeper level, the field is simply absent. No
relationships were invented.

---

## Guide statistics

1,595 guide documents, plus 164 scripting and 101 AI/Assistant documents.

Scripting documents receive source-derived tags (`security`, `events`,
`scheduler`, `capabilities`, `replication`, `server-client`) rather than a single
hard-coded category.

Assistant/AI documents are tagged `roblox-ai` / `roblox-assistant` and flagged
`advisory_only: true` with an explicit note that they must not override Engine
API facts.

---

## Code examples

**3,190 examples** in `metadata/code-examples.json`.

| Language | Count |
| --- | --- |
| luau | 1,380 |
| lua | 1,075 |
| c | 256 |
| unlabelled | 218 |
| bash | 71 |
| text | 61 |

Every example carries `example_id`, `source_id`, `source_path`, `source_url`,
`language`, `code`, `context`, `authority` and `license`. Code is stored
verbatim — never reformatted, corrected or truncated.

**All 3,190 are licensed MIT**, including those from creator-docs, whose prose is
CC-BY-4.0 but whose code samples are MIT. Nothing was extracted from
`luau/tests`, `luau/bench` or `luau/fuzz`; the validator asserts this.

---

## Deprecated APIs

**85 Engine API documents** are marked `deprecated: true`.

Detection: a non-empty `deprecation_message`, **or** a `Deprecated` tag. An API
tagged deprecated without a message is still marked, as required. Deprecated
members are additionally flagged individually inside `api.*[].deprecated`.

Nothing deprecated was deleted — it is marked so a later retriever can down-rank
it.

---

## Deduplication

| Kind | Groups | Action |
| --- | --- | --- |
| Exact duplicates | **6** | One canonical retained, duplicate ids recorded |
| Near duplicates | **403** | **Reported only — nothing merged** |

Exact duplicates are detected by content hash; the duplicate carries
`exact_duplicate_of` pointing at the canonical id. Near duplicates (same title +
same source type, e.g. many pages with an "Overview" heading) are listed in
`metadata/duplicates.json` for human review and were deliberately left alone.

---

## License distribution

| License | Documents |
| --- | --- |
| CC-BY-4.0 | 5,029 |
| MIT | 427 |

Prose and code licences are tracked separately: creator-docs prose is
CC-BY-4.0 while its code samples are MIT, and every code example records MIT
independently of its parent document. No licence was guessed — each is taken
from the repository's `source-lock.json` entry.

---

## Authority distribution

| Authority | Documents |
| --- | --- |
| canonical | 5,020 |
| historical | 239 |
| secondary | 197 |

Overlap rules from Step 3 are enforced in the data: creator-docs Luau pages are
`secondary` and carry `canonical_conflict_resolution` naming luau.org as the
winner (OV-001).

### Attributes collision (OV-005)

Both concepts exist and are separated:

| Path | `semantic_topic` |
| --- | --- |
| `creator-docs` → `content/en-us/scripting/attributes.md` | `roblox-instance-attributes` |
| `site` → `src/content/docs/reference/attributes.md` | `luau-language-attributes` |

The validator fails the build if either page carries the wrong topic.

---

## Failures

**0 failures.**

One failure occurred on the first run and was fixed rather than suppressed:

| Severity | Source | Problem | Resolution |
| --- | --- | --- | --- |
| critical | `creator-docs` → `content/en-us/cloud/auth/oauth2-reference.md` | Duplicate deterministic id: the page legitimately documents `### POST v1/token` **twice** under the same parent heading, producing an identical heading path and therefore an identical id | Section keys are now ordinal-qualified (`<index>:<heading path>`). Still fully deterministic; uniqueness guaranteed. |

This is exactly the class of collision that would have silently overwritten a
document had ids not been checked.

---

## Warnings

**0 warnings.**

94 operations were skipped, all for the same legitimate reason — a per-service
OpenAPI spec restating an operation the aggregate spec already defines. Each is
individually recorded in `corpus/reports/failures.json`. Nothing was skipped
silently.

---

## Validation

`node scripts/roblox-brain/validate-corpus.mjs` — **PASS**, 0 errors,
0 warnings, 5,456 documents streamed.

| Check | Result |
| --- | --- |
| Every document has `source_id` | pass |
| Every document has `source_commit` | pass |
| Every document has `source_path` | pass |
| Every document has `source_type` | pass |
| Every document has `authority` | pass |
| Every document has `license` | pass |
| `source_url` present where applicable | pass |
| No excluded source entered | pass |
| No binary media entered | pass |
| No `luau/tests` entered | pass |
| No `luau/bench` entered | pass |
| No `luau/extern` entered | pass |
| No `content/en-us/includes` entered | pass |
| No random ids (all 24-char deterministic hashes) | pass |
| No duplicate canonical ids (5,456 unique / 5,456) | pass |
| Engine API preserves structured fields | pass — 1,232 / 1,232 |
| OpenAPI operations preserve operation ids | pass |
| Code blocks intact | pass — 2,099 inspected |
| Deprecated APIs marked | pass — 85 |
| Attribute concepts separated | pass |
| Source commits match `source-lock.json` | pass |

---

## Coverage

| Stage | Count |
| --- | --- |
| Step 3 manifest candidates | 1,687 files |
| Normalized documents produced | 5,456 |
| Skipped | 94 (duplicate OpenAPI operations) |
| Failed | 0 |
| Exact duplicate groups | 6 |
| Near duplicate groups | 403 (reported, not merged) |
| Excluded by policy | media, `includes/**`, education/programme content, `luau/**` sources |

Documents exceed candidate files because heading-aware splitting turns one
Markdown file into several section documents, and one OpenAPI file into many
operation documents. That expansion is the point of normalization.

---

## Reproducibility

**Deterministic — confirmed by running the normalizer twice.**

| Comparison | Result |
| --- | --- |
| File set (5,461 files) | **identical** |
| Document content, timestamps excluded | **identical** |
| Document ids | **identical** |

Ids are `sha256(repository | commit | path | section)` truncated to 24 hex
characters — no random UUIDs anywhere. The same source at the same commit always
produces the same id, so the corpus can be diffed between runs and between
commits.

The only fields that differ between runs are `retrieved_at` and `generated_at`,
which record wall-clock time by design and are excluded from the comparison.

### Implementation notes

- **Incremental** — documents are written as produced; the corpus is never held
  in memory. Only hashes and counters are retained.
- **Atomic writes** — each document is written to a temp file and renamed, so an
  interrupted run cannot leave a half-written JSON file.
- **Fails loudly** — a parse error is recorded and processing continues; the
  process exits non-zero if any high or critical failure occurred.
- **One third-party dependency** — `js-yaml`, for Roblox's generated Engine API
  files. It was previously only present transitively (via eslint and shadcn),
  which was fragile; it is now an explicit devDependency so the pipeline cannot
  break from an unrelated dependency change.
