import { Section, SectionHeading } from "blockwright";
import { FileCode2, ShieldCheck, Workflow } from "lucide-react";

// Section is the landing page's layout wrapper — max-w-6xl, the page gutter and
// the vertical rhythm every marketing band shares. On its own it draws nothing,
// so both cells render it around the content it actually wraps on `/`.

// The "How it works" band, ported from src/app/(marketing)/page.tsx.
export const HowItWorks = () => (
  <Section id="how" className="border-t border-border">
    <SectionHeading
      eyebrow="How it works"
      title="It builds. It doesn't just answer."
      description="A chatbot hands you a snippet and leaves the integration to you. Blockwright works on the project itself — creating files, wiring them together, and verifying they compile before it says it's done."
    />

    <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
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
          body: "Not snippets to paste. Actual scripts, in the right places — server stuff on the server, player stuff on the player.",
        },
        {
          step: "03",
          icon: ShieldCheck,
          title: "It finds its own mistakes",
          body: "It re-reads everything it wrote, spots the broken bits and the things that only work on one side, and fixes them first.",
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
);

// Alternate bands are sunken so the page reads as stacked slabs — the pricing
// section on `/` uses exactly this pair of classes.
export const SunkenBand = () => (
  <Section id="pricing" className="border-t border-border bg-surface-sunken/40">
    <SectionHeading
      eyebrow="Credits"
      title="Pay for what you generate"
      description="One balance across every model. Heavier models cost more per token; nothing is charged for a request that fails before it reaches a provider."
    />
    <p className="mx-auto mt-8 max-w-xl text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
      Credits are metered from the token usage each provider reports. Every
      account starts with 2,000 credits and the Roblox Studio bridge included.
    </p>
  </Section>
);
