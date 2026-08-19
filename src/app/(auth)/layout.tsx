import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PromiseRail, WorkshopWall } from "@/components/auth/workshop-wall";

/**
 * The door to the workshop.
 *
 * The competitor stands its sign-in button beside a full-height wall of real
 * game art. We have none and will not invent any, so the door is built out of
 * the material instead: the same plate the landing hero stands on, with the
 * form mounted onto it as a part and the wall beside it carrying moulded
 * display type plus two true artifacts.
 *
 * The plate is a mounted object rather than a full-bleed background, and it
 * starts below the header for the same reason the hero's does: the plate holds
 * one colour in both themes, and the nav above it keeps the page's own tokens.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* Sky. Warm light from above the plate, the way the material is lit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(120%_60%_at_50%_-10%,color-mix(in_oklch,var(--ember)_28%,transparent),transparent_66%)]"
      />

      <header className="relative flex h-16 shrink-0 items-center px-4 sm:px-7">
        <Link
          href="/"
          className="flex items-center rounded-md pointer-coarse:min-h-11 focus-ember"
          aria-label="Blockwright home"
        >
          <Logo />
        </Link>
      </header>

      <main className="relative flex flex-1 px-3 pb-5 sm:px-6 sm:pb-8">
        <div className="plate relative flex w-full overflow-hidden rounded-[1.5rem] px-5 py-8 sm:rounded-[1.75rem] sm:px-8 sm:py-10 lg:px-10">
          {/* The lattice rides its own layer, dialled back until it is a
              surface you notice second rather than pattern that competes with
              the part mounted on it. */}
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.34] [--stud-pitch:38px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.075),transparent_34%,rgb(0_0_0/0.16))]"
          />

          <div className="relative m-auto w-full max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,24.5rem)_minmax(0,1fr)] lg:gap-14">
              <div className="mx-auto w-full max-w-[24.5rem] lg:mx-0">{children}</div>
              <WorkshopWall />
            </div>
            <div className="mt-7">
              <PromiseRail />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
