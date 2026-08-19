"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import { playSound } from "@/lib/sound";
import { ModelSelector } from "@/components/workspace/model-selector";
import { PART, PART_ICON, PART_INK } from "@/components/workspace/material";
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
 * The loudest, most obviously pressable object on the surface, and never
 * empty on arrival. Physically it is a tray bolted to the plate: a recessed
 * well for the text, and a moulded ember part that travels when you press it.
 * That is deliberate — the competitor's single most-criticised control is a
 * grey Generate button on a grey slab that reads as disabled.
 *
 * The text itself is owned by the workspace, because a mechanic chip and the
 * seeded project idea both write it from outside. Enter sends, Shift+Enter
 * inserts a newline. The textarea auto-grows to a ceiling and then scrolls, so
 * a long prompt never eats the conversation.
 */
export function ChatComposer({
  models,
  modelId,
  onModelChange,
  onSubmit,
  onStop,
  status,
  value,
  onValueChange,
  fillToken,
  sendLabel,
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
  value: string;
  onValueChange: (value: string) => void;
  /** Bumped whenever something other than typing writes `value`. */
  fillToken: number;
  /** "Build it" on an empty conversation, "Send" once it is under way. */
  sendLabel: string;
  disabledReason?: string;
  contextFileCount: number;
  catalogFetchedAt?: string;
}) {
  const [attachments, setAttachments] = useState<{ name: string; content: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fires on mount for the seeded prompt, and again each time a chip fills the
  // box. Keyed on the token rather than on `value` so it never fights typing.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
    if (!element.value) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [fillToken]);

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
    onValueChange("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  };

  return (
    <div className="stud-plate shrink-0 bg-[var(--plate)] p-2 md:p-2.5">
      <div className="mx-auto max-w-3xl">
        {disabledReason && (
          <p
            role="status"
            className="mount mb-2 rounded-lg px-3 py-2 text-[0.75rem] text-[var(--warning)]"
          >
            {disabledReason}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="mount flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem]"
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
        )}

        {/* The tray. Mounted onto the plate, so the studs stop at its edge. */}
        <div className="mount rounded-2xl p-2">
          <label htmlFor="composer" className="sr-only">
            Describe what you want to build
          </label>
          {/* The well the text sits in — the same relationship Roblox's Inlet
              surface has to Studs, one step deeper than the tray. */}
          <div className="rounded-xl bg-surface-sunken px-1 py-1">
            <textarea
              id="composer"
              ref={textareaRef}
              rows={1}
              value={value}
              disabled={Boolean(disabledReason)}
              placeholder="Describe a mechanic, or ask for a change…"
              onChange={(event) => {
                onValueChange(event.target.value);
                grow(event.target);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              className="max-h-[13.75rem] w-full resize-none bg-transparent px-2.5 py-2 text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
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
                  <span className="hidden shrink-0 items-center gap-1 rounded-md bg-surface-sunken px-1.5 py-1 font-mono text-[0.625rem] text-muted-foreground sm:inline-flex">
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
              <span className="hidden font-mono text-[0.625rem] text-muted-foreground md:inline">
                ~{estimate} credits
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
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
                      className={cn(PART_ICON, "disabled:opacity-50 focus-ember")}
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
                  className={cn(PART, "tap-target flex h-9 items-center gap-1.5 px-3 focus-ember")}
                >
                  <Square className="size-3 fill-current" />
                  <span className="text-[0.8125rem] font-semibold">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  className={cn(
                    "brick tap-target flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[0.875rem] font-semibold focus-ember",
                    canSend
                      ? `[--lift:5px] ${PART_INK}`
                      : "[--brick-face:var(--plate-raised)] [--lift:3px] text-muted-foreground",
                  )}
                >
                  {sendLabel}
                  <ArrowUp className="size-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 text-center font-mono text-[0.625rem] text-muted-foreground">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
