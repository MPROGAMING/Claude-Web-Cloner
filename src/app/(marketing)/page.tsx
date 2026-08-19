import { ArrowRight, BookOpen, FileCode2, GitBranch, ShieldCheck, Workflow } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { BrickText } from "@/components/marketing/brick-text";
import { Hero } from "@/components/marketing/hero";
import { PlateBand } from "@/components/marketing/plate-band";
import { StudioFlow } from "@/components/marketing/studio-flow";
import { Section, SectionHeading } from "@/components/marketing/section";

/**
 * The landing page.
 *
 * It used to run ten sections and 7,335px — a workspace replay, a feature
 * grid, a model catalogue, a pricing block and two showcases — against a
 * competitor who says everything in one screen and wins. Length was not
 * buying anything: the fold already carries the promise, the composer and the
 * receipt, and every section after it was another way of saying the same
 * thing to someone who had already decided.
 *
 * What is left is the three questions the fold cannot answer — how does it
 * work, how does it reach my place, does it actually know Roblox — and one
 * action. Sections were cut rather than compressed; nothing here is a
 * shrunken version of something bigger.
 *
 * The reader is thirteen to nineteen and has an idea, not a computer-science
 * degree. Every claim below is the same claim the engineering docs make; the
 * only thing that changed is that it is written in words the reader already
 * has. That is not simplification — "you see every line it added or took out
 * before you agree" is *more* specific than "review the diff", because it says
 * what you actually see and when.
 */

const STEPS = [
  {
    icon: Workflow,
    tone: "text-[var(--ember)]",
    title: "It tells you the plan first",
    body: "Before it builds anything big you get the list of what it is about to make. If it is wrong you fix it right there, instead of after twenty files exist.",
  },
  {
    icon: FileCode2,
    tone: "text-[var(--signal)]",
    title: "It writes real scripts",
    body: "Not a snippet to paste. Actual scripts, put where Roblox expects them — server stuff on the server, player stuff on the player — the way someone who knows Roblox would lay it out.",
  },
  {
    icon: ShieldCheck,
    tone: "text-[var(--success)]",
    title: "It checks its own code",
    body: "It reads back everything it wrote and looks for what actually breaks games: functions Roblox retired years ago, and code sitting on the player that only works on the server. It fixes those before you see them.",
  },
  {
    icon: GitBranch,
    tone: "text-[var(--ember)]",
    title: "Nothing lands until you say so",
    body: "You get the list of files it wants to change, and you can read every line it added or took out before you agree. Changed your mind afterwards? One press puts it back.",
  },
];

/**
 * Counted out of the shipped corpus manifest (`docs/roblox-brain/corpus`), not
 * estimated. If the corpus is rebuilt these three numbers move with it.
 */
const BRAIN = [
  { stat: "5,456", label: "pages of official Roblox and Luau documentation it reads from" },
  { stat: "9,591", label: "Roblox functions and events it checks your code against" },
  { stat: "3,190", label: "real examples out of the docs it can learn a pattern from" },
];

