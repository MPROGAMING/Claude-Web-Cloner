import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "blockwright";
import {
  Archive,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

export const ProjectActions = () => (
  <div className="h-80 max-w-sm">
    <div className="flex items-start justify-between gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-0">
        <p className="truncate text-[0.9375rem] font-semibold">Bloxburg Tycoon</p>
        <p className="text-xs text-muted-foreground">Synced to Studio 4 minutes ago</p>
      </div>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Actions for Bloxburg Tycoon"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
            >
              <MoreHorizontal />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56 min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <ExternalLink />
              Open in Studio
              <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Archive />
              Archive
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

export const GroupedSections = () => (
  <div className="h-80">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[0.8125rem] font-medium"
          >
            Change set 12
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Review</DropdownMenuLabel>
          <DropdownMenuItem>
            View diff
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>Apply to Studio</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>History</DropdownMenuLabel>
          <DropdownMenuItem>Undo last apply</DropdownMenuItem>
          <DropdownMenuItem disabled>Redo</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const WithSubmenu = () => (
  <div className="h-80">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Project menu"
            className="flex size-8 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground"
          >
            <MoreHorizontal />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56 min-w-56">
        <DropdownMenuItem>
          <ExternalLink />
          Open in Studio
        </DropdownMenuItem>
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger>
            <Download />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Rojo project</DropdownMenuItem>
            <DropdownMenuItem>Place file (.rbxlx)</DropdownMenuItem>
            <DropdownMenuItem>Model (.rbxmx)</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2 />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
