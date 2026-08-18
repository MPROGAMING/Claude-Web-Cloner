# Roblox Brain — Step 1: Repository Inventory & Knowledge Classification

Survey only. Nothing was installed, downloaded, embedded, indexed or modified.
The three source repositories were read; the only file created is this one.

**Two findings to read before anything else:**

1. **The repositories are not inside the Blockwright project.** They are in
   `~/Downloads/`. Nothing in `/Users/moshe/Claude-Web-Cloner` references them.
2. **None of them are Git repositories.** All three are extracted GitHub ZIP
   archives (`-main` / `-master` suffixes, no `.git` directory). There is
   therefore **no remote URL, no branch and no commit hash** to record — the
   provenance questions in the brief cannot be answered from what is on disk.
   This matters for a knowledge base: without a commit we cannot say which
   version of the docs an answer came from, or diff a future refresh.

---

# Repository Inventory

## creator-docs

| Field | Value |
| --- | --- |
| Path | `/Users/moshe/Downloads/creator-docs-main` |
| Git remote | **None** — ZIP extract, no `.git` |
| Branch | **Unknown** (archive name implies `main`) |
| Commit | **Unknown** |
| Snapshot date | Newest file mtime `2026-08-18` (extraction date, not authoring date) |
| Declared version | `package.json` → `roblox-creator-docs@0.0.0` (placeholder, not meaningful) |
| License | **CC BY 4.0** for content (`LICENSE`); **MIT** for code (`LICENSE-CODE`, © 2023 Roblox Corporation) |
| Size | 53 MB, 9,293 files |

**Important top-level directories**

- `content/en-us/` — all English documentation (the payload)
- `content/common/navigation/` — YAML navigation manifests (structured index)
- `tools/` — internal check/schema scripts (`checks`, `schemas`)

**Composition:** 1,262 YAML + 1,005 Markdown ≈ **21 MB of text**, against
4,173 PNG + 1,355 JPG + 808 MP4 + others ≈ **27 MB of media**. Roughly half the
repo by weight is imagery/video that is not ingestible as text.

**Requested areas — all located:**

| Area | Path | Notes |
| --- | --- | --- |
| Guides | `content/en-us/` topic dirs (`scripting`, `physics`, `ui`, `players`, `production`, …) | ~30 topic areas |
| Tutorials | `content/en-us/tutorials/` | `curriculums`, `first-experience`, `fundamentals`, `use-case-tutorials` |
| Engine API reference | `content/en-us/reference/engine/` | **1,232 YAML** files: 646 classes, 525 enums, 48 datatypes, 11 libraries, 2 globals |
| Code examples | Embedded in Markdown + YAML `code_samples:` fields | Only 20 standalone `.lua/.luau` files — examples are inline, not separate assets |
| Luau documentation | `content/en-us/luau/` | 22 Markdown files (see overlap section) |
| Assistant documentation | `content/en-us/assistant/` | `overview`, `guide`, `mcp`, `prompt-engineering`, `skills` |
| AI documentation | `content/en-us/ai/` + `generative-AI.md`, `ai-data-sharing.md` | `build`, `build-with-assistant`, `coding-harness`, `accelerated-workflows` |
| Cloud / Open Cloud | `content/en-us/cloud/` + `content/en-us/cloud-services/` + `content/en-us/reference/cloud/` | Guides, auth, webhooks, and ~11 per-API reference dirs |
| LLM/agent-specific docs | `assistant/mcp.md`, `assistant/skills.md`, `assistant/prompt-engineering.md`, `ai/coding-harness.md` | Directly relevant to how Blockwright should behave |
| **`llms.txt` or equivalent** | **ABSENT** | No `llms.txt`, no sitemap, no machine-readable doc index anywhere in the archive |
| Structured API data | `content/en-us/reference/engine/**/*.yaml` | Machine-generated, schema-consistent — the single highest-value asset here |

The engine YAML files carry a header stating they are automatically generated
and should not be hand-edited. That is a strong signal: they are a **derived,
schema-stable dataset**, ideal for structured ingestion rather than prose
chunking.

## luau

