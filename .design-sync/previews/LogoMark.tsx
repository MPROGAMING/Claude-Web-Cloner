import { LogoMark } from "blockwright";

// An isometric block mid-draw: two solid faces plus an ember top. It is a 28px
// glyph by default, so these cells put it at the sizes it ships at and against
// the surfaces it sits on rather than alone on an empty card.
export const AtEverySize = () => (
  <div className="flex items-end gap-6">
    {["size-4", "size-5", "size-7", "size-10", "size-16"].map((s) => (
      <span key={s} className="flex flex-col items-center gap-2">
        <LogoMark className={s} />
        <span className="label-meta">{s.replace("size-", "")}</span>
      </span>
    ))}
  </div>
);

export const OnSurfaces = () => (
  <div className="flex gap-4">
    <span className="grid size-24 place-items-center rounded-xl bg-background">
      <LogoMark className="size-10" />
    </span>
    <span className="grid size-24 place-items-center rounded-xl bg-surface">
      <LogoMark className="size-10" />
    </span>
    <span className="grid size-24 place-items-center rounded-xl bg-surface-sunken">
      <LogoMark className="size-10" />
    </span>
  </div>
);

export const AsAnAvatarTile = () => (
  <div className="flex max-w-sm items-center gap-3 rounded-lg border border-border bg-surface p-3">
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-sunken">
      <LogoMark className="size-6" />
    </span>
    <span className="min-w-0">
      <p className="text-[0.8125rem] font-medium">Blockwright</p>
      <p className="truncate text-xs text-muted-foreground">
        Wrote RoundTimer.server.luau
      </p>
    </span>
  </div>
);
