"use client";

import Anthropic from "@lobehub/icons/es/Anthropic";
import Cohere from "@lobehub/icons/es/Cohere";
import DeepSeek from "@lobehub/icons/es/DeepSeek";
import Gemini from "@lobehub/icons/es/Gemini";
import Hunyuan from "@lobehub/icons/es/Hunyuan";
import Kimi from "@lobehub/icons/es/Kimi";
import Meta from "@lobehub/icons/es/Meta";
import Mistral from "@lobehub/icons/es/Mistral";
import Nvidia from "@lobehub/icons/es/Nvidia";
import OpenAI from "@lobehub/icons/es/OpenAI";
import OpenRouter from "@lobehub/icons/es/OpenRouter";
import Zhipu from "@lobehub/icons/es/Zhipu";

import { getBrand, type BrandId } from "@/lib/brand/providers";
import { cn } from "@/lib/utils";

/**
 * Official provider logos.
 *
 * These are the real marks, from `@lobehub/icons` — an MIT-licensed icon set
 * built specifically for displaying AI provider branding inside AI products.
 * Using it means the logos are correct and current, they ship as inline SVG
 * (no network request, no broken images, no layout shift), and there is no
 * question about scraping or hot-linking someone's assets.
 *
 * Two providers have no logo in the set — Poolside and Dots Studio — so they
 * fall back to a lettermark rather than borrowing someone else's shape.
 */

type LogoComponent = {
  (props: { size?: number; className?: string }): React.ReactNode;
  colorPrimary?: string;
};

const LOGOS: Partial<Record<BrandId, LogoComponent>> = {
  openai: OpenAI as unknown as LogoComponent,
  anthropic: Anthropic as unknown as LogoComponent,
  google: Gemini as unknown as LogoComponent,
  openrouter: OpenRouter as unknown as LogoComponent,
  moonshot: Kimi as unknown as LogoComponent,
  zai: Zhipu as unknown as LogoComponent,
  tencent: Hunyuan as unknown as LogoComponent,
  nvidia: Nvidia as unknown as LogoComponent,
  cohere: Cohere as unknown as LogoComponent,
  deepseek: DeepSeek as unknown as LogoComponent,
  meta: Meta as unknown as LogoComponent,
  mistral: Mistral as unknown as LogoComponent,
};

const TILE = {
  sm: "size-5 rounded-[0.3rem]",
  md: "size-7 rounded-lg",
  lg: "size-9 rounded-xl",
} as const;

const GLYPH = { sm: 12, md: 16, lg: 20 } as const;

/**
 * A provider's official logo inside a tinted tile. The tint uses the brand's
 * own primary colour where the icon set publishes one, so the treatment stays
 * recognisable while still sitting inside Blockwright's surface system.
 */
export function ProviderMark({
  brand,
  size = "md",
  className,
}: {
  brand: BrandId;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = getBrand(brand);
  const Logo = LOGOS[brand];
  const accent = Logo?.colorPrimary ?? meta.accent;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border",
        TILE[size],
        className,
      )}
      style={{
        color: accent,
        backgroundColor: `color-mix(in oklch, ${accent} 13%, transparent)`,
        borderColor: `color-mix(in oklch, ${accent} 26%, transparent)`,
      }}
      title={meta.displayName}
    >
      {Logo ? (
        <Logo size={GLYPH[size]} />
      ) : (
        <span
          aria-hidden
          className={cn(
            "font-mono font-semibold leading-none",
            size === "sm" ? "text-[0.5rem]" : size === "md" ? "text-[0.625rem]" : "text-[0.75rem]",
          )}
        >
          {meta.initials}
        </span>
      )}
    </span>
  );
}

/** Wordmark + logo, for places with room for the full brand lockup. */
export function ProviderLockup({
  brand,
  className,
}: {
  brand: BrandId;
  className?: string;
}) {
  const meta = getBrand(brand);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <ProviderMark brand={brand} size="sm" />
      <span className="truncate text-[0.75rem] text-muted-foreground">{meta.displayName}</span>
    </span>
  );
}
