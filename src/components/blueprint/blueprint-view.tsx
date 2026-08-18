"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  SECTION_LABELS,
  orderSections,
  type Blueprint,
  type BlueprintIssue,
  type SectionKey,
} from "@/lib/blueprint/schema";
import { cn } from "@/lib/utils";

/**
 * The plan the creator reviews before anything is built.
 *
 * Sections are independently regenerable because approval is per-decision in
 * practice: someone who likes the combat but not the economy should be able to
 * fix the economy without losing the combat. Regenerating everything to change
 * one thing is how a review tool becomes a slot machine.
 */

const SCOPE_COPY: Record<Blueprint["scope"], { label: string; tone: string }> = {
  small: { label: "Small build", tone: "text-[var(--success)]" },
  medium: { label: "Medium build", tone: "text-[var(--signal)]" },
  large: { label: "Large build", tone: "text-[var(--warning)]" },
};

export function BlueprintView({
  blueprintId,
  blueprint: initial,
  issues: initialIssues,
  approved,
  onApproved,
}: {
  blueprintId: string;
  blueprint: Blueprint;
  issues: BlueprintIssue[];
  approved: boolean;
  onApproved?: () => void;
}) {
  const [blueprint, setBlueprint] = useState(initial);
  const [issues, setIssues] = useState(initialIssues);
  const [regenerating, setRegenerating] = useState<SectionKey | null>(null);
  const [approving, setApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(approved);
  const [open, setOpen] = useState<Set<SectionKey>>(new Set(["concept", "core_loop"]));

  const blocking = issues.filter((issue) => issue.severity === "error");
  const scope = SCOPE_COPY[blueprint.scope];

  const toggle = (key: SectionKey) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  async function regenerate(key: SectionKey) {
    setRegenerating(key);
    try {
      const response = await fetch(`/api/blueprint/${blueprintId}/section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not rewrite that section.");

      setBlueprint((prev) => ({
        ...prev,
        sections: prev.sections.some((s) => s.key === key)
          ? prev.sections.map((s) => (s.key === key ? body.section : s))
          : [...prev.sections, body.section],
      }));
      setIssues(body.issues ?? []);
      setOpen((prev) => new Set(prev).add(key));
      toast.success(`Rewrote ${SECTION_LABELS[key]}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rewrite that section.");
    } finally {
      setRegenerating(null);
    }
  }

  async function approve() {
    setApproving(true);
    try {
      const response = await fetch(`/api/blueprint/${blueprintId}/approve`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not approve that plan.");

      setIsApproved(true);
      toast.success("Plan approved. Blockwright will follow it from here.");
      onApproved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve that plan.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-mono text-[0.6875rem] uppercase tracking-[0.12em]", scope.tone)}>
            {scope.label}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
            · {blueprint.genre} · ~{blueprint.estimated_scripts} scripts
          </span>
        </div>

        <h2 className="mt-2 text-[1.5rem] font-semibold leading-tight">{blueprint.title}</h2>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
          {blueprint.pitch}
        </p>
      </div>

      {blocking.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/8 px-4 py-3">
          {blocking.map((issue) => (
            <p key={issue.rule + issue.message} className="flex items-start gap-2 text-[0.8125rem] text-[var(--danger)]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {issue.message}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2 overflow-y-auto pr-1">
        {orderSections(blueprint.sections).map((section, index) => {
          const expanded = open.has(section.key);
          const busy = regenerating === section.key;

          return (
            <div
              key={section.key}
              style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
              className="animate-rise overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-ember"
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                      expanded && "rotate-180",
                    )}
                  />
                  <span className="truncate text-[0.9375rem] font-medium">
                    {SECTION_LABELS[section.key]}
                  </span>
                  {!expanded && (
                    <span className="hidden truncate text-[0.8125rem] text-muted-foreground sm:inline">
                      — {section.summary}
                    </span>
                  )}
                </button>

                {!isApproved && (
                  <button
                    type="button"
                    onClick={() => regenerate(section.key)}
                    disabled={busy || approving}
                    aria-label={`Rewrite ${SECTION_LABELS[section.key]}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 focus-ember"
                  >
                    <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
                  </button>
                )}
              </div>

              {expanded && (
                <div className="border-t border-border/60 px-4 py-3">
                  <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
                    {section.summary}
                  </p>

                  {section.decisions.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {section.decisions.map((decision) => (
                        <li key={decision} className="flex items-start gap-2 text-[0.875rem] leading-relaxed">
                          <span className="mt-[0.4rem] size-1 shrink-0 rounded-full bg-[var(--ember)]" />
                          {decision}
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.roblox.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {section.roblox.map((api) => (
                        <span
                          key={api}
                          className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground"
                        >
                          {api}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {blueprint.out_of_scope.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border px-4 py-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
            Not in this version
          </p>
          <ul className="mt-2 space-y-1">
            {blueprint.out_of_scope.map((item) => (
              <li key={item} className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[var(--signal)]/30 bg-[var(--signal)]/6 px-4 py-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--signal)]">
          First milestone
        </p>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed">{blueprint.first_milestone}</p>
      </div>

      <div className="mt-5 flex items-center gap-3 px-1">
        {isApproved ? (
          <p className="flex items-center gap-2 text-[0.8125rem] text-[var(--success)]">
            <ShieldCheck className="size-4" />
            Approved — Blockwright follows this plan from here.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={approving || blocking.length > 0 || regenerating !== null}
              className="flex h-10 items-center gap-2 rounded-lg bg-foreground px-5 text-[0.875rem] font-medium text-background transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-ember"
            >
              {approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Approve this plan
            </button>
            <span className="text-[0.75rem] leading-snug text-muted-foreground">
              {blocking.length > 0
                ? "Fix the problems above first."
                : "Nothing is built until you approve. You can still rewrite any section."}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
