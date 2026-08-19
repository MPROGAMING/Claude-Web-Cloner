"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { mechanicsFor } from "@/lib/inspiration";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { cn } from "@/lib/utils";

/**
 * The bench.
 *
 * The dashboard used to open on three stat tiles, which answer a question
 * nobody arrives with. This opens on the thing they came to do, already
 * holding a real, specific, buildable sentence — a prefilled value rather than
 * a placeholder, because a placeholder evaporates the moment a cursor lands in
 * it and puts the person straight back at a blank page.
 *
 * The chips are mechanics in play language straight out of `lib/inspiration`,
 * so nothing offered here is copy the product cannot actually build. The one
 * currently loaded is held *pressed* — Inlet is the pressed half of the same
 * lattice, and the material gets to carry the state instead of a tint.
 *
 * Pressing Build it mounts the real project dialog with the sentence already
 * in it. Mounting at press time rather than keeping it alive is deliberate:
 * the dialog reads the idea once, lazily, which is what keeps it out of an
 * effect the React Compiler would reject.
 */
export function BenchComposer({ seed }: { seed: string }) {
  const mechanics = mechanicsFor(seed);
  const [value, setValue] = useState(mechanics[0].prompt);
  const [loaded, setLoaded] = useState(mechanics[0].id);
  const [launching, setLaunching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = (id: string, prompt: string) => {
    setValue(prompt);
    setLoaded(id);
    const field = textareaRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(prompt.length, prompt.length);
  };

  const submit = () => {
    if (!value.trim() || launching) return;
    setLaunching(true);
  };

  return (
    <div className="min-w-0">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="mount rounded-2xl p-2.5 sm:p-3"
      >
        <div className="relative overflow-hidden rounded-xl bg-surface-sunken px-4 py-3 shadow-[inset_0_2px_5px_0_rgb(0_0_0/0.45),inset_0_-1px_0_0_rgb(255_255_255/0.06)]">
          <div
            aria-hidden
            className="stud-plate-inlet pointer-events-none absolute inset-0 opacity-40 [--stud-pitch:26px]"
          />
          <label htmlFor="bench-idea" className="sr-only">
            Describe the mechanic you want built
          </label>
          <textarea
            id="bench-idea"
            ref={textareaRef}
            rows={3}
            value={value}
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className="relative h-[7rem] w-full resize-none overflow-y-auto bg-transparent text-[0.9375rem] leading-relaxed text-foreground outline-none sm:h-[5.5rem] sm:text-base"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 px-1 pb-1">
          <p className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
            It plans before it writes.
            <span className="block">Every change is a diff you approve.</span>
          </p>

          <button
            type="submit"
            className="brick tap-row ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-3 font-display text-[1rem] font-extrabold uppercase tracking-[0.04em] text-[var(--ember-ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)] sm:px-6 sm:text-[1.0625rem]"
          >
            Build it
            <ArrowRight className="size-4" aria-hidden strokeWidth={2.75} />
          </button>
        </div>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {mechanics.map((mechanic) => {
          const isLoaded = mechanic.id === loaded;
          return (
            <li key={mechanic.id}>
              <button
                type="button"
                aria-pressed={isLoaded}
                data-pressed={isLoaded ? "true" : undefined}
                onClick={() => load(mechanic.id, mechanic.prompt)}
                className={cn(
                  "brick tap-row rounded-lg px-3.5 py-2.5 text-[0.8125rem] font-medium text-foreground",
                  // A shallower part than the CTA: the travel still has to be
                  // visible, but a 5px drop on a chip reads as a misaligned row.
                  "[--brick-face:var(--surface)] [--lift:3px]",
                  "outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]",
                )}
              >
                {mechanic.label}
              </button>
            </li>
          );
        })}
      </ul>

      {launching && (
        <NewProjectDialog defaultOpen idea={value} onDismiss={() => setLaunching(false)} />
      )}
    </div>
  );
}
