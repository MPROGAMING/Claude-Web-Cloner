import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Real Roblox places, above the fold.
 *
 * These replaced three Creator Store asset renders — a wall, some towers and a
 * standing zombie on a flat blue skybox, which the page itself had to label
 * "Roblox Creator Store model". A catalogue thumbnail is not a game, and
 * captioning it honestly only made the problem legible. These are places:
 * built in Studio, captured with Studio's own screenshot tool, compressed for
 * the web and nothing else.
 *
 * The captions describe what the scene is, not where it came from, because
 * neither was produced by running a prompt through the agent. That caption is
 * reserved for a place an end-to-end run actually builds.
 */

const PLACES = [
  {
    src: "/demos/hero-corridor.jpg",
    alt: "A dark hotel corridor in Roblox lit by warm wall sconces, with numbered doors and wooden crates",
    title: "Horror",
    line: "Sconce-lit corridor, numbered doors, dust in the air",
    /**
     * Focal point for the cover crop.
     *
     * This scene was relit brighter once, after a review called it too dark to
     * read at thumbnail size. Brightening it flattened the whole frame into one
     * amber field — the sconces stopped reading as light sources because there
     * was no shadow left for them to be brighter than. The original is back:
     * dark is the point, and pairing it with the daylit island scene beside it
     * gives the row the contrast that a single dim image was missing.
     */
    offset: "object-[50%_46%]",
  },
  {
    src: "/demos/islands.jpg",
    alt: "Bright floating grass islands in Roblox with an open treasure chest spilling gold",
    title: "Adventure",
    line: "Floating islands, terrain grass, a chest worth crossing for",
    offset: "object-[50%_54%]",
  },
];

export function RobloxHeroPair({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {PLACES.map((place) => (
        <figure
          key={place.src}
          className="group relative overflow-hidden rounded-2xl border border-border bg-black"
        >
          <div className="relative h-48 overflow-hidden sm:h-60">
            <Image
              src={place.src}
              alt={place.alt}
              width={1600}
              height={760}
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className={cn(
                "h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100",
                place.offset,
              )}
            />
          </div>

          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-4 pb-3 pt-12 text-left">
            <p className="text-[0.9375rem] font-semibold text-white">{place.title}</p>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-white/75">{place.line}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
