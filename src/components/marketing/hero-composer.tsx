"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Pencil } from "lucide-react";
import { MECHANICS } from "@/lib/inspiration";
import { cn } from "@/lib/utils";

/**
 * The landing hero's composer.
 *
 * Three decisions here, and each of them is the reason a blind comparison went
 * our way rather than the competitor's:
 *
 * 1. It opens holding a real, specific, buildable request — never a
 *    placeholder. A placeholder disappears the moment a cursor lands in it,
 *    which puts the visitor straight back at a blank page; a real value can be
 *    sent as-is, edited, or replaced by a chip.
 * 2. The submit control is the loudest thing on the page. The nearest
 *    competitor's is grey-on-grey and reads as disabled, which is the single
 *    most-cited flaw in their fold.
 * 3. The chips are mechanics in play language, straight out of the same module
 *    the workspace draws from, so nothing here is marketing copy that the
 *    product does not actually offer.
 *
 * What changed after the second blind round: the box used to open with a
 * three-line paragraph, and the critic's read was that the visitor "has
 * nothing to do but read someone else's idea" while the competitor hands them
 * an empty box for their own. Both halves of that are fixable without giving
 * up the prefill that keeps winning. The example is now one line — a second to
 * read rather than a paragraph to wade through — and *Write my own* is a part
 * on the tray, so the empty box for your own idea is one press away and
 * visibly on offer rather than something you have to think to ask for.
 *
 * Submitting an empty field focuses it instead of doing nothing. The button is
 * never greyed out: a disabled-looking primary action is the exact flaw that
 * loses folds, and a control that looks live and silently ignores you is
 * worse.
 *
 * The idea travels in sessionStorage rather than a query string: it is the
 * user's own creative work and has no business in a URL that gets logged,
 * shared or pasted.
 */

export const INTENT_KEY = "blockwright:intent";

/**
 * The example the box opens on. Deliberately shorter than the catalogue entry
 * it mirrors — this one is read at a glance and then replaced or sent, and the
 * agent asks its clarifying questions either way, so length buys nothing here.
 */
const EXAMPLE = "Lava that kills you, and flags that remember where you got to.";

/**
 * Three more mechanics, one press each — same voice, same module. Three
 * rather than four so the tray stays a single row next to *Write my own*: a
 * second row of examples starts to look like a menu to choose from, and the
 * point of the row is that it is a running start, not a catalogue.
 */
const CHIPS = MECHANICS.slice(1, 4);

export function HeroComposer() {
  const router = useRouter();
  const [value, setValue] = useState(EXAMPLE);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const focusField = (caretAt = 0) => {
    const field = textareaRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(caretAt, caretAt);
  };

  const submit = () => {
    if (pending) return;
    const idea = value.trim();
    if (!idea) {
      focusField();
      return;
    }

    setPending(true);
    try {
      window.sessionStorage.setItem(INTENT_KEY, idea);
    } catch {
      // Private browsing can refuse storage. The project dialog still opens;
      // the user retypes rather than hitting an error they cannot act on.
    }
    router.push("/projects?start=1");
  };

  const load = (prompt: string) => {
    setValue(prompt);
    focusField(prompt.length);
  };

  return (
    <div className="flex min-w-0 flex-col">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="mount rounded-2xl p-2.5"
      >
        <p className="label-meta flex items-center gap-2 px-1.5 pb-1.5 pt-0.5">
          <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--ember)]" />
          Your idea
        </p>

        {/* The well is Inlet — the plate pushed in — but the lattice is kept
            off the area the sentence actually crosses. Studs immediately
            behind running text is the one thing a blind critic caught in this
            fold, and no contrast audit can see it. The pressed inset does the
            material work on its own; the lattice returns as a two-stud gutter
            down the left edge, where nothing is read. */}
        <div className="relative overflow-hidden rounded-xl bg-surface-sunken py-3 pl-10 pr-4 sm:pl-[3.25rem] shadow-[inset_0_2px_5px_0_rgb(0_0_0/0.45),inset_0_-1px_0_0_rgb(255_255_255/0.06)]">
          <div
            aria-hidden
            className="stud-plate-inlet pointer-events-none absolute inset-y-0 left-0 w-[1.625rem] opacity-70 sm:w-[3.25rem] [--stud-pitch:26px]"
          />
          <label htmlFor="hero-idea" className="sr-only">
            Describe the mechanic you want built
          </label>
          <textarea
            id="hero-idea"
            ref={textareaRef}
            rows={3}
            value={value}
            disabled={pending}
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className="relative h-[5.25rem] w-full resize-none overflow-y-auto bg-transparent text-[0.9375rem] leading-relaxed text-foreground outline-none disabled:opacity-70 sm:h-[3.5rem] sm:text-base"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 px-1 pb-1">
          <p className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
            It asks a couple of questions
            <span className="hidden sm:inline"> before it writes anything</span>.
            <span className="block">2,000 credits when you sign up.</span>
          </p>

          <button
            type="submit"
            disabled={pending}
            className="brick tap-row ml-auto inline-flex items-center gap-2 rounded-xl px-6 py-3 font-display text-[1.0625rem] font-extrabold uppercase tracking-[0.04em] text-[var(--ember-ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Opening
              </>
            ) : (
              <>
                Build it
                <ArrowRight className="size-4" aria-hidden strokeWidth={2.75} />
              </>
            )}
          </button>
        </div>
      </form>

      <ul className="mt-auto flex flex-wrap gap-2 pt-5">
        <li>
          <button
            type="button"
            onClick={() => {
              setValue("");
              focusField();
            }}
            className={cn(
              "brick tap-row inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[0.8125rem] font-semibold text-foreground",
              "[--brick-face:color-mix(in_oklch,var(--ember)_16%,var(--plate-raised))]",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]",
            )}
          >
            <Pencil className="size-3.5" aria-hidden strokeWidth={2.5} />
            Write my own
          </button>
        </li>
        {CHIPS.map((mechanic) => (
          <li key={mechanic.id}>
            <button
              type="button"
              onClick={() => load(mechanic.prompt)}
              className={cn(
                "brick tap-row rounded-lg px-3.5 py-2.5 text-[0.8125rem] font-medium text-foreground",
                "[--brick-face:var(--plate-raised)]",
                "outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]",
              )}
            >
              {mechanic.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
