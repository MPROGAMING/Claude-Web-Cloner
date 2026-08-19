import { Skeleton } from "blockwright";

// Skeleton is only ever the silhouette of something real, so each cell traces a
// surface the product actually loads. Radii follow the thing being stood in
// for — `rounded-xl` for cards, `rounded-md` (the default) for text lines.
export const ProjectCard = () => (
  <div className="max-w-xs rounded-xl border border-border bg-surface p-5">
    <div className="flex items-start justify-between gap-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="size-4 rounded-md" />
    </div>
    <Skeleton className="mt-3 h-3 w-full" />
    <Skeleton className="mt-2 h-3 w-32" />
    <div className="mt-5 flex items-center gap-2">
      <Skeleton className="size-2 rounded-full" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="ml-auto h-5 w-16 rounded-4xl" />
    </div>
  </div>
);

// Ported from src/app/(app)/loading.tsx — the dashboard's own loading state:
// heading, subhead, a row of stat tiles, then the project grid.
export const DashboardLoading = () => (
  <div className="w-full">
    <Skeleton className="h-8 w-56" />
    <Skeleton className="mt-3 h-4 w-96 max-w-full" />

    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-20 rounded-xl" />
      ))}
    </div>

    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Skeleton key={index} className="h-40 rounded-xl" />
      ))}
    </div>
  </div>
);

// An assistant turn is full width with no bubble (docs/DESIGN_SYSTEM.md
// § Messages), so its placeholder is bare lines rather than a panel.
export const AssistantMessage = () => (
  <div className="max-w-lg">
    <div className="flex items-center gap-2">
      <Skeleton className="size-5 rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="mt-3 space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-72" />
      <Skeleton className="h-3 w-40" />
    </div>
    <Skeleton className="mt-4 h-24 w-full rounded-lg" />
  </div>
);

export const FileList = () => (
  <div className="max-w-xs rounded-xl border border-border bg-surface p-3">
    <Skeleton className="ml-2 h-3 w-24" />
    <div className="mt-3 space-y-1">
      {["w-40", "w-32", "w-44", "w-24", "w-32"].map((width, index) => (
        <div key={index} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-3.5 rounded-sm" />
          <Skeleton className={`h-3 ${width}`} />
        </div>
      ))}
    </div>
  </div>
);
