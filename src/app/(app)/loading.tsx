import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape the app actually resolves into: a bench plate first, parts after.
 * A skeleton that predicts the wrong layout costs more than no skeleton at
 * all — the page appears to jump when the real content lands.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 md:px-8 md:py-9">
      <div className="plate relative overflow-hidden rounded-[1.5rem] px-4 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="stud-plate pointer-events-none absolute inset-0 opacity-[0.36] [--stud-pitch:38px]"
        />
        <div className="relative">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="mt-5 h-12 w-[22rem] max-w-full rounded-lg" />
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
            <Skeleton className="h-[13rem] rounded-2xl" />
            <Skeleton className="h-[13rem] rounded-2xl" />
          </div>
        </div>
      </div>

      <Skeleton className="mt-9 h-4 w-36" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
