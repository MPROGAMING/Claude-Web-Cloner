import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  Button,
  StatusDot,
  Separator,
} from "blockwright";
import { Plug, Coins } from "lucide-react";

export const StudioConnection = () => (
  <div className="h-64">
    <Popover defaultOpen>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Plug data-icon="inline-start" />
            Studio
          </Button>
        }
      />
      <PopoverContent align="start" side="bottom">
        <PopoverHeader>
          <PopoverTitle>Studio connected</PopoverTitle>
          <PopoverDescription>
            Paired with Moshe&rsquo;s Mac two minutes ago.
          </PopoverDescription>
        </PopoverHeader>
        <Separator />
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <StatusDot tone="live" pulse />
          Bloxburg Tycoon · Start Place
        </div>
        <Button size="sm" variant="ghost">
          Disconnect
        </Button>
      </PopoverContent>
    </Popover>
  </div>
);

export const CreditsBalance = () => (
  <div className="h-64">
    <Popover defaultOpen>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm">
            <Coins data-icon="inline-start" />
            420
          </Button>
        }
      />
      <PopoverContent align="start" side="bottom">
        <PopoverHeader>
          <PopoverTitle>420 credits left</PopoverTitle>
          <PopoverDescription>
            About two more mechanics the size of a round timer.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <StatusDot tone="working" />
          1,580 used this month
        </div>
        <Button size="sm">Buy credits</Button>
      </PopoverContent>
    </Popover>
  </div>
);

export const PlainNote = () => (
  <div className="h-64">
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="ghost" size="sm">Why this model?</Button>} />
      <PopoverContent align="start" side="bottom">
        <PopoverDescription>
          Sonnet holds a strict schema across a long response, which the free
          router cannot — blueprints need that.
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  </div>
);
