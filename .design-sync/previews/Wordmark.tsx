import { Wordmark, LogoMark } from "blockwright";

// Wordmark is the display face (Archivo) at a fixed tracking — the cells exist
// mostly to prove the face is loading and the tracking is holding.
export const Default = () => <Wordmark />;

export const AtDisplaySizes = () => (
  <div className="flex flex-col gap-4">
    <Wordmark />
    <Wordmark className="text-xl" />
    <Wordmark className="text-3xl" />
    <Wordmark className="text-5xl" />
  </div>
);

export const BesideTheMark = () => (
  <span className="inline-flex items-center gap-2">
    <LogoMark />
    <Wordmark />
  </span>
);

export const Muted = () => (
  <div className="flex flex-col gap-3">
    <Wordmark />
    <Wordmark className="text-muted-foreground" />
    <Wordmark className="text-ember" />
  </div>
);
