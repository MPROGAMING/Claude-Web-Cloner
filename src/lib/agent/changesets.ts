import { randomUUID } from "node:crypto";
import {
  MAX_FILE_BYTES,
  inferKind,
  inferService,
  validateProjectPath,
} from "@/lib/roblox/project-model";
import { validateLuau } from "@/lib/roblox/luau-validator";
import { reviewFiles } from "@/lib/agent/security";
import type { FileKind } from "@/lib/supabase/types";
import type {
  ChangeOperation,
  ChangeOperationKind,
  Changeset,
  ChangesetPreview,
  ChangesetValidationIssue,
} from "@/lib/agent/types";

/**
 * Changesets: every project mutation is described before it is performed.
 *
 * The point is not bookkeeping. It is that PREVIEW and APPLY execute the *same*
 * operation list — preview builds it, the user approves that exact list, and
 * apply replays it. The model is not consulted again at apply time, so what the
 * user approved is precisely what runs. Any design where apply re-prompts the
 * model would make approval meaningless.
 */

export interface ExistingFile {
  path: string;
  content: string;
  kind: FileKind;
  revision: number;
}

/**
 * Accumulates operations during a run.
 *
 * Tracks its own view of the project so that a run which creates a file and
 * then updates it produces a coherent pair of operations, with rollback
 * information captured against the file's state *before the run started*.
 */
export class ChangesetBuilder {
  private readonly operations: ChangeOperation[] = [];
  /** Path -> file state as the run currently believes it to be. */
  private readonly working = new Map<string, ExistingFile | null>();
  /** Path -> state before this run touched it, for rollback. */
  private readonly original = new Map<string, ExistingFile | null>();

  constructor(
    readonly runId: string,
    readonly projectId: string,
    readonly ownerId: string,
    existing: ExistingFile[] = [],
  ) {
    for (const file of existing) {
      this.working.set(file.path, file);
      this.original.set(file.path, file);
    }
  }

  get size(): number {
    return this.operations.length;
  }

  list(): ChangeOperation[] {
    return [...this.operations];
  }

  peek(path: string): ExistingFile | null {
    return this.working.get(path) ?? null;
  }

  private rememberOriginal(path: string) {
    if (!this.original.has(path)) this.original.set(path, this.working.get(path) ?? null);
  }

  private rollbackFor(path: string): ChangeOperation["rollback"] {
    const before = this.original.get(path) ?? null;
    if (!before) return { kind: "delete_created", path };
    return {
      kind: "restore_content",
      path,
      content: before.content,
      fileKind: before.kind,
      revision: before.revision,
    };
  }

  /** Stage a create/update. Returns the staged operation or a reason it cannot be staged. */
  stageWrite(args: {
    path: string;
    content: string;
    kind?: FileKind;
    mode: "create" | "update";
  }): { ok: true; operation: ChangeOperation } | { ok: false; error: string } {
    const validation = validateProjectPath(args.path);
    if (!validation.ok || !validation.path) {
      return { ok: false, error: validation.reason ?? "Invalid path." };
    }
    const path = validation.path;

    const bytes = Buffer.byteLength(args.content, "utf8");
    if (bytes > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `File is ${bytes} bytes; the limit is ${MAX_FILE_BYTES}. Split it into modules.`,
      };
    }

    const current = this.working.get(path) ?? null;
    if (args.mode === "create" && current) {
      return { ok: false, error: `${path} already exists. Use update_file to change it.` };
    }
    if (args.mode === "update" && !current) {
      return { ok: false, error: `${path} does not exist yet. Use create_file to add it.` };
    }

    this.rememberOriginal(path);
    const kind = args.kind ?? inferKind(path);

    const operation: ChangeOperation = {
      kind: args.mode === "create" ? "create" : "update",
      path,
      content: args.content,
      fileKind: kind,
      robloxParent: inferService(path),
      precondition: {
        mustExist: args.mode === "update",
        expectedRevision: current?.revision,
      },
      rollback: this.rollbackFor(path),
      summary: `${args.mode === "create" ? "Create" : "Update"} ${path}`,
    };

    this.operations.push(operation);
    this.working.set(path, {
      path,
      content: args.content,
      kind,
      revision: (current?.revision ?? 0) + 1,
    });

