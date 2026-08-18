# Roblox Brain — Step 2: Versioned Sources & Live Endpoint Verification

Scope: establish reproducible Git sources and verify Roblox's live
machine-readable documentation. **Nothing was ingested, embedded, indexed or
processed.** No knowledge system was built. Live endpoints were probed for
headers and shape only; none were saved to disk.

The ZIP archives in `~/Downloads/` were **not** deleted, moved or modified.

---

# Part 1 — Git Sources

Cloned to `~/Documents/Blockwright-Sources/`, outside the Blockwright
application tree:

```
~/Documents/Blockwright-Sources/
├── creator-docs/
├── luau/
└── site/
```

## creator-docs

| Field | Value |
| --- | --- |
| Path | `/Users/moshe/Documents/Blockwright-Sources/creator-docs` |
| Remote | `https://github.com/Roblox/creator-docs.git` |
| Branch | `main` (tracking `origin/main`) |
| HEAD commit | `bac0b51429b324e4cc2dd76c93b94e8f64d0a2e0` |
| Commit date | `2026-08-18T10:14:10Z` |
| Commit subject | `update Open Source Docs from Roblox internal teams` |
| History depth | 2,128 commits |
| Size | 66 MB total (`.git` 13 MB, `content/` 52 MB) |
| Working tree | **Clean** — 0 modifications |
| Latest tag | none |

## luau

| Field | Value |
| --- | --- |
| Path | `/Users/moshe/Documents/Blockwright-Sources/luau` |
| Remote | `https://github.com/luau-lang/luau.git` |
| Branch | `master` (tracking `origin/master`) |
| HEAD commit | `6dafc0dd9909efe534c825d1b1184644e1f7a4e4` |
| Commit date | `2026-08-14T15:48:18-07:00` |
| Commit subject | `Also run all the tests with the old solver. (#2652)` |
| History depth | 1,720 commits |
| Size | 25 MB total (`.git` 6.2 MB) |
| Working tree | **Clean** — 0 modifications |
| Latest tag | **`0.734`** — the only repo of the three with meaningful version tags |

## site

| Field | Value |
| --- | --- |
| Path | `/Users/moshe/Documents/Blockwright-Sources/site` |
| Remote | `https://github.com/luau-lang/site.git` |
| Branch | `master` (tracking `origin/master`) |
| HEAD commit | `28edb95d3c67e8c140181efdc027d44b534d5106` |
| Commit date | `2026-08-03T01:06:29-07:00` |
| Commit subject | `Update intro to use type annotation style used everywhere else (#109)` |
| History depth | 355 commits |
| Size | 6.1 MB total (`.git` 2.8 MB) |
| Working tree | **Clean** — 0 modifications |
| Latest tag | none |

## Clone method — and why it matters

All three were cloned with `--filter=blob:none` (partial clone): full commit
history is present for provenance and diffing, while historical file blobs are
fetched lazily. The working trees are fully populated.

**creator-docs required an extra step.** It uses **Git LFS** for its media. A
normal clone pulls every image and video through the LFS smudge filter — the
first attempt reached **8.6 GB** (4.3 GB of LFS objects) and was still running
when it was interrupted, leaving a broken working tree.

It was re-cloned with `GIT_LFS_SKIP_SMUDGE=1`, which keeps LFS *pointer files*
in place of the binaries. Result: **67 MB instead of 8.6 GB**, a 99% reduction,
with the complete text payload (~21 MB of Markdown and YAML) intact.

This is consistent with the Step 1 classification, where all binary media was
placed in *Do Not Ingest*. We are not discarding anything we intended to use.

> **Consequence to remember:** image and video files in this clone are pointer
> stubs, not real binaries. If media is ever genuinely needed, run
> `git lfs pull` for specific paths. Any future tooling must not assume a
> `.png` in this tree is a real image.

---

# Part 2 — Live Machine-Readable Documentation

Probed on 2026-08-18. Headers and structure only; **no files were retained**.

| # | URL | Status | Content-Type | Size | Kind |
| --- | --- | --- | --- | --- | --- |
| 1 | `create.roblox.com/docs.md` | **404** | `text/html` | 15 KB (error page) | — |
| 2 | `create.roblox.com/docs/llms.txt` | **200** | `text/plain` | **340 KB** | Index |
| 3 | `create.roblox.com/docs/reference/engine/llms.txt` | **200** | `text/markdown` | **156 KB** | Index |
| 4 | `create.roblox.com/docs/cloud/llms.txt` | **200** | `text/markdown` | **14 KB** | Index |
| 5 | `create.roblox.com/docs/cloud/openapi.json` | **200** | `application/json` | **3,224,059 B** | OpenAPI |

Two additional endpoints found while verifying #1:

| # | URL | Status | Note |
| --- | --- | --- | --- |
| 6 | `create.roblox.com/docs/index.md` | **200** | The working equivalent of the requested `docs.md` |
| 7 | `create.roblox.com/llms.txt` | **200** | Site-root index (distinct from `/docs/llms.txt`) |

### 1. `docs.md` — DOES NOT EXIST

