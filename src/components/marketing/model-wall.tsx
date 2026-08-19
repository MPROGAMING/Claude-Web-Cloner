import { MODELS, PROVIDER_LABEL, TIER_LABEL, TIER_ORDER } from "@/lib/ai/registry";
import { cn } from "@/lib/utils";

/**
 * Rendered from the model registry, so the marketing page can never drift from
 * what the product actually offers.
 */
export function ModelWall({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-5 md:grid-cols-3", className)}>
      {TIER_ORDER.map((tier) => {
        const models = MODELS.filter((m) => m.enabled && m.tier === tier);
        return (
          <div key={tier} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{TIER_LABEL[tier]}</h3>
              <span className="label-meta">
                {models.length} model{models.length === 1 ? "" : "s"}
              </span>
            </div>

            <ul className="mt-4 space-y-3.5">
              {models.map((model) => (
                <li key={model.id} className="border-t border-hairline pt-3.5 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.8125rem] font-medium">{model.name}</span>
                    {model.recommended && (
                      <span className="rounded border border-[var(--ember)]/35 bg-[var(--ember)]/10 px-1.5 py-px font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--ember)]">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {model.description}
                  </p>
                  <p className="mt-1.5 font-mono text-[0.625rem] text-muted-foreground">
                    {PROVIDER_LABEL[model.provider]} · {(model.contextWindow / 1000).toFixed(0)}k context
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
