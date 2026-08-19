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
  PanelRightClose,
  PanelRightOpen,
  Plug2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { playSound } from "@/lib/sound";
import { markRunAnnounced } from "@/lib/notifications/announced";
import { ChatMessage } from "@/components/workspace/chat-message";
import { ChatComposer } from "@/components/workspace/chat-composer";
import { GenerationStatus, GenerationSummary } from "@/components/workspace/generation-status";
import { FileTree } from "@/components/workspace/file-tree";
import { CodePanel, type DraftState } from "@/components/workspace/code-panel";
import { FileQuickOpen } from "@/components/workspace/file-quick-open";
import { StudioPanel } from "@/components/workspace/studio-panel";
import { MemoryPanel } from "@/components/workspace/memory-panel";
import { WorkspaceStart } from "@/components/workspace/workspace-start";
import { PANEL, PART, PART_ICON, PART_INK, PLATE_TOKENS } from "@/components/workspace/material";
import { BlueprintDialog } from "@/components/blueprint/blueprint-dialog";
import type { Blueprint, BlueprintIssue } from "@/lib/blueprint/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusDot } from "@/components/ui/status-dot";
import { CreditBadge } from "@/components/app/credit-badge";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import { setProjectModel } from "@/lib/actions/projects";
import type { BlockwrightUIMessage, StatusData } from "@/lib/ai/types";
import type { ClientModel } from "@/lib/ai/registry";
import type { Project, ProjectFile } from "@/lib/supabase/types";
import { mechanicsFor } from "@/lib/inspiration";
import { cn } from "@/lib/utils";

