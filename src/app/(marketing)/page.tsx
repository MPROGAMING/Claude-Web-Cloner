import {
  ArrowRight,
  Boxes,
  FileCode2,
  GitBranch,
  Plug2,
  ShieldCheck,
  Terminal,
  Workflow,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { WorkspacePreview } from "@/components/marketing/workspace-preview";
import { HeroComposer } from "@/components/marketing/hero-composer";
import { StudBuild } from "@/components/brand/stud-build";
import { RobloxHeroPair } from "@/components/marketing/roblox-showcase";
import { StudioFlow } from "@/components/marketing/studio-flow";
import { TemplateStrip } from "@/components/marketing/template-strip";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Section, SectionHeading } from "@/components/marketing/section";

export default function LandingPage() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        {/* The floor is Roblox's own material: a stud plate, fading out. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-studs opacity-[0.85] [mask-image:radial-gradient(ellipse_78%_62%_at_50%_8%,black,transparent)]"
        />
        {/* Light from the forge, low and slow. */}
        <div
          aria-hidden
          className="animate-forge pointer-events-none absolute left-1/2 top-[-10rem] size-[42rem] rounded-full bg-[var(--ember)]/14 blur-[130px]"
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8 sm:pt-14">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-[2.6rem] font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-[4.25rem]">
              Say what you want
              <br />
              <span className="text-[var(--ember)]">to make.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
              Blockwright builds it — the scripts, the systems, the whole thing —
              and puts it straight into your Roblox place.
            </p>

            {/* The product's core action, in the hero. */}
            <HeroComposer />
          </div>

          {/* Real Roblox above the fold, each tagged with the sentence that
              builds it. One image explains the product better than a section. */}
          <RobloxHeroPair className="mt-10" />
        </div>
      </section>

      <section className="relative border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <WorkspacePreview />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The problem it solves                                               */}
      {/* ------------------------------------------------------------------ */}
      <Section id="how" className="border-t border-border">
        <SectionHeading
          eyebrow="How it works"
          title="It builds. It doesn't just answer."
          description="A chatbot hands you a snippet and leaves the integration to you. Blockwright works on the project itself — creating files, wiring them together, and verifying they compile before it says it's done."
        />

        <div className="pointer-events-none mt-8 flex justify-center">
          <StudBuild className="h-[13rem] w-[17rem] sm:h-[16rem] sm:w-[21rem]" />
        </div>

        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {[
            {
              step: "01",
              icon: Workflow,
              title: "It tells you the plan first",
              body: "Before it builds anything big, you see the list of what it's about to make. If it's wrong, you fix it there — not after twenty files exist.",
            },
            {
              step: "02",
              icon: FileCode2,
              title: "It writes real scripts",
              body: "Not snippets to paste. Actual scripts, in the right places — server stuff on the server, player stuff on the player — the way a good Roblox dev would lay it out.",
            },
            {
              step: "03",
              icon: ShieldCheck,
              title: "It finds its own mistakes",
              body: "It re-reads everything it wrote, spots the old or broken bits and the things that only work on one side, and fixes them before you ever see them.",
            },
          ].map((item) => (
            <li key={item.step} className="bg-background p-7">
              <div className="flex items-center gap-3">
                <item.icon className="size-4 text-[var(--ember)]" strokeWidth={1.75} />
                <span className="label-meta">{item.step}</span>
              </div>
              <h3 className="mt-4 text-[1.0625rem] font-semibold">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Studio bridge                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Section id="studio" className="border-t border-border bg-surface-sunken/40">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--signal)]">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--signal)]" />
              Studio bridge
            </span>
            <h2 className="mt-3 text-3xl font-semibold leading-[1.1] sm:text-[2.5rem]">
              Watch it land in your place.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Install the plugin, paste a six-character code, and the project in
              your browser is linked to the place open in Studio. Scripts appear
              where they belong. No copy-paste, no dragging files around.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Plug2,
                  title: "Connect once",
                  body: "One short code and you're linked. Unlink from either side whenever you want.",
                },
                {
                  icon: Terminal,
                  title: "It can only do what you allow",
                  body: "The plugin does a short list of named jobs, like syncing your files. It is never handed code to run in your place.",
                },
                {
                  icon: GitBranch,
                  title: "It sees what happened",
                  body: "Whatever Studio reports — worked, or broke — comes back into the chat, so it can react to the real result instead of guessing.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
                    <item.icon className="size-4 text-[var(--signal)]" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-8 rounded-lg border border-border bg-surface p-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              Studio is optional. Everything works without it — your files are
              saved, and you can sync them next time you open Studio.
            </p>
          </div>

          <StudioFlow />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Section className="border-t border-border">
        <SectionHeading
          eyebrow="In the workspace"
          title="Made for actually finishing a game"
          description="The things you only miss on day two: every version kept, a way back when something breaks, and an honest count of what you've spent."
        />

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: FileCode2,
              title: "See every script",
              body: "All the code it writes, colour-coded and searchable, with a copy button when you want it somewhere else.",
            },
            {
              icon: GitBranch,
              title: "Undo anything",
              body: "Every change keeps the old version. See exactly what moved, and put it back in one click.",
            },
            {
              icon: Boxes,
              title: "Pick up where you left off",
              body: "Your chat, your files and your Studio link all stay with the project. Close the tab and come back tomorrow.",
            },
            {
              icon: Workflow,
              title: "No fake loading bars",
              body: "When it says it's searching the docs or writing a script, that is the thing it is doing right then.",
            },
            {
              icon: ShieldCheck,
              title: "Built so it can't be cheated",
              body: "It writes games where the server decides what counts — money, health, items — so players can't hand themselves whatever they like.",
            },
            {
              icon: Plug2,
              title: "Swap brains mid-build",
              body: "Start on something fast, switch to something stronger for the hard part. It remembers the whole conversation either way.",
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-background p-6">
              <feature.icon className="size-4 text-[var(--ember)]" strokeWidth={1.75} />
              <h3 className="mt-4 text-[0.9375rem] font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Templates                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Section className="border-t border-border bg-surface-sunken/40">
        <SectionHeading
          eyebrow="Templates"
          title="Start from a known-good loop"
          description="Templates are prompts, not frozen code — the agent generates fresh against today's Roblox APIs every time."
        />
        <TemplateStrip className="mt-12" />
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Models                                                              */}
      {/* ------------------------------------------------------------------ */}
      {/* The model catalogue used to live here: fourteen rows of provider names
          and context windows. It was the largest section on the page, aimed at
          someone who evaluates inference pricing rather than someone who wants
          a tycoon game. The capability is unchanged and still in the workspace
          model picker; the landing now says the one thing a creator needs. */}
      <Section id="brain" className="border-t border-border">
        <SectionHeading
          eyebrow="The brain"
          title="It actually knows Roblox"
          description="Most AI guesses at Roblox and invents functions that don't exist. Blockwright reads the real documentation before it writes a line, and tells you which page it used."
        />

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {[
            {
              stat: "5,456",
              label: "pages of official Roblox and Luau documentation it can read",
            },
            {
              stat: "9,591",
              label: "Roblox functions and events it checks your code against",
            },
            {
              stat: "3,190",
              label: "real code examples from the docs it can learn a pattern from",
            },
          ].map((item) => (
            <div key={item.stat} className="bg-background p-7">
              <p className="text-[2.25rem] font-extrabold leading-none tracking-[-0.03em] text-[var(--ember)]">
                {item.stat}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[0.8125rem] leading-relaxed text-muted-foreground">
          You can pick which AI writes your game, and swap it mid-build — that
          lives in the workspace, next to the chat box, where you actually need it.
        </p>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Pricing                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Section id="pricing" className="border-t border-border bg-surface-sunken/40">
        <SectionHeading
          eyebrow="Credits"
          title="Pay for what you generate"
          description="One balance across every model. Heavier models cost more per token; nothing is charged for a request that fails before it reaches a provider."
        />
        <PricingCards className="mt-12" />
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotgrid opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
          <h2 className="text-3xl font-semibold leading-[1.1] sm:text-[2.75rem]">
            What are you building?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Open a project, type one sentence, and watch the first version of it
            appear.
          </p>
          <LinkButton href="/sign-up" size="lg" className="mt-8 h-10 px-5 text-sm">
            Start building free
            <ArrowRight className="size-4" data-icon="inline-end" />
          </LinkButton>
        </div>
      </section>
    </>
  );
}
