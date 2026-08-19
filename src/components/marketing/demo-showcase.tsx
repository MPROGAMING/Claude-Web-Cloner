import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Real Roblox places, captured from Roblox Studio.
 *
 * These are genuine renders — a place built in Studio and captured with
 * Studio's own screenshot tool, at 1594x757, then compressed for the web.
 * Nothing here is concept art, a mockup, or another studio's game.
 *
 * The captions are deliberately careful about causation. This scene was authored
 * directly in Studio to demonstrate the target quality; it was NOT produced by
 * running a prompt through the agent, so it does not claim to have been. When an
 * end-to-end agent run produces a place, that one gets the prompt caption and
 * this note goes away.
 */

const SHOTS = [
  {
    src: "/demos/hero-corridor.jpg",
    alt: "A dark hotel corridor in Roblox, lit by warm wall sconces, with numbered doors and scattered crates",
    title: "Hotel corridor",
    note: "Wall sconces, numbered doors, dust in the light",
    span: "sm:col-span-3 sm:row-span-2",
    priority: true,
  },
  {
    src: "/demos/corridor-detail.jpg",
    alt: "Close view of a wooden wardrobe and an iron-banded crate in a dark Roblox corridor",
    title: "Props, close up",
    note: "Wardrobe and crate generated as 3D meshes, then placed and lit",
    span: "sm:col-span-2",
    priority: false,
  },
];

export function DemoShowcase({ className }: { className?: string }) {
  return (
    <section className={cn("relative border-t border-border", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-studs opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />

      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--ember)]">
            <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--ember)]" />
            Real Roblox
          </span>
          <h2 className="mt-3 text-[1.75rem] font-bold leading-[1.03] tracking-[-0.03em] sm:text-[2.5rem]">
            This is a place, not a mockup.
          </h2>
          <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground">
            Captured straight out of Roblox Studio. The lighting, the fog, the
            props — all of it lives in a real place file you can open and keep
            building.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-5">
          {SHOTS.map((shot) => (
            <figure
              key={shot.src}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-black",
                shot.span,
              )}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1594}
                height={757}
                priority={shot.priority}
                sizes="(max-width: 640px) 100vw, 60vw"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-4 pb-3.5 pt-12">
                <p className="text-[0.9375rem] font-semibold text-white">{shot.title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-white/70">{shot.note}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-4 text-[0.75rem] leading-relaxed text-muted-foreground">
          Captured in Roblox Studio for this demo. The wardrobe and crate were
          generated as 3D meshes from a text description; the corridor, lighting
          and atmosphere were built in the place.
        </p>
      </div>
    </section>
  );
}
