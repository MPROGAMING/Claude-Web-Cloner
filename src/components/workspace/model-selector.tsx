"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProviderMark } from "@/components/brand/provider-mark";
import { getBrand } from "@/lib/brand/providers";
import {
  CAPABILITY_LABEL,
  DISCOVERY_LABEL,
  SECTIONS,
  type ClientModel,
  type SectionId,
} from "@/lib/ai/registry";
import { formatCredits } from "@/lib/credits/pricing";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Model picker.
 *
 * Reads only from the registry projection — it has no idea OpenRouter exists,
 * which is what keeps the app provider-agnostic. Sections, discovery labels and
 * capability badges all come from model metadata, so a new model appears here
 * correctly without touching this file.
 */

const RECENT_KEY = "blockwright.recent-models";
const MAX_RECENT = 4;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberModel(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [id, ...readRecent().filter((v) => v !== id)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private-mode storage failures must not break model switching.
  }
}

function contextLabel(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

/** Blockwright cost, expressed the way the user will actually feel it. */
function costLabel(model: ClientModel): string {
  if (model.credits.output === 0 && model.credits.input === 0) return "0 credits";
  return `${formatCredits(model.credits.output)} cr/M out`;
}

function ModelRow({
  model,
  selected,
  onPick,
}: {
  model: ClientModel;
  selected: boolean;
  onPick: () => void;
}) {
  const brand = getBrand(model.brand);
  const label = model.labels?.[0];

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      disabled={!model.available}
      onClick={onPick}
      className={cn(
        "group relative flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left",
        "transition-[background-color,transform] duration-150",
        model.available
          ? "hover:bg-accent active:scale-[0.995]"
          : "cursor-not-allowed opacity-45",
        selected && "bg-accent",
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full"
          style={{ backgroundColor: brand.accent }}
        />
      )}

      <ProviderMark brand={model.brand} size="md" className="mt-0.5" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[0.8125rem] font-medium">{model.name}</span>

          {model.free ? (
            <span className="shrink-0 rounded border border-[var(--success)]/40 bg-[var(--success)]/12 px-1 py-px font-mono text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--success)]">
              Free
            </span>
          ) : null}

          {model.status === "preview" && (
            <span className="shrink-0 rounded border border-border px-1 py-px font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
              Preview
            </span>
          )}

          {selected && (
            <Check className="ml-auto size-3.5 shrink-0 text-[var(--ember)]" strokeWidth={2.5} />
          )}
        </span>

        <span className="mt-0.5 flex items-center gap-1.5 text-[0.625rem] text-muted-foreground">
          <span className="truncate">{brand.displayName}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 font-mono">{contextLabel(model.contextWindow)}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 font-mono">{costLabel(model)}</span>
        </span>

        <span className="mt-1 block truncate text-[0.6875rem] leading-relaxed text-muted-foreground">
          {model.available ? model.description : model.unavailableReason}
        </span>

        {model.available && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {label && (
              <span
                className="rounded px-1 py-px font-mono text-[0.5625rem] uppercase tracking-wider"
                style={{
                  color: brand.accent,
                  backgroundColor: `color-mix(in oklch, ${brand.accent} 14%, transparent)`,
                }}
              >
                {DISCOVERY_LABEL[label]}
              </span>
            )}
            {model.capabilities
              .filter((c) => c === "tools" || c === "vision" || c === "reasoning")
              .map((capability) => (
                <span
                  key={capability}
                  className="rounded border border-border px-1 py-px font-mono text-[0.5625rem] text-muted-foreground"
                >
                  {CAPABILITY_LABEL[capability]}
                </span>
              ))}
          </span>
        )}
      </span>
    </button>
  );
}

