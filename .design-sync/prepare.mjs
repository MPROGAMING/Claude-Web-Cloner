// Pre-converter prep for this repo. Emits the two inputs design-sync needs and
// a Next.js app doesn't ship:
//
//   1. ds-tailwind.css — src/app/globals.css is a Tailwind *source* file
//      (`@import "tailwindcss"`), not a compiled sheet. Shipping it raw leaves
//      every component unstyled. The `--font-*` variables it reads are injected
//      by next/font in src/app/layout.tsx, so FONT_SETUP below has to restate
//      them: without it `--font-sans: var(--font-figtree)` resolves to nothing
//      and every card renders in a browser default face.
//
//   2. ds-entry.mjs — the barrel that stands in for a published dist/ entry.
//      Passing it as --entry is also what puts PKG_DIR at the repo root; with
//      no --entry the converter looks for node_modules/blockwright.
//
// Utility coverage in the CSS is what Tailwind finds in this repo's source, plus
// the authored previews, plus the SAFELIST floor below. See .design-sync/NOTES.md.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// Families + axes mirror the next/font/google calls in src/app/layout.tsx.
const FONT_SETUP = `@import url("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Figtree:wght@300..900&family=Geist+Mono:wght@100..900&display=swap");
:root {
  --font-archivo: "Archivo", "Figtree", ui-sans-serif, system-ui, sans-serif;
  --font-figtree: "Figtree", ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}
`;

const CACHE = resolve('.design-sync/.cache');
mkdirSync(CACHE, { recursive: true });

// ── 1. stylesheet ──────────────────────────────────────────────────────────
// Compiled through a generated wrapper rather than globals.css directly, for one
// reason: Tailwind v4's automatic source detection skips hidden directories, so
// it never sees `.design-sync/previews/`. A preview using any utility the app's
// own source does not already use would then render unstyled — silently, with no
// warning anywhere. The explicit @source lines are what make authored previews
// first-class template sources.
// A layout/typography floor, generated whether or not anything references it.
// Two jobs. (a) Preview authors — including parallel subagents that cannot
// rebuild this sheet — can reach for an ordinary utility without it silently
// resolving to nothing. (b) The shipped sheet stops being "only what Blockwright
// happens to use today", which is the difference between a design agent being
// able to lay something out and not. Colours stay on the DS tokens on purpose:
// the point is to keep the palette closed while leaving layout open.
const SAFELIST = [
  'block hidden inline-flex flex grid relative absolute inset-0 shrink-0 grow truncate overflow-hidden',
  'flex-col flex-row flex-wrap flex-1',
  'items-{start,center,end,baseline,stretch}',
  'justify-{start,center,end,between,around}',
  '{gap,gap-x,gap-y}-{0,0.5,1,1.5,2,2.5,3,4,5,6,8,10,12,16}',
  '{p,px,py,pt,pr,pb,pl}-{0,0.5,1,1.5,2,2.5,3,4,5,6,8,10,12,16,20}',
  '{m,mx,my,mt,mr,mb,ml}-{0,1,2,3,4,5,6,8,10,12,16,auto}',
  '{w,h,size}-{full,auto,fit,px,3,4,5,6,8,10,12,16,20,24,32,40}',
  '{min-h,min-w}-{0,full,screen,fit}',
  'max-w-{none,full,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl}',
  'text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl}',
  'font-{normal,medium,semibold,bold}',
  'font-{sans,mono,display}',
  'leading-{none,tight,snug,normal,relaxed}',
  'text-{left,center,right}',
  'grid-cols-{1,2,3,4}',
  'border border-{0,2,4} border-{t,r,b,l}',
  'rounded-{none,sm,md,lg,xl,2xl,3xl,full}',
  'text-{foreground,muted-foreground,primary,primary-foreground,secondary-foreground,accent-foreground,card-foreground,destructive,ember,ember-ink,ember-text,signal,success,success-ink,warning,warning-ink,danger,danger-ink}',
  'bg-{background,card,popover,surface,surface-raised,surface-sunken,muted,accent,primary,secondary,destructive,ember,ember-soft,signal,success,warning,danger}',
  '{bg,border,text}-{ember,signal,success,warning,danger,primary,muted-foreground,foreground,border}/{5,10,15,20,25,30,35,40,50,60,70,80}',
  'border-{border,input,ring,ember,signal,success,warning,danger,transparent}',
  // Named in .design-sync/conventions.md, so they must exist in the shipped
  // sheet even though no Blockwright component happens to use them today.
  'animate-{shimmer,caret,rise,drift,pop,slide-in,tick,breathe,sweep}',
  'shadow-{flat,raised,overlay,ember}',
  'mask-fade-{b,r}',
  'sm:{grid-cols-2,grid-cols-3,flex-row,text-base,text-lg,text-xl,text-2xl,text-3xl,text-4xl,px-8,py-16}',
  'md:{grid-cols-2,grid-cols-3,grid-cols-4,flex-row}',
  'lg:{grid-cols-2,grid-cols-3,grid-cols-4}',
];

const globals = resolve('src/app/globals.css');
const wrapper = join(CACHE, 'ds-tailwind.src.css');
writeFileSync(
  wrapper,
  `@import ${JSON.stringify(globals)};\n` +
    `@source ${JSON.stringify(resolve('src'))};\n` +
    `@source ${JSON.stringify(resolve('.design-sync/previews'))};\n` +
    SAFELIST.map((s) => `@source inline(${JSON.stringify(s)});\n`).join(''),
);

const cssOut = join(CACHE, 'ds-tailwind.css');
const compiled = await postcss([tailwind({ optimize: true })]).process(readFileSync(wrapper, 'utf8'), {
  from: wrapper,
  to: cssOut,
});
const css = FONT_SETUP + compiled.css;
writeFileSync(cssOut, css);
console.error(`[css] ${(css.length / 1024).toFixed(1)} KB -> ${cssOut}`);

// ── 2. entry barrel ────────────────────────────────────────────────────────
const { dirs } = JSON.parse(readFileSync(resolve('.design-sync/ds-scope.json'), 'utf8'));
const files = dirs.flatMap((d) => {
  const abs = resolve('src/components', d);
  return readdirSync(abs)
    .filter((n) => /\.tsx$/.test(n) && !/\.(stories|test|spec)\./.test(n))
    .map((n) => join(abs, n));
});
const entryOut = join(CACHE, 'ds-entry.mjs');
writeFileSync(entryOut, files.map((f) => `export * from ${JSON.stringify(f)};`).join('\n') + '\n');
console.error(`[entry] ${files.length} files (${dirs.join(', ')}) -> ${entryOut}`);
