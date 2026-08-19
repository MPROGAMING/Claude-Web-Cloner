"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Blocks,
  BookOpen,
  Coins,
  CornerDownLeft,
  Home,
  Map as MapIcon,
  Plug2,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Command palette.
 *
 * Every action here is a real navigation or a real command — nothing is listed
 * that the app cannot do. A palette that offers dead entries is worse than no
 * palette, because it teaches people the shortcut is unreliable.
 *
 * Mounted once in the app shell rather than per page, so the shortcut works
 * everywhere and there is exactly one keyboard listener.
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  run: (router: ReturnType<typeof useRouter>) => void;
  group: "Go" | "Create" | "Help";
}

const COMMANDS: Command[] = [
  {
    id: "projects",
    label: "Open projects",
    icon: Blocks,
    keywords: "projects games list",
    group: "Go",
    run: (r) => r.push("/projects"),
  },
  {
    id: "new-project",
    label: "New project",
    hint: "Describe a mechanic and start building",
    icon: Sparkles,
    keywords: "new create project game build start",
    group: "Create",
    run: (r) => r.push("/projects?start=1"),
  },
  {
    id: "dashboard",
    label: "Go to dashboard",
    icon: Home,
    keywords: "dashboard home overview",
    group: "Go",
    run: (r) => r.push("/dashboard"),
  },
  {
    id: "activity",
    label: "View activity",
    hint: "Everything the agent has done",
    icon: Activity,
    keywords: "activity history runs log recent",
    group: "Go",
    run: (r) => r.push("/activity"),
  },
  {
    id: "credits",
    label: "Credits and usage",
    icon: Coins,
    keywords: "credits billing usage balance cost",
    group: "Go",
    run: (r) => r.push("/credits"),
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    keywords: "settings account preferences profile",
    group: "Go",
    run: (r) => r.push("/settings"),
  },
  {
    id: "studio",
    label: "Connect Roblox Studio",
    hint: "Pair the plugin with a project",
    icon: Plug2,
    keywords: "studio connect plugin pair bridge roblox",
    group: "Go",
    run: (r) => r.push("/settings#studio"),
  },
  {
    id: "docs",
    label: "How Blockwright works",
    icon: BookOpen,
    keywords: "docs help how it works guide",
    group: "Help",
    run: (r) => r.push("/#how"),
  },
];

function score(command: Command, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const label = command.label.toLowerCase();

  if (label.startsWith(q)) return 100;
  if (label.includes(q)) return 60;
  if (command.keywords.includes(q)) return 30;

  // Every character in order — lets "npj" find "New project".
  let index = 0;
  for (const char of q) {
    index = label.indexOf(char, index);
    if (index === -1) return 0;
    index += 1;
  }
  return 10;
}

/**
 * The palette is mounted in the layout and owns its own state, so a control
 * elsewhere in the shell opens it by announcing rather than by lifting state
 * into a provider that every page would then have to render inside.
 */
const OPEN_EVENT = "blockwright:command-palette";

/** The visible half of ⌘K. A shortcut nobody can see is a shortcut nobody uses. */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      className={cn(
        "tap-row hidden h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-ember md:inline-flex",
        className,
      )}
    >
      <Search className="size-3.5" strokeWidth={1.75} />
      <span className="hidden lg:inline">Search</span>
      <kbd className="font-mono text-[0.6875rem] tracking-[0.08em]">⌘K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const scored = COMMANDS.map((command) => ({ command, s: score(command, query) }))
      .filter((entry) => entry.s > 0)
      .sort((a, b) => b.s - a.s);
    return scored.map((entry) => entry.command);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const run = useCallback(
    (command: Command) => {
      close();
      command.run(router);
    },
    [close, router],
  );

  // One global listener. Ignores keystrokes aimed at an input so ⌘K inside the
  // composer does not fight the person typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isToggle) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    };
    const onRequest = () => setOpen(true);

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onRequest);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const grouped = results.reduce<Record<string, Command[]>>((acc, command) => {
    (acc[command.group] ??= []).push(command);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div
      role="presentation"
      onClick={close}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        className="mount animate-pop w-full max-w-lg overflow-hidden rounded-2xl"
      >
        {/* The search well is Inlet — the same lattice, pressed in — so the
            query sits in a machined slot rather than on a flat rectangle. */}
        <div className="relative flex items-center gap-2.5 border-b border-border px-4">
          <div
            aria-hidden
            className="stud-plate-inlet pointer-events-none absolute inset-0 opacity-25 [--stud-pitch:24px]"
          />
          <Search className="relative size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                run(results[active]);
              }
            }}
            placeholder="Search commands…"
            aria-label="Search commands"
            className="relative h-12 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="relative hidden rounded border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : (
            Object.entries(grouped).map(([group, commands]) => (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  {group}
                </p>
                {commands.map((command) => {
                  flatIndex += 1;
                  const isActive = flatIndex === active;
                  const Icon = command.icon;

                  return (
                    <button
                      key={command.id}
                      type="button"
                      onMouseEnter={() => setActive(results.indexOf(command))}
                      onClick={() => run(command)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-lg py-2 pl-5 pr-3 text-left transition-colors",
                        isActive ? "bg-accent" : "hover:bg-accent/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-1.5 size-1.5 rounded-[2px]",
                          isActive ? "bg-[var(--ember)]" : "bg-transparent",
                        )}
                      />
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem]">{command.label}</span>
                        {command.hint && (
                          <span className="block truncate text-[0.75rem] text-muted-foreground">
                            {command.hint}
                          </span>
                        )}
                      </span>
                      {isActive && <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 font-mono text-[0.625rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapIcon className="size-3" />
            ↑↓ to move
          </span>
          <span>⏎ to open</span>
          <span className="ml-auto">⌘K</span>
        </div>
      </div>
    </div>
  );
}
