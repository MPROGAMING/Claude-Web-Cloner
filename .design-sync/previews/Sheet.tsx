import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  Button,
  Input,
  Label,
  Switch,
  StatusDot,
  Separator,
} from "blockwright";
import { Settings2 } from "lucide-react";

// SheetContent is `fixed`, and Sheet exports no Portal part to redirect it into
// the card — so these render against the viewport. cfg.overrides.Sheet pins the
// card to a single story for that reason.
export const ProjectSettings = () => (
  <Sheet defaultOpen>
    <SheetTrigger
      render={
        <Button variant="outline" size="sm">
          <Settings2 data-icon="inline-start" />
          Project settings
        </Button>
      }
    />
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>Project settings</SheetTitle>
        <SheetDescription>
          Bloxburg Tycoon — these apply to every change set in this project.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-sheet-name">Name</Label>
          <Input id="ds-sheet-name" defaultValue="Bloxburg Tycoon" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-sheet-place">Place ID</Label>
          <Input id="ds-sheet-place" defaultValue="7291043118" />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ds-sheet-auto">Apply change sets automatically</Label>
          <Switch id="ds-sheet-auto" />
        </div>
        <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <StatusDot tone="live" />
          Studio connected
        </div>
      </div>
      <SheetFooter>
        <SheetClose render={<Button variant="outline">Cancel</Button>} />
        <Button>Save changes</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

export const FromTheLeft = () => (
  <Sheet defaultOpen>
    <SheetTrigger render={<Button variant="ghost" size="sm">Files</Button>} />
    <SheetContent side="left">
      <SheetHeader>
        <SheetTitle>Project files</SheetTitle>
        <SheetDescription>9 Luau scripts in this project.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-1 px-4 font-mono text-xs text-muted-foreground">
        <span>ServerScriptService/RoundTimer.server.luau</span>
        <span>ServerScriptService/ShopService.server.luau</span>
        <span>ReplicatedStorage/Remotes.luau</span>
        <span>ReplicatedStorage/Config.luau</span>
        <span>StarterPlayerScripts/ShopUI.client.luau</span>
      </div>
    </SheetContent>
  </Sheet>
);

export const FromTheBottom = () => (
  <Sheet defaultOpen>
    <SheetTrigger render={<Button variant="ghost" size="sm">Credits</Button>} />
    <SheetContent side="bottom">
      <SheetHeader>
        <SheetTitle>You are low on credits</SheetTitle>
        <SheetDescription>
          420 credits left — roughly two more mechanics at this size.
        </SheetDescription>
      </SheetHeader>
      <SheetFooter>
        <SheetClose render={<Button variant="outline">Not now</Button>} />
        <Button>Buy credits</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
