# Gauntlet pass: identity, language, showing the game

Three gaps were named by an independent critic and attacked in order. Three
further critic rounds were run against the live lemonade.gg at 1440×900.

**Result: Blockwright lost all three rounds.** Recorded here rather than
softened, because the reason it keeps losing is now precisely known and one half
of it is not a design problem.

---

## What was built

### Visual identity
- **Typefaces replaced.** Space Grotesk (the default display face of AI landing
  pages) and Geist (ships with `create-next-app`) → **Archivo** run at its
  expanded width axis for display, **Figtree** for body. Wide, flat-sided
  letterforms chosen from the product's own name.
- **Signature mark**: `StudBuild`, an isometric structure that assembles out of
  studded blocks with light from beneath. Studs are the one piece of visual
  vocabulary that is unmistakably Roblox, so the identity is built from the
  material rather than from another gradient.
- **Stud plate** as a real surface (`.bg-studs`) — two layered radial gradients,
  no image.
- **Mono all-caps eyebrows removed** from every section heading. The critic
  called them "the single most exhausted device in dev-tool marketing"; six of
  them made the page read as a template. Replaced with a stud-marked tag.
- Section rhythm tightened (py-20/24 → py-14/16) against measured 250–400px
  runs of dead black.

### Creator language
Rewritten throughout. Capability was translated, never removed:

| Was | Now |
|---|---|
| "Generated Luau is statically checked for deprecated globals, removed APIs" | "It re-reads everything it wrote, spots the old or broken bits… and fixes them before you ever see them" |
| "Allowlisted actions only" | "It can only do what you allow" |
| "Server-side everything" | "Built so it can't be cheated" |
| "Revisions and revert" | "Undo anything" |
| "Honest progress" | "No fake loading bars" |

**The 14-row model spec table was removed from the landing.** It was the largest
section on the page — `GLM 5.2`, `Kimi K3 · 1049k context` — aimed at someone
evaluating inference pricing rather than someone who wants a tycoon game. The
capability is unchanged and still in the workspace model picker. The section now
answers the one question a creator has: does it actually know Roblox (5,456
pages, 9,591 functions, 3,190 examples).

### Showing the game
Three **real Roblox renders**, above the fold, each captioned with the sentence
that would build it — a walled courtyard, a castle kit, and a rigged zombie
character. Roblox's own render farm produced the images; each links to its
Creator Store asset.

Every candidate was checked by eye. The Creator Store is heavily keyword-spammed:
a search for a low-poly tree pack returned a **weapons pack**, and
"🚀 Space Station Sci-Fi Interior" returned a **stock avatar**. Nothing was used
because its filename sounded right.

---

## Defects found by the critics and fixed

All were measured, not eyeballed.

1. **Eight template cards clipped their artwork.** A `size-[7.5rem]` glyph offset
   inside a 96px `overflow-hidden` card sliced every silhouette flat at the edge.
   Intentional bleed, but it reads as a broken image. Now a low-opacity ghost
   bleeds (which is what a bleed is for) and the focal glyph sits fully inside.
2. **The hero game cards overflowed on all four sides** — an 831×347 `<img>` box
   inside a 536×224 container, tower tops sheared flat. Cause: scaling the
   element so `object-contain` fit inside an oversized box. Replaced with
   `object-cover` and a per-image focal point. Verified: box now equals container.
3. **The hero code pane destroyed 39% of every line** — `clientWidth 255` vs
   `scrollWidth 420`, hard vertical cut mid-glyph, no fade or scroll affordance,
   on the one panel meant to prove the product works. Now wraps, with a fade at
   the bottom edge. Verified: `scrollWidth === clientWidth`.
4. **The workspace demo was 55–60% empty black on arrival.** A 7-second timeline
   inside a panel sized for its finished state. Compressed to ~3s and pre-seeded
   with three files and a populated code pane.
5. **Nav "Models" anchored to a section headed "The brain"** — a mismatch created
   when the model table was removed. Nav renamed, anchor renamed.
6. **Orphaned footer disclaimer** about provider logos that no longer appear
   anywhere on the page. Removed.

---

## Critic verdicts

| Round | Verdict | Biggest gap named |
|---|---|---|
| 1 (before this pass) | **Blockwright wins** | Lemonade never names Roblox and ends after one screen |
| 2 | Lemonade wins | Blockwright is "a template with the serial numbers still on it" |
| 3 | Lemonade wins | Blockwright "looks like a Postgres client" |
| 4 | Lemonade wins | Blockwright shows 3 images and 0 Roblox games; Lemonade shows 12 |

### Why it keeps losing, stated plainly

Round 4 measured the decisive difference:

| | Blockwright | Lemonade |
|---|---|---|
| `<img>` | 3 | 121 |
| `<video>` | 0 | 8 |
| Distinct Roblox games shown | **0** | **12** |

Lemonade ships gameplay footage of **Jailbreak, Adopt Me, MM2, BedWars, Fisch,
Rivals, Blade Ball, Grow a Garden** — twelve chart-topping Roblox games it did
not make. Every critic has ranked that as the single most persuasive thing on
either page.

Blockwright cannot match it by the same route. Putting other studios' games on
this landing page implies association and endorsement that does not exist, and
the brief explicitly forbids fabricated screenshots and random game art. The
legitimate equivalent is Blockwright's **own** gameplay footage, captured from a
place it built.

That is blocked, and the blocker is small: **Roblox Studio's window is
minimized.** Viewport capture needs a compositing window, and un-minimizing it
requires assistive access that `osascript` does not have here.

Studio scripting itself works — a real landscape was written into the open place
and verified by query (607,544 terrain cells, Atmosphere, Bloom, ColorCorrection,
SunRays, framed camera). Only the screenshot is unavailable.

**Restore the Studio window and the decisive asset becomes obtainable in
minutes.** Until then this gap stays open, and no amount of CSS closes it.

The critics' second recurring point is also real and worth stating: Lemonade's
display face is a paid Grilli Type licence. Archivo and Figtree are deliberate
choices, but they are free ones, and at least one critic treated "free Google
font" as disqualifying on its own.

---

## Verification

| | |
|---|---|
| `tsc --noEmit` | clean |
| ESLint | clean |
| Unit tests | 304 passed, 15 files |
| Production build | success |
| Hero cards contained | verified, box == container |
| Code pane clipping | verified, scrollWidth == clientWidth |

No paid OpenRouter credits were spent in this pass.
