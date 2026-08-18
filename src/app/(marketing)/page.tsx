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
import { ModelWall } from "@/components/marketing/model-wall";
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-blueprint opacity-[0.55] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-14rem] size-[36rem] -translate-x-1/2 rounded-full bg-[var(--ember)]/12 blur-[110px] animate-drift"
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-[var(--ember)]" />
              For Roblox creators
            </span>

            <h1 className="mt-6 text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[4.25rem]">
              Describe the mechanic.
              <br />
              <span className="text-muted-foreground">Get the working game.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
              Real Luau, organised properly, checked against the Roblox docs, and
              pushed straight into Studio.
            </p>

            {/* The product's core action, in the hero. */}
            <HeroComposer />

            <div className="mt-6 flex items-center justify-center">
              <LinkButton href="#how" size="lg" variant="ghost" className="h-9 px-4 text-[0.8125rem] text-muted-foreground">
                See how it works
                <ArrowRight className="size-3.5" data-icon="inline-end" />
              </LinkButton>
            </div>
          </div>

          <div className="relative mt-14 sm:mt-20">
            <WorkspacePreview />
          </div>
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

        <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {[
            {
              step: "01",
              icon: Workflow,
              title: "It plans out loud",
              body: "Every non-trivial request starts with a visible plan. You see the six things it's about to build before it builds them, so nothing arrives as a surprise.",
            },
            {
              step: "02",
              icon: FileCode2,
              title: "It writes real files",
              body: "Server logic in ServerScriptService, client code in StarterPlayerScripts, shared modules in ReplicatedStorage. Structured the way a Roblox engineer would structure it.",
            },
            {
              step: "03",
              icon: ShieldCheck,
              title: "It checks its own work",
              body: "Generated Luau is statically checked for deprecated globals, removed APIs and server/client mistakes. It reads the failures and fixes them before handing over.",
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
            <span className="label-meta">Studio bridge</span>
            <h2 className="mt-3 text-3xl font-semibold leading-[1.1] sm:text-[2.5rem]">
              Your place, updated while you watch.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Install the Blockwright plugin, paste a six-character code, and the
              project you&apos;re building in the browser is linked to the place
              open on your machine. Scripts land as real Instances under the right
              services — no copy-paste, no file juggling.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Plug2,
                  title: "Pair once, per project",
                  body: "A short code, a token, done. Disconnect from either side at any time.",
                },
                {
                  icon: Terminal,
                  title: "Allowlisted actions only",
                  body: "The plugin executes named verbs like sync_files. It never receives code to run.",
                },
                {
                  icon: GitBranch,
                  title: "Results flow back",
                  body: "Successes and errors return to the conversation, so the AI can react to what actually happened in Studio.",
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
              Studio is optional. Everything still works without it — files are
              saved to your project and you can sync whenever you open Studio next.
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
          title="Built for long build sessions"
          description="The parts you'd miss on day two: file history, diffs, model switching mid-conversation, and a record of every credit spent."
        />

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: FileCode2,
              title: "File tree and code viewer",
              body: "Every generated script, syntax highlighted, with line numbers, search and a copy button.",
            },
            {
              icon: GitBranch,
              title: "Revisions and revert",
              body: "Each edit snapshots the previous version. Diff what changed, restore it in one click.",
            },
            {
              icon: Boxes,
              title: "Projects that persist",
              body: "Conversations, files and Studio pairing all live with the project. Close the tab and pick up where you left off.",
            },
            {
              icon: Workflow,
              title: "Honest progress",
              body: "Status lines map to real operations. Nothing invents a progress bar for work that isn't happening.",
            },
            {
              icon: ShieldCheck,
              title: "Server-side everything",
              body: "Provider keys, credit accounting and file writes are enforced on the server. The browser is never trusted.",
            },
            {
              icon: Plug2,
              title: "Switch models mid-build",
              body: "Start on a fast model, escalate to a stronger one for the tricky part. The conversation carries over.",
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
      <Section id="models" className="border-t border-border">
        <SectionHeading
          eyebrow="Models"
          title="Three providers, one workspace"
          description="Pick per project or per message. Credits are metered from real reported token usage — you can see the cost of every request."
        />
        <ModelWall className="mt-12" />
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
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
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
