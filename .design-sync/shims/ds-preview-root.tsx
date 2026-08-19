// The preview/design wrapper for this DS, exposed to the bundle via
// cfg.extraEntries and named in cfg.provider.
//
// Two things the app's own root does that a bare preview card does not:
//
//   1. `.dark`. src/components/theme-provider.tsx sets defaultTheme="dark", so
//      dark IS Blockwright's appearance — and globals.css builds its dark
//      variant as `&:is(.dark *)`, which needs a real `.dark` ancestor in the
//      DOM. Without one every card renders the light palette, and every design
//      the agent builds off these cards is on-brand only by accident. The
//      wrapper also paints bg-background/text-foreground itself, because those
//      tokens are redefined under `.dark` and the card's own body is outside it.
//
//   2. TooltipProvider. src/app/layout.tsx wraps the whole tree in it, and
//      Base UI's Tooltip parts throw outside their provider.
import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function DsPreviewRoot({ children }: { children?: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      {/*
        p-6 is the page gutter. Without it every card renders flush to x=0 and
        left-aligned content clips — a left-aligned SectionHeading lost the stem
        of its first letter. In the app that gutter comes from Section's
        `px-5 sm:px-8`, which a card rendering one component never gets.
      */}
      <div className="dark bg-background text-foreground font-sans p-6">{children}</div>
    </TooltipProvider>
  );
}
