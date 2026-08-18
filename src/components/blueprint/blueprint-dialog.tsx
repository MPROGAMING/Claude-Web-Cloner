"use client";

import { useState } from "react";
import { Loader2, Map as MapIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuestionFlow } from "@/components/blueprint/question-flow";
import { BlueprintView } from "@/components/blueprint/blueprint-view";
import type {
  Blueprint,
  BlueprintIssue,
  BlueprintQuestion,
  QuestionAnswer,
} from "@/lib/blueprint/schema";

/**
 * Plan a game: idea → questions → blueprint → approval.
 *
 * The whole flow lives in one dialog because it is one decision. Sending the
 * creator to three pages to answer six questions turns a two-minute setup into
 * a process, and a process is something people postpone.
 *
 * Every stage shown here is backed by a real request. The "planning" state is
 * displayed while a generation is genuinely in flight, never as decoration.
 */

type Stage = "idea" | "questions" | "blueprint";

export function BlueprintDialog({
  projectId,
  projectName,
  seedIdea,
  existing,
  trigger,
}: {
  projectId: string;
  projectName: string;
  seedIdea?: string;
  existing?: {
    id: string;
    blueprint: Blueprint;
    issues: BlueprintIssue[];
    approved: boolean;
  };
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>(existing ? "blueprint" : "idea");
  const [idea, setIdea] = useState(seedIdea ?? "");
  const [pending, setPending] = useState(false);

  const [blueprintId, setBlueprintId] = useState(existing?.id ?? "");
  const [questions, setQuestions] = useState<BlueprintQuestion[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(existing?.blueprint ?? null);
  const [issues, setIssues] = useState<BlueprintIssue[]>(existing?.issues ?? []);
  const [approved, setApproved] = useState(existing?.approved ?? false);

  async function askQuestions() {
    if (idea.trim().length < 8 || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "questions", projectId, idea: idea.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not prepare the questions.");

      setBlueprintId(body.blueprintId);
      setQuestions(body.questions);
      setStage("questions");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the questions.");
    } finally {
      setPending(false);
    }
  }

  async function buildPlan(answers: QuestionAnswer[]) {
    setPending(true);
    try {
      const response = await fetch("/api/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "blueprint", blueprintId, answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not build the plan.");

      setBlueprint(body.blueprint);
      setIssues(body.issues ?? []);
      setStage("blueprint");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the plan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}

      <DialogContent className="max-h-[88vh] w-[min(44rem,94vw)] overflow-y-auto">
        <DialogTitle className="sr-only">Plan {projectName}</DialogTitle>
        <DialogDescription className="sr-only">
          Answer a few questions and review the plan before anything is built.
        </DialogDescription>

        {stage === "idea" && (
          <div className="animate-rise">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              <MapIcon className="size-3 text-[var(--ember)]" />
              Game plan
            </span>

            <h2 className="mt-3 text-[1.375rem] font-semibold leading-snug">
              What are we building?
            </h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              Describe the game in a sentence or two. Blockwright will ask a few
              questions, then write a plan for you to approve before any code exists.
            </p>

            <textarea
              rows={4}
              autoFocus
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void askQuestions();
              }}
              placeholder="A round-based zombie survival where players hold out in a barricaded house, earn cash for kills, and buy weapons between waves."
              className="mt-4 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[0.9375rem] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--ember)]/55 focus:shadow-[0_0_0_3px_var(--ember-soft)]"
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={askQuestions}
                disabled={idea.trim().length < 8 || pending}
                className="flex h-10 items-center gap-2 rounded-lg bg-foreground px-5 text-[0.875rem] font-medium text-background transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-ember"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Reading your idea
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Continue
                  </>
                )}
              </button>
              <span className="text-[0.75rem] text-muted-foreground">
                Four to six questions, then a plan.
              </span>
            </div>
          </div>
        )}

        {stage === "questions" && (
          <QuestionFlow
            questions={questions}
            pending={pending}
            onBack={() => setStage("idea")}
            onComplete={buildPlan}
          />
        )}

        {stage === "blueprint" && blueprint && (
          <BlueprintView
            blueprintId={blueprintId}
            blueprint={blueprint}
            issues={issues}
            approved={approved}
            onApproved={() => setApproved(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
