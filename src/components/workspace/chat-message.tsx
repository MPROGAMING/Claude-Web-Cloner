"use client";

import { memo, useState } from "react";
import {
  AlertTriangle,
  Check,
  BookOpen,
  ChevronRight,
  Copy,
  FilePlus2,
  FilePen,
  FileX2,
  ListChecks,
  Loader2,
  Plug2,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Markdown } from "@/components/workspace/markdown";
import { getModelOrDefault } from "@/lib/ai/registry";
import type { BlockwrightUIMessage, CitationData } from "@/lib/ai/types";
import { ChangesetCard } from "@/components/workspace/changeset-card";
import { cn } from "@/lib/utils";

/**
 * A single conversation turn.
 *
 * Tool calls render as compact, expandable rows rather than raw JSON — the
 * default view is "what happened", and the technical detail is one click away
 * for when something goes wrong.
 */

const TOOL_META: Record<
  string,
  { label: (input: Record<string, unknown>) => string; icon: typeof Wrench }
> = {
  plan_build: { label: () => "Planning the build", icon: ListChecks },
  list_files: { label: () => "Reading the project", icon: Wrench },
  read_file: {
    label: (input) => `Reading ${String(input?.path ?? "a file")}`,
    icon: Wrench,
  },
  create_file: {
    label: (input) => `Creating ${String(input?.path ?? "a file")}`,
    icon: FilePlus2,
  },
  update_file: {
    label: (input) => `Updating ${String(input?.path ?? "a file")}`,
    icon: FilePen,
  },
  delete_file: {
    label: (input) => `Deleting ${String(input?.path ?? "a file")}`,
    icon: FileX2,
  },
  validate_scripts: { label: () => "Validating scripts", icon: ShieldCheck },
  studio_status: { label: () => "Checking Roblox Studio", icon: Plug2 },
  search_roblox_knowledge: {
    label: (input) => `Searching Roblox docs: ${String(input?.query ?? "").slice(0, 42)}`,
    icon: BookOpen,
  },
  request_studio_action: {
    label: (input) => `Sending "${String(input?.action ?? "action")}" to Studio`,
    icon: Plug2,
  },
};

function ToolCallRow({
  name,
  state,
  input,
  output,
  errorText,
}: {
  name: string;
  state: string;
  input: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[name] ?? { label: () => name.replace(/_/g, " "), icon: Wrench };
  const Icon = meta.icon;

  const running = state === "input-streaming" || state === "input-available";
  const failed =
    state === "output-error" ||
    Boolean(errorText) ||
    (typeof output === "object" && output !== null && (output as { ok?: boolean }).ok === false);

  const detail = errorText ?? (output ? JSON.stringify(output, null, 2) : null);

  return (
    <div className="rounded-lg border border-border bg-surface-sunken/60">
      <button
        type="button"
        onClick={() => detail && setOpen((v) => !v)}
        aria-expanded={detail ? open : undefined}
        className={cn(
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[0.75rem] transition-colors",
          detail && "hover:bg-accent/50",
        )}
      >
        {running ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-[var(--ember)]" />
        ) : failed ? (
          <AlertTriangle className="size-3 shrink-0 text-[var(--danger)]" />
        ) : (
          <Icon className="size-3 shrink-0 text-[var(--success)]" strokeWidth={2} />
        )}

        <span className={cn("truncate", failed ? "text-[var(--danger)]" : "text-muted-foreground")}>
          {meta.label(input)}
        </span>

        {detail && (
          <ChevronRight
            className={cn(
              "ml-auto size-3 shrink-0 text-muted-foreground/60 transition-transform",
              open && "rotate-90",
            )}
          />
        )}
      </button>

      {open && detail && (
        <pre className="max-h-56 overflow-auto border-t border-hairline px-2.5 py-2 font-mono text-[0.625rem] leading-relaxed text-muted-foreground">
          {detail}
        </pre>
      )}
    </div>
  );
}

