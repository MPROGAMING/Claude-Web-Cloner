"use client";

import { ArrowUpRight } from "lucide-react";
import type { Mechanic } from "@/lib/inspiration";
import { cn } from "@/lib/utils";

/**
 * The first screen of an empty conversation.
 *
 * The competitor's empty workspace is a logo. This is the opposite argument:
 * an empty project is the moment inspiration is worth the most, so the screen
 * is a fresh baseplate carrying the one question the product answers and four
 * real mechanics to answer it with.
 *
 * Two rules it exists to obey.
 *
 * The prize is the *mechanic*, in play language — what happens when someone
 * plays. Luau, files and diffs are the receipt, so they appear at the bottom
 * as a strip of true statements about the process and never as the promise.
 *
 * And text sits on a mount, never on bare plate. Only the moulded headline and
 * the mechanic parts touch the lattice directly; every sentence here has an
 * opaque surface under it, because contrast over a textured ground is a thing
 * no audit can measure.
 *
 * Nothing on this screen is invented: the mechanics come from
 * `lib/inspiration.ts`, the file count is the project's own, and the process
 * claims are the pipeline the agent actually runs.
 */

/** One line of display type moulded out of the plate. */
function BrickLine({ text, ember }: { text: string; ember?: boolean }) {
  return (
    <span
      data-text={text}
      className={cn(
        "brick-type font-display text-[1.55rem] leading-[1.14] font-semibold sm:text-[2.5rem]",
        ember && "brick-type--ember",
      )}
    >
      <span className="brick-type__face">{text}</span>
    </span>
  );
}

const PROCESS: { tone: string; label: string }[] = [
  { tone: "bg-[var(--ember)]", label: "Plans before it writes" },
  { tone: "bg-[var(--success)]", label: "Validates its own Luau" },
  { tone: "bg-[var(--ember)]", label: "Every change is a changeset you approve" },
  { tone: "bg-[var(--signal)]", label: "Undo is one press" },
];

export function WorkspaceStart({
  projectName,
  mechanics,
  fileCount,
  onPick,
  disabled,
}: {
  projectName: string;
  mechanics: Mechanic[];
  fileCount: number;
  /** Fills the composer with the mechanic's full prompt. */
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="stud-plate rounded-xl bg-[var(--plate)] px-3 py-7 sm:px-6 sm:py-9">
      <p className="mount label-meta inline-flex items-center gap-2 rounded-md px-2.5 py-1">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--ember)]" />
        Describe the mechanic
      </p>

      <h2 className="mt-4 flex flex-col items-start gap-1">
        <BrickLine text="WHAT HAPPENS" />
        <BrickLine text="IN YOUR GAME?" ember />
      </h2>

      <div className="mount mt-6 rounded-xl p-4 sm:p-5">
        <p className="text-[0.9375rem] leading-relaxed">
          Say it the way a player would. Blockwright plans the change, writes real Luau into{" "}
          <span className="font-semibold">{projectName}</span>, checks its own output, and hands you
          the diff before a single line reaches your place.
        </p>

        <ul className="mt-4 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
          {PROCESS.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground"
            >
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", item.tone)} />
              {item.label}
            </li>
          ))}
        </ul>

        {fileCount > 0 && (
          <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-[0.6875rem] text-muted-foreground">
            {fileCount} file{fileCount === 1 ? "" : "s"} already in this project. It reads them
            before it writes anything.
          </p>
        )}
      </div>

      <p className="mount label-meta mt-7 inline-flex items-center rounded-md px-2.5 py-1">
        Or start from one of these
      </p>

      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {mechanics.map((mechanic, index) => (
          <li key={mechanic.id} className="land" style={{ ["--i" as string]: index }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(mechanic.prompt)}
              className={cn(
                "brick group/part flex h-full w-full flex-col rounded-xl px-3.5 py-3 text-left",
                "[--brick-face:var(--plate-raised)] focus-ember",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <span className="flex w-full items-center gap-1.5 text-[0.875rem] font-semibold">
                {mechanic.label}
                <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-[var(--plate-ink-mute)] transition-transform group-hover/part:-translate-y-0.5" />
              </span>
              <span className="mt-1 line-clamp-2 text-[0.75rem] leading-snug text-muted-foreground">
                {mechanic.prompt}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mount mt-6 rounded-lg px-3 py-2 text-[0.75rem] text-muted-foreground">
        Picking one fills the composer below — read it, change it, then press{" "}
        <span className="font-semibold text-foreground">Build it</span>.
      </p>
    </div>
  );
}
