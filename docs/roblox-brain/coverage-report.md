# Roblox Brain Step 3 Coverage Report

Generated 2026-08-18. Read-only audit. **Nothing was ingested, chunked,
embedded or indexed.** No vector database exists. No model or UI was modified.

Artifacts produced:

- `docs/roblox-brain/source-lock.json`
- `docs/roblox-brain/ingestion-manifest.json`
- `docs/roblox-brain/coverage-report.md` (this file)
- `scripts/roblox-brain/validate-manifest.mjs`
- `scripts/roblox-brain/coverage-audit.mjs`

---

## Source lock

All three commits were verified against the working trees before use. None were
resolved forward to a branch tip.

| Repository | Branch | Commit | Commit date | Clean | License | LFS |
| --- | --- | --- | --- | --- | --- | --- |
| creator-docs | `main` | `bac0b51429b324e4cc2dd76c93b94e8f64d0a2e0` | 2026-08-18T10:14:10Z | yes | CC-BY-4.0 (content) / MIT (code) | **required, blobs excluded** |
| luau | `master` | `6dafc0dd9909efe534c825d1b1184644e1f7a4e4` | 2026-08-14T15:48:18-07:00 | yes | MIT | not used |
| site | `master` | `28edb95d3c67e8c140181efdc027d44b534d5106` | 2026-08-03T01:06:29-07:00 | yes | MIT | not used |

`luau` is pinned for **provenance only** and contributes zero documents.

---

## Manifest statistics

**13 ingestion sources**, plus one `reference_only` entry (`luau`).

By repository

| Repository | Sources | Candidate documents |
| --- | --- | --- |
| creator-docs | 10 | 1,627 |
| site | 3 | 60 |
| luau | 0 (reference-only) | 0 |
| **Total** | **13** | **1,687** |

By source type

| Source type | Sources | Parser |
| --- | --- | --- |
| `engine-api-yaml` | 1 | structured field-level |
| `openapi` | 2 | operation-level |
| `guide-md` | 6 | heading-aware |
| `tutorial-md` | 1 | heading-aware, step order preserved |
| `language-reference` | 1 | heading-aware, grammar blocks preserved |
| `language-reference-md` | 1 | heading-aware |
| `news-md` | 1 | date-aware, low retrieval weight |

By authority

| Authority | Sources |
| --- | --- |
| canonical | 11 |
| secondary | 1 (`creator-docs.luau-intro`) |
| historical | 1 (`site.news`) |

By priority

| Priority | Sources |
| --- | --- |
| 1 (highest) | 6 |
| 2 | 4 |
| 3 | 2 |
| 5 (lowest) | 1 |

Largest contributors: Engine API YAML (1,232), tutorials (135), cloud guides
(52), engine topic areas (140), site news (36).

---

## Roblox published documentation coverage

| Index | URLs | Size | Last updated |
| --- | --- | --- | --- |
| main — `/docs/llms.txt` | **2,292** links (2,290 unique) | 340,303 B | 2026-08-17T23:44:20Z |
| engine — `/docs/reference/engine/llms.txt` | **1,232** | 156,400 B | 2026-08-17T23:44:20Z |
| cloud — `/docs/cloud/llms.txt` | **110** | 14,466 B | 2026-08-17T23:44:25Z |

Indexes only. No documentation pages were crawled.

---

## Local coverage

| Measure | Count |
| --- | --- |
| Candidate documents selected by the manifest | **1,687** |
| All Markdown + YAML under `content/en-us/` | 2,237 |
| Engine API YAML | 1,232 |
| Cloud OpenAPI specs (aggregate + per-service) | 13 |

The gap between 2,237 and 1,687 is deliberate: excluded programme/legal content,
`includes/**` fragments, and navigation YAML retained as taxonomy only.

### Engine API mapping — clean

| Direction | Count |
| --- | --- |
| Published Engine URLs | 1,232 |
| Local Engine YAML files | 1,232 |
| Published with no local file | **0** |
| Local file not published | **0** |

**A perfect 1:1 mapping in both directions.** This confirms the Step 1 and
Step 2 hypothesis: the local structured YAML is a complete representation of the
published Engine API, and is strictly richer than the rendered Markdown.

### Cloud OpenAPI — present locally

`content/en-us/reference/cloud/openapi.json` — 3,224,059 bytes, identical in
size to the live copy. 690 paths, 1,119 component schemas, OpenAPI 3.0.4.

---

## Mismatches

87 published URLs have no local Markdown file, and 34 local documents have no
published URL. Every one has been explained; none is a content gap.

| Severity | URL / path | Problem | Recommended action |
| --- | --- | --- | --- |
| informational | `/docs/reference/engine/llms.txt`, `/docs/cloud/llms.txt` | The indexes list themselves. Self-referential, not documents. | Filter index files from URL inventories. |
| informational | `cloud/reference/features/*` (~24) | Generated at publish time from `openapi.json`. Its 32 operation tags match these feature names exactly (Accounts, Advertising, Analytics, Assets, Avatars, Badges, Bans and blocks, Configs, Creator Store, …). | None. Source data is local and richer. |
| informational | `cloud/api/*` and `cloud/legacy/*` (~41) | Generated from the per-service OpenAPI JSON specs in `reference/cloud/*/v*.json`. | None. Source data is local. |
| informational | 34 × `content/en-us/includes/**` | Local-only, never published. Transclusion fragments. | None — already excluded by design. This **confirms** the Step 1 exclusion decision. |
| **medium** | `monetize-experiences`, `monetize-avatar`, `samples`, `courses` | Published hub pages with no local source file. Most likely site-framework landing pages assembled from navigation rather than authored content, but **this was not verified**. | Spot-check 1–2 in Step 4. If they carry real content, add a narrow fetch rule. |
| low | `dashboard`, `resources/scripting-libraries`, `monetize` | Similar; `monetize` exists locally at a different path (`projects/assets/monetize.md`), so this is a path-normalisation artifact rather than a gap. | Refine normalisation if these matter. |

