import {
  ProviderMark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "blockwright";

const MODELS: Record<string, string> = {
  "anthropic:claude-sonnet-4-5": "Claude Sonnet 4.5",
  "anthropic:claude-opus-4-5": "Claude Opus 4.5",
  "openai:gpt-5": "GPT-5",
  "google:gemini-2.5-pro": "Gemini 2.5 Pro",
};

const Items = () => (
  <>
    {Object.entries(MODELS).map(([value, label]) => (
      <SelectItem key={value} value={value}>
        {label}
      </SelectItem>
    ))}
  </>
);

/** Both heights. `default` is 32px; `sm` is the 28px form for dense toolbars. */
export const Sizes = () => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <span className="label-meta">Default — 32px</span>
      <Select items={MODELS} defaultValue="anthropic:claude-sonnet-4-5">
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <Items />
        </SelectContent>
      </Select>
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="label-meta">Small — 28px, composer toolbar</span>
      <Select items={MODELS} defaultValue="anthropic:claude-opus-4-5">
        <SelectTrigger size="sm" className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <Items />
        </SelectContent>
      </Select>
    </div>
  </div>
);

/** Nothing chosen yet — the placeholder reads muted, not like a value. */
export const Placeholder = () => (
  <div className="flex flex-col gap-4">
    <Select items={MODELS}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Choose a model" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <Items />
      </SelectContent>
    </Select>
    <Select items={MODELS} disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="No models available" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <Items />
      </SelectContent>
    </Select>
  </div>
);

/** The submitted-without-a-choice state: `aria-invalid` paints the ring red. */
export const Invalid = () => (
  <div className="flex flex-col gap-1.5">
    <span className="label-meta">Place to sync</span>
    <Select items={MODELS}>
      <SelectTrigger aria-invalid className="w-64">
        <SelectValue placeholder="Choose a place" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <Items />
      </SelectContent>
    </Select>
    <p className="text-[0.75rem] text-danger-ink">
      Pick a place before applying the change set.
    </p>
  </div>
);

/** Open: the trigger keeps its border while the popup is anchored under it. */
export const Open = () => (
  <Select items={MODELS} defaultValue="anthropic:claude-sonnet-4-5" defaultOpen>
    <SelectTrigger className="w-64">
      <ProviderMark brand="anthropic" size="sm" />
      <SelectValue />
    </SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false}>
      <Items />
    </SelectContent>
  </Select>
);
