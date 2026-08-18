import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Real Roblox, on the page — paired with the sentence that builds it.
 *
 * A game-creation product that only shows code and file trees asks people to
 * take the game part on faith. These are genuine Roblox renders of genuine
 * Creator Store models: Roblox's own render farm produced the images, and the
 * link on each card goes to the asset.
 *
 * Every candidate was checked by eye first. The Creator Store is heavily
 * keyword-spammed — a search for a low-poly tree pack returned a weapons pack,
 * and a "sci-fi space station" returned a stock avatar — so nothing is used
 * because its filename sounded right.
 *
 * The honest framing lives in the heading, once, rather than in a disclaimer
 * paragraph underneath: the models are Roblox's, the game around them is what
 * Blockwright writes.
 */

const PIECES = [
  {
    src: "/roblox/546011181.png",
    assetId: 546011181,
    prompt: "Make a castle siege where two teams fight over the courtyard.",
    /**
     * Per-asset framing. The two renders compose their subjects very
     * differently inside an identical 420-square canvas, so a single shared
     * treatment leaves one zoomed and the other letterboxed. Scaling each to
     * fill and nudging the focal point is what makes the pair read as one set.
     */
    /** Focal point for the cover crop, chosen so the subject stays centred. */
    offset: "object-[50%_52%]",
  },
  {
    src: "/roblox/128871661974159.png",
    assetId: 128871661974159,
    prompt: "Make a tower defence where you buy walls and towers between waves.",
    offset: "object-[50%_44%]",
  },
  {
    src: "/roblox/87055610558102.png",
    assetId: 87055610558102,
    prompt: "Make a zombie survival where you barricade a house between waves.",
    // A rigged character, not a building: the page needed someone in it. The
    // focal point sits high because a full-body rig in a wide card crops
    // vertically, and the face is the part worth keeping.
    offset: "object-[50%_14%]",
  },
];

/**
 * The hero pair: real Roblox, above the fold, each card carrying the sentence
 * that would build it.
 *
 * This is the one composition that explains the product without a paragraph —
 * a creator sees the thing they recognise and the thing they would type, next
 * to each other, before scrolling.
 */
export function RobloxHeroPair({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {PIECES.map((piece) => (
        <figure
          key={piece.assetId}
          className="group relative overflow-hidden rounded-2xl border border-border bg-[#4a6ea6]"
        >
          <div className="relative h-44 overflow-hidden sm:h-56">
            <Image
              src={piece.src}
              alt="A Roblox model, rendered by Roblox"
              width={420}
              height={420}
              priority
              /**
               * `object-cover`, not `object-contain` with a scale. Scaling the
               * element made the image box larger than its container, so the
               * picture overflowed and was clipped on all four sides — tower
               * tops sheared flat by the card edge. Cover fills the frame by
               * cropping the source, which is what a crop is supposed to do.
               */
              className={cn("h-full w-full object-cover", piece.offset)}
            />
          </div>

          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 via-black/60 to-transparent px-3.5 pb-3 pt-10 text-left">
            <p className="text-[0.8125rem] font-medium leading-snug text-white">
              &ldquo;{piece.prompt}&rdquo;
            </p>
            {/* Attribution sits on the card itself rather than in a disclaimer
                paragraph: the model is Roblox's, the game around it is ours. */}
            <a
              href={`https://create.roblox.com/store/asset/${piece.assetId}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1.5 inline-block font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-white/45 transition-colors hover:text-white/85 focus-ember"
            >
              Roblox Creator Store model
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
