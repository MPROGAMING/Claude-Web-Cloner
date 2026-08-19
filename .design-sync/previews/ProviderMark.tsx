import { ProviderMark, Badge } from "blockwright";

// Real provider logos from @lobehub/icons, each in a tile tinted with that
// brand's own primary colour. Two brands publish no logo and fall back to a
// lettermark rather than borrowing someone else's shape — poolside and dots.
const WITH_LOGOS = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "moonshot",
  "deepseek",
  "meta",
  "mistral",
  "cohere",
  "nvidia",
  "zai",
  "tencent",
] as const;

export const EveryProvider = () => (
  <div className="flex flex-wrap gap-2">
    {WITH_LOGOS.map((b) => (
      <ProviderMark key={b} brand={b} />
    ))}
  </div>
);

export const Sizes = () => (
  <div className="flex items-center gap-4">
    {(["sm", "md", "lg"] as const).map((size) => (
      <span key={size} className="flex flex-col items-center gap-2">
        <ProviderMark brand="anthropic" size={size} />
        <span className="label-meta">{size}</span>
      </span>
    ))}
  </div>
);

// poolside and dots have no mark in the set — the lettermark is deliberate.
export const LettermarkFallback = () => (
  <div className="flex items-center gap-4">
    <ProviderMark brand="poolside" />
    <ProviderMark brand="dots" />
    <ProviderMark brand="generic" />
  </div>
);

export const InAModelRow = () => (
  <div className="flex max-w-sm flex-col gap-1">
    {[
      ["anthropic", "Claude Sonnet 4.5", "150 cr/M"],
      ["openai", "GPT-5", "180 cr/M"],
      ["google", "Gemini 2.5 Pro", "90 cr/M"],
    ].map(([brand, name, cost]) => (
      <span
        key={name}
        className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-[0.8125rem]"
      >
        <ProviderMark brand={brand as "anthropic"} size="sm" />
        {name}
        <Badge variant="outline" className="ml-auto font-mono">
          {cost}
        </Badge>
      </span>
    ))}
  </div>
);
