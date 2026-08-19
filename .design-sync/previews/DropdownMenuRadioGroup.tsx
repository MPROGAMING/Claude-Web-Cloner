import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "blockwright";
import { SlidersHorizontal } from "lucide-react";

// The one-of-many section of the workspace view menu. Held open so the marked
// item is in the capture.
export const ViewDensity = () => (
  <div className="h-80">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="View options"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] font-medium"
          >
            <SlidersHorizontal className="size-3.5" />
            View
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56 min-w-56">
        <DropdownMenuLabel>Diff density</DropdownMenuLabel>
        <DropdownMenuRadioGroup defaultValue="changed">
          <DropdownMenuRadioItem value="changed">Changed lines only</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="context">With 3 lines context</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="full">Whole file</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const SortOrder = () => (
  <div className="h-80">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] font-medium"
          >
            Sort: Last synced
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56 min-w-56">
        <DropdownMenuLabel>Sort projects by</DropdownMenuLabel>
        <DropdownMenuRadioGroup defaultValue="synced">
          <DropdownMenuRadioItem value="synced">Last synced</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="created">Date created</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

// Radios and checkboxes in one menu — the shape the workspace view menu ships in.
export const AlongsideCheckboxes = () => (
  <div className="h-80">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="View options"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] font-medium"
          >
            <SlidersHorizontal className="size-3.5" />
            View
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56 min-w-56">
        <DropdownMenuLabel>Diff density</DropdownMenuLabel>
        <DropdownMenuRadioGroup defaultValue="context">
          <DropdownMenuRadioItem value="changed">Changed lines only</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="context">With 3 lines context</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked>Line numbers</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked>Validation warnings</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Whitespace</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
