/**
 * Provider brand metadata — the single source of truth for how a model's maker
 * is presented anywhere in the product.
 *
 * Logos are the providers' real marks, rendered by `provider-mark.tsx` from
 * `@lobehub/icons` — an MIT-licensed icon set built for displaying AI provider
 * branding inside AI products. They ship as inline SVG, so nothing is scraped
 * or hot-linked and a logo can never fail to load.
 *
 * Trademarks remain their owners'; they are shown here for identification of
 * which company makes a given model. `accent` is a fallback tint for the two
 * providers the icon set does not cover, and `website` lets the UI link out.
 */

export type BrandId =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "moonshot"
  | "zai"
  | "tencent"
  | "nvidia"
  | "cohere"
  | "deepseek"
  | "meta"
  | "mistral"
  | "poolside"
  | "dots"
  | "generic";

export interface Brand {
  id: BrandId;
  /** Human name of the organisation that makes the model. */
  displayName: string;
  /** Their site — used for the "about this provider" link. */
  website: string;
  /**
   * Accent used for the mark and subtle card tinting. oklch so it composes
   * with the design-system tokens and stays stable across themes.
   */
  accent: string;
  /** Two-letter fallback when a mark cannot render. */
  initials: string;
}

export const BRANDS: Record<BrandId, Brand> = {
  openai: {
    id: "openai",
    displayName: "OpenAI",
    website: "https://openai.com",
    accent: "oklch(0.72 0.11 165)",
    initials: "AI",
  },
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
    website: "https://anthropic.com",
    accent: "oklch(0.72 0.13 55)",
    initials: "AN",
  },
  google: {
    id: "google",
    displayName: "Google",
    website: "https://ai.google",
    accent: "oklch(0.68 0.17 255)",
    initials: "GO",
  },
  openrouter: {
    id: "openrouter",
    displayName: "OpenRouter",
    website: "https://openrouter.ai",
    accent: "oklch(0.72 0.14 285)",
    initials: "OR",
  },
  moonshot: {
    id: "moonshot",
    displayName: "Moonshot AI",
    website: "https://moonshot.ai",
    accent: "oklch(0.7 0.15 300)",
    initials: "KI",
  },
  zai: {
    id: "zai",
    displayName: "Z.ai",
    website: "https://z.ai",
    accent: "oklch(0.7 0.15 230)",
    initials: "GL",
  },
  tencent: {
    id: "tencent",
    displayName: "Tencent",
    website: "https://cloud.tencent.com",
    accent: "oklch(0.68 0.14 245)",
    initials: "HY",
  },
  nvidia: {
    id: "nvidia",
    displayName: "NVIDIA",
    website: "https://nvidia.com",
    accent: "oklch(0.76 0.19 135)",
    initials: "NV",
  },
  cohere: {
    id: "cohere",
    displayName: "Cohere",
    website: "https://cohere.com",
    accent: "oklch(0.7 0.16 20)",
    initials: "CO",
  },
  deepseek: {
    id: "deepseek",
    displayName: "DeepSeek",
    website: "https://deepseek.com",
    accent: "oklch(0.66 0.16 265)",
    initials: "DS",
  },
  meta: {
    id: "meta",
    displayName: "Meta",
    website: "https://ai.meta.com",
    accent: "oklch(0.68 0.15 250)",
    initials: "ME",
  },
  mistral: {
    id: "mistral",
    displayName: "Mistral AI",
    website: "https://mistral.ai",
    accent: "oklch(0.75 0.16 65)",
    initials: "MI",
  },
  poolside: {
    id: "poolside",
    displayName: "Poolside",
    website: "https://poolside.ai",
    accent: "oklch(0.72 0.13 195)",
    initials: "PS",
  },
  dots: {
    id: "dots",
    displayName: "Dots Studio",
    website: "https://openrouter.ai",
    accent: "oklch(0.74 0.14 100)",
    initials: "DO",
  },
  generic: {
    id: "generic",
    displayName: "Community",
    website: "https://openrouter.ai",
    accent: "oklch(0.66 0.02 80)",
    initials: "AI",
  },
};

/**
 * Map an OpenRouter slug's namespace to a brand. Slugs are `vendor/model`, and
 * the vendor segment is stable, so this keeps working as new models appear
 * without anyone editing a list of model names.
 */
const VENDOR_TO_BRAND: Record<string, BrandId> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  openrouter: "openrouter",
  moonshotai: "moonshot",
  "z-ai": "zai",
  tencent: "tencent",
  nvidia: "nvidia",
  cohere: "cohere",
  deepseek: "deepseek",
  "meta-llama": "meta",
  mistralai: "mistral",
  poolside: "poolside",
  "dots-studio": "dots",
};

export function brandForSlug(slug: string): BrandId {
  const vendor = slug.split("/")[0]?.replace(/^~/, "").toLowerCase() ?? "";
  return VENDOR_TO_BRAND[vendor] ?? "generic";
}

export function getBrand(id: BrandId): Brand {
  return BRANDS[id] ?? BRANDS.generic;
}
