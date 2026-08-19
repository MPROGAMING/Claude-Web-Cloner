import { TemplateThumb } from "blockwright";

/**
 * The square version of the template art, for dense lists and the create-project
 * dialog. It is decorative (aria-hidden) and sizes entirely from className — the
 * glyph is half the box — so every cell here passes a size.
 *
 * Metadata is the real data from src/lib/templates.ts; the thumb only reads
 * `accent` and `art`.
 */
const TEMPLATES = [
  {
    name: "Collect & Sell Simulator",
    tagline: "Gather a resource, sell it, buy upgrades, unlock the next area.",
    art: "GiCrystalGrowth",
    accent: ["oklch(0.72 0.16 200)", "oklch(0.62 0.19 280)"],
  },
  {
    name: "Round-Based Arena",
    tagline: "Lobby, countdown, match, winner, repeat.",
    art: "GiCrossedSwords",
    accent: ["oklch(0.68 0.19 20)", "oklch(0.55 0.17 340)"],
  },
  {
    name: "Tycoon Core Loop",
    tagline: "Droppers, conveyors, collectors and buyable expansions.",
    art: "GiFactory",
    accent: ["oklch(0.74 0.15 145)", "oklch(0.6 0.16 195)"],
  },
  {
    name: "Story Chapters",
    tagline: "Cutscenes, branching dialogue and saved chapter progress.",
    art: "GiOpenBook",
    accent: ["oklch(0.72 0.12 220)", "oklch(0.56 0.14 285)"],
  },
];

// The list shape it exists for: pick a starter template before a project opens.
export const TemplatePicker = () => (
  <ul className="max-w-md overflow-hidden rounded-xl border border-border bg-surface">
    {TEMPLATES.map((template) => (
      <li
        key={template.name}
        className="flex items-center gap-3 border-t border-hairline p-3.5 first:border-0"
      >
        <TemplateThumb template={template} className="size-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium">{template.name}</p>
          <p className="truncate text-xs text-muted-foreground">{template.tagline}</p>
        </div>
      </li>
    ))}
  </ul>
);

// Sizes it is used at, from a chat-row avatar to a dialog tile.
export const Sizes = () => (
  <div className="flex items-end gap-4">
    {["size-6", "size-8", "size-10", "size-14"].map((size, index) => (
      <TemplateThumb key={size} template={TEMPLATES[index]} className={size} />
    ))}
  </div>
);