    return { ok: true, operation };
  }

  stageDelete(args: {
    path: string;
    reason: string;
  }): { ok: true; operation: ChangeOperation } | { ok: false; error: string } {
    const validation = validateProjectPath(args.path);
    if (!validation.ok || !validation.path) {
      return { ok: false, error: validation.reason ?? "Invalid path." };
    }
    const path = validation.path;
    const current = this.working.get(path) ?? null;
    if (!current) return { ok: false, error: `${path} does not exist.` };

    this.rememberOriginal(path);

    const operation: ChangeOperation = {
      kind: "delete",
      path,
      precondition: { mustExist: true, expectedRevision: current.revision },
      rollback: this.rollbackFor(path),
      summary: `Delete ${path} — ${args.reason}`,
    };

    this.operations.push(operation);
    this.working.set(path, null);
    return { ok: true, operation };
  }

  stageMove(args: {
    path: string;
    toPath: string;
    rename?: boolean;
  }): { ok: true; operation: ChangeOperation } | { ok: false; error: string } {
    const from = validateProjectPath(args.path);
    const to = validateProjectPath(args.toPath);
    if (!from.ok || !from.path) return { ok: false, error: from.reason ?? "Invalid source path." };
    if (!to.ok || !to.path) return { ok: false, error: to.reason ?? "Invalid destination path." };

    const current = this.working.get(from.path) ?? null;
    if (!current) return { ok: false, error: `${from.path} does not exist.` };
    if (this.working.get(to.path)) return { ok: false, error: `${to.path} already exists.` };

    this.rememberOriginal(from.path);
    this.rememberOriginal(to.path);

    const operation: ChangeOperation = {
      kind: args.rename ? "rename" : "move",
      path: from.path,
      toPath: to.path,
      content: current.content,
      fileKind: current.kind,
      robloxParent: inferService(to.path),
      precondition: { mustExist: true, expectedRevision: current.revision },
      rollback: { kind: "restore_path", path: to.path, content: current.content, fileKind: current.kind },
      summary: `${args.rename ? "Rename" : "Move"} ${from.path} -> ${to.path}`,
    };

    this.operations.push(operation);
    this.working.set(from.path, null);
    this.working.set(to.path, { ...current, path: to.path, revision: 1 });
    return { ok: true, operation };
  }

  build(): Changeset {
    const operations = this.list();
    return {
      changesetId: randomUUID(),
      runId: this.runId,
      projectId: this.projectId,
      ownerId: this.ownerId,
      operations,
      status: operations.length ? "pending_approval" : "draft",
      createdAt: new Date().toISOString(),
      issues: reviewChangeset(operations),
    };
  }
}

/**
 * Structural checks over a complete operation list.
 *
 * These are about the changeset as a unit — the per-file Luau checks already
 * ran when the content was staged. What can only be seen here is ordering and
 * coherence: deleting a file a later operation updates, two operations claiming
 * the same path, a move onto an occupied path.
 */
export function validateChangeset(operations: ChangeOperation[]): ChangesetValidationIssue[] {
  const issues: ChangesetValidationIssue[] = [];
  const seen = new Map<string, ChangeOperationKind>();

  for (const op of operations) {
    const previous = seen.get(op.path);

    if (previous === "delete" && op.kind !== "create") {
      issues.push({
        severity: "error",
        rule: "operation-after-delete",
        message: `${op.path} is ${op.kind}d after being deleted in the same changeset.`,
        path: op.path,
      });
    }

    if (op.kind === "create" && previous && previous !== "delete") {
      issues.push({
        severity: "error",
        rule: "duplicate-create",
        message: `${op.path} is created more than once in the same changeset.`,
        path: op.path,
      });
    }

    if ((op.kind === "create" || op.kind === "update") && !op.content) {
      issues.push({
        severity: "error",
        rule: "empty-content",
        message: `${op.path} has no content.`,
        path: op.path,
      });
    }

    if ((op.kind === "move" || op.kind === "rename") && !op.toPath) {
      issues.push({
        severity: "error",
        rule: "missing-destination",
        message: `${op.path} is moved with no destination.`,
        path: op.path,
      });
    }

    // A path that escaped validation at stage time must never reach execution.
    const revalidated = validateProjectPath(op.path);
    if (!revalidated.ok) {
      issues.push({
        severity: "error",
        rule: "invalid-path",
        message: `${op.path}: ${revalidated.reason}`,
        path: op.path,
      });
    }

    seen.set(op.path, op.kind);
    if (op.toPath) seen.set(op.toPath, "create");
  }

  return issues;
}

/**
 * Everything that would block execution: structure, Luau, and security.
 *
 * One function, used by both the preview and the apply path. They used to run
 * different checks, which meant a change set could be previewed as clean and
 * then refused at apply — making the user's approval meaningless, since what
 * they approved was never what was going to be verified.
 */
