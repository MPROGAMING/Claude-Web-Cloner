import { Tooltip, TooltipTrigger, TooltipContent, Button } from "blockwright";
import { RefreshCw, Trash2, Plug } from "lucide-react";

// Tooltips normally appear on hover, which a static capture cannot trigger — the
// root is held open so the popup is in the shot. TooltipProvider is supplied by
// the shared preview provider, so there is none here.
export const OnAnIconButton = () => (
  <div className="flex h-40 items-center justify-center">
    <Tooltip open>
      <TooltipTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label="Refresh connection status">
            <RefreshCw />
          </Button>
        }
      />
      <TooltipContent side="top">Refresh connection status</TooltipContent>
    </Tooltip>
  </div>
);

export const Sides = () => (
  <div className="grid h-64 place-items-center gap-10 sm:grid-cols-2">
    <Tooltip open>
      <TooltipTrigger render={<Button size="sm" variant="outline">Top</Button>} />
      <TooltipContent side="top">Applies to the paired place</TooltipContent>
    </Tooltip>
    <Tooltip open>
      <TooltipTrigger render={<Button size="sm" variant="outline">Bottom</Button>} />
      <TooltipContent side="bottom">Applies to the paired place</TooltipContent>
    </Tooltip>
  </div>
);

export const OnADestructiveAction = () => (
  <div className="flex h-40 items-center justify-center">
    <Tooltip open>
      <TooltipTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label="Delete project">
            <Trash2 />
          </Button>
        }
      />
      <TooltipContent side="top">Delete project — cannot be undone</TooltipContent>
    </Tooltip>
  </div>
);

export const LongerCopy = () => (
  <div className="flex h-40 items-center justify-center">
    <Tooltip open>
      <TooltipTrigger
        render={
          <Button size="icon-sm" variant="outline" aria-label="Studio pairing">
            <Plug />
          </Button>
        }
      />
      <TooltipContent side="top">
        Blockwright talks to Roblox Studio through the Blockwright plugin. Install
        it once per machine.
      </TooltipContent>
    </Tooltip>
  </div>
);
