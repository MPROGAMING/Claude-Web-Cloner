import type { Metadata } from "next";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Coins } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Progress } from "@/components/ui/progress";
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
  const usedPercent = granted > 0 ? Math.min(100, Math.round((spent / granted) * 100)) : 0;
  const low = current < 500;

  return (
    <>
      <Topbar balance={current} email={user.email ?? ""} displayName={profile?.display_name} />

      <PageBody>
        <PageHeader
          title="Credits & usage"
          description="Credits are metered from the token usage each provider reports for your requests."
        />

        {low && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/8 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
            <div>
              <p className="text-sm font-medium text-[var(--warning)]">Running low on credits</p>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                Generations stop once your balance is too low to cover a request. Switching to a
                faster model uses fewer credits per message.
              </p>
            </div>
          </div>
        )}

        {/* Balance */}
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="label-meta">Current balance</p>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
              {current.toLocaleString("en-US")}
              <span className="ml-2 text-base font-normal text-muted-foreground">credits</span>
            </p>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-[0.75rem] text-muted-foreground">
                <span>{spent.toLocaleString("en-US")} used</span>
                <span>{granted.toLocaleString("en-US")} granted</span>
              </div>
              <Progress value={usedPercent} className="h-1.5" />
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-hairline pt-5">
              <div>
                <dt className="label-meta">Requests</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {usage.totalRequests}
                </dd>
              </div>
              <div>
                <dt className="label-meta">Spent (recent)</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {formatCredits(usage.totalCredits)}
                </dd>
              </div>
              <div>
                <dt className="label-meta">Plan</dt>
                <dd className="mt-1 font-display text-lg font-semibold capitalize">
                  {profile?.plan ?? "free"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="label-meta">Top up</p>
            <ul className="mt-4 space-y-3">
              {CREDIT_PACKS.map((pack) => (
                <li
                  key={pack.id}
                  className="flex items-center justify-between gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] font-medium">{pack.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCredits(pack.credits)} credits
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums">${pack.priceUsd}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Checkout is not enabled on this deployment. The billing interfaces are in place; wiring
              a payment provider is the remaining step.
            </p>
          </div>
        </div>

        {/* Breakdown */}
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
              <div className="overflow-hidden rounded-xl border border-border">
                {usage.byModel.map((row) => {
                  const model = getModelOrDefault(row.modelId);
                  const share =
                    usage.totalCredits > 0 ? (row.credits / usage.totalCredits) * 100 : 0;
                  return (
                    <div
                      key={row.modelId}
                      className="relative flex items-center justify-between gap-4 border-b border-hairline px-4 py-3.5 last:border-0"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 bg-[var(--ember)]/8"
                        style={{ width: `${share}%` }}
                      />
                      <div className="relative min-w-0">
                        <p className="truncate text-[0.8125rem] font-medium">{model.name}</p>
                        <p className="font-mono text-[0.625rem] text-muted-foreground">
                          {row.requests} request{row.requests === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="relative shrink-0 font-mono text-[0.8125rem] tabular-nums">
                        {formatCredits(row.credits)}
                      </span>
                    </div>
                  );
                })}
              </div>
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[42rem] text-sm">
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
                    {usage.requests.slice(0, 50).map((request) => (
                      <tr key={request.id} className="border-b border-hairline last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
                          {formatDateTime(request.created_at)}
                        </td>
                        <td className="px-4 py-2.5 text-[0.8125rem]">
                          {getModelOrDefault(request.model_id).name}
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ledger" className="mt-6">
            {transactions.length === 0 ? (
              <EmptyState
                icon={Coins}
                title="No transactions"
                description="Grants and usage both appear in this ledger."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                {transactions.map((tx) => {
                  const credit = tx.amount > 0;
                  return (
                    <div
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
                        <p className="font-mono text-[0.625rem] text-muted-foreground">
                          {formatDateTime(tx.created_at)}
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
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
