"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import type { BlueprintQuestion, QuestionAnswer } from "@/lib/blueprint/schema";
import { cn } from "@/lib/utils";

/**
 * The setup questions.
 *
 * One question per screen rather than a wall of form fields. A creator on a
 * phone answering "what kind of game" should see one decision, understand what
 * it changes, and move on — a six-field form is where people leave.
 *
 * Every question carries the consequence of each option, because the point is
 * not to collect preferences, it is to let someone make an informed choice about
 * a thing that is about to be built for them.
 */

export function QuestionFlow({
  questions,
  onComplete,
  onBack,
  pending,
}: {
  questions: BlueprintQuestion[];
  onComplete: (answers: QuestionAnswer[]) => void;
  onBack?: () => void;
  pending?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    // Suggested answers are pre-selected so the whole flow can be accepted
    // without reading every option, which is what most people want.
    Object.fromEntries(
      questions.filter((q) => q.suggested).map((q) => [q.id, q.suggested as string]),
    ),
  );
  const textRef = useRef<HTMLTextAreaElement>(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const current = answers[question?.id ?? ""] ?? "";
  const canAdvance = question?.kind === "text" ? true : current.length > 0;

  useEffect(() => {
    if (question?.kind === "text") textRef.current?.focus();
  }, [question]);

  const answerList = useMemo(
    () =>
      questions
        .map((q) => ({ id: q.id, answer: answers[q.id] ?? "" }))
        .filter((a) => a.answer.length > 0),
    [questions, answers],
  );

  const setAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const toggleMulti = (label: string) => {
    const selected = current ? current.split(" · ") : [];
    const next = selected.includes(label)
      ? selected.filter((s) => s !== label)
      : [...selected, label];
    setAnswer(next.join(" · "));
  };

  const advance = () => {
    if (!canAdvance || pending) return;
    if (isLast) onComplete(answerList);
    else setIndex((i) => i + 1);
  };

  const retreat = () => {
    if (index === 0) onBack?.();
    else setIndex((i) => i - 1);
  };

  if (!question) return null;

  return (
    <div className="flex min-h-0 flex-col">
      {/* Progress: real position in a known-length flow, not a fake loading bar. */}
      <div className="flex items-center gap-1.5 px-1">
        {questions.map((q, i) => (
          <span
            key={q.id}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors duration-300",
              i < index && "bg-[var(--ember)]",
              i === index && "bg-[var(--ember)]/60",
              i > index && "bg-border",
            )}
          />
        ))}
      </div>

      <p className="mt-4 px-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
        Question {index + 1} of {questions.length}
      </p>

      {/* key on the question id restarts the entrance animation per screen */}
      <div key={question.id} className="animate-rise px-1">
        <h2 className="mt-2 text-[1.375rem] font-semibold leading-snug sm:text-[1.5rem]">
          {question.question}
        </h2>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          {question.why}
        </p>

        <div className="mt-5 space-y-2">
          {question.kind === "text" ? (
            <textarea
              ref={textRef}
              rows={3}
              value={current}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) advance();
              }}
              placeholder="Type your answer, or leave it blank to let Blockwright decide."
              className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[0.9375rem] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--ember)]/55 focus:shadow-[0_0_0_3px_var(--ember-soft)]"
            />
          ) : (
            question.options.map((option, optionIndex) => {
              const selected =
                question.kind === "multi"
                  ? current.split(" · ").includes(option.label)
                  : current === option.label;

              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() =>
                    question.kind === "multi" ? toggleMulti(option.label) : setAnswer(option.label)
                  }
                  style={{ animationDelay: `${optionIndex * 45}ms` }}
                  className={cn(
                    "animate-rise flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,transform] duration-150 focus-ember",
                    "hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0",
                    selected
                      ? "border-[var(--ember)]/60 bg-[var(--ember)]/8"
                      : "border-border bg-surface hover:border-foreground/25",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      selected ? "border-[var(--ember)] bg-[var(--ember)]" : "border-border",
                    )}
                  >
                    {selected && <Check className="size-2.5 text-background" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-medium leading-snug">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-muted-foreground">
                      {option.detail}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 px-1">
        <button
          type="button"
          onClick={retreat}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-ember"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>

        <button
          type="button"
          onClick={advance}
          disabled={!canAdvance || pending}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-foreground px-5 text-[0.875rem] font-medium text-background transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-ember"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Planning the game
            </>
          ) : isLast ? (
            <>
              <Sparkles className="size-4" />
              Build the plan
            </>
          ) : (
            <>
              Next
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