export default function LandingPage() {
  return (
    <>
      <Hero />

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Section id="how" className="border-t border-border bg-surface-sunken/60">
        <SectionHeading
          eyebrow="How it works"
          title="It builds. It doesn't just answer."
          description="Ask a chatbot and you get a chunk of code and good luck. Blockwright works on the game itself — making the files, wiring them to each other, and making sure they actually run before it tells you it is finished."
        />

        {/* A tray: the plate pressed in (Inlet), holding four parts. The
            lattice stops at the tray edge rather than running under the
            heading — studs behind running text is the one flaw a blind critic
            found in the fold, and no contrast audit can see it.

            `--surface` is lifted a step on the way down, so a part inside a
            sunken tray is not the same value as the tray. Set on a descendant
            because `.mount` is unlayered and would beat a utility on itself. */}
        <div className="relative mt-8 overflow-hidden rounded-2xl bg-surface-sunken p-[1.0625rem] shadow-[inset_0_2px_6px_0_rgb(0_0_0/0.4)] sm:p-[2.125rem]">
          <div
            aria-hidden
            className="stud-plate-inlet pointer-events-none absolute inset-0 opacity-90 [--stud-pitch:34px]"
          />
          <ol className="relative grid gap-4 [--surface:var(--surface-raised)] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="mount rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="brick flex size-8 items-center justify-center rounded-lg font-mono text-[0.75rem] font-bold text-[var(--ember-ink)] [--lift:3px]"
                  >
                    {index + 1}
                  </span>
                  <step.icon className={`size-4 ${step.tone}`} strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-4 text-[1.0625rem] font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Studio bridge — the same plate as the hero, in the other note.      */}
      {/* ------------------------------------------------------------------ */}
      <section id="studio" className="scroll-mt-16">
        <div className="mx-auto max-w-7xl px-3 pb-4 sm:px-6">
          <PlateBand className="px-5 py-7 sm:px-9 sm:py-9">
            <div className="grid gap-7 lg:grid-cols-[1fr_minmax(0,1fr)] lg:items-center lg:gap-12">
              <div>
                <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[var(--signal)]">
                  <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--signal)]" />
                  Studio bridge
                </p>

                {/* The same moulding as the hero, one size down. Display type
                    is the one thing allowed to sit on bare plate — its own
                    relief is louder than the lattice. */}
                <h2 className="mt-4 pb-1.5 text-[clamp(1.75rem,3.4vw,2.5rem)] uppercase leading-[1.12]">
                  <BrickText>Watch it land</BrickText>{" "}
                  <BrickText>in your place.</BrickText>
                </h2>

                <div className="mount mt-5 rounded-2xl px-4 py-4 sm:px-5">
                  <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
                    Install the plugin, type in a six-character code, and the
                    project in your browser is joined to the place you have open
                    in Studio. Scripts turn up where they belong — no copying
                    and pasting, no dragging files around. When it plays the way
                    you wanted, you hit Publish in Studio and your friends are
                    in it.
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-hairline pt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    <li>
                      The plugin can only do a short list of jobs we named ahead
                      of time. Nothing ever hands it code to run inside your
                      place.
                    </li>
                    <li>
                      Whatever Studio says back — it worked, or it didn&rsquo;t —
                      goes straight into the chat, so it is reacting to what
                      really happened rather than what it hoped.
                    </li>
                    <li>
                      You don&rsquo;t need Studio to start. Your files are saved
                      either way, and you can join them up the next time you
                      open a place.
                    </li>
                  </ul>
                </div>
              </div>

              <StudioFlow />
            </div>
          </PlateBand>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The knowledge base                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Section id="brain" className="border-t border-border">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-14">
          <SectionHeading
            eyebrow="The knowledge base"
            title="It actually knows Roblox"
            description="Most AI guesses at Roblox and makes up functions that were never there. Blockwright reads the real documentation before it writes a line, and tells you which page it got it from."
          />

          <div className="mount rounded-xl p-5 sm:p-6">
            <ul className="divide-y divide-[var(--hairline)]">
              {BRAIN.map((item) => (
                <li key={item.stat} className="flex items-baseline gap-4 py-3 first:pt-0 last:pb-0">
                  <p className="w-[4.75rem] shrink-0 font-display text-[1.5rem] font-extrabold leading-none tabular-nums tracking-[-0.03em] text-[var(--ember)]">
                    {item.stat}
                  </p>
                  <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {item.label}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-2.5 border-t border-hairline pt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-[var(--signal)]" strokeWidth={1.75} />
              Counted out of the documentation that ships inside the product,
              not guessed at. You pick which model writes your game, and you can
              swap it halfway through.
            </p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* One closing action                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_120%,color-mix(in_oklch,var(--ember)_22%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-3xl px-5 py-12 text-center sm:px-8 sm:py-14">
          <h2 className="text-[1.875rem] font-bold uppercase leading-[1.02] tracking-[-0.02em] sm:text-[2.5rem]">
            What are you building?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground">
            Say the thing you have been picturing. You get 2,000 credits when
            you make an account, and saying no to the first plan it comes back
            with costs you nothing.
          </p>
          <LinkButton
            href="/sign-up"
            size="lg"
            className="brick mt-8 h-12 rounded-xl px-7 font-display text-[1.0625rem] font-extrabold uppercase tracking-[0.04em] text-[var(--ember-ink)]"
          >
            Start building free
            <ArrowRight className="size-4" data-icon="inline-end" strokeWidth={2.75} />
          </LinkButton>
        </div>
      </section>
    </>
  );
}