/**
 * The project as it will be once every operation has run.
 *
 * A run that writes a file three times while correcting itself produces three
 * operations for one path, and only the last one survives. Validating the
 * intermediates reports errors in code that never exists at rest — which is
 * exactly how a correct build got blocked by its own earlier drafts.
 */
export function finalState(operations: ChangeOperation[]): { path: string; content: string }[] {
  const state = new Map<string, string>();

  for (const op of operations) {
    switch (op.kind) {
      case "create":
      case "update":
        if (op.content !== undefined) state.set(op.path, op.content);
        break;
      case "delete":
        state.delete(op.path);
        break;
      case "move":
      case "rename":
        if (op.toPath) {
          state.set(op.toPath, op.content ?? state.get(op.path) ?? "");
          state.delete(op.path);
        }
        break;
    }
  }

  return [...state.entries()].map(([path, content]) => ({ path, content }));
}

export function reviewChangeset(operations: ChangeOperation[]): ChangesetValidationIssue[] {
  const issues = validateChangeset(operations);

  const files = finalState(operations);

  for (const file of files) {
    if (!/\.luau?$/i.test(file.path)) continue;
    const result = validateLuau(file.content, file.path);
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.severity !== "error") continue;
      issues.push({
        severity: "error",
        rule: `luau:${diagnostic.rule}`,
        message: `${file.path}:${diagnostic.line} ${diagnostic.message}`,
        path: file.path,
      });
    }
  }

  for (const finding of reviewFiles(files).findings) {
    if (finding.severity !== "error") continue;
    issues.push({
      severity: "error",
      rule: `security:${finding.rule}`,
      message: `${finding.path}:${finding.line} ${finding.message}`,
      path: finding.path,
    });
  }

  return issues;
}

/** Does this changeset have anything blocking execution? */
export function isExecutable(changeset: Changeset): boolean {
  return (
    changeset.operations.length > 0 &&
    !changeset.issues.some((issue) => issue.severity === "error")
  );
}

/** The user-facing rendering. Content is deliberately not included wholesale. */
export function toPreview(changeset: Changeset): ChangesetPreview {
  const totals: Record<ChangeOperationKind, number> = {
    create: 0,
    update: 0,
    delete: 0,
    move: 0,
    rename: 0,
  };

  const operations = changeset.operations.map((op) => {
    totals[op.kind] += 1;
    const isLuau = /\.luau?$/i.test(op.path);
    const validation =
      isLuau && op.content
        ? (() => {
            const result = validateLuau(op.content, op.path);
            return { errors: result.errors, warnings: result.warnings };
          })()
        : undefined;

    return {
      kind: op.kind,
      path: op.path,
      toPath: op.toPath,
      summary: op.summary,
      bytes: op.content ? Buffer.byteLength(op.content, "utf8") : undefined,
      validation,
    };
  });

  const parts = (Object.entries(totals) as [ChangeOperationKind, number][])
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}`);

  return {
    changesetId: changeset.changesetId,
    status: changeset.status,
    summary: parts.length ? parts.join(", ") : "no changes",
    operations,
    issues: changeset.issues,
    totals,
  };
}

/**
 * Invert an applied operation list.
 *
 * One inverse per path, not per operation. A run that corrects itself writes the
 * same file several times, and emitting an inverse for each produces a first
 * delete that succeeds followed by duplicates that fail — an undo that fully
 * worked then reports itself as failed.
 *
 * Reversed order matters too: undoing a create-then-update pair must remove the
 * file, not restore an intermediate revision. Every operation on a path carries
 * the same pre-run rollback, so collapsing them is lossless.
 */
export function invertOperations(operations: ChangeOperation[]): ChangeOperation[] {
  const seen = new Set<string>();
  const inverses: ChangeOperation[] = [];

  for (const op of [...operations].reverse()) {
    const rollback = op.rollback;
    if (seen.has(rollback.path)) continue;
    seen.add(rollback.path);

    if (rollback.kind === "delete_created") {
      inverses.push({
        kind: "delete",
        path: rollback.path,
        precondition: { mustExist: false },
        rollback: { kind: "none", path: rollback.path },
        summary: `Roll back: remove ${rollback.path}`,
      });
      continue;
    }

    inverses.push({
      kind: "update",
      path: rollback.path,
      content: rollback.content ?? "",
      fileKind: rollback.fileKind,
      precondition: { mustExist: false },
      rollback: { kind: "none", path: rollback.path },
      summary: `Roll back: restore ${rollback.path}`,
    });
  }

  return inverses;
}
