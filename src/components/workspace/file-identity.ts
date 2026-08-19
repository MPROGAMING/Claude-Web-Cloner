import {
  KIND_TO_CLASS,
  PROJECT_LAYOUT,
  inferKind,
  inferService,
  instanceNameFor,
  type FileKind,
} from "@/lib/roblox/project-model";

/**
 * What a file *is*, said the way a Roblox creator would say it.
 *
 * A path and an extension are a developer's identity for a file. This surface
 * is used by fourteen-year-olds who have never opened a terminal, and to them
 * `src/server/RoundService.luau` is noise wrapped around the only word that
 * matters: `RoundService`, the thing that runs the round.
 *
 * None of this is decoration or invention. `instanceNameFor` is the exact name
 * the Studio bridge gives the Instance it creates, `KIND_TO_CLASS` is the class
 * it creates, and `inferService` is where it parents it — the same three
 * functions `lib/studio/service.ts` calls when it actually syncs. So the label
 * a creator reads here is the label they will see in Studio's Explorer.
 *
 * Paths are never removed from the surface — they stay as the mono subtitle in
 * the editor header, in the changeset review, and on every `title`. They are
 * demoted, not hidden, because the code is the receipt and a receipt has to
 * stay checkable.
 */

export interface FileIdentity {
  /** The Instance name Studio will use — the file's real name to a creator. */
  name: string;
  /** Its job, in one noun phrase. */
  role: string;
  /** What it does, in one short sentence. */
  blurb: string;
  /** The Roblox class the bridge creates for it. */
  robloxClass: string;
  /** The service it is parented under, when it is synced at all. */
  service: string;
  /** True when the Studio bridge will actually send it — it only sends scripts. */
  synced: boolean;
}

const ROLES: Record<FileKind, { role: string; blurb: string }> = {
  script: { role: "Server script", blurb: "Runs on the server" },
  localscript: { role: "Client script", blurb: "Runs on each player's device" },
  module: { role: "Shared module", blurb: "Shared by the server and every client" },
  ui: { role: "Interface", blurb: "Builds what the player sees on screen" },
  config: { role: "Settings", blurb: "Numbers you can tune without touching the logic" },
  doc: { role: "Note", blurb: "Design notes kept beside the code" },
};

/** Ink for each role, so the same job reads the same colour everywhere. */
export const ROLE_TINT: Record<FileKind, string> = {
  script: "text-[var(--ember)]",
  localscript: "text-[var(--signal)]",
  module: "text-foreground/60",
  ui: "text-[var(--warning)]",
  config: "text-foreground/50",
  doc: "text-muted-foreground",
};

/**
 * A note is the one kind that never reaches Studio, so it has no Instance name
 * to be faithful to — and `design-notes` is a filename wearing a costume. Give
 * it the title a person would write.
 */
function readableNote(name: string): string {
  const spaced = name.replace(/[-_]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : name;
}

export function fileIdentity(path: string, kind?: FileKind | null): FileIdentity {
  const resolved: FileKind = kind ?? inferKind(path);
  const { role, blurb } = ROLES[resolved] ?? ROLES.module;
  const instance = instanceNameFor(path);
  return {
    name: resolved === "doc" ? readableNote(instance) : instance,
    role,
    blurb,
    robloxClass: KIND_TO_CLASS[resolved] ?? KIND_TO_CLASS.module,
    service: inferService(path),
    // `lib/studio/service.ts` filters the sync payload to `.luau`/`.lua`, so
    // claiming a note lands in Studio would be a lie by omission.
    synced: /\.luau?$/i.test(path),
  };
}

/**
 * One sentence saying where a file ends up in the place. This replaces the
 * caret position and the byte count that used to sit in the editor's footer —
 * same slot, but it answers a question a creator actually has.
 */
export function destinationOf(identity: FileIdentity): string {
  return identity.synced
    ? `Lands in ${identity.service} as a ${identity.robloxClass}`
    : "Kept in the project — only scripts go to Studio";
}

/** Folder labels lifted from the project layout: "Server", not "src/server". */
const FOLDER = new Map(PROJECT_LAYOUT.map((entry) => [entry.dir, entry]));

export function folderIdentity(path: string): { label: string; blurb?: string } {
  const entry = FOLDER.get(path);
  return entry ? { label: entry.label, blurb: entry.blurb } : { label: path.split("/").pop() ?? path };
}

/** Display order for the top level: server first, notes last, as the layout lists them. */
export function folderRank(path: string): number {
  const index = PROJECT_LAYOUT.findIndex((entry) => entry.dir === path);
  return index === -1 ? PROJECT_LAYOUT.length : index;
}
