# Live session progress

Updated as work happens. Every value here is real; nothing is aspirational.

**Last updated:** 19 Aug 2026, 11:10 — blind critic ruled for Blockwright vs Lemonade

---

## Standing blocker

**The OpenRouter account has $0.20 left** ($10.00 bought, $9.796 used). This is
the only external blocker, and it is not something to route around: topping up
is a purchase, so it belongs to the account owner.

What it does and does not stop:

| Path | Blocked? | Why |
|---|---|---|
| Studio bridge | No | No model involved at all |
| Cube 3D / world generation | No | Free inside Studio |
| Agent acceptance | No | Runs on the free router — tool calls are validated and repaired |
| Blueprint | **Yes** | `generateObject` needs a model that holds a strict schema across a long response; the free router fails with `AI_NoObjectGeneratedError` about half the time |
| Product/UI work | No | No model involved |

Everything free, local and Studio-side continues.

---

## Done and proven this session

### Studio bridge — pair → poll → execute → report

The last unverified path in the product. Now run for real: plugin installed to
`~/Documents/Roblox/Plugins`, Studio restarted, pairing code typed in by hand.

```bash
npm run studio:verify     # 16/16
```

| Stage | Proven |
|---|---|
| Pairing | Plugin claims a 6-char code, reports the open place back; code is spent; a token **hash** is stored, never a token |
| `inspect_place` | Round-trips, returns the real place |
| `sync_files` | 2 written / 0 skipped, and genuinely present as Instances |
| Placement | `ReplicatedStorage/Blockwright/RoundClock` (ModuleScript), `ServerScriptService/Blockwright/BridgeProof` (Script) — correct services, correct classes, real Luau source, each with a `BlockwrightPath` attribute back to its project file |
| **Unknown verb** | **`execute_luau` REFUSED** — "Unsupported action". A compromised token cannot become arbitrary execution. |
| Heartbeat | Polling keeps `last_seen_at` current |
| Restart | The plugin reconnects by itself — the token lives in plugin settings, not memory |

**Two things the run found:**

1. `sync_files` reported `ok` for writing nothing. The server does not pass
   files in the payload — it reads the project's files out of Postgres — so an
   empty project produced a green tick, "Synced 0 scripts", and an unchanged
   Explorer. An empty or fully-skipped sync now fails, and says which.
2. The first version of the acceptance asserted against a payload the server
   ignores, so it passed against an empty project. It now seeds real
   `project_files` and asserts on the written count, not just on status.

---

## In flight

| Piece | Owner | Bar | Status |
|---|---|---|---|
| Project Memory | builder agent | — | **merged, migration applied, probed live** |
| Notifications + run history | builder agent | — | **merged, migration applied, probed live** |
| Horror demo place | this session | DOORS | **built + playtested + 2 bugs fixed** |
| Mini-IDE (diff view, editing, tabs) | builder agent | Cursor | **merged** |
| Blind critic vs Lemonade | critic agent | Lemonade.gg | **Blockwright wins** |
| Blind critic vs Cursor | critic agent | Cursor | running |

---

## Horror demo — built through Blockwright's own pipeline

The place (corridor, six numbered doors, sconces, two Cube-generated wardrobes,
an entity) was authored in Studio. The **game logic was not** — it came from a
prompt through the product:

    prompt -> preview run (free router) -> 13 operations / 7 files
          -> approval gate -> apply -> plugin sync -> 7/7 real Instances

Placement was correct on arrival: `EntityLoop` and `MainServer` as Scripts in
ServerScriptService, `HidingClient`/`HUD` as LocalScripts under
StarterPlayerScripts, `Config`/`Remotes` as ModuleScripts in ReplicatedStorage.

Then I pressed Play, and it did not run. Two real bugs:

1. **The agent had no idea where its files end up.** It wrote
   `ReplicatedStorage:WaitForChild("Remotes")` — what the repo layout suggests —
   but the bridge parents everything under a `Blockwright` folder, so it yielded
   forever. Nothing in the system prompt described the mapping. Now stated with
   worked require paths, pinned by a test against `inferService`.
2. **The validator passed a file that does not parse.**
   `doorLabel backgroundColor3 = Color3.new(0,0,0)` — a dropped dot. Studio
   refuses the whole script, so one missing character silenced the entire HUD.
   Now an error, with a keyword guard and tests for the statements that legally
   begin with two bare words.

**Lighting was measured, not eyeballed.** A histogram script reports the
rendered frame; the first pass was 95.8% of pixels below luminance 10 (mean
1.8) — black. The final scene is mean 29-36 with ~55% in deep shadow and lit
pools at p75+, which is the shape a horror interior should have.

**Not proven:** that a model *follows* the new placement guidance. Two free-router
runs produced 13 operations and then zero; it is too inconsistent to test a
prompt change through. Needs a real model.

---

## Vercel

Project **blockwright** created and linked to `MPROGAMING/Claude-Web-Cloner`
(`prj_aWBELXzNIMJ5SODDfSejeTb7yN9o`). 21 commits pushed to master.

**Blocked:** the Vercel token cannot create or list deployments —
`403 forbidden: You don't have permission to create a Production Deployment`.
That needs the account owner to grant deploy rights or press deploy themselves.

Verified locally instead: **the app builds with no environment variables at
all**, so the marketing site deploys and works standalone; the authenticated app
shows its setup-required state until secrets are added. No secret has ever been
committed — `.env.example` carries empty values and the only key-shaped strings
in the tree are deliberately fake test fixtures.

---

## Gauntlet: product experience vs live Lemonade.gg

A fresh-context critic, told only "Page A" and "Page B" and not which was whose,
was required to pick a winner and name one gap.

> **VERDICT: PAGE B WINS** (Blockwright)

Its measurements, not mine:

| | Lemonade.gg | Blockwright |
|---|---|---|
| Whole page height | 1,609px (2.2 viewports) | — |
| Body copy | 97 words | 1,269 words |
| "publish" / "Studio" / "place" / "script" | **0 occurrences each** | place 11x, Studio 15x, publish 3x |

It also went past the marketing page into the signed-in workspace and found
10 real Luau files, a change set labelled "2 update, 1 create, 1 delete" behind
"Nothing is written until you approve", and activity entries naming specific
work ("Synced 7 scripts into Studio").

The one gap it named lands on **Lemonade**, not us: 0 of its 121 images link to
a playable game, and the twelve genre cards filling its second scroll resolve to
decorative `/visuals/*.webp`, not user output.

Worth keeping honest about: part of what the critic saw as proof was a seeded
fixture project left behind by the mini-IDE work. The files, change set and
approval gate are real, but that particular project was staged for testing.

---

## Queued

- Expanded visual templates
- Admin operations
- Vercel deployment, verified after deploy
- Full-product Gauntlet against Lemonade.gg

---

## Health

| | |
|---|---|
| Tests | 464 passing, 21 files |
| `npm run check` | clean — 0 errors |
| `npm run verify:security` | **44/44 live** — includes project_memory and notifications |
| `npm run agent:verify` | 44/44 live (free router) |
| `npm run studio:verify` | **16/16 live, inside Studio** |
| `npm run blueprint:verify` | 23/24 — needs a real model |
| `npm run a11y` | clean, both themes, 1440px and 390px |