/** Sources the Roblox Brain contributed to this answer. */
function CitationBlock({ citations }: { citations: CitationData["citations"] }) {
  const [open, setOpen] = useState(false);
  if (!citations.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-sunken/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[0.75rem] text-muted-foreground transition-colors hover:bg-accent/50"
      >
        <BookOpen className="size-3 shrink-0 text-[var(--signal)]" />
        <span>
          {citations.length} source{citations.length === 1 ? "" : "s"} from Roblox documentation
        </span>
        <ChevronRight
          className={cn("ml-auto size-3 shrink-0 text-muted-foreground/60 transition-transform", open && "rotate-90")}
        />
      </button>

      {open && (
        <ul className="space-y-1 border-t border-hairline px-2.5 py-2">
          {citations.map((c) => (
            <li key={`${c.url ?? c.title}`} className="flex items-start gap-1.5 text-[0.6875rem]">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="min-w-0 flex-1">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--signal)] underline-offset-2 hover:underline"
                  >
                    {c.label}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{c.label}</span>
                )}
                {c.authority !== "canonical" && (
                  <span className="ml-1.5 rounded border border-border px-1 font-mono text-[0.5rem] uppercase text-muted-foreground">
                    {c.authority}
                  </span>
                )}
                {c.deprecated && (
                  <span className="ml-1.5 rounded border border-[var(--warning)]/40 px-1 font-mono text-[0.5rem] uppercase text-[var(--warning)]">
                    deprecated
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanBlock({ goal, steps }: { goal: string; steps: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--ember)]/25 bg-[var(--ember)]/5 p-3">
      <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--ember)]">
        <ListChecks className="size-3.5" />
        Build plan
      </p>
      <p className="mt-1.5 text-[0.8125rem]">{goal}</p>
      <ol className="mt-2.5 space-y-1">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-[0.75rem] text-muted-foreground">
            <span className="font-mono text-[0.625rem] text-[var(--ember)]/70">
              {String(index + 1).padStart(2, "0")}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming,
  onRetry,
}: {
  message: BlockwrightUIMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-surface-raised px-3.5 py-2.5 text-[0.875rem] leading-relaxed whitespace-pre-wrap sm:max-w-[75%]">
          {text}
        </div>
      </div>
    );
  }

  const modelName = message.metadata?.modelId
    ? getModelOrDefault(message.metadata.modelId).name
    : null;

  return (
    <div className="group/message">
      <div className="space-y-2">
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`;

          if (part.type === "text") {
            return part.text ? <Markdown key={key} content={part.text} /> : null;
          }

          if (part.type === "reasoning") {
            return part.text ? (
              <details key={key} className="rounded-lg border border-border bg-surface-sunken/60">
                <summary className="cursor-pointer px-2.5 py-1.5 text-[0.75rem] text-muted-foreground">
                  Reasoning
                </summary>
                <div className="border-t border-hairline px-2.5 py-2 text-[0.75rem] leading-relaxed text-muted-foreground">
                  {part.text}
                </div>
              </details>
            ) : null;
          }

          if (part.type === "data-plan") {
            return <PlanBlock key={key} goal={part.data.goal} steps={part.data.steps} />;
          }

          if (part.type === "data-changeset") {
            return <ChangesetCard key={key} changeset={part.data} />;
          }

          if (part.type === "data-citations") {
            return <CitationBlock key={key} citations={part.data.citations} />;
          }

          if (part.type.startsWith("tool-")) {
            const toolPart = part as unknown as {
              type: string;
              state: string;
              input?: Record<string, unknown>;
              output?: unknown;
              errorText?: string;
            };
            return (
              <ToolCallRow
                key={key}
                name={toolPart.type.replace(/^tool-/, "")}
                state={toolPart.state}
                input={toolPart.input ?? {}}
                output={toolPart.output}
                errorText={toolPart.errorText}
              />
            );
          }

          return null;
        })}
      </div>

      {!isStreaming && text && (
        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
          <button
            type="button"
            onClick={copy}
            aria-label="Copy response"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
          >
            {copied ? (
              <Check className="size-3.5 text-[var(--success)]" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              aria-label="Regenerate response"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}

          {modelName && (
            <span className="ml-1 font-mono text-[0.625rem] text-muted-foreground/60">
              {modelName}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
