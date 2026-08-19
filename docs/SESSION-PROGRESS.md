# Live session progress

Updated as work happens. Every value here is real; nothing is aspirational.

**Session started:** 19 Aug 2026
**Last updated:** 19 Aug 2026 — reconnaissance complete

---

## Blockers cleared at session start

Both blockers that ended the previous session are **gone**:

| Blocker | Previous state | Now |
|---|---|---|
| Roblox Studio screen capture | Window minimized, no compositing frame | **Working** — new `Roblox_Studio` MCP has `screen_capture`; captured the existing terrain live |
| OpenRouter balance | Exhausted mid-session | **Working** — verified with a real call, `content: OK` |

This unblocks the single thing that lost three Gauntlet rounds: real Roblox
gameplay imagery on the landing page.

---

## Current piece

**Roadmap area:** Demo places → landing page game imagery
**Piece:** Roblox horror demo scene, captured from Studio, on the landing page
**Reference bar:** DOORS (real thumbnails pulled from Roblox's public API)
**Builder status:** shipped — scene built, captured, integrated
**Critic status:** ready for round 5
**Latest verdict:** round 4 — Lemonade wins
**Biggest remaining gap:** landing showed 0 Roblox games — now addressed

### What was built
- Hotel corridor: 220-stud shell with skirting, wainscot, chair rail, crown
  moulding; 11 recessed doors with casings and brass plates; 9 warm sconces;
  cold spill at the far end; dust motes.
- **Cube (`generate_mesh`) produced 4 usable props** — wardrobe, luggage cart,
  two crates. Output is semantically segmented (`doors_geom`/`body_geom`) and
  textured. Quality is genuinely production-usable.
- Three lighting iterations: orange tube → unreadable → legible and moody.

### Capture pipeline (was the session's biggest blocker)
`screencapture` is blocked and `save_to_disk` is unreachable. The path that
works: set camera via Luau → click the viewport to focus it → Studio's own
**View → Screenshot** → file lands in `~/Pictures/Roblox`. The viewport focus
click is required; without it the menu item silently does nothing.

Also built `scripts/shot.mjs` — headless Chrome over CDP for deterministic page
screenshots, because the in-app browser returns black frames after scrolling.

---

## Gauntlet record

| # | Piece | Reference | Verdict | Gap named |
|---|---|---|---|---|
| 1 | Landing | lemonade.gg | **Blockwright wins** | Lemonade never names Roblox, ends after one screen |
| 2 | Landing | lemonade.gg | Lemonade wins | "a template with the serial numbers still on it" |
| 3 | Landing | lemonade.gg | Lemonade wins | "looks like a Postgres client" |
| 4 | Landing | lemonade.gg | Lemonade wins | 3 images / 0 games vs 121 images / 12 games |
| 5 | Landing | lemonade.gg | pending | — |

---

## Health

| | |
|---|---|
| Tests | 304 passing, 15 files |
| Typecheck | clean |
| Lint | clean |
| Build | success |
| Live security | 37/37 |
| Retrieval | Recall@5 98.7%, MRR 0.910 |
| Studio | **connected** — `Untitled Experience` (placeId 118380397520813) |
| Git | clean, `dd43194`, pushed |

---

## External spend ledger

Ceiling: **$3.00**. Claude Max usage is outside this ceiling.

| # | Provider | Purpose | Cost | Cumulative |
|---|---|---|---|---|
| 1 | OpenRouter | Verify paid path is live after last session's exhaustion | $0.0001 | $0.0001 |
| 2 | Roblox Cube | 4 generated meshes via Studio `generate_mesh` | $0.00 (included in Studio) | $0.0001 |

**Remaining: ~$3.00**

---

## Backlog (prioritised, live)

Ordered by product value. Blocked items are skipped, not waited on.

1. ~~Demo places + real game footage~~ — **done**, 2 real captures shipped
2. **Landing Gauntlet round 5 vs Lemonade** ← current
3. Server-driven repair loop (currently model-driven)
4. Agent run history UI + durable runs (data exists, no surface)
5. Blueprint latency (120–140s) — stream/split
6. Mini-IDE vs Cursor Gauntlet
7. Project Memory surface
8. Notifications
9. Template system expansion
10. Sound design
11. Cube / 3D provider boundary
12. Admin control centre
13. Vercel deploy + verify
14. Mobile Gauntlet pass

---

## Notes

- Studio place is a scratch `Untitled Experience` with the previous session's
  terrain. Safe to rebuild in.
- Creator Store search is keyword-spammed; every asset must be visually checked
  before use (a "low poly tree pack" returned a weapons pack last session).