Returns **404** with an HTML error page. The requested path is wrong. The
working equivalent is **`/docs/index.md`** (#6), which returns 200.

Recorded plainly because assuming this endpoint exists would break any future
fetcher built on the brief's URL list.

### 2. `/docs/llms.txt` — master documentation index

- Header comment: `<!-- Last updated: 2026-08-17T23:44:20Z -->`
- Title: *Roblox Creator Documentation*
- **2,290 Markdown links** to individual `.md` pages
- Covers guides, tutorials, engine reference and cloud — the whole corpus

### 3. `/docs/reference/engine/llms.txt` — Engine API index

- Same timestamp: `2026-08-17T23:44:20Z`
- **1,232 Markdown links**
- **This exactly matches the 1,232 YAML files counted in the local repo in
  Step 1** (646 classes + 525 enums + 48 datatypes + 11 libraries + 2 globals).
  A clean 1:1 correspondence between the live index and local structured data.

### 4. `/docs/cloud/llms.txt` — Open Cloud index

- Timestamp: `2026-08-17T23:44:25Z`
- **105 Markdown links**, REST API reference for server-side integrations

### 5. `cloud/openapi.json` — OpenAPI 3.0.4 specification

Referenced from `content/en-us/cloud/index.md` and
`content/en-us/cloud/reference/openapi.md` in the repo.

| Property | Value |
| --- | --- |
| OpenAPI version | 3.0.4 |
| Title / version | Roblox API / 1.0.0 |
| Paths | **690** |
| Component schemas | **1,119** |
| Live size | 3,224,059 bytes |
| Local copy | `content/en-us/reference/cloud/openapi.json` — **3,224,059 bytes** |

**The live and local files are byte-identical in size**, which strongly
indicates the repository ships the same artifact the site serves. The local copy
is therefore already canonical and needs no separate download.

### Live page format

A sample live page (`reference/engine/classes/Players.md`) returns
`text/markdown` with a **YAML front-matter header** (`name`, `last_updated`,
`inherits`, `type`, `memory_category`, …) followed by prose. It is a rendered
projection of the same data held as `.yaml` in the repo — same content, one
already flattened for reading, the other structured for querying.

---

# Part 3 — Local vs Live Comparison

## 3.1 Available locally in creator-docs

- Complete Markdown corpus: guides, tutorials, scripting, cloud, AI/Assistant
- **Structured Engine API as 1,232 YAML files** with typed fields
- **Full Open Cloud OpenAPI spec** (690 paths, 1,119 schemas)
- Navigation manifests (`content/common/navigation/*.yaml`)
- Full commit history — attributable, diffable, reproducible

## 3.2 Only exposed by the live endpoints

- **`llms.txt` indexes** — no equivalent exists in the repository (confirmed by
  sweep in Step 1 and again here). These are generated at publish time.
- **Publication timestamps** (`Last updated: …`) reflecting when the *site* was
  built, which is distinct from a Git commit date.
- **The published URL for each page** — the repo has file paths; only the live
  index maps content to its canonical public URL. Useful for citation.
- **Pre-flattened Markdown** of Engine API pages, front-matter plus prose.

## 3.3 Which live sources suit future retrieval

| Live source | Verdict |
| --- | --- |
| `/docs/llms.txt` | **Adopt as an index**, not as content. It is the authoritative enumeration of what exists, and gives page → URL mapping for citations. |
| `/docs/reference/engine/llms.txt` | **Adopt for URL mapping only.** Its 1,232 entries map 1:1 to local YAML; the YAML is strictly richer. |
| `/docs/cloud/llms.txt` | Same — index and URL mapping. |
| Live `.md` pages | **Do not adopt as primary.** They are a lossy projection of data we already hold in structured form. |
| `cloud/openapi.json` | **Already local and identical.** Use the repo copy — it carries a commit hash; the live one carries nothing. |

## 3.4 Canonical for structured Engine API data

**The local repository, unambiguously.**

The YAML retains typed structure — properties, methods, events, callbacks,
inheritance, tags, deprecation, security, `code_samples` — as discrete fields.
The live `.md` flattens all of it into prose. For a knowledge system that must
answer *"what parameters does this method take"*, the structure is the value.

The local copy also has a commit hash. The live pages have only a build
timestamp, so an answer sourced from them could never be pinned to a version.

## 3.5 Can `llms.txt` replace manual crawling?

**Yes — for discovery. No — for content.**

- It **eliminates crawler logic entirely**: no sitemap parsing, no link
  following, no HTML scraping, no robots handling. 2,290 pre-enumerated links
  covering the whole corpus.
- It does **not** replace the local repo as the content source. Following all
  2,290 links would mean 2,290 HTTP requests to retrieve a lossy version of what
  a single `git pull` already provides — structured, versioned, and offline.

**Recommended split:** local Git for content, live `llms.txt` for the
authoritative page inventory and canonical URLs. A diff between the live index
and the local file tree also becomes a cheap **coverage check** — it would
surface any page published but missing from the repo.

---

# Part 4 — Proposed Provenance Schema

**Proposal only. Not implemented, per the Step 2 constraints.**

Every future knowledge document should carry:

| Field | Type | Purpose | Example |
| --- | --- | --- | --- |
| `source_id` | string | Stable unique id for the chunk | `creator-docs:engine/classes/Players#Players.PlayerAdded` |
| `source_repository` | enum | Which of the three sources | `creator-docs` \| `luau` \| `site` |
| `source_url` | string | Canonical public URL (from `llms.txt`) | `https://create.roblox.com/docs/reference/engine/classes/Players` |
| `source_commit` | string (40) | Exact Git SHA — the reproducibility anchor | `bac0b51429b324e4cc2dd76c93b94e8f64d0a2e0` |
| `source_path` | string | Repo-relative path | `content/en-us/reference/engine/classes/Players.yaml` |
| `source_type` | enum | Drives the parsing strategy | `engine-api-yaml` \| `openapi` \| `guide-md` \| `tutorial-md` \| `language-ref-md` \| `news-md` \| `navigation-yaml` |
| `authority` | enum | Resolves the Step 1 overlaps at retrieval time | `canonical` \| `secondary` \| `historical` |
| `license` | enum | Travels with the content | `CC-BY-4.0` \| `MIT` |
| `retrieved_at` | ISO 8601 | When we read it | `2026-08-18T18:40:00Z` |
| `content_date` | ISO 8601 | When the content was authored/updated upstream | `2026-08-18T10:14:10Z` |

### Notes on three fields that will otherwise cause trouble

- **`license` is not optional.** creator-docs is **CC BY 4.0 and requires
  attribution**; `luau` and `site` are MIT. If the brain surfaces creator-docs
  text, attribution must travel with it. Storing the licence per document is the
  only way to enforce that at answer time.
- **`authority`** is how the Step 1 overlaps get resolved mechanically rather
  than by hope: `site` is `canonical` for Luau language semantics,
  `creator-docs/luau/**` is `secondary`, and `site/news/**` is `historical`.
- **`content_date` vs `retrieved_at`** must stay separate. Conflating them makes
  a freshly-fetched 2019 changelog look current.

Suggested additions worth considering in Step 3: `chunk_index`/`chunk_total` for
reassembly, and `deprecated: bool` lifted from the engine YAML's existing
`deprecation_message` field so retired APIs can be down-ranked.

---

# STEP 2 RESULT

**Complete.** All Part 1–4 objectives met, with three corrections to the brief's
assumptions.

**Delivered**

1. Three official repositories cloned as real Git repos at
   `~/Documents/Blockwright-Sources/`, all clean working trees, all with
   recorded remote / branch / HEAD / date / size / status.
2. All five requested live endpoints probed; two extra working endpoints found.
3. Local vs live comparison with a concrete recommendation for each source.
4. Provenance schema proposed and documented, not implemented.

**Corrections to the brief**

- **`create.roblox.com/docs.md` does not exist** — 404. The working equivalent
  is `/docs/index.md`. Any future fetcher built on the given URL list would
  have failed here.
- **creator-docs uses Git LFS.** An ordinary clone is 8.6 GB. Cloning with
  `GIT_LFS_SKIP_SMUDGE=1` yields 67 MB with the full text corpus intact.
- **The Cloud OpenAPI spec is already in the repository** and byte-identical in
  size to the live copy. No separate download is warranted.

**Constraints honoured** — nothing ingested, no embeddings, no vector database,
no model changes, no AI architecture or UI changes, no knowledge system built.
No live file was permanently saved. The `~/Downloads` ZIPs are untouched.

---

# RECOMMENDED STEP 3

**Write the ingestion manifest and a source-coverage report. Still no ingestion,
no embeddings, no database.**

1. **Pin the three commits** recorded above into a small checked-in source-lock
   file. Every later artefact references these SHAs, so any answer can be traced
   to an exact version and a refresh becomes a diff between two known points.

2. **Write explicit include/exclude globs per repository**, encoding the Step 1
   classification: engine YAML and `openapi.json` in; `luau/tests/`,
   `luau/bench/`, `extern/`, all media, `content/en-us/includes/` out. Express
   it as patterns that a later script can consume without re-litigating scope.

3. **Run a coverage diff** between the live `/docs/llms.txt` (2,290 links) and
   the local file tree at the pinned commit. This is a read-only comparison that
   answers a question we cannot currently answer: *is anything published that
   the repository does not contain?* The engine index already looks like a clean
   1:1 match at 1,232 — worth confirming across the whole corpus before relying
   on local-only content.

4. **Decide the LFS position explicitly.** Media is currently pointer stubs.
   Confirm that no planned feature needs real images, or list the specific paths
   that would need `git lfs pull`.

5. **Fix the `authority` matrix in writing** — the exact rule set for the four
   Step 1 overlaps, including distinct tags for the two different `attributes`
   pages, so retrieval cannot conflate them.

6. **Choose the parse strategy per `source_type`** — structured field-level
   extraction for engine YAML, path/operation-level for OpenAPI, heading-aware
   for Markdown, date-weighted for news.

Only once that manifest is agreed should any tooling be written.

**Stopping here as instructed.**
