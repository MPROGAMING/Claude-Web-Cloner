import type { Metadata } from "next";
import { CircleSlash, Coins, Gauge } from "lucide-react";
import { BrickText } from "@/components/marketing/brick-text";
import { CreditPacks } from "@/components/marketing/credit-packs";
import { PlateBand } from "@/components/marketing/plate-band";
import { Section, SectionHeading } from "@/components/marketing/section";
import { MODELS, PROVIDER_LABEL } from "@/lib/ai/registry";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Blockwright runs on credits. You pay for what the AI actually uses, at rates every model publishes up front.",
};

/**
 * /pricing.
 *
 * The job is to make one unit legible — what a credit is, when it is spent,
 * and what it costs to run each model — without becoming the three-column
 * plan comparison this product does not have. There are no tiers to compare:
 * every account has the same features and the same balance, so the page
 * explains the meter, publishes the rates from the registry, and stops.
 */
const MECHANICS = [
  {
    icon: Gauge,
    tone: "text-[var(--ember)]",
    title: "You pay for what you use",
    body: "A credit is one unit of AI use. Every model has a published rate, and a request costs whatever it actually used — counted by the provider that ran it, not guessed at by us.",
  },
  {
    icon: CircleSlash,
    tone: "text-[var(--signal)]",
    title: "If it fails, it is free",
    body: "A request that never gets to the AI — something did not check out, you hit a limit, a model is not set up — costs you nothing. You are only charged once it has finished writing.",
  },
  {
    icon: Coins,
    tone: "text-[var(--success)]",
    title: "Running out is not a disaster",
    body: "It stops and tells you so, and your projects stay exactly as they were. Nothing is deleted, nothing goes negative, and credits never expire.",
  },
];

const FAQ = [
  {
    q: "Does switching models cost more?",
    a: "It can, and the picker shows you each model's rate before you switch. Most people rough things out on a fast cheap one and move up to a stronger one for the hard part — the conversation carries over either way.",
  },
  {
    q: "What am I actually paying for?",
    a: "Your message, the parts of your project it had to read, and any Roblox documentation it looked up. That is why planning first is cheap — it reads before it writes, instead of writing the same thing twice.",
  },
  {
    q: "Do I need Roblox Studio?",
    a: "No. Blockwright writes and saves your project either way. The plugin is what makes the scripts turn up inside a place you have open, and you can connect at any point.",
  },
  {
    q: "Is there a paid plan I am missing?",
    a: "No. Projects, files, history, the Studio bridge and every model are on every account. Credits are the only thing being counted.",
  },
];

export default function PricingPage() {
  const models = MODELS.filter((model) => model.enabled);

  return (
    <>
      <section className="relative -mt-16 overflow-hidden pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(112%_66%_at_50%_-6%,color-mix(in_oklch,var(--ember)_28%,transparent),transparent_66%)]"
        />
        <div className="relative mx-auto max-w-7xl px-3 pb-10 pt-4 sm:px-6 sm:pt-5">
          <PlateBand className="px-5 py-7 sm:px-9 sm:py-9">
            <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--ember)]" />
              Pricing
            </p>

            <h1 className="mt-4 uppercase leading-[0.96]">
              <span className="block text-[clamp(1rem,1.7vw,1.375rem)] font-bold tracking-[0.005em]">
                One balance, every model.
              </span>
              <span className="mt-2.5 block text-[clamp(2rem,5.2vw,4.25rem)] sm:mt-3">
                <BrickText>Credits,</BrickText> <BrickText tone="ember">nothing else.</BrickText>
              </span>
            </h1>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {MECHANICS.map((item) => (
                <div key={item.title} className="mount rounded-xl p-4 sm:p-5">
                  <item.icon className={`size-4 ${item.tone}`} strokeWidth={1.75} aria-hidden />
                  <h2 className="mt-3 text-[0.9375rem] font-semibold">{item.title}</h2>
                  <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </PlateBand>
        </div>
      </section>

      <Section className="border-t border-border">
        <SectionHeading
          eyebrow="Rates"
          title="What each model costs to run"
          description="Credits per million tokens, straight out of the model list the product runs on. Input is what you send it — your message plus the bits of your project it read. Output is what it writes back."
        />

        <div className="mount mt-8 overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">
                Credit cost per million tokens for each available model
              </caption>
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
                {models.map((model) => (
                  <tr key={model.id} className="border-b border-hairline last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {model.name}
                      {model.recommended && (
                        <span className="ml-2 rounded border border-[var(--ember)]/35 bg-[var(--ember)]/10 px-1.5 py-px font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--ember-text)]">
                          Default
                        </span>
                      )}
                    </th>
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
        </div>
      </Section>

      <Section className="border-t border-border">
        <SectionHeading
          eyebrow="Topping up"
          title="More credits, when you need them"
          description="Same features, same balance. The only thing a pack changes is how many credits a dollar gets you."
        />
        <CreditPacks className="mt-8" />
      </Section>

      <Section className="border-t border-border">
        <SectionHeading eyebrow="Questions" title="The details" />
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="mount rounded-xl p-5">
              <dt className="text-[0.9375rem] font-semibold">{item.q}</dt>
              <dd className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