Severity counts: **0 critical, 0 high, 1 medium (4 URLs), 1 low (3 URLs),
4 informational (~80 URLs).**

### Normalisation applied

To avoid phantom differences, both sides were normalised for locale prefixes
(`/en-us/`), trailing slashes, `.md` suffixes, `#anchors`, query strings,
percent-encoding, `index` filenames and case. Without this the audit reports
hundreds of false mismatches.

---

## Overlap rules

Five rules encoded in the manifest and enforced by the validator.

| ID | Topic | Canonical | Secondary |
| --- | --- | --- | --- |
| OV-001 | Luau language semantics | **site** `src/content/docs/**` | creator-docs `content/en-us/luau/**` |
| OV-002 | Roblox Engine API | **creator-docs** engine YAML | — (sole source) |
| OV-003 | Roblox runtime / scripting | **creator-docs** `content/en-us/scripting/**` | — (sole source) |
| OV-004 | Roblox datatypes | **creator-docs** engine YAML `datatypes/` | site `types/roblox-types.md` (context) |
| OV-005 | **Attributes — name collision** | *neither; they are different subjects* | see below |

### OV-005 — the collision that must not be merged

Two unrelated subjects share a word:

| Path | Subject | Semantic tag |
| --- | --- | --- |
| `creator-docs` → `content/en-us/scripting/attributes.md` | Roblox **Instance** attributes | `roblox.instance-attributes` |
| `site` → `src/content/docs/reference/attributes.md` | Luau **type** attributes | `luau.type-attributes` |

Both files were confirmed present on disk. They must never be merged,
deduplicated or treated as one topic. Violation severity: **high**.

---

## LFS decision

**LFS media remains excluded.**

creator-docs stores all binary media in Git LFS. A normal clone reaches
**8.6 GB**; cloning with `GIT_LFS_SKIP_SMUDGE=1` gives **66 MB** while keeping
the entire ~21 MB text corpus. Step 1 classified all media as never-ingest, so
nothing intended for the knowledge base is lost.

Consequence: image and video files in this working tree are **LFS pointer
stubs, not real binaries**. Any future tooling must not assume a `.png` here is
an image.

This stands unless a later feature explicitly requires specific assets, in which
case retrieve only those paths with `git lfs pull --include='<path>'`. A blanket
`git lfs pull` is not warranted.

---

## Validation

`node scripts/roblox-brain/validate-manifest.mjs` — **PASS**, 0 errors,
0 warnings, across 12 checks:

| Check | Result |
| --- | --- |
| Every repository has a locked 40-char commit | pass |
| Every manifest include glob matches ≥1 real file | pass (after correction) |
| Every exclude glob is syntactically valid | pass |
| No excluded path survives as included | pass |
| Every source type has a parser strategy | pass |
| Every source has an authority | pass |
| Every source has a license | pass |
| Overlap rules OV-001…OV-005 present | pass |
| Engine API classified as structured, `must_not_flatten_to_prose` | pass |
| Engine API preserves all 18 required fields | pass |
| OpenAPI classified separately, operation-level | pass |
| Luau compiler source not ingested | pass |

### Correction the validator caught

The first run **failed**. `content/en-us/reference/cloud/**/*.yaml` — an include
specified in the brief — matched **zero files**. That directory contains JSON,
not YAML.

Two changes followed:

1. The dead glob was removed. Left in place it would have silently contributed
   nothing while appearing configured.
2. Investigating it surfaced **12 per-service OpenAPI specifications** that were
   otherwise unaccounted for: `cloud.docs.json` (60 paths) plus
   `assets`, `datastores-api` (v1 + ordered-v1), `developer-products-api`,
   `game-passes-http-service`, `secrets-store-service`, `open-eval-api`,
   `toolbox-service`, `asset-permissions-api`, `messaging-service` and
   `universes-api`. All are genuine OpenAPI documents (3.0.0–3.0.4). They are now
   a distinct source, `creator-docs.cloud-service-openapi`.

Note for Step 4: these per-service specs partially overlap the aggregate
`openapi.json`. Deduplicate by `(method, path)`, preferring the aggregate.

---

## Result

### PASS

- Source lock created; all three commits verified against disk, none drifted.
- Ingestion manifest created: 13 sources, 1,687 candidate documents, every one
  with a parser, authority, license and priority.
- Validator passes with **0 errors and 0 warnings**.
- Engine API maps **1:1** with the published index (1,232 ↔ 1,232, zero
  discrepancies either way).
- Cloud OpenAPI confirmed present locally.
- No critical or high-severity mismatches.

**Warnings not hidden:** one medium finding remains open — four published hub
pages (`monetize-experiences`, `monetize-avatar`, `samples`, `courses`) have no
local source. They are *probably* framework-generated landing pages, but that was
inferred, not verified. Step 4 should spot-check one before relying on the
assumption.

Nothing was ingested. No embeddings, no vector database, no model change, no UI
change.
