import {
  CircleCheck,
  FileCode2,
  Flag,
  Flame,
  GitPullRequestArrow,
  Play,
  Plug,
  RotateCcw,
} from "lucide-react";
import { PairingShape } from "@/components/marketing/pairing-shape";
import { highlightLuauLines } from "@/lib/roblox/luau-highlight";

/**
 * What the request turns into, in the order the reader cares about.
 *
 * This half of the fold used to open with a syntax-highlighted `.luau` file at
 * roughly the weight of the call to action, and a blind critic put the page
 * behind the competitor for exactly that: the headline promises "then go play
 * it" and the only visual evidence in the same viewport was a code review. So
 * the top of the panel is now the mechanic *in play* — what a player does,
 * what happens to them, where they come back — and the code, the file path and
 * the validator verdict are a footer under a rule, which is the hierarchy the
 * whole direction is built on: the mechanic is the prize, the code is the
 * receipt.
 *
 * Nothing here is a picture of a game. We do not have gameplay to show and
 * will not fabricate any, and the honest version is better anyway: the three
 * beats are the literal behaviour of the file printed beneath them, so the
 * reader can check the claim against the code without leaving the fold.
 *
 * Artifacts are still allowed to look like artifacts — a service path and
 * `validate · 0 errors` are evidence, and dressing evidence down makes it less
 * convincing, not more readable. What is not allowed is *explaining* the
 * product in the vocabulary of the people who built it, which is why the
 * status chip says what it means to the reader rather than naming the internal
 * object it comes from.
 *
 * It reports no Studio session. A landing page that claims a live connection
 * is claiming state it cannot have, so the pairing row explains the mechanism
 * and stops there.
 */

/**
 * The mechanic the composer opens on, as a player experiences it. Each beat is
 * something the printed file below actually does: the touch handler zeroes the
 * humanoid's health, and it hands the player to CheckpointService first, which
 * is why they come back at a flag rather than at spawn.
 */
const BEATS = [
  {
    icon: Flame,
    tone: "ember",
    text: "Touch the lava and you're gone that second.",
  },
  {
    icon: Flag,
    tone: "signal",
    text: "It already saved the last flag you ran past.",
  },
  {
    icon: RotateCcw,
    tone: "ok",
    text: "You come back at that flag, not at the start.",
  },
] as const;

/** Three inks, so the plate is never one hue against itself. */
const TONE = {
  ember: { ink: "text-[var(--ember)]", face: "[--brick-face:color-mix(in_oklch,var(--ember)_20%,var(--surface-sunken))]" },
  signal: { ink: "text-[var(--signal)]", face: "[--brick-face:color-mix(in_oklch,var(--signal)_20%,var(--surface-sunken))]" },
  ok: { ink: "text-[var(--success)]", face: "[--brick-face:color-mix(in_oklch,var(--success)_20%,var(--surface-sunken))]" },
} as const;

const PATH_DIR = "ServerScriptService/Blockwright/Lava/";
const PATH_FILE = "LavaService.luau";

/**
 * Real Luau for that mechanic. Server-authoritative — the kill and the
 * checkpoint both happen on the server, which is the whole reason a `.Touched`
 * handler lives in ServerScriptService and not on the player.
 */
const SOURCE = `--!strict
local Players = game:GetService("Players")
local Checkpoints = require(script.Parent.CheckpointService)

local function onLavaTouched(hit: BasePart)
\tlocal model = hit:FindFirstAncestorOfClass("Model")
\tlocal player = model and Players:GetPlayerFromCharacter(model)
\tif not model or not player then
\t\treturn
\tend

\tlocal humanoid = model:FindFirstChildOfClass("Humanoid")
\tif humanoid and humanoid.Health > 0 then
\t\tCheckpoints.remember(player)
\t\thumanoid.Health = 0
\tend
end`;

/**
 * The four lines that are the three beats. An excerpt rather than the head of
 * the file, because `--!strict` and two `require`s prove nothing to anybody:
 * these are the lines a reader can hold against the sentences above them.
 */
const EXCERPT = highlightLuauLines(SOURCE).slice(11, 15);

export function HeroOutcome() {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="mount min-w-0 overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 px-4 pb-0.5 pt-3">
          <Play className="size-3.5 shrink-0 fill-current text-[var(--ember)]" strokeWidth={2} />
          <p className="label-meta">When you press play</p>
        </div>

        {/* The beats are a sequence, so a connector runs down behind the
            parts. The parts are opaque, so it only shows in the gaps — the
            same trick the material uses everywhere else. */}
        <ol className="relative px-4 pb-3 pt-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-5 left-[2rem] w-px bg-[var(--hairline)]"
          />
          {BEATS.map((beat) => (
            <li key={beat.text} className="relative flex items-center gap-3 py-0.5">
              <span
                aria-hidden
                className={`brick flex size-8 shrink-0 items-center justify-center rounded-lg [--lift:3px] ${TONE[beat.tone].face}`}
              >
                <beat.icon className={`size-4 ${TONE[beat.tone].ink}`} strokeWidth={2.25} />
              </span>
              <p className="text-[0.875rem] leading-snug">{beat.text}</p>
            </li>
          ))}
        </ol>

        {/* The receipt. Under a rule, at a fraction of the size, because the
            mechanic is the promise and this is the proof it was kept. */}
        <div className="border-t border-hairline">
          <div className="flex items-center gap-2 bg-[var(--signal)]/8 px-4 py-2">
            <FileCode2 className="size-3.5 shrink-0 text-[var(--signal)]" strokeWidth={2} />
            <p className="min-w-0 truncate font-mono text-[0.6875rem] text-muted-foreground">
              <span className="hidden sm:inline">{PATH_DIR}</span>
              <span className="font-medium text-foreground">{PATH_FILE}</span>
            </p>
          </div>

          <pre className="code-type max-w-full overflow-hidden whitespace-pre bg-surface-sunken px-4 py-1.5 text-[0.6875rem] leading-[1.05rem]">
            <code>
              {EXCERPT.map((html, index) => (
                <span
                  key={index}
                  className="block"
                  dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
                />
              ))}
            </code>
          </pre>

          <ul className="flex flex-wrap gap-1.5 px-4 py-2">
            <li className="inline-flex items-center gap-1.5 rounded-md bg-[var(--success)]/12 px-2 py-1 font-mono text-[0.6875rem] text-[var(--success-ink)]">
              <CircleCheck className="size-3.5" strokeWidth={2.25} />
              validate · 0 errors
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ember)]/14 px-2 py-1 font-mono text-[0.6875rem] text-[var(--ember)]">
              <GitPullRequestArrow className="size-3.5" strokeWidth={2.25} />
              written · waiting for your yes
            </li>
          </ul>
        </div>
      </div>

      {/* Studio is the one thing on this page that is not ember. The bridge
          owns --plate-signal across the whole site, which is also what keeps a
          terracotta plate from reading as one hue against itself. */}
      <div className="mount rounded-xl border border-[var(--signal)]/25 px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Plug className="size-3.5 shrink-0 text-[var(--signal)]" strokeWidth={2} />
          <p className="label-meta text-[var(--signal)]">Studio pairing</p>
          <PairingShape className="ml-auto" />
        </div>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">
          Six characters, typed into the plugin in Studio. Then it lands in the
          place you have open and you press play on it yourself.
        </p>
      </div>
    </div>
  );
}
