"use client";

import Image from "next/image";
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

  // Where a place has actually been built for this genre, show the place. The
  // glyph below is honest decoration, but decoration is what a competitor was
  // faulted for, and the same criticism lands on every card without a capture.
  if (template.capture) {
    return (
      <span
        role="img"
        aria-label={template.capture.alt}
        className={cn("relative block h-full w-full overflow-hidden bg-black", className)}
      >
        <Image
          src={template.capture.src}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, 320px"
          className="object-cover"
          style={{ objectPosition: template.capture.focal ?? "50% 50%" }}
        />
        {/* Says what it is. It was built in Studio, not produced by a prompt,
            and the label must not imply otherwise. */}
        <span className="absolute bottom-2 left-2 rounded border border-white/25 bg-black/55 px-1.5 py-px font-mono text-[0.5625rem] uppercase tracking-wider text-white/90 backdrop-blur-sm">
          Real place
        </span>
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

      {/* Two passes. The huge ghost bleeds off the edge and reads as texture,
          which is what a bleed is for. The focal glyph stays fully inside the
          card: previously a single oversized glyph was sliced flat by the card
          edge on every card, which reads as a broken image rather than a crop. */}
      <Icon
        aria-hidden
        className="absolute -bottom-8 -left-6 size-[9rem] opacity-[0.13]"
        style={{ color: "oklch(1 0 0)" }}
      />
      <Icon
        aria-hidden
        className={cn(
          "absolute right-3 top-1/2 size-[4.25rem] -translate-y-1/2 opacity-95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]",
          !priority && "animate-rise",
        )}
        style={{ color: "oklch(1 0 0 / 0.95)" }}
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
