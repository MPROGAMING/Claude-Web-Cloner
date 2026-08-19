"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Brain, History, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { forgetProjectMemory, rememberProjectFact } from "@/lib/actions/projects";
import {
  MAX_CONTENT_CHARS,
  MEMORY_KINDS,
  kindLabel,
  type MemoryFact,
  type MemoryKind,
} from "@/lib/memory/facts";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What the agent remembers about this project, and the controls to correct it.
 *
 * The delete button is the point of this panel. Memory the creator cannot
 * inspect is a system quietly forming opinions about their game; memory they
 * cannot correct is worse, because the only way out is to argue with it every
 * turn. So every fact is listed with what produced it and one click removes it.
 *
 * Superseded facts are shown separately rather than hidden. A correction the
 * creator cannot see reads as the agent changing its mind at random.
 */

interface MemoryResponse {
  facts: MemoryFact[];
  superseded: MemoryFact[];
  summary: string;
}

const SOURCE_TONE: Record<string, string> = {
  user: "text-[var(--ember)]",
  agent: "text-muted-foreground",
  blueprint: "text-[var(--signal)]",
};

export function MemoryPanel({
  projectId,
  /** Bumped by the workspace after each turn so newly recorded facts appear. */
  revision = 0,
}: {
  projectId: string;
  revision?: number;
}) {
  const [state, setState] = useState<MemoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<MemoryKind>("decision");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/memory`, { cache: "no-store" });
      if (!response.ok) return;
      setState((await response.json()) as MemoryResponse);
    } catch {
      // A blip should not blank a panel the user is reading.
    }
  }, [projectId]);

  useEffect(() => {
    // Read from a task rather than the effect body, the same way the Studio
    // panel does: the first paint should not wait on a fetch resolving, and a
    // synchronous setState inside an effect is a React Compiler error here.
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [refresh, revision]);

  // Grouped for reading, not for storage — a creator scans for "what did it
  // decide about naming", which is a kind, not a date.
  const groups = useMemo(() => {
    const facts = state?.facts ?? [];
    return MEMORY_KINDS.map((kind) => ({
      kind,
      facts: facts.filter((fact) => fact.kind === kind),
    })).filter((group) => group.facts.length > 0);
  }, [state]);

  const forget = (fact: MemoryFact) =>
    startTransition(async () => {
      const result = await forgetProjectMemory(projectId, fact.id);
      if (result.ok) {
        toast.success("Forgotten");
        await refresh();
      } else {
        toast.error(result.error ?? "Could not delete that memory.");
      }
    });

  const add = () =>
    startTransition(async () => {
      const content = draft.trim();
      if (!content) return;
      const result = await rememberProjectFact(projectId, { kind: draftKind, content });
      if (result.ok) {
        setDraft("");
        setAdding(false);
        await refresh();
      } else {
        toast.error(result.error ?? "Could not save that.");
      }
    });

  const empty = state !== null && state.facts.length === 0;

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <Brain className="size-3.5 shrink-0 text-[var(--ember)]" />
        <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
          {state?.summary ?? "Loading memory…"}
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label={adding ? "Cancel adding a memory" : "Add a memory"}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-ember"
        >
          {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
        </button>
      </div>

      {adding && (
        <div className="mount rounded-lg p-2.5 [--surface:var(--plate-raised)]">
          <label htmlFor="memory-content" className="label-meta">
            Tell it something durable
          </label>
          <textarea
            id="memory-content"
            value={draft}
            maxLength={MAX_CONTENT_CHARS}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="The currency is called Sparks."
            className="mt-1.5 w-full resize-none rounded-md bg-surface-sunken px-2 py-1.5 text-[0.8125rem] placeholder:text-muted-foreground focus-ember"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <label htmlFor="memory-kind" className="sr-only">
              Memory kind
            </label>
            <select
              id="memory-kind"
              value={draftKind}
              onChange={(event) => setDraftKind(event.target.value as MemoryKind)}
              className="rounded-md bg-surface-sunken px-2 py-1 text-[0.75rem] focus-ember"
            >
              {MEMORY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabel(kind)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={add}
              disabled={pending || draft.trim().length < 3}
              className={cn("brick ml-auto h-8 font-semibold", "text-[var(--ember-ink)]")}
            >
              {pending ? <Loader2 className="size-3 animate-spin" /> : null}
              Remember
            </Button>
          </div>
        </div>
      )}

      {empty && !adding && (
        <p className="rounded-lg bg-surface-sunken px-2.5 py-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Nothing remembered yet. As you settle decisions — what the currency is called, how long
          respawns take, what you are not building — they are recorded here and carried into every
          later conversation.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.kind}>
          <p className="label-meta mb-1.5 px-0.5">{kindLabel(group.kind)}</p>
          <ul className="space-y-1">
            {group.facts.map((fact) => (
              <li
                key={fact.id}
                className="group rounded-lg bg-surface-sunken px-2.5 py-2"
              >
                <p className="text-[0.8125rem] leading-snug">{fact.content}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "font-mono text-[0.5625rem] uppercase tracking-wider",
                      SOURCE_TONE[fact.source] ?? "text-muted-foreground",
                    )}
                  >
                    {fact.source}
                  </span>
                  <span className="font-mono text-[0.5625rem] text-muted-foreground">
                    {relativeTime(fact.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => forget(fact)}
                    disabled={pending}
                    aria-label={`Forget: ${fact.content}`}
                    className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-[var(--danger)] disabled:opacity-40 focus-ember"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {state && state.superseded.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="flex w-full items-center gap-1.5 rounded-md px-0.5 py-1 text-muted-foreground transition-colors hover:text-foreground focus-ember"
          >
            <History className="size-3" />
            <span className="label-meta">Corrected ({state.superseded.length})</span>
          </button>

          {showHistory && (
            <ul className="mt-1 space-y-1">
              {state.superseded.map((fact) => (
                <li
                  key={fact.id}
                  className="rounded-md border border-dashed border-border bg-surface-sunken px-2.5 py-1.5"
                >
                  <p className="text-[0.75rem] leading-snug text-muted-foreground line-through">
                    {fact.content}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="font-mono text-[0.5625rem] text-muted-foreground">
                      corrected {fact.supersededAt ? relativeTime(fact.supersededAt) : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => forget(fact)}
                      disabled={pending}
                      aria-label={`Delete corrected memory: ${fact.content}`}
                      className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-[var(--danger)] disabled:opacity-40 focus-ember"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