| Field | Value |
| --- | --- |
| Path | `/Users/moshe/Downloads/luau-master` |
| Git remote | **None** — ZIP extract, no `.git` |
| Branch | **Unknown** (archive name implies `master`) |
| Commit | **Unknown** |
| Snapshot date | Newest file mtime `2026-08-15` |
| Declared version | No `package.json`; version lives in CMake/source headers, not surfaced |
| License | **MIT** (© 2019–2025 Roblox Corporation); bundled `lua_LICENSE.txt` for upstream Lua (© 1994–2019 Lua.org, PUC-Rio) |
| Size | 19 MB, 1,077 files |

**Requested areas:**

| Area | Path | Size | Verdict |
| --- | --- | --- | --- |
| Language implementation (VM) | `VM/` | 976 KB | C++ source |
| Compiler | `Compiler/`, `Bytecode/`, `CodeGen/`, `Inliner/` | ~3.8 MB | C++ source |
| Type checker | `Analysis/` | 3.4 MB | C++ source |
| Parser / AST | `Ast/` | 640 KB | C++ source |
| Tests | `tests/` | 5.3 MB, 111 files | **Largest single directory** |
| Benchmarks | `bench/` | 4.8 MB | Perf harness + Lua fixtures |
| Documentation | **NONE** | — | **There is no `docs/` directory in this repo** |
| Examples | **NONE** | — | No `examples/` directory |
| Third-party | `extern/` (doctest, isocline) | 788 KB | Vendored, not Roblox's |
| Build/tooling | `CMakeLists.txt`, `Makefile`, `Sources.cmake`, `tools/`, `fuzz/`, `CLI/`, `Config/`, `Require/`, `Common/` | — | Infrastructure |

**This is the critical finding for `luau`:** the repository is a **compiler
implementation, not a documentation source.** The prose documentation that used
to live here now lives in the `site` repository. Ingesting `luau` as
"documentation" would fill the knowledge base with C++ internals that answer
questions nobody building a Roblox game will ask.

## site

| Field | Value |
| --- | --- |
| Path | `/Users/moshe/Downloads/site-master` |
| Git remote | **None** — ZIP extract, no `.git` |
| Branch | **Unknown** (archive name implies `master`) |
| Commit | **Unknown** |
| Snapshot date | Newest file mtime `2026-08-03` |
| Declared version | `package.json` → `next@0.0.1` (placeholder; Astro project) |
| License | **MIT** (© 2019–2026 Roblox Corporation) |
| Size | 3.3 MB, 139 files — **smallest repo, highest documentation density** |

**Requested areas:**

| Area | Path | Contents |
| --- | --- | --- |
| Documentation root | `src/content/docs/` | 59 Markdown files total across the repo |
| Getting started | `docs/getting-started/` | `intro`, `syntax`, `compatibility`, `lint`, `why` |
| Language reference | `docs/reference/` | `api`, `attributes`, **`grammar`**, `library`, `types-library` |
| Type system | `docs/types/` | `overview`, `basic-types`, `generics`, `refinements`, `tables`, `unions-and-intersections`, `type-functions`, `object-oriented-programs`, `roblox-types`, `considerations` |
| Guides | `docs/guides/` | `performance`, `profile`, `sandbox` |
| News / recaps | `src/content/news/` | ~40 dated posts, 2019 → 2025 |
| Site machinery | `src/components`, `src/pages`, `src/layouts`, `src/plugins`, `src/lib`, `src/styles`, `src/fonts`, `astro.config.mjs` | Astro scaffolding |
| Generated/static output | **None present** | No `dist/`, no `.astro/`, no `node_modules/` — repo is unbuilt, so there is no duplicate rendered copy to worry about |

`docs/reference/grammar.md` is the formal language grammar — the most
authoritative single artefact for Luau syntax anywhere across the three repos.

---

# Knowledge Classification

## High Value

Ingest first. Dense, authoritative, directly answers creator questions.

