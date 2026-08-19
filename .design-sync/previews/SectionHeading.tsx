import { SectionHeading } from "blockwright";

// Copy ported from the marketing pages that use this heading — the display face
// (Archivo) and the ember eyebrow only read correctly at real sentence lengths.
export const Centered = () => (
  <SectionHeading
    eyebrow="How it works"
    title="Describe the mechanic. Get working Luau."
    description="Blockwright plans the system, writes real Luau into a structured project, checks its own output, and applies it straight into Roblox Studio."
  />
);

export const LeftAligned = () => (
  <SectionHeading
    align="left"
    eyebrow="Pricing"
    title="Start free. Pay when you ship."
    description="Every plan includes the Studio bridge and unlimited projects."
  />
);

export const TitleOnly = () => (
  <SectionHeading eyebrow="Templates" title="Start from something that already runs" />
);
