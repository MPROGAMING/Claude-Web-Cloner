"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";

/**
 * The landing hero's prompt box.
 *
 * The product's core action belongs in the hero, not two clicks behind a
 * marketing button. Typing an idea here carries it through sign-up into a real
 * project and seeds the first message, so the first thing a visitor does is the
 * thing the product is for.
 *
 * The idea is held in sessionStorage rather than a query string: it is the
 * user's own creative work, and it has no business sitting in a URL that gets
 * logged, shared or pasted.
 */

export const INTENT_KEY = "blockwright:intent";

/** Real Roblox mechanics, phrased the way a creator would ask for them. */
const EXAMPLES = [
  "a round-based zombie survival with a safe lobby between waves",
  "a tycoon where players buy droppers and upgrade a conveyor",
  "a farming game where crops grow on a timer and sell for coins",
  "a sword fighting arena with server-authoritative damage",
  "an obby with checkpoints, coins and a shop for trails",
  "a horror map where the lights fail and a monster hunts you",
];

export function HeroComposer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A rotating example is a hint, not a claim — nothing here reports state that
  // does not exist. It stops while the user is typing.
  useEffect(() => {
    if (value) return;
    const timer = window.setInterval(() => {
      setExampleIndex((index) => (index + 1) % EXAMPLES.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [value]);

  const submit = () => {
    const idea = value.trim();
    if (!idea || pending) return;

    setPending(true);
    try {
      window.sessionStorage.setItem(INTENT_KEY, idea);
    } catch {
      // Private browsing can refuse storage. The project dialog still opens; the
      // user simply retypes rather than hitting an error they cannot act on.
    }
    router.push("/projects?start=1");
  };

  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  };

  return (
    <div className="mx-auto mt-9 w-full max-w-2xl">
      <div className="group relative rounded-2xl border border-border bg-surface/80 shadow-[var(--shadow-raised)] backdrop-blur transition-colors focus-within:border-[var(--ember)]/55 focus-within:shadow-[0_0_0_4px_var(--ember-soft),var(--shadow-raised)]">
        <label htmlFor="hero-idea" className="sr-only">
          Describe the Roblox game you want to build
        </label>

        <textarea
          id="hero-idea"
          ref={textareaRef}
          rows={2}
          value={value}
          disabled={pending}
          placeholder={`Make ${EXAMPLES[exampleIndex]}…`}
          onChange={(event) => {
            setValue(event.target.value);
            grow(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none bg-transparent px-5 pb-14 pt-5 text-left text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60 sm:text-base"
        />

        <div className="absolute inset-x-3 bottom-3 flex items-center gap-3">
          <span className="hidden font-mono text-[0.6875rem] text-muted-foreground/70 sm:inline">
            Enter to start · Shift + Enter for a new line
          </span>

          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || pending}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-[0.8125rem] font-medium text-background transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-ember"
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Opening
              </>
            ) : (
              <>
                Start building
                <ArrowUp className="size-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-[0.6875rem] text-muted-foreground">
        2,000 credits on signup · no card required
      </p>
    </div>
  );
}