| Source | Why |
| --- | --- |
| `creator-docs/content/en-us/reference/engine/**/*.yaml` (1,232 files) | Complete Engine API. Schema-stable, machine-generated, includes summaries, descriptions, inheritance, tags, deprecation and inline code samples. The single most valuable asset in the survey. |
| `creator-docs/content/en-us/tutorials/**` | Task-shaped, end-to-end, matches how users phrase requests |
| `creator-docs/content/en-us/scripting/**` | Engine-specific runtime semantics: services, events, security, capabilities, scheduler, multithreading |
| `creator-docs/content/en-us/cloud/**`, `cloud-services/**`, `reference/cloud/**` | Open Cloud + DataStore/MemoryStore — required for persistence guidance |
| `creator-docs/content/en-us/assistant/**`, `ai/**` | How Roblox expects AI agents to behave on-platform; directly informs Blockwright's own system prompt |
| `site/src/content/docs/types/**` | The real Luau type-system reference |
| `site/src/content/docs/reference/**` | Grammar, standard library, attributes |
| `site/src/content/docs/getting-started/**` | Syntax and lint rules |
| Major engine topic dirs: `physics`, `ui`, `players`, `parts`, `animation`, `input`, `sound`, `effects`, `environment`, `characters` | Core gameplay surface area |

## Secondary

Useful, but ingest later or at lower weight.

- `creator-docs/content/en-us/luau/**` — good beginner prose, but **superseded by `site` for language authority** (see overlaps)
- `site/src/content/docs/guides/**` — `performance`, `profile`, `sandbox`; valuable but narrow
- `site/src/content/news/**` (~40 recaps, 2019→2025) — excellent for "when did X land", but **historical and partly obsolete**; old recaps describe behaviour since changed. Ingest only with strong date metadata, or defer.
- `creator-docs/content/en-us/production/**`, `marketplace/**`, `monetization` — publishing/business, not code generation
- `creator-docs/content/en-us/studio/**` — IDE usage; relevant to the Studio bridge feature
- `creator-docs` top-level explainers (`platform.md`, `creation.md`, `experiences.md`) — orientation only
- `creator-docs/content/common/navigation/*.yaml` — not knowledge itself, but a **ready-made topic taxonomy** worth reusing for chunk tagging

## Source Code

Implementation, not documentation. Do not ingest as prose.

- `luau/VM/`, `Compiler/`, `CodeGen/`, `Analysis/`, `Ast/`, `Bytecode/`, `Inliner/`, `Config/`, `Require/`, `Common/`, `CLI/`
- `site/src/components/`, `src/pages/`, `src/layouts/`, `src/lib/`, `src/plugins/`
- `creator-docs/tools/`

Narrow exception worth noting for later: `luau/Analysis` and `luau/Ast` contain
the authoritative list of built-in type names and AST node kinds. If we ever
need a **validated symbol list** (not prose), that is where it comes from — but
that is a Step-4+ concern, not documentation ingestion.

## Tests / Infrastructure

