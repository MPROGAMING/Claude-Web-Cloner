"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Files,
  Map,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Plug2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ChatMessage } from "@/components/workspace/chat-message";
import { ChatComposer } from "@/components/workspace/chat-composer";
import { GenerationStatus, GenerationSummary } from "@/components/workspace/generation-status";
import { FileTree } from "@/components/workspace/file-tree";
import { CodeViewer } from "@/components/workspace/code-viewer";
import { StudioPanel } from "@/components/workspace/studio-panel";
import { BlueprintDialog } from "@/components/blueprint/blueprint-dialog";
import type { Blueprint, BlueprintIssue } from "@/lib/blueprint/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusDot } from "@/components/ui/status-dot";
import { CreditBadge } from "@/components/app/credit-badge";
import { UserMenu } from "@/components/app/user-menu";
import { setProjectModel } from "@/lib/actions/projects";
import type { BlockwrightUIMessage, StatusData } from "@/lib/ai/types";
import type { ClientModel } from "@/lib/ai/registry";
import type { Project, ProjectFile } from "@/lib/supabase/types";
import { suggestionsFor } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * The workspace.
 *
 * Layout: file tree (left, collapsible) · conversation (centre) · context panel
 * (right, collapsible). Below `lg` the side panels become a sheet-style overlay
 * so the conversation always owns the full width on a laptop or phone — the
 * chat is the product, the panels are support.
 */
