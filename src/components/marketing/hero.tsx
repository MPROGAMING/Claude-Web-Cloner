import { GitBranch, Plug, ShieldCheck, Workflow } from "lucide-react";
import { BrickText } from "@/components/marketing/brick-text";
import { HeroComposer } from "@/components/marketing/hero-composer";
import { HeroOutcome } from "@/components/marketing/hero-outcome";
import { PlateBand } from "@/components/marketing/plate-band";

/**
 * The fold.
 *
 * The headline promises the thing a player feels — a mechanic, running, in a
 * place you can walk around in. An earlier version made the payoff word
 * `LUAU`, which is a file format rather than a reason to build anything, and
 * lost every blind comparison it was put through on exactly that point.
 *
 * The right-hand half has to pay that promise back inside the same viewport,
 * and for one round it did not: it opened on a syntax-highlighted `.luau` file
 * at roughly the weight of the call to action, so the fold said "go play it"
 * and showed a code review. It now leads with the mechanic as a player meets
 * it and keeps the file, the validator verdict and the pending change as a
 * footer under it — the hierarchy this whole direction is built on, which is
 * that the mechanic is the prize and the code is the receipt.
 *
 * The plate is a mounted object rather than a full-bleed background, and it
 * starts below the shared header on purpose: the plate carries one fixed
 * colour in both themes, and the nav above it keeps the page's own tokens, so
 * neither has to compromise for the other.
 *
 * Everything that is *read* here sits on a mount. A blind critic picked this
 * fold over the competitor's and named one flaw — "brown on brown, body copy
 * over a busy stud texture" — which the automated audit is structurally unable
 * to see, because it resolves contrast against a single flat ancestor colour
 * and a plate is a lattice of lit rims and cast shadows. So the eyebrow, the
 * standfirst, the promise list, the prompt and the receipt are all seated on
 * opaque parts; bare plate is left to the display type and the bricks, whose
 * own relief is louder than the studs.
 *
 * The words are aimed at a fourteen-year-old with an idea, not at the engineer
 * who built this. "Structured project", "the diff", "validates its own Luau"
 * and "changeset" were all true and all invisible to the reader they were
 * written for, so each one now says the same true thing in a word the reader
 * already owns. Precision was not the price: nothing here claims less than it
 * used to, it just stops asking for a vocabulary the audience has no reason to
 * have. The receipt keeps its real artifacts — a service path, a validator
 * verdict — because those are evidence, and evidence is allowed to look
 * technical. Explanation is not.
 */
const PROMISES = [
  { icon: Workflow, tone: "ember", text: "Tells you the plan first" },
  { icon: ShieldCheck, tone: "ok", text: "Checks its own code" },
  { icon: GitBranch, tone: "ember", text: "Nothing changes until you say yes" },
  { icon: Plug, tone: "signal", text: "Lands in the place you have open" },
] as const;

/** Three notes, so the plate is never one hue against itself. */
const TONE = {
  ember: "text-[var(--ember)]",
  ok: "text-[var(--success)]",
  signal: "text-[var(--signal)]",
} as const;

export function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden pt-16">
      {/* Sky. Warm light from above the plate, the way the material is lit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(112%_66%_at_50%_-6%,color-mix(in_oklch,var(--ember)_34%,transparent),transparent_66%)]"
      />

      <div className="relative mx-auto max-w-7xl px-3 pb-10 pt-4 sm:px-6 sm:pt-5">
        <PlateBand className="px-5 pb-7 pt-6 sm:px-9 sm:pb-8 sm:pt-8">
          <div>
            <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--ember)]" />
              An AI build partner for Roblox
            </p>

            <h1 className="mt-4 uppercase leading-[0.94]">
              <span className="block text-[clamp(1.0625rem,1.95vw,1.6rem)] font-bold tracking-[0.005em] text-foreground">
                Describe the mechanic.
              </span>
              <span className="mt-2.5 block text-[clamp(2.35rem,6.7vw,6rem)] sm:mt-3.5">
                <BrickText>Then go</BrickText> <BrickText tone="ember">play it.</BrickText>
              </span>
            </h1>

            {/* The standfirst and the four claims share one part, because they
                are one argument: here is what happens, and here is what you can
                hold us to. Three ink tones on the markers keep the plate from
                being brown against brown. */}
            <div className="mount mt-5 flex flex-col gap-4 rounded-2xl px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:gap-8">
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground lg:max-w-[26rem] lg:text-[1rem]">
                Say what you want to happen in your game. Blockwright writes
                the real Luau, puts each script where Roblox expects it, and
                shows you every line before it lands in the place you have
                open. Then you press play.
              </p>

              <ul className="grid gap-x-8 gap-y-2 border-t border-hairline pt-4 sm:grid-cols-2 lg:min-w-0 lg:flex-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                {PROMISES.map((promise) => (
                  <li key={promise.text} className="flex items-center gap-2.5 text-[0.8125rem]">
                    <promise.icon
                      aria-hidden
                      strokeWidth={2}
                      className={`size-4 shrink-0 ${TONE[promise.tone]}`}
                    />
                    {promise.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)] lg:gap-9">
              <HeroComposer />
              <HeroOutcome />
            </div>
          </div>
        </PlateBand>
      </div>
    </section>
  );
}