- `luau/tests/` — 5.3 MB, 111 files, the single largest directory in `luau`
- `luau/bench/` — 4.8 MB benchmark harness and fixtures
- `luau/fuzz/`, `luau/tools/`, `luau/extern/`
- `creator-docs/jest.config.json`, `tsconfig.json`, `package-lock.json`
- `site/astro.config.mjs`, `tsconfig.json`, `package-lock.json`
- All `CMakeLists.txt`, `Makefile`, `Sources.cmake`, `CODEOWNERS`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`

`luau/tests/` is a tempting trap: it contains thousands of small, valid Luau
snippets. They are **compiler conformance cases**, written to probe edge cases
and error paths — not idiomatic Roblox code. Ingesting them would teach the
model to write pathological Luau. Excluded deliberately.

## Do Not Ingest

- **All binary media** in `creator-docs`: 4,173 PNG, 1,355 JPG, 808 MP4, 147 WebP, 147 JPEG, 70 ZIP, 31 WAV, 29 FBX, 26 PDF, 22 GIF (~27 MB, ~half the repo by weight)
- `luau/extern/` — vendored third-party (doctest, isocline); not Roblox's, separate licensing
- `package-lock.json` files across all three
- `site/src/fonts/` (17 WOFF2), `src/assets/images/` (28 PNG), `public/`
- `creator-docs/content/en-us/includes/` — Markdown fragments meant for transclusion; they are sentence fragments without their host page and will produce incoherent chunks
- `luau/tools/faillist.txt` — a list of known-failing tests; actively misleading as knowledge
- `creator-docs/content/en-us/education/`, `creator-programs/`, `ip-licensing/`, `affiliates.md`, `creator-rewards.md` — programme/legal/business content, no bearing on code generation

---

# Duplicated / Overlapping Sources

Three real overlaps. Each needs a decided winner before ingestion, or the
knowledge base will answer the same question two ways.

### 1. Luau language documentation — `creator-docs` vs `site` (significant)

Both document the Luau language, with different audiences and depth.

| Topic | `creator-docs/content/en-us/luau/` | `site/src/content/docs/` |
| --- | --- | --- |
| Types | `type-checking.md`, `type-coercion.md` | `types/` — 10 files incl. `generics`, `refinements`, `type-functions` |
| Tables | `tables.md` | `types/tables.md` |
| Syntax/operators | `operators.md`, `control-structures.md`, `variables.md`, `scope.md`, `comments.md` | `getting-started/syntax.md`, `reference/grammar.md` |
| Std library | scattered across `strings.md`, `numbers.md` | `reference/library.md` |
| Primitives | `booleans`, `nil`, `numbers`, `strings`, `userdata`, `tuples` | covered within `types/basic-types.md` |

**Character of each:** `creator-docs/luau` is beginner-facing prose aimed at
Roblox creators (and includes Roblox-only extras like `luau-csharp-comparison.md`
and `native-code-gen.md`). `site` is the language's own reference — deeper,
formally precise, and the home of the grammar.

They are **complementary in audience but conflicting in authority**. Where they
disagree on language semantics, `site` is correct.

### 2. Roblox-specific type information — `site` vs `creator-docs` (narrow)

`site/src/content/docs/types/roblox-types.md` describes Roblox types from the
language side, while `creator-docs/reference/engine/datatypes/` (48 YAML files)
describes the same types from the engine side. Different granularity, same
subject. The YAML is far more complete; the `site` page gives the type-system
framing.

### 3. Scripting concepts — `creator-docs/luau/` vs `creator-docs/scripting/`

Within the *same* repository: `luau/` covers language constructs while
`scripting/` covers engine runtime (`services.md`, `events/`, `scheduler.md`,
`security/`, `capabilities.md`, `attributes.md`). The boundary is mostly clean,
but `attributes.md` appears in `scripting/` here **and** as
`reference/attributes.md` in `site` — different meanings of "attribute"
(Instance attributes vs Luau type attributes). **This is a genuine collision
risk:** a naive retriever will confuse them. They must be tagged distinctly.

### 4. Non-overlap worth stating

`luau` (the compiler repo) contains **no documentation at all** — no `docs/`, no
`examples/`. It therefore overlaps with nothing. Its apparent overlap with
`site` is an illusion created by the repo names.

---

# Recommended Canonical Sources

| Knowledge category | Canonical source | Rationale |
| --- | --- | --- |
| **Roblox Engine API** | `creator-docs/content/en-us/reference/engine/**/*.yaml` | Only complete, structured, machine-generated source. 1,232 files. No competitor. |
| **Luau language** (syntax, types, semantics, grammar, stdlib) | `site/src/content/docs/**` | The language's own reference. Deeper and formally precise. Wins any conflict with `creator-docs/luau`. |
| **Luau for beginners / Roblox framing** | `creator-docs/content/en-us/luau/**` | Keep as *secondary*, tagged as introductory. Do not let it override `site` on semantics. |
| **Roblox tutorials** | `creator-docs/content/en-us/tutorials/**` | Sole source. |
| **Engine runtime & scripting patterns** | `creator-docs/content/en-us/scripting/**` | Sole source; distinct from language docs. |
| **Roblox AI / Assistant guidance** | `creator-docs/content/en-us/assistant/**` then `ai/**` | Sole source. Highest relevance to Blockwright's own agent design. |
| **Open Cloud** | `creator-docs/content/en-us/cloud/**` + `reference/cloud/**` | Guides and reference respectively; `cloud-services/**` for in-engine DataStore/MemoryStore. |
| **Code examples** | `code_samples:` fields in engine YAML, then fenced blocks in tutorials | Only 20 standalone script files exist; examples are overwhelmingly inline. **Never** `luau/tests/`. |
| **Roblox datatypes** | `creator-docs/reference/engine/datatypes/` (authoritative), cross-linked to `site/types/roblox-types.md` (framing) | Different granularity; link rather than duplicate. |
| **Language history / "when did X change"** | `site/src/content/news/**` | Only source, but **must carry date metadata** — much of it is superseded. |
| **Compiler internals** | `luau/` (reference only, not ingested) | Not creator-facing knowledge. |

---

# Important Discovery

## No machine-readable index exists locally

A sweep across all three archives for `llms.txt`, `llms-full.txt`, sitemaps and
documentation manifests returned **nothing**. The only `manifest` hits are
`creator-docs/tools/checks/utils/manifest.ts` — an internal build-check script,
not a content index.

The closest local equivalent is `creator-docs/content/common/navigation/*.yaml`
(`documentation.yaml`, `engine/`, `cloud/`, `assets.yaml`, `avatar/`,
`analytics.yaml`, `education.yaml`, `monetize.yaml`, `platform.yaml`,
`programs.yaml`). These describe the published site's navigation tree and are a
usable **topic taxonomy**, though not an LLM-oriented index.

## Future sources — NOT downloaded, NOT verified

Per instruction, nothing was fetched. The following are **candidate** endpoints
on the Roblox Creator Hub commonly used for machine-readable docs. Their
existence and exact paths are **unverified** and must be checked before use:

| Candidate | Purpose if present |
| --- | --- |
| `create.roblox.com/llms.txt` | Top-level LLM doc index |
| `create.roblox.com/docs/llms.txt` | Documentation index |
| Engine API `llms.txt` equivalent | Would complement / possibly supersede the YAML |
| Cloud API `llms.txt` equivalent | Open Cloud index |
| `create.roblox.com/sitemap.xml` | Full published-URL enumeration |
| Open Cloud OpenAPI/Swagger spec | Structured Cloud API definition |

**Deliberately not downloaded.** Flagged for a later step, and each should be
confirmed to exist rather than assumed.

Also worth noting: the local archives are **snapshots with no provenance**.
Whatever we build in later steps should record a source version so a refresh can
be diffed. Re-acquiring these as real Git clones would solve that and is worth
considering before ingestion begins.

---

# NEXT STEP RECOMMENDATION

**Step 2 should be a written ingestion plan and a source manifest — still no
code, no installs, no embeddings.**

Specifically:

1. **Fix provenance first.** The archives have no commit hashes. Decide whether
   to re-acquire the three sources as Git clones (recommended) so the knowledge
   base can record *which version* an answer came from and diff future refreshes.
   This is cheap now and expensive to retrofit.

2. **Write an explicit include/exclude manifest** — concrete glob patterns per
   repository, derived from the classification above. It should encode the
   decisions already made here: engine YAML in, `luau/tests/` out, media out,
   `includes/` out, `extern/` out.

3. **Resolve the four overlaps by rule, not by guess.** Record for each:
   `site` wins on Luau language semantics; `creator-docs` wins on engine API and
   Roblox runtime; `creator-docs/luau` is retained as beginner-tagged secondary;
   and the two different `attributes` pages get distinct tags so retrieval cannot
   conflate them.

4. **Decide the chunking strategy per content type**, because they differ
   sharply and one strategy will not serve all three:
   - Engine YAML → structured, one chunk per class/member, preserving the
     schema fields rather than flattening to prose
   - Markdown guides/tutorials → heading-aware chunks
   - News/recaps → date-stamped, lower retrieval weight

5. **Define the metadata schema** — at minimum `source_repo`, `source_path`,
   `category`, `authority` (canonical vs secondary), `roblox_version_or_date`,
   `license`. Licensing is not optional here: `creator-docs` content is
   **CC BY 4.0 and requires attribution**, while `luau` and `site` are MIT. If
   the brain surfaces creator-docs content, attribution has to travel with it.

6. **Verify the `llms.txt` candidates exist** before planning around them —
   confirm, do not assume.

Only after that plan is agreed should Step 3 touch any tooling.

**Stopping here as instructed.**
