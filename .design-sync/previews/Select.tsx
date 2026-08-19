import {
  ProviderMark,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "blockwright";

// `items` is what lets a *closed* trigger show the model's name instead of the
// raw `provider:model` id — Base UI unmounts the popup when closed, so the
// label has to come from the root.
const MODELS: Record<string, string> = {
  "anthropic:claude-sonnet-4-5": "Claude Sonnet 4.5",
  "anthropic:claude-opus-4-5": "Claude Opus 4.5",
  "anthropic:claude-haiku-4-5": "Claude Haiku 4.5",
  "openai:gpt-5": "GPT-5",
  "google:gemini-2.5-pro": "Gemini 2.5 Pro",
};

const PLACES: Record<string, string> = {
  "sword-fight-arena/start": "Sword Fight Arena · Start Place",
  "sword-fight-arena/lobby": "Sword Fight Arena · Lobby",
  "bloxburg-tycoon/start": "Bloxburg Tycoon · Start Place",
  "obby-checkpoints/start": "Obby Checkpoints · Start Place",
};

/** The default model for new chats, as it reads on the settings page. */
export const ModelPicker = () => (
  <Select items={MODELS} defaultValue="anthropic:claude-sonnet-4-5" defaultOpen>
    <div className="flex flex-col gap-1.5">
      <span className="label-meta">Default model</span>
      <SelectTrigger className="w-72">
        <SelectValue />
      </SelectTrigger>
    </div>
    <SelectContent align="start" alignItemWithTrigger={false}>
      <SelectGroup>
        <SelectLabel>Anthropic</SelectLabel>
        <SelectItem value="anthropic:claude-sonnet-4-5">
          <ProviderMark brand="anthropic" size="sm" />
          <span>Claude Sonnet 4.5</span>
          <span className="ml-auto font-mono text-[0.625rem] text-muted-foreground">
            150 cr/M out
          </span>
        </SelectItem>
        <SelectItem value="anthropic:claude-opus-4-5">
          <ProviderMark brand="anthropic" size="sm" />
          <span>Claude Opus 4.5</span>
          <span className="ml-auto font-mono text-[0.625rem] text-muted-foreground">
            250 cr/M out
          </span>
        </SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Other providers</SelectLabel>
        <SelectItem value="openai:gpt-5">
          <ProviderMark brand="openai" size="sm" />
          <span>GPT-5</span>
        </SelectItem>
        <SelectItem value="google:gemini-2.5-pro">
          <ProviderMark brand="google" size="sm" />
          <span>Gemini 2.5 Pro</span>
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);

/** Closed, in the settings row it actually ships in. */
export const SettingsRow = () => (
  <div className="flex max-w-lg flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.8125rem] font-medium" htmlFor="sync-target">
        Sync target
      </label>
      <p className="text-[0.75rem] text-muted-foreground">
        Change sets are applied to this place when you approve them.
      </p>
      <Select items={PLACES} defaultValue="sword-fight-arena/start">
        <SelectTrigger id="sync-target" className="w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {Object.entries(PLACES).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

/** No Studio session, so there is nothing to pick a place from yet. */
export const Disabled = () => (
  <div className="flex flex-col gap-1.5">
    <span className="label-meta">Sync target</span>
    <Select items={PLACES} defaultValue="bloxburg-tycoon/start" disabled>
      <SelectTrigger className="w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {Object.entries(PLACES).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-[0.75rem] text-muted-foreground">
      Connect Roblox Studio to choose a place.
    </p>
  </div>
);
