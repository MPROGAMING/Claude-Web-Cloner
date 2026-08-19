import { CircleCheck, FileCode2, PlugZap, ShieldCheck } from "lucide-react";
import { BrickText } from "@/components/marketing/brick-text";
import { MECHANICS } from "@/lib/inspiration";
import { highlightLuauLines } from "@/lib/roblox/luau-highlight";

/**
 * The wall beside the door.
 *
 * The competitor puts a full-height slab of real game art next to its sign-in
 * button. We have no game art and will not manufacture any, so this side of
 * the door wins on material and on truth instead.
 *
 * Two things a blind critic named are load-bearing in the layout below, and
 * both are proportion decisions rather than colour ones:
 *
 * 1. Display type gets a mount of its own. Moulded cream letterforms standing
 *    on the warm plate were reading as brown-on-brown: the plate is a lattice
 *    of lit rims and cast shadows, so luminance swings locally underneath the
 *    glyphs and a headline half-dissolves into its own background. The sign is
 *    a dark, near-neutral part (`--surface-sunken`) seated on the warm plate —
 *    two materials, and roughly five stops of value between the letters and
 *    what is behind them. The recessed lattice inside the sign sits behind the
 *    display type only, never behind running text.
 *
 * 2. The Luau is a receipt, not a hero. A wall of source fading out under a
 *    gradient was the largest element on a sign-in page, which is backwards —
 *    nobody signs in to read source. It is now five sharp lines with no mask,
 *    under the mechanic it implements, and the space it gave up went to the
 *    thing that actually makes someone want an account: the mechanic in play
 *    language, plus six more they could ask for next.
 *
 * Nothing here claims a session, a project or a number. The prompt and the
 * chips are mechanics the product actually offers (`lib/inspiration`), and the
 * Luau is real Luau for the featured one.
 */

/** "Coins that come back" — the mechanic the receipt below implements. */
const FEATURED = MECHANICS[1];

/** Six more, in the same play language. Same source the workspace draws from. */
const ALTERNATIVES = MECHANICS.slice(2, 8);

const PATH_DIR = "ServerScriptService/Blockwright/Coins/";
const PATH_FILE = "CoinService.luau";

/**
 * An excerpt of that file — the pickup half, whole and unclipped.
 *
 * Server-authoritative, because the coin has to disappear for everyone and the
 * wallet must not be writable from a client. Deliberately short: five lines
 * read as evidence, thirty read as a demand that you review code before you
 * have an account.
 */
const RECEIPT = `--!strict
local function collect(coin: BasePart, player: Player)
\tcoin.CanTouch = false
\tWallet.add(player, 1)
end`;

export function WorkshopWall() {
  const lines = highlightLuauLines(RECEIPT);

  return (
    <aside className="min-w-0">
      {/* The sign: the promise, on a dark part that the letters can stand on. */}
      <section className="mount land overflow-hidden rounded-2xl [--surface:var(--surface-sunken)]">
        <p className="label-meta flex items-center gap-3 px-5 pt-5 sm:px-6">
          <span aria-hidden className="h-0.5 w-8 shrink-0 rounded-full bg-[var(--ember)]" />
          An AI build partner for Roblox
        </p>

        {/* The lattice band is its own block, bleeding to both edges of the
            sign, so it is behind display type and nothing else however the
            eyebrow above it wraps. Inlet is the pressed form of Studs. */}
        <div className="relative overflow-hidden px-5 pb-6 pt-4 sm:px-6">
          <div
            aria-hidden
            className="stud-plate-inlet pointer-events-none absolute inset-0 opacity-45 [--stud-pitch:26px]"
          />

          <h2 className="relative uppercase leading-[0.92]">
            <span className="block text-[clamp(2.05rem,4.5vw,3.5rem)]">
              <BrickText>Describe it.</BrickText>
            </span>
            <span className="mt-2 block text-[clamp(2.05rem,4.5vw,3.5rem)]">
              <BrickText tone="ember">Then play it.</BrickText>
            </span>
          </h2>
        </div>

        {/* The prize: a mechanic in the words a player would use. The largest
            block of running text on the surface, which is the right way round. */}
        <div className="border-t border-hairline px-5 py-5 sm:px-6">
          <p className="label-meta">You say it like this</p>
          <p className="mt-2.5 text-[1.0625rem] leading-[1.5] text-foreground sm:text-[1.125rem]">
            {FEATURED.prompt}
          </p>

          <p className="label-meta mt-5">Or any of these</p>
          <ul className="mt-3 flex flex-wrap gap-2 sm:gap-2.5">
            {ALTERNATIVES.map((mechanic) => (
              <li
                key={mechanic.id}
                className="brick rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium text-foreground [--brick-face:var(--plate-raised)] [--lift:3px] sm:px-3 sm:py-2 sm:text-[0.8125rem]"
              >
                {mechanic.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The receipt. Real Luau at a real path, sharp to the last line. */}
      <section className="mount land mt-3.5 rounded-2xl p-4 [--i:1] [--surface:var(--surface-sunken)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
          <p className="label-meta">It writes</p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <li className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-[var(--success-ink)]">
              <CircleCheck className="size-3.5 shrink-0" strokeWidth={2.25} />
              validate · 0 errors
            </li>
            <li className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-[var(--signal)]">
              <ShieldCheck className="size-3.5 shrink-0" strokeWidth={2.25} />
              strict typing
            </li>
          </ul>
        </div>

        <p className="mt-2.5 flex items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
          <FileCode2 className="size-3.5 shrink-0 text-[var(--signal)]" strokeWidth={2} />
          <span className="min-w-0 truncate">
            <span className="hidden sm:inline">{PATH_DIR}</span>
            <span className="font-medium text-foreground">{PATH_FILE}</span>
          </span>
        </p>

        <pre className="code-type mt-3 max-w-full overflow-x-auto whitespace-pre border-l-2 border-[var(--ember)]/45 pl-3 text-[0.6875rem] leading-[1.05rem]">
          <code>
            {lines.map((html, index) => (
              <span
                key={index}
                className="block"
                dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
              />
            ))}
          </code>
        </pre>

        <p className="mt-3.5 flex items-start gap-2 border-t border-hairline pt-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          <PlugZap className="mt-px size-4 shrink-0 text-[var(--signal)]" strokeWidth={2} />
          Approved changes land in the place you have open in Roblox Studio.
        </p>
      </section>
    </aside>
  );
}

/**
 * Four claims the product can be held to, seated along the base of the plate.
 *
 * Every one of them names a mechanism that exists: the blueprint pass, the
 * Luau validator, the changeset review, and undo. Nothing here is a number,
 * a count of users, or a state this page cannot know.
 */
const CLAIMS = [
  "Plans before it writes",
  "Validates its own Luau",
  "Every change is a changeset you approve",
  "Undo is one press",
];

export function PromiseRail() {
  return (
    <ul className="mount land flex flex-col flex-wrap gap-2 rounded-xl px-5 py-3.5 sm:flex-row sm:items-center sm:justify-center sm:gap-x-7 [--i:4]">
      {CLAIMS.map((claim) => (
        <li
          key={claim}
          className="flex items-start gap-2 font-mono text-[0.6875rem] uppercase leading-[1.35] tracking-[0.11em] text-muted-foreground"
        >
          <span
            aria-hidden
            className="mt-[0.3125rem] size-1.5 shrink-0 rounded-[2px] bg-[var(--ember)]"
          />
          {claim}
        </li>
      ))}
    </ul>
  );
}
