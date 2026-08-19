"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileCode2,
  Folder,
  Loader2,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/status-dot";

/**
 * A scripted replay of a real generation, built from the same tokens and
 * components as the product. It is explicitly a *preview*, not a live demo —
 * the timings are fixed and nothing is claimed to be running.
 */

const PROMPT =
  "Create a simulator where players collect crystals, sell them, buy backpacks and unlock new islands.";

/**
 * The tree listed six scripts while the step list and the footer both claimed
 * seven. It also had no client folder at all, which is not what this build
 * would actually produce — a shop and a HUD need something running on the
 * player. Nine files now, and every count on the panel is derived from this
 * array rather than typed out again somewhere else.
 */
const FILES = [
  { path: "src/server", type: "dir" as const, depth: 0 },
  { path: "CurrencyService.luau", type: "file" as const, depth: 1 },
  { path: "CrystalNodes.server.luau", type: "file" as const, depth: 1 },
  { path: "IslandUnlocks.server.luau", type: "file" as const, depth: 1 },
  { path: "ShopService.luau", type: "file" as const, depth: 1 },
  { path: "src/client", type: "dir" as const, depth: 0 },
  { path: "CrystalHud.client.luau", type: "file" as const, depth: 1 },
  { path: "SellPrompt.client.luau", type: "file" as const, depth: 1 },
  { path: "src/shared", type: "dir" as const, depth: 0 },
  { path: "GameConfig.luau", type: "file" as const, depth: 1 },
  { path: "Remotes.luau", type: "file" as const, depth: 1 },
  { path: "src/ui", type: "dir" as const, depth: 0 },
  { path: "ShopPanel.luau", type: "file" as const, depth: 1 },
];

const SCRIPT_COUNT = FILES.filter((f) => f.type === "file").length;

/**
 * The build sequence.
 *
 * Deliberately short. The panel is sized for its finished state, so a long
 * timeline means a visitor arrives at a mostly-empty box and watches it fill —
 * which reads as broken, not as animated. It now starts part-built and lands
 * inside three seconds.
 */
const STEPS = [
  { label: "Read the project", ms: 0 },
  { label: "Planned 6 build steps", ms: 420 },
  { label: "Created src/shared/GameConfig.luau", ms: 860 },
  { label: "Created src/server/CurrencyService.luau", ms: 1300 },
  { label: "Created src/server/CrystalNodes.server.luau", ms: 1740 },
  { label: "Created src/ui/ShopPanel.luau", ms: 2180 },
  { label: `Validated ${SCRIPT_COUNT} scripts — clean`, ms: 2620 },
  { label: "Synced to Roblox Studio", ms: 3020 },
];

const CODE = `--!strict
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local GameConfig = require(script.Parent.Parent.shared.GameConfig)

local CurrencyService = {}
local store = DataStoreService:GetDataStore("Wallets_v1")
local wallets: { [number]: number } = {}

function CurrencyService.award(player: Player, amount: number)
	assert(amount > 0, "award expects a positive amount")
	wallets[player.UserId] = (wallets[player.UserId] or 0) + amount
	CurrencyService.changed:Fire(player, wallets[player.UserId])
end`;

/**
 * When the panel settles.
 *
 * These three used to drift: the step list was shortened to land at 3s while
 * the summary and the live dot stayed gated on 6.8s — past the point the timer
 * stopped ticking. Neither could ever render, so the panel finished early and
 * left the space its summary was meant to occupy empty. Anything gated on time
 * belongs in here, next to the tick that has to outlast it.
 */
const SETTLE = {
  summary: STEPS[STEPS.length - 1].ms + 280,
  approval: STEPS[STEPS.length - 1].ms + 540,
  /** The tick must outlive every gate above or they never fire. */
  stopTicking: STEPS[STEPS.length - 1].ms + 900,
};

const FINISHED = 99_999;

