import type { Metadata } from "next";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Coins, Receipt } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ProviderMark } from "@/components/brand/provider-mark";
import { BrickText } from "@/components/marketing/brick-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCreditBalance,
  getProfile,
  getUsageSummary,
  listCreditTransactions,
  requireUser,
} from "@/lib/data/queries";
import { CREDIT_PACKS, formatCredits } from "@/lib/credits/pricing";
import { getModelOrDefault } from "@/lib/ai/registry";
import { formatDateTime, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Credits & usage" };

/**
 * Credits, as a fuel gauge rather than a table of numbers.
 *
 * The whole surface is honest about what it can and cannot do. The balance,
 * the grant, the spend, every request and every ledger row come from this
 * account.
 *
 * Nothing is for sale here yet, and the way that used to be said — a warning
 * banner reading "checkout is not enabled on this deployment" sitting directly
 * above three priced packs — was the worst of both worlds: it advertised
 * something unavailable AND handed the reader an engineer's TODO. Prices only
 * belong on an account page once they can be paid. So the section states the
 * plan the account is actually on, in the reader's language, and names the
 * packs that are waiting; the price list itself lives on /pricing until there
 * is a checkout behind it. `CREDIT_PACKS` stays the single source of truth for
 * every pack fact either page shows.
 *
 * The plate carries the summary — one number big enough to read across a room,
 * a segmented gauge that encodes the same fact in form, and the three figures
 * that explain it. The detail lives below it on the page's own surface, where
 * dense rows belong. Everything that is *read* on the plate sits on a mount:
 * the lattice is a lit, shadowed texture and running text over it loses
 * contrast that no automated audit can measure.
 */

/** Gauge resolution. Whole cells, because a plate measures in whole studs. */
const GAUGE_CELLS = 24;

export default async function CreditsPage() {
  const { user } = await requireUser();
  const [profile, balance, transactions, usage] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listCreditTransactions(),
    getUsageSummary(),
  ]);

  const current = balance?.balance ?? 0;
  const granted = balance?.lifetime_granted ?? 0;
  const spent = balance?.lifetime_spent ?? 0;
  const low = current < 500;
  const plan = profile?.plan ?? "free";

  const remainingShare = granted > 0 ? Math.min(1, Math.max(0, current / granted)) : 0;
  const litCells = granted > 0 ? Math.max(current > 0 ? 1 : 0, Math.round(remainingShare * GAUGE_CELLS)) : 0;

  // Both figures are arithmetic over the requests this account actually made —
  // an average and what that average implies, never a forecast dressed up as
  // one. The divisor is shown alongside so the number can be checked.
  const perRequest = usage.totalRequests > 0 ? usage.totalCredits / usage.totalRequests : 0;
  const runway = perRequest >= 1 ? Math.floor(current / perRequest) : null;

  // The packs are real, configured objects with names — so name them. Prices
  // stay off an account page until they can be paid, and CREDIT_PACKS remains
  // the only place either fact is written down.
  const packNames = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(
    CREDIT_PACKS.map((pack) => pack.name),
  );

  return (
    <>
      <Topbar balance={current} email={user.email ?? ""} displayName={profile?.display_name} />

      <PageBody>
        <section className="plate relative overflow-hidden rounded-[1.5rem] px-5 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-7">
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.38] [--stud-pitch:38px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.075),transparent_34%,rgb(0_0_0/0.16))]"
          />

          <div className="relative">
            {/* The page title is the eyebrow and the balance is the display
                datum, not the other way round: the heading a screen reader
                announces has to name the page, and "1,096" does not. */}
            <h1 className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-[2px]",
                  low ? "bg-[var(--warning)]" : "bg-[var(--ember)]",
                )}
              />
              Credits &amp; usage
            </h1>

            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
              <p className="font-display text-[clamp(2.75rem,11vw,6rem)] font-semibold uppercase leading-[0.86] tabular-nums">
                <BrickText tone={low ? "ember" : "cream"}>
                  {current.toLocaleString("en-US")}
                </BrickText>
              </p>
              <p className="mount rounded-lg px-3 py-1.5 text-[0.8125rem]">
                credits left · <span className="capitalize">{plan}</span> plan
              </p>
            </div>

            {/* One part carries the whole summary: the gauge that shows the
                shape of the balance, and the three figures that explain how it
                got there. Splitting them across two mounts made the plate read
                as two unrelated widgets. */}
            <div className="mount mt-6 grid gap-5 rounded-2xl px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8">
              <div>
                <Gauge lit={litCells} spent={spent} granted={granted} current={current} />
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  Metered from the token usage each provider reports for your requests — never
                  estimated, never rounded up to a plan.
                </p>
              </div>

              <div className="border-t border-hairline pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <dl className="grid grid-cols-3 gap-3">
                  <Figure label="Requests" value={usage.totalRequests.toLocaleString("en-US")} />
                  <Figure label="Spent (recent)" value={formatCredits(usage.totalCredits)} />
                  <Figure
                    label="Avg / request"
                    value={perRequest > 0 ? formatCredits(Math.round(perRequest)) : "—"}
                  />
                </dl>

                <p className="mt-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {runway !== null ? (
                    <>
                      At that average this balance covers roughly{" "}
                      {/* --ember-text, not --ember: the base token is tuned to
                          read against the page, and this sits on a lighter
                          plate mount where it falls to 4.2:1. */}
                      <span className="font-mono tabular-nums text-[var(--ember-text)]">
                        {runway}
                      </span>{" "}
                      more requests.
                    </>
                  ) : (
                    <>
                      Nothing has been metered yet. A per-request average appears here as soon as
                      you run your first build.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {low && (
            <div className="mount relative mt-5 flex items-start gap-3 rounded-xl border border-[var(--warning)]/40 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
              <div>
                {/* The tone is carried by the icon and the edge, not by the
                    heading: --warning-ink is tuned against the page, and a
                    plate mount is a lighter ground than it was measured on. */}
                <p className="text-sm font-semibold">Running low on credits</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  Generations stop once your balance is too low to cover a request. Switching to a
                  faster model in Settings uses fewer credits per message.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* The plan this account is on — stated once, plainly. */}
        <section className="mt-8">
          <h2 className="label-meta">Plan</h2>

          <div className="mt-3 grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6 sm:p-5">
            <div className="rounded-lg bg-surface-sunken px-4 py-3.5">
              <p className="label-meta">Current plan</p>
              <p className="mt-2 font-display text-2xl font-semibold capitalize leading-none">
                {plan}
              </p>
              <p className="mt-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">
                Every feature is on it. Credits are the only thing that runs out.
              </p>
            </div>

            <div className="max-w-[62ch]">
              <p className="text-[0.875rem] font-semibold">Blockwright isn’t selling credits yet.</p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {granted > 0 ? (
                  <>
                    The {granted.toLocaleString("en-US")} credits on this account came with it, they
                    do not expire, and there is no card attached — generations simply pause if the
                    balance runs out.
                  </>
                ) : (
                  <>
                    Credits granted to this account do not expire, and there is no card attached —
                    generations simply pause if the balance runs out.
                  </>
                )}
              </p>
              <p className="mt-3 border-t border-hairline pt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {packNames} are the top-up packs waiting behind that. They arrive here, priced and
                ready to buy, the day top-ups open.
              </p>
            </div>
          </div>
        </section>

        {/* Detail. Three views over the same spend, coarse to fine. */}
        <Tabs defaultValue="usage" className="mt-10">
          <TabsList>
            <TabsTrigger value="usage">Usage by model</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="ledger">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="mt-6">
            {usage.byModel.length === 0 ? (
              <EmptyState
                icon={Coins}
                title="No usage yet"
                description="Once you run a generation, a per-model breakdown appears here."
              />
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-surface">
                {usage.byModel.map((row, index) => {
                  const model = getModelOrDefault(row.modelId);
                  const share =
                    usage.totalCredits > 0 ? (row.credits / usage.totalCredits) * 100 : 0;
                  return (
                    <li
                      key={row.modelId}
                      className="relative flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-0"
                    >
                      {/* The share, encoded in form as well as in the number. */}
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 bg-[var(--ember)]/10"
                        style={{ width: `${share}%` }}
                      />
                      <span
                        aria-hidden
                        className="relative w-4 shrink-0 font-mono text-[0.6875rem] tabular-nums text-muted-foreground"
                      >
                        {index + 1}
                      </span>
                      <ProviderMark brand={model.brand} size="sm" className="relative rounded-md" />
                      <div className="relative min-w-0 flex-1">
                        <p className="truncate text-[0.875rem] font-medium">{model.name}</p>
                        <p className="font-mono text-[0.6875rem] text-muted-foreground">
                          {row.requests} request{row.requests === 1 ? "" : "s"}
                          {share > 0 && ` · ${share.toFixed(0)}% of spend`}
                        </p>
                      </div>
                      <span className="relative shrink-0 font-mono text-[0.875rem] tabular-nums">
                        {formatCredits(row.credits)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            {usage.requests.length === 0 ? (
              <EmptyState
                icon={Coins}
                title="No requests yet"
                description="Each AI request is logged with its latency, token counts and credit cost."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full min-w-[44rem] text-sm">
                  <caption className="sr-only">
                    The most recent {Math.min(50, usage.requests.length)} AI requests on this
                    account.
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-sunken/60">
                      {["When", "Model", "In", "Out", "Latency", "Credits"].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-4 py-2.5 text-left font-mono text-[0.625rem] font-normal uppercase tracking-[0.12em] text-muted-foreground last:text-right"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usage.requests.slice(0, 50).map((request) => {
                      const failed = request.status === "failed" || request.status === "aborted";
                      return (
                        <tr key={request.id} className="border-b border-hairline last:border-0">
                          <td className="whitespace-nowrap px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
                            {formatDateTime(request.created_at)}
                          </td>
                          <td className="px-4 py-2.5 text-[0.8125rem]">
                            <span className="flex items-center gap-2">
                              {getModelOrDefault(request.model_id).name}
                              {failed && (
                                <span className="rounded border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-1.5 py-px font-mono text-[0.625rem] text-[var(--danger-ink)]">
                                  {request.status}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                            {formatTokens(request.input_tokens)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                            {formatTokens(request.output_tokens)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                            {request.latency_ms ? `${(request.latency_ms / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[0.75rem] tabular-nums">
                            {request.credits_charged}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ledger" className="mt-6">
            {transactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions"
                description="Grants and usage both appear in this ledger."
              />
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-surface">
                {transactions.map((tx) => {
                  const credit = tx.amount > 0;
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-0"
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg",
                          credit
                            ? "bg-[var(--success)]/12 text-[var(--success)]"
                            : "bg-surface-sunken text-muted-foreground",
                        )}
                      >
                        {credit ? (
                          <ArrowUpRight className="size-3.5" />
                        ) : (
                          <ArrowDownRight className="size-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem]">
                          {tx.description ?? tx.kind.replace(/_/g, " ")}
                        </p>
                        <p className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground">
                          {tx.kind.replace(/_/g, " ")} · {formatDateTime(tx.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "font-mono text-[0.8125rem] tabular-nums",
                            credit && "text-[var(--success)]",
                          )}
                        >
                          {credit ? "+" : ""}
                          {tx.amount.toLocaleString("en-US")}
                        </p>
                        <p className="font-mono text-[0.625rem] text-muted-foreground">
                          {tx.balance_after.toLocaleString("en-US")} left
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-meta leading-[1.4]">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums sm:text-2xl">{value}</dd>
    </div>
  );
}

/**
 * The balance as a fuel gauge.
 *
 * A single percentage tells you a number you already have three lines above.
 * Whole lit cells tell you the shape of it at a glance — which is the question
 * a balance is actually asked, and it is legible before the digits are read.
 */
function Gauge({
  lit,
  spent,
  granted,
  current,
}: {
  lit: number;
  spent: number;
  granted: number;
  current: number;
}) {
  if (granted <= 0) return null;

  return (
    <div>
      <div
        role="progressbar"
        aria-label="Credits remaining"
        aria-valuemin={0}
        aria-valuemax={granted}
        aria-valuenow={current}
        aria-valuetext={`${current.toLocaleString("en-US")} of ${granted.toLocaleString("en-US")} credits remaining`}
        className="flex gap-[3px]"
      >
        {Array.from({ length: GAUGE_CELLS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 flex-1 rounded-[2px]",
              i < lit ? "bg-[var(--ember)]" : "bg-surface-sunken",
            )}
          />
        ))}
      </div>
      <p className="mt-2 flex justify-between font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
        <span>{spent.toLocaleString("en-US")} used</span>
        <span>{granted.toLocaleString("en-US")} granted</span>
      </p>
    </div>
  );
}
