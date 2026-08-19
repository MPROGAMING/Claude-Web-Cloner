import { cn } from "@/lib/utils";

/**
 * A plate, moulded once.
 *
 * The hero and the Studio bridge are both physical objects photographed on the
 * page, and the only way they read as the same material is if the lattice, the
 * opacity it is dialled to, and the single overhead light are written down in
 * one place. Two hand-built plates drift within a week.
 *
 * The studs ride at 38px and 38% because a full-strength 30px lattice is louder
 * than anything mounted on it: the ground has to read as a surface, not as
 * pattern.
 *
 * The band also decides what a mounted part is *made of*. `.plate` maps
 * `--surface` to `--plate-raised`, which is the brick tone one step lighter —
 * so a panel on a plate was the same warm hue as the plate, and a blind critic
 * called the result "one brown value… everything sinks into the mud". A
 * moulded part is a different material from the brick it sits on, so the
 * remap pulls panels toward the near-neutral `--plate-deep`: dark ABS on warm
 * terracotta, two materials rather than one hue at two lightnesses.
 *
 * It is applied to a descendant of `.plate` rather than the plate element
 * itself on purpose. `.plate`, `.mount` and `.brick` live outside every
 * cascade layer, so an unlayered rule beats any Tailwind utility on the same
 * element no matter what it says; setting the custom property one level down
 * sidesteps the fight entirely, because inheritance has no specificity.
 */
const TONE = [
  // Panels: dark moulded part.
  "[--surface:color-mix(in_oklch,var(--plate-deep)_72%,var(--plate-raised))]",
  // One step proud of a panel, for anything that needs to sit on top of one.
  "[--surface-raised:color-mix(in_oklch,var(--plate-deep)_56%,var(--plate-raised))]",
].join(" ");
export function PlateBand({
  className,
  children,
}: {
  /** Padding for the band. The lattice is fixed; the geometry is not. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "plate relative overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem]",
        className,
      )}
    >
      <div
        aria-hidden
        className="stud-plate pointer-events-none absolute inset-0 opacity-[0.38] [--stud-pitch:38px]"
      />
      {/* One light source, from above. The plate catches it at the top and
          falls away at the bottom, which is what stops a large flat panel from
          reading as a rectangle of paint. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.075),transparent_34%,rgb(0_0_0/0.16))]"
      />
      <div className={cn("relative", TONE)}>{children}</div>
    </div>
  );
}