export function WorkspacePreview({ className }: { className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Only animate once the preview is actually on screen, and skip straight to
  // the finished state when the visitor prefers reduced motion. Both decisions
  // are made inside the observer/timer callbacks rather than in an effect body,
  // so there is no cascading render on mount.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setElapsed(FINISHED), 0);
      return () => window.clearTimeout(id);
    }

    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = Date.now();
        timer = window.setInterval(() => {
          const next = Date.now() - start;
          setElapsed(next);
          if (next > SETTLE.stopTicking) window.clearInterval(timer);
        }, 80);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const visibleSteps = STEPS.filter((s) => elapsed >= s.ms);
  const activeStep = STEPS.find((s) => elapsed < s.ms);
  // Three files are present on arrival, so the tree is never an empty column.
  const visibleFiles = Math.min(FILES.length, 3 + Math.floor(elapsed / 300));
  // The code pane starts with content rather than an empty viewer under a
  // filename, and fills quickly enough to feel like typing rather than waiting.
  const codeChars = Math.max(120, Math.floor((elapsed + 400) / 1.5));

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-overlay)]",
        className,
      )}
      aria-label="Preview of the Blockwright workspace"
      role="img"
    >
      {/* window chrome */}
      <div className="flex h-10 items-center gap-2 border-b border-hairline bg-surface-sunken px-3.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="ml-2 truncate font-mono text-[0.6875rem] text-muted-foreground">
          Crystal Islands
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--signal)]/30 bg-[var(--signal)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--signal)]">
          <StatusDot tone="live" pulse={elapsed >= SETTLE.summary} />
          Studio connected
        </span>
      </div>

      <div className="grid min-h-[24rem] grid-cols-1 md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[10.5rem_minmax(0,1fr)_16rem]">
        {/* file tree */}
        <div className="hidden border-r border-hairline bg-surface-sunken/60 p-3 lg:block">
          <p className="label-meta mb-2.5">Files</p>
          <ul className="space-y-0.5">
            {FILES.slice(0, visibleFiles).map((file) => (
              <li
                key={file.path}
                className="animate-rise"
                style={{ paddingLeft: file.depth * 10 }}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 truncate rounded py-0.5 text-[0.6875rem]",
                    file.type === "dir"
                      ? "font-medium text-muted-foreground"
                      : "text-foreground/80",
                  )}
                >
                  {file.type === "dir" ? (
                    <Folder className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileCode2 className="size-3 shrink-0 text-[var(--ember)]/70" />
                  )}
                  <span className="truncate">
                    {file.type === "dir" ? file.path : file.path}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {visibleFiles >= FILES.length && (
            <p className="mt-3 animate-rise border-t border-hairline pt-2.5 text-[0.625rem] leading-relaxed text-muted-foreground">
              {SCRIPT_COUNT} scripts
              <br />
              <span className="text-[var(--success)]">Validated — no errors</span>
            </p>
          )}
        </div>

        {/* conversation */}
        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-surface-raised px-3.5 py-2.5 text-[0.8125rem] leading-relaxed">
            {PROMPT}
          </div>

          <div className="space-y-2.5">
            {visibleSteps.map((step) => (
              <div
                key={step.label}
                className="flex animate-rise items-center gap-2 text-[0.75rem] text-muted-foreground"
              >
                <Check className="size-3 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                <span className="truncate">{step.label}</span>
              </div>
            ))}
            {activeStep && (
              <div className="flex items-center gap-2 text-[0.75rem] text-foreground">
                <Loader2 className="size-3 shrink-0 animate-spin text-[var(--ember)]" />
                <span className="truncate">{activeStep.label}…</span>
              </div>
            )}
          </div>

          {elapsed >= SETTLE.summary && (
            <p className="animate-rise text-[0.8125rem] leading-relaxed text-foreground/85">
              Built the collect → sell → upgrade loop. Crystals respawn on a
              timer, the shop validates every purchase server-side, and island
              unlocks are gated on total coins earned.
            </p>
          )}

          {/* The approval gate is the product's central promise and the panel
              never showed it — so the one screenshot a visitor studies left out
              the reason to trust it. Nothing reaches the place until this is
              pressed. */}
          {elapsed >= SETTLE.approval && (
            <div className="mt-auto flex animate-rise flex-wrap items-center gap-2 rounded-lg border border-[var(--ember)]/30 bg-[var(--ember)]/[0.07] px-3 py-2.5">
              <ShieldCheck className="size-3.5 shrink-0 text-[var(--ember)]" />
              <span className="text-[0.75rem] leading-snug text-foreground/85">
                {SCRIPT_COUNT} files ready. Nothing reaches your place until you say
                so.
              </span>
              <span className="ml-auto flex shrink-0 gap-1.5">
                <span className="rounded-md border border-border px-2 py-1 text-[0.6875rem] text-muted-foreground">
                  Discard
                </span>
                <span className="rounded-md bg-[var(--ember)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--ember-ink)]">
                  Apply
                </span>
              </span>
            </div>
          )}
        </div>

        {/* code preview */}
        <div className="hidden min-w-0 border-t border-hairline bg-surface-sunken/60 md:block md:border-l md:border-t-0">
          <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2">
            <FileCode2 className="size-3 text-[var(--ember)]/70" />
            <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
              CurrencyService.luau
            </span>
          </div>
          {/*
            The pane is narrower than the source lines, so every line was being
            guillotined at a hard vertical edge mid-glyph — on the one panel
            meant to prove the product works, which made it read as a rendering
            failure. Wrapping keeps the code intact, and the fade at the bottom
            edge shows there is more rather than pretending the file ends there.
          */}
          <pre className="overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-[0.625rem] leading-[1.7] text-foreground/75 [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
            <code>
              {CODE.slice(0, codeChars)}
              {codeChars < CODE.length && codeChars > 0 && (
                <span className="ml-px inline-block h-2.5 w-1 animate-caret bg-[var(--ember)] align-middle" />
              )}
            </code>
          </pre>
        </div>
      </div>

      {/* composer */}
      <div className="flex items-center gap-2 border-t border-hairline bg-surface-sunken px-3.5 py-2.5">
        <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-[0.75rem] text-muted-foreground">
          Ask for a change…
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
          <Plug className="size-2.5" />
          Sonnet 4.5
        </span>
      </div>
    </div>
  );
}
