"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { ModelSelector } from "@/components/workspace/model-selector";
import { estimateCredits } from "@/lib/credits/pricing";
import { getModelOrDefault, type ClientModel } from "@/lib/ai/registry";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Prompt composer.
 *
 * Enter sends, Shift+Enter inserts a newline. The textarea auto-grows to a
 * ceiling and then scrolls, so a long prompt never eats the conversation.
 */
export function ChatComposer({
  models,
  modelId,
  onModelChange,
  onSubmit,
  onStop,
  status,
  seededPrompt,
  disabledReason,
  contextFileCount,
  catalogFetchedAt,
}: {
  models: ClientModel[];
  modelId: string;
  onModelChange: (modelId: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  status: "ready" | "submitted" | "streaming" | "error";
  seededPrompt?: string;
  disabledReason?: string;
  contextFileCount: number;
  catalogFetchedAt?: string;
}) {
  // A template's prompt is the composer's *initial* value, not something an
  // effect pushes in later — that keeps the first paint correct and means the
  // user's own typing is never clobbered.
  const [value, setValue] = useState(seededPrompt ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!seededPrompt) return;
    const element = textareaRef.current;
    if (!element) return;
    element.focus();
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [seededPrompt]);

  const busy = status === "submitted" || status === "streaming";
  const canSend = value.trim().length > 0 && !busy && !disabledReason;

  const model = getModelOrDefault(modelId);
  const estimate = value.trim() ? estimateCredits(model, value.length, 4000) : 0;

  const send = () => {
    if (!canSend) return;
    onSubmit(value.trim());
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  };

  return (
    <div className="border-t border-border bg-background/95 px-3 pb-3 pt-2.5 backdrop-blur md:px-4 md:pb-4">
      {disabledReason && (
        <p
          role="status"
          className="mx-auto mb-2 max-w-3xl rounded-lg border border-[var(--warning)]/35 bg-[var(--warning)]/8 px-3 py-2 text-[0.75rem] text-[var(--warning)]"
        >
          {disabledReason}
        </p>
      )}

      <div
        className={cn(
          "mx-auto max-w-3xl rounded-xl border bg-surface transition-colors",
          "border-border focus-within:border-[var(--ember)]/50 focus-within:shadow-[0_0_0_3px_var(--ember-soft)]",
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Describe what you want to build
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={Boolean(disabledReason)}
          placeholder="Describe a mechanic, or ask for a change…"
          onChange={(event) => {
            setValue(event.target.value);
            grow(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          className="max-h-[13.75rem] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[0.875rem] leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />

        <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
          <ModelSelector
            models={models}
            value={modelId}
            onChange={onModelChange}
            compact
            align="start"
            disabled={busy}
            catalogFetchedAt={catalogFetchedAt}
          />

          <Tooltip>
            <TooltipTrigger
              render={
                <span className="hidden shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-1 font-mono text-[0.625rem] text-muted-foreground sm:inline-flex">
                  {contextFileCount} file{contextFileCount === 1 ? "" : "s"}
                </span>
              }
            />
            <TooltipContent>
              The project&apos;s file list is included with every message so the AI knows what
              already exists.
            </TooltipContent>
          </Tooltip>

          {estimate > 0 && (
            <span className="hidden font-mono text-[0.625rem] text-muted-foreground/70 md:inline">
              ~{estimate} credits
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    disabled
                    aria-label="Attach a file (coming soon)"
                    className="rounded-md p-1.5 text-muted-foreground/50 disabled:cursor-not-allowed"
                  >
                    <Paperclip className="size-4" />
                  </button>
                }
              />
              <TooltipContent>Attachments are not enabled yet</TooltipContent>
            </Tooltip>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface transition-colors hover:bg-accent focus-ember"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-all focus-ember",
                  canSend
                    ? "bg-[var(--ember)] text-[oklch(0.16_0.008_75)] hover:brightness-108"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-2 max-w-3xl text-center font-mono text-[0.625rem] text-muted-foreground/60">
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}