export function ModelSelector({
  models,
  value,
  onChange,
  align = "end",
  compact = false,
  disabled = false,
  catalogFetchedAt,
}: {
  models: ClientModel[];
  value: string;
  onChange: (modelId: string) => void;
  align?: "start" | "end";
  compact?: boolean;
  disabled?: boolean;
  catalogFetchedAt?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Read on open rather than on mount, so the list reflects other tabs too.
  // Both writes happen inside a task rather than the effect body, which keeps
  // opening the menu to a single render pass.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setRecent(readRecent());
      searchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const selected = models.find((m) => m.id === value) ?? models[0];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((model) =>
      [model.name, getBrand(model.brand).displayName, model.description, model.providerModelId]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [models, query]);

  const recentModels = useMemo(
    () =>
      recent
        .map((id) => filtered.find((m) => m.id === id))
        .filter((m): m is ClientModel => Boolean(m) && m!.id !== value),
    [recent, filtered, value],
  );

  // A model can match several sections; show it in the first it qualifies for
  // so the list stays scannable rather than repeating entries. Anything already
  // surfaced under "Recently used" is claimed up front for the same reason.
  const sections = useMemo(() => {
    const claimed = new Set<string>(query ? [] : recentModels.map((m) => m.id));
    const result: { id: SectionId; title: string; blurb?: string; models: ClientModel[] }[] = [];

    for (const section of SECTIONS) {
      const matched = filtered.filter(
        (model) => !claimed.has(model.id) && section.match(model),
      );
      if (!matched.length) continue;
      for (const model of matched) claimed.add(model.id);
      result.push({ ...section, models: matched });
    }

    const rest = filtered.filter((model) => !claimed.has(model.id));
    if (rest.length) result.push({ id: "premium", title: "Other models", models: rest });

    return result;
  }, [filtered, recentModels, query]);

  if (!selected) return null;

  const pick = (id: string) => {
    rememberModel(id);
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={`Model: ${selected.name}`}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface pl-1.5 pr-2 text-[0.8125rem] font-medium",
              "transition-[background-color,border-color,transform] duration-150",
              "hover:bg-accent active:scale-[0.98] disabled:opacity-50 focus-ember",
              compact ? "h-7" : "h-8",
            )}
          >
            <ProviderMark brand={selected.brand} size="sm" />
            <span className="truncate">{selected.name}</span>
            {selected.free && (
              <span className="shrink-0 rounded bg-[var(--success)]/15 px-1 font-mono text-[0.5625rem] font-semibold uppercase text-[var(--success)]">
                Free
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        }
      />

      <DropdownMenuContent
        align={align}
        className="flex max-h-[30rem] w-[23rem] min-w-[23rem] flex-col overflow-hidden p-0"
      >
        {/* search */}
        <div className="shrink-0 border-b border-hairline p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="h-8 w-full rounded-md border border-border bg-surface-sunken pl-7 pr-7 text-[0.8125rem] outline-none placeholder:text-muted-foreground focus-visible:border-[var(--ember)]/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {sections.length === 0 && (
            <p className="px-2 py-8 text-center text-[0.8125rem] text-muted-foreground">
              No models match “{query}”.
            </p>
          )}

          {!query && recentModels.length > 0 && (
            <div className="mb-1">
              <p className="label-meta flex items-center gap-1.5 px-2 py-1.5">
                <Clock className="size-3" />
                Recently used
              </p>
              {recentModels.map((model) => (
                <ModelRow
                  key={`recent-${model.id}`}
                  model={model}
                  selected={false}
                  onPick={() => pick(model.id)}
                />
              ))}
            </div>
          )}

          {sections.map((section) => (
            <div key={section.id} className="mb-1 last:mb-0">
              <p className="label-meta flex items-center gap-1.5 px-2 py-1.5">
                {section.id === "recommended" && <Sparkles className="size-3 text-[var(--ember)]" />}
                {section.id === "free" && <Zap className="size-3 text-[var(--success)]" />}
                {section.title}
              </p>

              {section.blurb && !query && (
                <p className="px-2 pb-1.5 text-[0.625rem] leading-relaxed text-muted-foreground/75">
                  {section.blurb}
                </p>
              )}

              {section.models.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  selected={model.id === value}
                  onPick={() => pick(model.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {catalogFetchedAt && (
          <p className="shrink-0 border-t border-hairline px-3 py-1.5 font-mono text-[0.5625rem] text-muted-foreground/70">
            Free catalog checked {relativeTime(catalogFetchedAt)} · via OpenRouter
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
