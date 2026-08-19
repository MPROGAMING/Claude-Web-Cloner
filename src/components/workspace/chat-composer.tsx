"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import { playSound } from "@/lib/sound";
import { ModelSelector } from "@/components/workspace/model-selector";
import { estimateCredits } from "@/lib/credits/pricing";
import { getModelOrDefault, type ClientModel } from "@/lib/ai/registry";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Text-ish files only: the content is inlined, so anything binary is useless. */
const ATTACHABLE = /\.(luau|lua|txt|md|json)$/i;
const MAX_ATTACHMENT_BYTES = 128_000;

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
  const [attachments, setAttachments] = useState<{ name: string; content: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!seededPrompt) return;
    const element = textareaRef.current;
    if (!element) return;
    element.focus();
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [seededPrompt]);

  const busy = status === "submitted" || status === "streaming";
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !busy && !disabledReason;

  const model = getModelOrDefault(modelId);
  const estimate = value.trim() ? estimateCredits(model, value.length, 4000) : 0;

  /**
   * Attachments are read as text and inlined into the message rather than
   * uploaded. "Fix this script" needs the source in the model's context, not a
   * file in a bucket, and inlining keeps the whole feature free of storage,
   * lifecycle and retention questions it does not need.
   */
  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: { name: string; content: string }[] = [];

    for (const file of Array.from(files).slice(0, 4)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024)}KB.`);
        continue;
      }
      if (!ATTACHABLE.test(file.name)) {
        toast.error(`${file.name} is not a script or text file.`);
        continue;
      }
      accepted.push({ name: file.name, content: await file.text() });
    }

    if (accepted.length) setAttachments((prev) => [...prev, ...accepted].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = () => {
    if (!canSend) return;

    // The file's own name and extension are kept so the model can tell a
    // LocalScript from a server Script without being told.
    const body = attachments.length
      ? [
          value.trim(),
          "",
          ...attachments.map(
            (file) => `Attached — ${file.name}:\n\n\`\`\`luau\n${file.content}\n\`\`\``,
          ),
        ].join("\n")
      : value.trim();

    playSound("send");
    onSubmit(body);
    setValue("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  };

  const attachmentChips = attachments.length > 0 && (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((file, index) => (
        <span
          key={`${file.name}-${index}`}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[0.7rem]"
        >
          <Paperclip className="size-3 text-muted-foreground" />
          <span className="max-w-[14rem] truncate font-mono">{file.name}</span>
          <span className="text-muted-foreground">
            {(file.content.length / 1024).toFixed(1)}KB
          </span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
            className="rounded text-muted-foreground transition-colors hover:text-foreground focus-ember"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );

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

      <div className="mx-auto max-w-3xl">{attachmentChips}</div>

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
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".luau,.lua,.txt,.md,.json"
              // Visually hidden but still in the accessibility tree, so it needs
              // its own name — the button that opens it is a separate element.
              aria-label="Choose scripts to attach"
              className="sr-only"
              onChange={(event) => void attachFiles(event.target.files)}
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach a script"
                    className="tap-target flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-ember"
                  >
                    <Paperclip className="size-4" />
                  </button>
                }
              />
              <TooltipContent>Attach a script to include its source</TooltipContent>
            </Tooltip>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="tap-target flex size-8 items-center justify-center rounded-lg border border-border bg-surface transition-colors hover:bg-accent focus-ember"
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
                  "tap-target flex size-8 items-center justify-center rounded-lg transition-all focus-ember",
                  canSend
                    ? "bg-[var(--ember)] text-[var(--ember-ink)] hover:brightness-108"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-2 max-w-3xl text-center font-mono text-[0.625rem] text-muted-foreground">
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}
