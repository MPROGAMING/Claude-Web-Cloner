import { HeroComposer } from "blockwright";

// The landing hero's prompt box — the product's core action, in the hero.
// Takes no props: the rotating placeholder cycles through real Roblox mechanics
// and the send button stays disabled until something is typed, which is the
// state a static capture sees. Submitting stores the idea in sessionStorage and
// routes to /projects, so nothing happens inside a preview card.

export const Empty = () => <HeroComposer />;

// How it is actually composed on `/`: centred under the hero headline.
export const InHero = () => (
  <div className="mx-auto max-w-3xl text-center">
    <h1 className="text-[2.6rem] font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-[4.25rem]">
      Say what you want
      <br />
      <span className="text-[var(--ember)]">to make.</span>
    </h1>
    <p className="mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
      Blockwright writes the scripts, wires the systems, and puts the whole thing
      into your Roblox place — ready for you to hit Publish.
    </p>
    <HeroComposer />
  </div>
);
