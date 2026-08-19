import { StudBuild } from "blockwright";

// An isometric stud build — the landing page's brand illustration. It animates
// through a beat sequence, so a static capture catches one frame; that frame is
// what these cells show. Its own palette is fixed (stone / deep / ember /
// accent brick tones), not token-driven.
export const Default = () => <StudBuild />;

export const OnTheHeroSurface = () => (
  <div className="grid max-w-2xl place-items-center rounded-2xl bg-surface-sunken bg-blueprint p-8">
    <StudBuild />
  </div>
);

export const Small = () => (
  <div className="grid max-w-sm place-items-center rounded-xl border border-border bg-surface p-6">
    <StudBuild className="w-40" />
  </div>
);
