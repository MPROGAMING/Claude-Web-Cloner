# Live session progress

Updated as work happens. Every value here is real; nothing is aspirational.

**Last updated:** 19 Aug 2026, 10:16 — Studio bridge verified inside Roblox Studio

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
| Mini-IDE (diff view, editing, tabs) | builder agent | Cursor | running |
| Horror demo place | this session | DOORS | next |
| Cube-backed world generation | this session | — | next |

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
| Tests | 380 passing, 17 files |
| `npm run check` | clean — 0 errors |
| `npm run verify:security` | **44/44 live** — includes project_memory and notifications |
| `npm run agent:verify` | 44/44 live (free router) |
| `npm run studio:verify` | **16/16 live, inside Studio** |
| `npm run blueprint:verify` | 23/24 — needs a real model |
| `npm run a11y` | clean, both themes, 1440px and 390px |
