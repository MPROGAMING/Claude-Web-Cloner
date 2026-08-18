"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts to its new value instead of snapping.
 *
 * Used for the credit balance, where a jump after a generation reads as a
 * glitch but a short count reads as "that just cost you something". Skipped
 * entirely under reduced-motion, and on first render — the initial value
 * should be correct immediately, not animate up from zero on every page load.
 */
export function AnimatedNumber({
  value,
  duration = 600,
  format = (v: number) => Math.round(v).toLocaleString("en-US"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (from === value) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast then settling, matching --ease-enter.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return (
    <span className={className} suppressHydrationWarning>
      {format(display)}
    </span>
  );
}
