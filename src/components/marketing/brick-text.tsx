import { cn } from "@/lib/utils";

/**
 * A run of display type moulded out of the same material as the plate.
 *
 * The extruded side wall is painted by a `::before` that reads `data-text`, so
 * the string has to reach CSS as an attribute as well as a text node. Keeping
 * that in one component is the only way the two never drift — a headline whose
 * face says one thing and whose shadow says another is the kind of bug that
 * only shows up in a screenshot.
 *
 * `children` is a string rather than ReactNode for the same reason: there is
 * no `attr()` for a subtree.
 */
export function BrickText({
  children,
  tone = "cream",
  className,
}: {
  children: string;
  tone?: "cream" | "ember";
  className?: string;
}) {
  return (
    <span
      data-text={children}
      className={cn("brick-type", tone === "ember" && "brick-type--ember", className)}
    >
      <span className="brick-type__face">{children}</span>
    </span>
  );
}
