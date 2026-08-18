import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FileKind } from "@/lib/supabase/types";
import { PROJECT_LAYOUT, inferService } from "@/lib/roblox/project-model";
import type { AgentBudget } from "@/lib/agent/types";

/**
 * Project context, under a token budget.
 *
 * The rule from section 10: never send the whole project. A mature Roblox
 * project is far larger than any sensible context window, and pasting it into
 * every step is both the main cost driver and a reliable way to bury the one
 * file that matters.
 *
 * So the agent gets a *tree* by default — cheap, complete, enough to decide what
 * to read — and reads individual files through a tool when it needs their
 * contents.
 */

type Client = SupabaseClient<Database>;

export interface ProjectFileSummary {
  path: string;
  kind: FileKind;
  bytes: number;
  revision: number;
  service: string;
}

export interface ProjectContext {
  files: ProjectFileSummary[];
  totalFiles: number;
  totalBytes: number;
  truncated: boolean;
  tree: string;
}

/** Rough token estimate; 4 chars/token is close enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function loadProjectContext(
  supabase: Client,
  projectId: string,
  budget: Pick<AgentBudget, "maxProjectFilesInContext">,
): Promise<ProjectContext> {
  const { data } = await supabase
    .from("project_files")
    .select("path, kind, size_bytes, revision")
    .eq("project_id", projectId)
    .order("path");

  const all = data ?? [];
  const files: ProjectFileSummary[] = all.slice(0, budget.maxProjectFilesInContext).map((f) => ({
    path: f.path,
    kind: f.kind,
    bytes: f.size_bytes,
    revision: f.revision,
    service: inferService(f.path),
  }));

  return {
    files,
    totalFiles: all.length,
    totalBytes: all.reduce((sum, f) => sum + f.size_bytes, 0),
    truncated: all.length > files.length,
    tree: renderTree(files, all.length),
  };
}

/**
 * Compact textual tree grouped by Roblox service.
 *
 * Grouped by service rather than by folder because that is the question the
 * agent actually has to answer — "does this run on the server?" — and a path
 * alone does not say so to a model that has not memorised the layout.
 */
export function renderTree(files: ProjectFileSummary[], totalFiles = files.length): string {
  if (!files.length) return "(empty project — no files yet)";

  const byService = new Map<string, ProjectFileSummary[]>();
  for (const file of files) {
    const list = byService.get(file.service) ?? [];
    list.push(file);
    byService.set(file.service, list);
  }

  const order = PROJECT_LAYOUT.map((entry) => entry.service);
  const services = [...byService.keys()].sort(
    (a, b) => order.indexOf(a as never) - order.indexOf(b as never),
  );

  const lines: string[] = [];
  for (const service of services) {
    lines.push(`${service}/`);
    for (const file of byService.get(service) ?? []) {
      lines.push(`  ${file.path}  (${file.kind}, ${file.bytes}b, r${file.revision})`);
    }
  }

  if (totalFiles > files.length) {
    lines.push(`  … ${totalFiles - files.length} more file(s) not listed — use list_files.`);
  }

  return lines.join("\n");
}

/**
 * Which existing files are worth reading for this request?
 *
 * Scored rather than retrieved by embedding: the corpus here is a handful of
 * paths, and a filename match is both cheaper and more predictable than a
 * vector lookup over something this small.
 */
export function rankRelevantFiles(
  request: string,
  files: ProjectFileSummary[],
  limit = 6,
): ProjectFileSummary[] {
  const words = (request.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w),
  );
  if (!words.length) return [];

  const scored = files.map((file) => {
    const haystack = file.path.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (haystack.includes(word)) score += word.length >= 5 ? 3 : 1;
    }
    // Tie-breaker only. Applied unconditionally it would give every script a
    // non-zero score, so an unrelated request would "match" the whole project.
    if (score > 0 && (file.kind === "script" || file.kind === "module")) score += 0.5;
    return { file, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.file);
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "make", "add",
  "create", "build", "please", "can", "you", "how", "why", "what", "when",
  "roblox", "game", "script", "scripts", "code", "player", "players",
]);
