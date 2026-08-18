"use client";

import {
  GiCampfire,
  GiChessRook,
  GiCrossedSwords,
  GiCrystalGrowth,
  GiFactory,
  GiGhost,
  GiJumpAcross,
  GiOpenBook,
  GiRaceCar,
  GiScrollUnfurled,
  GiThreeFriends,
  GiTowerFlag,
} from "react-icons/gi";
import type { IconType } from "react-icons";
import type { ArtIcon, Template } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * Template hero art.
 *
 * The glyphs are real artwork from the **Game Icons** project
 * (game-icons.net), shipped via `react-icons/gi` and licensed CC BY 3.0 —
 * genuine game iconography drawn by that project's artists, not something
 * approximated here. Attribution lives in docs/DESIGN_SYSTEM.md and the app
 * footer.
 *
 * They render as inline SVG, so a card has its final dimensions on first paint:
 * no network request, no broken image, no layout shift, and no cost to the
 * selector's responsiveness.
 */

const ICONS: Record<ArtIcon, IconType> = {
  GiCrystalGrowth,
  GiJumpAcross,
  GiFactory,
  GiGhost,
  GiCampfire,
  GiCrossedSwords,
  GiTowerFlag,
  GiScrollUnfurled,
  GiRaceCar,
  GiThreeFriends,
  GiOpenBook,
  GiChessRook,
};

export function TemplateArt({
  template,
  className,
  priority = false,
}: {
  template: Template;
  className?: string;
  /** Above-the-fold cards skip the reveal so nothing flashes on first paint. */
  priority?: boolean;
}) {
  const [from, to] = template.accent;
  const Icon = ICONS[template.art];

  return (
    <span
      role="img"
      aria-label={template.imageAlt}
      className={cn("relative block h-full w-full overflow-hidden", className)}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${from} 62%, transparent), color-mix(in oklch, ${to} 38%, transparent))`,
      }}
    >
      {/* A faint tile grid grounds the glyph and echoes the blueprint motif
          used on the marketing hero. */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          color: "oklch(1 0 0)",
        }}
      />

      {/* Oversized, cropped glyph — reads as artwork rather than as an icon. */}
      <Icon
        aria-hidden
        className={cn(
          "absolute -right-3 -top-2 size-[7.5rem] opacity-90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]",
          !priority && "animate-rise",
        )}
        style={{ color: "oklch(1 0 0 / 0.92)" }}
      />

      {/* Bottom fade so overlaid text keeps its contrast. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 45%, color-mix(in oklch, var(--surface) 82%, transparent) 100%)",
        }}
      />
    </span>
  );
}

/** Small square version for dense lists and the create dialog. */
export function TemplateThumb({
  template,
  className,
}: {
  template: Template;
  className?: string;
}) {
  const [from, to] = template.accent;
  const Icon = ICONS[template.art];

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-lg border",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${from} 55%, transparent), color-mix(in oklch, ${to} 32%, transparent))`,
        borderColor: `color-mix(in oklch, ${from} 32%, transparent)`,
      }}
    >
      <Icon className="size-1/2" style={{ color: "oklch(1 0 0 / 0.9)" }} />
    </span>
  );
}
