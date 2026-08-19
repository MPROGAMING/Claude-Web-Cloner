import { TemplateArt } from "blockwright";

/**
 * Template hero art. Given a template it paints that genre's gradient from the
 * template's own two oklch accent stops, tiles a faint blueprint grid over it,
 * bleeds one oversized Game-icons glyph off the bottom-left as texture, sets the
 * focal glyph on the right, and fades the bottom edge so a title stays legible.
 *
 * The metadata below is the real thing from src/lib/templates.ts, minus each
 * template's `banner` — with a banner set the component renders that sourced
 * photograph instead, and the app's /templates images are not part of a preview
 * bundle. Everything drawn here is inline SVG plus gradients.
 */
const GENRES = [
  {
    name: "Collect & Sell Simulator",
    category: "Simulator",
    art: "GiCrystalGrowth",
    accent: ["oklch(0.72 0.16 200)", "oklch(0.62 0.19 280)"],
    imageAlt: "Abstract scene of floating crystal shards above a collection pad",
  },
  {
    name: "Obby with Checkpoints",
    category: "Obby",
    art: "GiJumpAcross",
    accent: ["oklch(0.78 0.16 85)", "oklch(0.66 0.19 35)"],
    imageAlt: "Abstract scene of ascending platforms with a checkpoint flag",
  },
  {
    name: "Horror Escape",
    category: "Horror",
    art: "GiGhost",
    accent: ["oklch(0.5 0.14 300)", "oklch(0.3 0.1 265)"],
    imageAlt: "Abstract scene of a torch beam cutting through fog",
  },
  {
    name: "Tower Defense",
    category: "Tower Defense",
    art: "GiTowerFlag",
    accent: ["oklch(0.7 0.16 165)", "oklch(0.58 0.18 250)"],
    imageAlt: "Abstract scene of a winding lane with tower placements alongside",
  },
];

// One art per genre at the height the template cards use (h-24), which is where
// the accent pair has to do its work.
export const AcrossGenres = () => (
  <div className="grid gap-4 sm:grid-cols-4">
    {GENRES.map((template) => (
      <div
        key={template.name}
        className="overflow-hidden rounded-xl border border-border bg-surface"
      >
        <span className="relative block h-24">
          <TemplateArt template={template} priority />
        </span>
        <span className="block p-3">
          <span className="label-meta">{template.category}</span>
          <span className="mt-1 block text-[0.8125rem] font-semibold leading-snug">
            {template.name}
          </span>
        </span>
      </div>
    ))}
  </div>
);

// Larger, so the bleed glyph, the blueprint grid and the bottom fade are all
// readable — the size the template detail page gives it.
export const HeroSize = () => (
  <div className="overflow-hidden rounded-xl border border-border bg-surface">
    <span className="relative block h-44">
      <TemplateArt template={GENRES[0]} priority />
    </span>
    <span className="block p-5">
      <span className="block text-[0.9375rem] font-semibold">
        Collect &amp; Sell Simulator
      </span>
      <span className="mt-1.5 block text-[0.8125rem] leading-relaxed text-muted-foreground">
        Gather a resource, sell it, buy upgrades, unlock the next area.
      </span>
    </span>
  </div>
);
