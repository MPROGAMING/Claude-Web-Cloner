import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "blockwright";

// The scroll buttons only mount when the option list is taller than the popup,
// so this list is deliberately long — a real Roblox place list gets there fast.
const PLACES: Record<string, string> = Object.fromEntries(
  [
    "Start Place",
    "Lobby",
    "Arena A",
    "Arena B",
    "Arena C",
    "Shop",
    "Obby — Stage 1",
    "Obby — Stage 2",
    "Obby — Stage 3",
    "Obby — Stage 4",
    "Spectator Deck",
    "Tutorial",
    "Backrooms",
    "Boss Room",
  ].map((n) => [n.toLowerCase().replace(/[^a-z0-9]+/g, "-"), n]),
);

const Overflowing = ({ value }: { value: string }) => (
  <Select items={PLACES} defaultValue={value} defaultOpen>
    <div className="flex flex-col gap-1.5">
      <span className="label-meta">Sync target</span>
      <SelectTrigger className="w-72">
        <SelectValue />
      </SelectTrigger>
    </div>
    <SelectContent align="start" alignItemWithTrigger={false} className="max-h-56">
      <SelectGroup>
        <SelectLabel>Bloxburg Tycoon</SelectLabel>
        {Object.entries(PLACES).map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
);

// Selecting something near the end scrolls the list down, which is what puts the
// UP button on screen.
export const ScrolledDown = () => <Overflowing value="boss-room" />;

export const AtTheTop = () => <Overflowing value="start-place" />;
