import { cn } from "@/lib/utils";

/**
 * The shape of the Studio handshake: six characters, pressed into the plate.
 *
 * These letters illustrate the mechanism the surrounding copy describes. The
 * page has no Studio session and claims none — a real code only exists once a
 * signed-in project asks for one — so this is drawn as a form factor, marked
 * `aria-hidden`, and never presented as something to type.
 *
 * It lives in one component because the hero receipt and the bridge section
 * both show it, and two illustrative codes on one page reads as two products.
 */
const CHARACTERS = ["B", "4", "K", "2", "Q", "7"];

export function PairingShape({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <ul aria-hidden className={cn("flex gap-1", className)}>
      {CHARACTERS.map((character, index) => (
        <li
          key={index}
          className={cn(
            "flex items-center justify-center rounded-[0.3rem] bg-surface-sunken font-mono font-semibold text-[var(--signal)] shadow-[inset_0_1px_0_0_rgb(0_0_0/0.5),inset_0_-1px_0_0_rgb(255_255_255/0.08)]",
            size === "sm" ? "size-[1.35rem] text-[0.6875rem]" : "size-7 text-[0.8125rem]",
          )}
        >
          {character}
        </li>
      ))}
    </ul>
  );
}
