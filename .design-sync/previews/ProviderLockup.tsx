import { ProviderLockup } from "blockwright";

// The mark plus the provider's name, for places with room for the full lockup.
export const EveryProvider = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {(["anthropic", "openai", "google", "openrouter", "deepseek", "mistral"] as const).map((b) => (
      <ProviderLockup key={b} brand={b} />
    ))}
  </div>
);

export const InASettingsList = () => (
  <div className="flex max-w-sm flex-col gap-1 rounded-lg border border-border bg-surface p-2">
    {(["anthropic", "openai", "google"] as const).map((b) => (
      <span key={b} className="flex items-center px-1.5 py-2 text-[0.8125rem]">
        <ProviderLockup brand={b} />
        <span className="ml-auto font-mono text-xs text-muted-foreground">key set</span>
      </span>
    ))}
  </div>
);

export const WithoutALogo = () => (
  <div className="flex flex-col gap-3">
    <ProviderLockup brand="poolside" />
    <ProviderLockup brand="dots" />
  </div>
);
