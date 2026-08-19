import { TemplateStrip } from "blockwright";

// The first eight starter templates, read straight from src/lib/templates.ts:
// genre art, the category chip mixed toward the page ink, a sparkle on the
// featured ones, and the whole card linking into sign-up. className is the only
// prop, so this is the section exactly as `/` ships it.
//
// The four-across layout only turns on at lg; the card is captured at 900px, so
// sm:grid-cols-4 restores the desktop row rather than letting eight cards run
// off the bottom in two columns.
export const EightTemplates = () => <TemplateStrip className="sm:grid-cols-4" />;