export function Workspace({
  project,
  conversationId,
  initialMessages,
  files: initialFiles,
  models,
  balance,
  email,
  displayName,
  seededPrompt,
  studioConnected,
  catalogFetchedAt,
  blueprint,
}: {
  project: Project;
  conversationId: string;
  initialMessages: BlockwrightUIMessage[];
  files: ProjectFile[];
  models: ClientModel[];
  balance: number;
  email: string;
  displayName?: string | null;
  seededPrompt?: string;
  studioConnected: boolean;
  catalogFetchedAt?: string;
  blueprint?: {
    id: string;
    blueprint: Blueprint;
    issues: BlueprintIssue[];
    approved: boolean;
  };
}) {
  const router = useRouter();

  const [modelId, setModelId] = useState(project.model_id);
  const [files, setFiles] = useState(initialFiles);
  const [activePath, setActivePath] = useState<string | undefined>(files[0]?.path);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"files" | "studio" | null>(null);
  const [statuses, setStatuses] = useState<StatusData[]>([]);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const anyProviderAvailable = models.some((model) => model.available);

  const { messages, sendMessage, status, error, stop, regenerate } =
    useChat<BlockwrightUIMessage>({
      id: conversationId,
      messages: initialMessages,
      // The messages table keys on uuid, and the server persists the id the
      // client sent. The SDK's default generator emits a 16-char nanoid, which
      // would be rejected by the column — so generate real UUIDs here.
      generateId: () => crypto.randomUUID(),
      transport: new DefaultChatTransport({
        api: "/api/chat",
        // Only the newest message goes over the wire; the server owns history,
        // so the client cannot rewrite what was said earlier.
        prepareSendMessagesRequest: ({ messages: all, id }) => ({
          body: {
            id,
            projectId: project.id,
            modelId,
            message: all[all.length - 1],
          },
        }),
      }),
      onData: (part) => {
        if (part.type === "data-status") {
          setStatuses((previous) => [...previous, part.data as StatusData]);
        }
      },
      onError: (chatError) => {
        toast.error(friendlyError(chatError));
      },
      onFinish: () => {
        setStatuses([]);
        // The agent wrote files server-side; pull the new tree.
        void refreshFiles();
        router.refresh();
      },
    });

  const busy = status === "submitted" || status === "streaming";

  const refreshFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/files`, { cache: "no-store" });
      if (!response.ok) return;
      const data: { files: ProjectFile[] } = await response.json();
      setFiles(data.files);
      setActivePath((current) =>
        current && data.files.some((f) => f.path === current)
          ? current
          : (data.files[0]?.path ?? undefined),
      );
    } catch {
      // Non-fatal: the tree refreshes again on the next turn.
    }
  }, [project.id]);

  // Auto-scroll, but only while the user is already at the bottom — yanking
  // someone back down while they are reading is the classic chat UI sin.
  useEffect(() => {
    if (!atBottom) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, statuses, atBottom]);

  const onScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setAtBottom(distance < 80);
  };

  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath),
    [files, activePath],
  );

  // Which files this turn touched, derived from the streamed artifact parts
  // rather than mirrored into state — there is nothing to synchronise here.
  const changedPaths = useMemo(() => {
    const touched = new Set<string>();
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === "data-artifact") touched.add(part.data.path);
      }
    }
    return touched;
  }, [messages]);

  // Change counts for the last assistant turn. Sourced from the same artifact
  // parts the server emitted, so the summary can never overstate the work.
  const lastTurnSummary = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    const counts = { created: 0, updated: 0, deleted: 0 };
    if (!last) return counts;
    const seen = new Set<string>();
    for (const part of last.parts) {
      if (part.type !== "data-artifact") continue;
      if (seen.has(part.data.path)) continue;
      seen.add(part.data.path);
      counts[part.data.change] += 1;
    }
    return counts;
  }, [messages]);

  const changeModel = (nextModelId: string) => {
    setModelId(nextModelId);
    void setProjectModel(project.id, nextModelId);
  };

  const disabledReason = !anyProviderAvailable
    ? "No AI provider is configured on this deployment. Add a provider API key to enable generation."
    : balance < 25
      ? "You are out of credits. Top up to keep building."
      : undefined;

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ---- workspace bar ---- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:px-4">
        <Link
          href="/projects"
          aria-label="Back to projects"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.875rem] font-semibold">{project.name}</h1>
          <p className="truncate font-mono text-[0.625rem] text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"}
            {studioConnected && " · Studio live"}
          </p>
        </div>

        {/* The plan is a first-class object, not a wizard you pass through once:
            it stays reachable so decisions can be revisited. */}
        <BlueprintDialog
          projectId={project.id}
          projectName={project.name}
          seedIdea={project.description ?? undefined}
          existing={blueprint}
          trigger={
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors focus-ember",
                blueprint?.approved
                  ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/15"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Map className="size-3.5" />
              <span className="hidden sm:inline">{blueprint?.approved ? "Plan" : "Plan the game"}</span>
            </button>
          }
        />

        {studioConnected && (
          <span className="hidden items-center gap-1.5 rounded-md border border-[var(--signal)]/30 bg-[var(--signal)]/10 px-2 py-1 text-[0.6875rem] font-medium text-[var(--signal)] sm:inline-flex">
            <StatusDot tone="live" pulse />
            Studio
          </span>
        )}

        {/* mobile panel toggles */}
        <button
          type="button"
          onClick={() => setMobilePanel(mobilePanel === "files" ? null : "files")}
          aria-label="Toggle files"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden focus-ember"
        >
          <Files className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel(mobilePanel === "studio" ? null : "studio")}
          aria-label="Toggle Studio panel"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden focus-ember"
        >
          <Plug2 className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-label={panelOpen ? "Hide side panels" : "Show side panels"}
          className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:block focus-ember"
        >
          {panelOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          <CreditBadge balance={balance} />
          <UserMenu email={email} displayName={displayName} />
        </div>
      </header>

      {/* ---- body ---- */}
      <div className="flex min-h-0 flex-1">
        {/* files */}
        <aside
          className={cn(
            "hidden w-56 shrink-0 border-r border-border bg-sidebar lg:flex lg:flex-col",
            !panelOpen && "lg:hidden",
          )}
        >
          <FileTree
            files={files}
            activePath={activePath}
            onSelect={setActivePath}
            changedPaths={changedPaths}
          />
        </aside>

        {/* conversation */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
              {empty ? (
                <WorkspaceEmptyState
                  projectName={project.name}
                  templateSlug={project.template_slug}
                  onPick={(prompt) => sendMessage({ text: prompt })}
                  disabled={Boolean(disabledReason)}
                />
              ) : (
                messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isStreaming={busy && index === messages.length - 1}
                    onRetry={
                      message.role === "assistant" && index === messages.length - 1 && !busy
                        ? () => regenerate()
                        : undefined
                    }
                  />
                ))
              )}

              {busy && <GenerationStatus statuses={statuses} active />}

              {!busy && !error && (
                <GenerationSummary
                  created={lastTurnSummary.created}
                  updated={lastTurnSummary.updated}
                  deleted={lastTurnSummary.deleted}
                />
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3 py-2.5"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] text-[var(--danger)]">{friendlyError(error)}</p>
                    <button
                      type="button"
                      onClick={() => regenerate()}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="size-3" />
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!atBottom && messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAtBottom(true);
                  const node = scrollRef.current;
                  if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
                }}
                aria-label="Scroll to latest"
                className="sticky bottom-4 left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface-raised shadow-[var(--shadow-raised)] transition-transform hover:scale-105 focus-ember"
              >
                <ArrowDown className="size-4" />
              </button>
            )}
          </div>

          <ChatComposer
            models={models}
            modelId={modelId}
            catalogFetchedAt={catalogFetchedAt}
            onModelChange={changeModel}
            onSubmit={(text) => {
              setStatuses([]);
              sendMessage({ text });
            }}
            onStop={stop}
            status={status}
            seededPrompt={seededPrompt}
            disabledReason={disabledReason}
            contextFileCount={files.length}
          />
        </main>

        {/* context panel */}
        <aside
          className={cn(
            "hidden w-[22rem] shrink-0 flex-col border-l border-border bg-sidebar xl:flex",
            !panelOpen && "xl:hidden",
          )}
        >
          <Tabs defaultValue="code" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="m-2 shrink-0">
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="studio">Studio</TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="min-h-0 flex-1 overflow-hidden">
              {activeFile ? (
                <CodeViewer file={activeFile} />
              ) : (
                <p className="p-6 text-center text-[0.8125rem] text-muted-foreground">
                  No file selected. Generated scripts appear in the tree on the left.
                </p>
              )}
            </TabsContent>

            <TabsContent value="studio" className="min-h-0 flex-1 overflow-y-auto">
              <StudioPanel projectId={project.id} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* ---- mobile overlays ---- */}
      {mobilePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setMobilePanel(null)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col border-l border-border bg-surface shadow-[var(--shadow-overlay)]">
            {mobilePanel === "files" ? (
              activeFile && files.length > 0 ? (
                <Tabs defaultValue="tree" className="flex min-h-0 flex-1 flex-col gap-0">
                  <TabsList className="m-2 shrink-0">
                    <TabsTrigger value="tree">Files</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tree" className="min-h-0 flex-1 overflow-hidden">
                    <FileTree
                      files={files}
                      activePath={activePath}
                      onSelect={setActivePath}
                      changedPaths={changedPaths}
                    />
                  </TabsContent>
                  <TabsContent value="code" className="min-h-0 flex-1 overflow-hidden">
                    <CodeViewer file={activeFile} />
                  </TabsContent>
                </Tabs>
              ) : (
                <FileTree
                  files={files}
                  activePath={activePath}
                  onSelect={setActivePath}
                  changedPaths={changedPaths}
                />
              )
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <StudioPanel projectId={project.id} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceEmptyState({
  projectName,
  templateSlug,
  onPick,
  disabled,
}: {
  projectName: string;
  templateSlug: string | null;
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  // Suggestions follow the project's template, so a tycoon project is not
  // offered obby prompts.
  const suggestions = suggestionsFor(templateSlug);

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface">
        <Sparkles className="size-5 text-[var(--ember)]" strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 text-lg font-semibold">What are we building?</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Describe the mechanic you want for <span className="text-foreground">{projectName}</span>.
        The AI plans it, writes the Luau, checks its own work, and can push it straight into Studio.
      </p>

      <ul className="stagger mt-7 grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion.label} style={{ ["--i" as string]: index }}>
            <button
              type="button"
              disabled={disabled}
              title={suggestion.prompt}
              onClick={() => onPick(suggestion.prompt)}
              className="lift flex h-full w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-[0.8125rem] font-medium text-muted-foreground hover:border-[var(--ember)]/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 focus-ember"
            >
              <MessageSquarePlus className="size-3.5 shrink-0 text-[var(--ember)]/70" />
              <span className="truncate">{suggestion.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Map a thrown chat error to something a person can act on. */
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON — fall through to the raw message.
  }
  if (/insufficient/i.test(message)) return "You are out of credits.";
  if (/rate/i.test(message)) return "Too many requests. Wait a few seconds and try again.";
  return message || "Something went wrong generating that response.";
}