/**
 * The workspace.
 *
 * A baseplate with parts bolted to it. The conversation is the centre — a
 * recessed well running the full height of the plate — and the file tree, the
 * code panel, Studio and memory are parts mounted either side of it. Nothing
 * moves the conversation into a panel; the panels yield width to it and
 * disappear entirely below `lg`.
 *
 * The plate holds one colour in both themes, the way the marketing hero does:
 * it is a physical object the page is standing on, not a themed surface. See
 * `material.ts` for why `--surface` is remapped to the *deep* moulding tone
 * here rather than the raised one.
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
  // Tabs, in the order they were opened. The first file is open on arrival so
  // the panel is never a blank rectangle next to a project full of code.
  const [openPaths, setOpenPaths] = useState<string[]>(files[0] ? [files[0].path] : []);
  const [panelOpen, setPanelOpen] = useState(true);
  const [codeExpanded, setCodeExpanded] = useState(false);
  // Unsaved edits live here rather than in the code panel: two panels are
  // mounted below `xl` (the side panel and the mobile sheet) and typing must
  // survive closing the sheet.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedContent, setSavedContent] = useState<Record<string, string>>({});
  const [mobilePanel, setMobilePanel] = useState<"files" | "studio" | null>(null);
  const [statuses, setStatuses] = useState<StatusData[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  // Bumped when a turn ends so the Memory panel re-reads. A counter rather than
  // a fetch here: the panel owns its own data, this only says "it may be stale".
  const [memoryRevision, setMemoryRevision] = useState(0);

  // Four mechanics, fixed for this project. Chips that reshuffle under the
  // reader are worse than no chips, and the same list has to render on the
  // server and on the client or hydration disagrees.
  const suggestions = useMemo(() => mechanicsFor(project.id), [project.id]);

  /**
   * What is in the project, counted rather than characterised: scripts are the
   * files the Studio bridge actually sends, notes are the `doc` rows. If the
   * project holds anything that is neither, the phrase falls back to a plain
   * file count rather than mislabelling it.
   */
  const contents = useMemo(() => {
    const scripts = files.filter((file) => /\.luau?$/i.test(file.path)).length;
    const notes = files.filter((file) => file.kind === "doc").length;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    if (files.length === 0) return "Nothing built yet";
    if (scripts + notes !== files.length) return plural(files.length, "file");
    if (notes === 0) return plural(scripts, "script");
    if (scripts === 0) return plural(notes, "note");
    return `${plural(scripts, "script")} · ${plural(notes, "note")}`;
  }, [files]);

  /**
   * The composer's text lives here, not in the composer.
   *
   * It is the loudest control on the surface and it must never be empty on
   * arrival — the single flaw eleven of fourteen critics named in the
   * competitor was an empty, grey, disabled-looking input. So it opens on the
   * idea this project was created from, and failing that on a real mechanic,
   * and a chip fills it rather than firing a thirty-word prompt nobody read.
   */
  const [composerValue, setComposerValue] = useState(
    seededPrompt ?? (initialMessages.length === 0 ? suggestions[0].prompt : ""),
  );
  // Bumped whenever something other than typing writes the composer, so it can
  // focus and resize itself without an effect that watches every keystroke.
  const [fillToken, setFillToken] = useState(0);

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
        playSound("error");
        markRunAnnounced(project.id);
        toast.error(friendlyError(chatError));
      },
      onFinish: () => {
        // Tied to the run actually ending, not to a timer.
        playSound("complete");
        // The user heard it here, so the notification for this same run should
        // arrive as a badge and not a second chime.
        markRunAnnounced(project.id);
        setStatuses([]);
        // The agent wrote files server-side; pull the new tree.
        void refreshFiles();
        setMemoryRevision((v) => v + 1);
        router.refresh();
      },
    });

  const busy = status === "submitted" || status === "streaming";

  const openFile = useCallback((path: string) => {
    setOpenPaths((current) => (current.includes(path) ? current : [...current, path]));
    setActivePath(path);
  }, []);

  const draftState: DraftState = useMemo(
    () => ({
      drafts,
      saved: savedContent,
      onDraftChange: (path, content) =>
        setDrafts((current) => ({ ...current, [path]: content })),
      onDraftDiscard: (path) =>
        setDrafts((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        }),
      onSaved: (path, content) =>
        setSavedContent((current) => ({ ...current, [path]: content })),
    }),
    [drafts, savedContent],
  );

  const closeFile = useCallback(
    (path: string) => {
      const index = openPaths.indexOf(path);
      const next = openPaths.filter((open) => open !== path);
      setOpenPaths(next);
      // Fall to the neighbour on the left, which is where the eye already is.
      if (activePath === path) setActivePath(next[Math.max(0, index - 1)]);
    },
    [openPaths, activePath],
  );

  const refreshFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/files`, { cache: "no-store" });
      if (!response.ok) return;
      const data: { files: ProjectFile[] } = await response.json();
      setFiles(data.files);

      const paths = new Set(data.files.map((file) => file.path));
      setOpenPaths((current) => {
        const surviving = current.filter((path) => paths.has(path));
        return surviving.length ? surviving : data.files[0] ? [data.files[0].path] : [];
      });
      setActivePath((current) =>
        current && paths.has(current) ? current : (data.files[0]?.path ?? undefined),
      );
    } catch {
      // Non-fatal: the tree refreshes again on the next turn.
    }
  }, [project.id]);

  // Auto-scroll, but only while the user is already at the bottom — yanking
  // someone back down while they are reading is the classic chat UI sin.
  useEffect(() => {
    // Nothing to follow on an empty conversation, and scrolling there would
    // land the reader at the bottom of the opening screen.
    if (!atBottom || messages.length === 0) return;
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

  const contextPanel = (
    <Tabs defaultValue="code" className="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList className="m-2 shrink-0 data-[variant=default]:bg-[var(--surface-sunken)]">
        <TabsTrigger
          value="code"
          className="data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
        >
          Code
        </TabsTrigger>
        <TabsTrigger
          value="studio"
          className="data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
        >
          {/* The one live signal in the chrome, and only when a session really
              is paired — the same value the header pill reads. */}
          {studioConnected && <StatusDot tone="live" pulse />}
          Studio
        </TabsTrigger>
        <TabsTrigger
          value="memory"
          className="data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
        >
          Memory
        </TabsTrigger>
      </TabsList>

      <TabsContent value="code" className="min-h-0 flex-1 overflow-hidden">
        <CodePanel
          projectId={project.id}
          files={files}
          openPaths={openPaths}
          activePath={activePath}
          onOpen={openFile}
          onClosePath={closeFile}
          onFilesChanged={refreshFiles}
          changedPaths={changedPaths}
          draftState={draftState}
          bindKeys={mobilePanel !== "files"}
          expanded={codeExpanded}
          onToggleExpand={() => setCodeExpanded((value) => !value)}
        />
      </TabsContent>

      <TabsContent value="studio" className="min-h-0 flex-1 overflow-y-auto">
        <StudioPanel projectId={project.id} />
      </TabsContent>

      <TabsContent value="memory" className="min-h-0 flex-1 overflow-y-auto">
        <MemoryPanel projectId={project.id} revision={memoryRevision} />
      </TabsContent>
    </Tabs>
  );

  return (
    // Below `md` the shell keeps a 56px tab bar at the bottom of the viewport,
    // so the plate stops above it rather than sliding underneath.
    <div className="plate stud-plate h-[calc(100dvh-3.5rem)] overflow-hidden md:h-dvh">
      <div className={cn("flex h-full min-h-0 flex-col gap-2 p-2 md:gap-2.5 md:p-2.5", PLATE_TOKENS)}>
        {/* ---- the bar. Bare plate carrying parts: the one place the lattice
            is meant to show, because nothing here is running text. ---- */}
        <header className="flex min-h-12 shrink-0 items-center gap-2">
          <Link
            href="/projects"
            aria-label="Back to projects"
            className={cn(PART_ICON, "focus-ember")}
          >
            <ArrowLeft className="size-4" />
          </Link>

          {/* The nameplate. Running text, so it is mounted — the studs behind
              it are occluded rather than showing through the letters. */}
          <div className="mount min-w-0 flex-1 rounded-lg px-3 py-1.5">
            <h1 className="truncate text-[0.875rem] font-semibold">{project.name}</h1>
            <p className="truncate text-[0.6875rem] text-muted-foreground">
              {contents}
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
                // The label is hidden below `sm`, which would leave an icon-only
                // button with no accessible name on exactly the devices most
                // Roblox creators use.
                aria-label={blueprint?.approved ? "Open the approved game plan" : "Plan the game"}
                className={cn(
                  PART,
                  "tap-target flex items-center justify-center gap-1.5 px-2.5 py-2 text-[0.75rem] font-semibold focus-ember",
                  blueprint?.approved && `[--brick-face:var(--plate-ok)] ${PART_INK}`,
                )}
              >
                <Map className="size-3.5" />
                <span className="hidden sm:inline">
                  {blueprint?.approved ? "Plan" : "Plan the game"}
                </span>
              </button>
            }
          />

          {studioConnected && (
            <span
              className={cn(
                "brick hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.6875rem] font-semibold sm:inline-flex",
                "[--brick-face:var(--plate-signal)] [--lift:3px]",
                PART_INK,
              )}
            >
              <StatusDot tone="live" pulse />
              Studio
            </span>
          )}

          {/* mobile panel toggles */}
          <button
            type="button"
            onClick={() => setMobilePanel(mobilePanel === "files" ? null : "files")}
            aria-label="Toggle files"
            className={cn(PART_ICON, "lg:hidden focus-ember")}
          >
            <Files className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel(mobilePanel === "studio" ? null : "studio")}
            aria-label="Toggle Studio and Memory panel"
            className={cn(PART_ICON, "lg:hidden focus-ember")}
          >
            <Plug2 className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-label={panelOpen ? "Hide side panels" : "Show side panels"}
            className={cn(PART_ICON, "hidden lg:flex focus-ember")}
          >
            {panelOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <NotificationBell />
            <CreditBadge balance={balance} />
            <UserMenu email={email} displayName={displayName} />
          </div>
        </header>

        {/* ---- body ---- */}
        <div className="flex min-h-0 flex-1 gap-2 md:gap-2.5">
          {/* files */}
          <aside
            className={cn(
              PANEL,
              "hidden w-56 shrink-0 lg:flex lg:flex-col",
              !panelOpen && "lg:hidden",
            )}
          >
            <FileTree
              files={files}
              activePath={activePath}
              onSelect={openFile}
              changedPaths={changedPaths}
            />
          </aside>

          {/* conversation — the centre of the plate, and the only part that
              never yields width */}
          <main className={cn(PANEL, "flex min-w-0 flex-1 flex-col")}>
            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="relative min-h-0 flex-1 overflow-y-auto"
            >
              <div
                className={cn(
                  "mx-auto max-w-3xl px-3 md:px-6",
                  // A short conversation sits down by the composer rather than
                  // floating at the top of an empty well; once it is longer
                  // than the panel this has no effect and it scrolls normally.
                  empty ? "py-3 md:py-4" : "flex min-h-full flex-col justify-end space-y-5 py-6",
                )}
              >
                {empty ? (
                  <WorkspaceStart
                    projectName={project.name}
                    mechanics={suggestions}
                    fileCount={files.length}
                    disabled={Boolean(disabledReason)}
                    onPick={(prompt) => {
                      setComposerValue(prompt);
                      setFillToken((token) => token + 1);
                    }}
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

                {busy && <GenerationStatus statuses={statuses} active className="mt-5" />}

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
                    className="mt-5 flex items-start gap-2.5 rounded-lg bg-surface-sunken px-3 py-2.5"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] text-[var(--danger)]">
                        {friendlyError(error)}
                      </p>
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
                  className={cn(
                    PART,
                    "sticky bottom-4 left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center focus-ember",
                  )}
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
              value={composerValue}
              onValueChange={setComposerValue}
              fillToken={fillToken}
              sendLabel={empty ? "Build it" : "Send"}
              onSubmit={(text) => {
                setStatuses([]);
                sendMessage({ text });
              }}
              onStop={stop}
              status={status}
              disabledReason={disabledReason}
              contextFileCount={files.length}
            />
          </main>

          {/* context panel. Expanding it takes width from the conversation rather
              than floating over it, so the tree, the tabs and the code stay in
              one continuous surface — reviewing nine files in a 22rem column is
              the thing that makes people stop reading. */}
          <aside
            className={cn(
              PANEL,
              "hidden shrink-0 flex-col xl:flex",
              codeExpanded ? "w-[min(52rem,55vw)]" : "w-[22rem]",
              !panelOpen && "xl:hidden",
            )}
          >
            {contextPanel}
          </aside>
        </div>

        {/* Inside the token wrapper, not beside it: ⌘P is part of the same
            machine and must be moulded out of the same material. */}
        <FileQuickOpen files={files} onSelect={openFile} />
      </div>

      {/* ---- mobile overlays ---- */}
      {mobilePanel && (
        <div className={cn("fixed inset-0 z-50 lg:hidden", PLATE_TOKENS)}>
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setMobilePanel(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="mount absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col">
            {mobilePanel === "files" ? (
              files.length > 0 ? (
                <Tabs defaultValue="tree" className="flex min-h-0 flex-1 flex-col gap-0">
                  <TabsList className="m-2 shrink-0 data-[variant=default]:bg-[var(--surface-sunken)]">
                    <TabsTrigger
                      value="tree"
                      className="tap-target data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
                    >
                      Files
                    </TabsTrigger>
                    <TabsTrigger
                      value="code"
                      className="tap-target data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
                    >
                      Code
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="tree" className="min-h-0 flex-1 overflow-hidden">
                    <FileTree
                      files={files}
                      activePath={activePath}
                      onSelect={openFile}
                      changedPaths={changedPaths}
                    />
                  </TabsContent>
                  <TabsContent value="code" className="min-h-0 flex-1 overflow-hidden">
                    <CodePanel
                      projectId={project.id}
                      files={files}
                      openPaths={openPaths}
                      activePath={activePath}
                      onOpen={openFile}
                      onClosePath={closeFile}
                      onFilesChanged={refreshFiles}
                      changedPaths={changedPaths}
                      draftState={draftState}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <FileTree
                  files={files}
                  activePath={activePath}
                  onSelect={openFile}
                  changedPaths={changedPaths}
                />
              )
            ) : (
              // Studio and Memory share the one overlay rather than adding a
              // third header button — the mobile bar is already at its limit.
              <Tabs defaultValue="studio" className="flex min-h-0 flex-1 flex-col gap-0">
                <TabsList className="m-2 shrink-0 data-[variant=default]:bg-[var(--surface-sunken)]">
                  <TabsTrigger
                    value="studio"
                    className="data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
                  >
                    Studio
                  </TabsTrigger>
                  <TabsTrigger
                    value="memory"
                    className="data-active:bg-[var(--plate-raised)] dark:data-active:bg-[var(--plate-raised)]"
                  >
                    Memory
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="studio" className="min-h-0 flex-1 overflow-y-auto">
                  <StudioPanel projectId={project.id} />
                </TabsContent>
                <TabsContent value="memory" className="min-h-0 flex-1 overflow-y-auto">
                  <MemoryPanel projectId={project.id} revision={memoryRevision} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
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
