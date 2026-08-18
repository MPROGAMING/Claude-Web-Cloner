/**
 * How a Blockwright project maps onto a Roblox place.
 *
 * The web app owns a *file tree*. Roblox Studio owns *Instances*. These are not
 * the same thing, and pretending otherwise is where naive tools break. So the
 * mapping is explicit: every file declares which Roblox service it belongs
 * under, and the Studio plugin is what actually materialises Instances.
 */

export const ROBLOX_SERVICES = [
  "ServerScriptService",
  "ServerStorage",
  "ReplicatedStorage",
  "StarterPlayer.StarterPlayerScripts",
  "StarterPlayer.StarterCharacterScripts",
  "StarterGui",
  "Workspace",
  "Lighting",
] as const;

export type RobloxService = (typeof ROBLOX_SERVICES)[number];

export type FileKind = "script" | "localscript" | "module" | "config" | "doc" | "ui";

/** Roblox class each file kind becomes inside Studio. */
export const KIND_TO_CLASS: Record<FileKind, string> = {
  script: "Script",
  localscript: "LocalScript",
  module: "ModuleScript",
  ui: "ModuleScript",
  config: "ModuleScript",
  doc: "StringValue",
};

/** Top-level folders of a Blockwright project, in display order. */
export const PROJECT_LAYOUT = [
  {
    dir: "src/server",
    label: "Server",
    service: "ServerScriptService" as RobloxService,
    blurb: "Authoritative gameplay: currency, saves, validation.",
  },
  {
    dir: "src/client",
    label: "Client",
    service: "StarterPlayer.StarterPlayerScripts" as RobloxService,
    blurb: "Input, camera, local effects.",
  },
  {
    dir: "src/shared",
    label: "Shared",
    service: "ReplicatedStorage" as RobloxService,
    blurb: "Modules and config replicated to both sides.",
  },
  {
    dir: "src/ui",
    label: "Interface",
    service: "StarterGui" as RobloxService,
    blurb: "ScreenGui builders and HUD modules.",
  },
  {
    dir: "docs",
    label: "Notes",
    service: "ReplicatedStorage" as RobloxService,
    blurb: "Design notes kept alongside the code.",
  },
];

/** Infer the Roblox parent service from a path when the model omits one. */
export function inferService(path: string): RobloxService {
  const normalised = path.toLowerCase();
  if (normalised.startsWith("src/server")) return "ServerScriptService";
  if (normalised.startsWith("src/client")) return "StarterPlayer.StarterPlayerScripts";
  if (normalised.startsWith("src/ui")) return "StarterGui";
  return "ReplicatedStorage";
}

/** Infer file kind from path + extension when the model omits one. */
export function inferKind(path: string): FileKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) return "doc";
  if (lower.endsWith(".client.luau") || lower.startsWith("src/client")) return "localscript";
  if (lower.endsWith(".server.luau") || lower.startsWith("src/server")) return "script";
  if (lower.startsWith("src/ui")) return "ui";
  if (lower.includes("config")) return "config";
  return "module";
}

/**
 * Path allowlist. This is a security boundary, not a convenience: the model
 * proposes paths and we must never let one escape the project sandbox.
 */
const ALLOWED_ROOTS = ["src/", "docs/"];
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ALLOWED_EXTENSIONS = [".luau", ".lua", ".md", ".json"];
export const MAX_PATH_LENGTH = 240;
export const MAX_FILE_BYTES = 200_000;

export interface PathValidation {
  ok: boolean;
  path?: string;
  reason?: string;
}

export function validateProjectPath(input: string): PathValidation {
  const raw = (input ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");

  if (!raw) return { ok: false, reason: "Path is empty." };
  if (raw.length > MAX_PATH_LENGTH) {
    return { ok: false, reason: `Path exceeds ${MAX_PATH_LENGTH} characters.` };
  }
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) {
    return { ok: false, reason: "Absolute paths are not allowed." };
  }
  if (raw.includes("\0")) return { ok: false, reason: "Path contains a null byte." };

  const segments = raw.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      return { ok: false, reason: "Path may not contain '.' or '..' segments." };
    }
    if (!SAFE_SEGMENT.test(segment)) {
      return { ok: false, reason: `Invalid path segment: "${segment}".` };
    }
  }

  if (!ALLOWED_ROOTS.some((root) => raw.startsWith(root))) {
    return {
      ok: false,
      reason: `Files must live under ${ALLOWED_ROOTS.join(" or ")}.`,
    };
  }

  if (!ALLOWED_EXTENSIONS.some((ext) => raw.toLowerCase().endsWith(ext))) {
    return {
      ok: false,
      reason: `Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.`,
    };
  }

  return { ok: true, path: raw };
}

/** Instance name Studio will use for a file, e.g. src/server/Shop.luau -> Shop */
export function instanceNameFor(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.(server|client)?\.?(luau|lua|md|json)$/i, "").replace(/\.$/, "");
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "dir" | "file";
  kind?: FileKind;
  children?: FileTreeNode[];
}

/** Build a nested tree from flat paths, directories first then alphabetical. */
export function buildFileTree(files: { path: string; kind: FileKind }[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const segments = file.path.split("/");
    let level = root;
    let acc = "";

    segments.forEach((segment, index) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      let node = level.find(
        (n) => n.name === segment && n.type === (isLeaf ? "file" : "dir"),
      );
      if (!node) {
        node = isLeaf
          ? { name: segment, path: acc, type: "file", kind: file.kind }
          : { name: segment, path: acc, type: "dir", children: [] };
        level.push(node);
      }
      if (!isLeaf) level = node.children!;
    });
  }

  const sort = (nodes: FileTreeNode[]): FileTreeNode[] =>
    nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => (node.children ? { ...node, children: sort(node.children) } : node));

  return sort(root);
}
