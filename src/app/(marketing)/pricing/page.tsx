import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Section, SectionHeading } from "@/components/marketing/section";
import { MODELS, PROVIDER_LABEL } from "@/lib/ai/registry";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Blockwright is metered in credits, charged from the token usage each AI provider reports.",
};

const FAQ = [
  {
    q: "What is a credit?",
    a: "An internal unit of AI usage. Each model has a published rate per million input and output tokens, and a request costs the sum of the two. The rates are listed below.",
  },
  {
    q: "When am I charged?",
    a: "After a generation finishes, from the token counts the provider actually reports. A request that fails before reaching a provider — a validation error, a rate limit, an unconfigured model — costs nothing.",
  },
  {
    q: "What happens when I run out?",
    a: "Generation stops with a clear message and your projects stay exactly as they are. Nothing is deleted and nothing goes negative.",
  },
  {
    q: "Does switching models cost more?",
    a: "Yes, and the picker shows each model's output rate so you can decide. A common pattern is prototyping on a fast model and switching to a stronger one for the tricky part.",
  },
  {
    q: "Do I need Roblox Studio?",
    a: "No. Blockwright writes and stores your project files regardless. The Studio plugin is what makes them appear as Instances in an open place, and you can connect it at any point.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pb-0">
        <SectionHeading
          eyebrow="Pricing"
          title="One balance, every model"
          description="No seats, no per-project fees. You pay for the generation you actually run."
        />
        <PricingCards className="mt-12" />
      </Section>

      <Section className="border-t border-border">
        <SectionHeading
          eyebrow="Rates"
          title="What each model costs"
          description="Credits per million tokens. Input is what you send — your prompt plus the project context. Output is what the model writes."
        />

        <div className="mt-12 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken/60">
                {["Model", "Provider", "Input / M", "Output / M", "Context"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-4 py-3 text-left font-mono text-[0.625rem] font-normal uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODELS.filter((model) => model.enabled).map((model) => (
                <tr key={model.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{model.name}</span>
                    {model.recommended && (
                      <span className="ml-2 rounded border border-[var(--ember)]/35 bg-[var(--ember)]/10 px-1.5 py-px font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--ember)]">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {PROVIDER_LABEL[model.provider]}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                    {model.credits.input}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                    {model.credits.output}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                    {(model.contextWindow / 1000).toFixed(0)}k
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            { included: true, text: "Every model on every plan" },
            { included: true, text: "Unlimited projects and files" },
            { included: true, text: "Roblox Studio bridge" },
            { included: true, text: "File revisions and revert" },
            { included: false, text: "Team workspaces — not yet" },
            { included: false, text: "Published-game analytics — not yet" },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-2.5 text-[0.8125rem]">
              {item.included ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
              ) : (
                <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
              )}
              <span className={item.included ? "text-muted-foreground" : "text-muted-foreground/60"}>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-t border-border bg-surface-sunken/40">
        <SectionHeading eyebrow="Questions" title="The details" />
        <dl className="mx-auto mt-12 max-w-2xl divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {FAQ.map((item) => (
            <div key={item.q} className="p-5">
              <dt className="text-[0.9375rem] font-semibold">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
