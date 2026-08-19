import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hand edits are a second write path into `project_files`, and the reason to
 * test it separately from the agent's is that its input comes from a person
 * rather than from a model — which is not the same as coming from somewhere
 * trustworthy. Both arrive over the same wire.
 *
 * What is pinned here: a path that escapes the project is refused, a save keeps
 * the version it replaced, and a save against a stale revision does not silently
 * overwrite whatever landed in the meantime.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PROJECT = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";

interface FileRow {
  id: string;
  project_id: string;
  owner_id: string;
  path: string;
  content: string;
  kind: string;
  size_bytes: number;
  revision: number;
  roblox_parent?: string | null;
  updated_at?: string;
}

const tables: {
  projects: { id: string; owner_id: string }[];
  project_files: FileRow[];
  file_revisions: { file_id: string; revision: number; content: string }[];
} = { projects: [], project_files: [], file_revisions: [] };

/** Thenable query builder covering only the calls these two actions make. */
class Query implements PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> {
  private filters: [string, unknown][] = [];
  private op: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> | null = null;
  private single = false;

  constructor(private readonly table: keyof typeof tables) {}

  private rows(): Record<string, unknown>[] {
    return (tables[this.table] as Record<string, unknown>[]).filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );
  }

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  insert(payload: Record<string, unknown>) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.op = "update";
    this.payload = payload;
    return this;
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    resolve?:
      | ((value: { data: unknown; error: { code?: string; message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      if (this.op === "insert") {
        if (this.table === "project_files") {
          const row = this.payload as unknown as FileRow;
          if (tables.project_files.some((f) => f.project_id === row.project_id && f.path === row.path)) {
            return Promise.resolve(
              resolve!({ data: null, error: { code: "23505", message: "duplicate key" } }),
            );
          }
          tables.project_files.push({ ...row, id: `f${tables.project_files.length + 1}`, revision: 1 });
        } else if (this.table === "file_revisions") {
          tables.file_revisions.push(
            this.payload as unknown as { file_id: string; revision: number; content: string },
          );
        }
        return Promise.resolve(resolve!({ data: null, error: null }));
      }

      if (this.op === "update") {
        for (const row of this.rows()) Object.assign(row, this.payload);
        return Promise.resolve(resolve!({ data: null, error: null }));
      }

      const found = this.rows();
      return Promise.resolve(
        resolve!({ data: this.single ? (found[0] ?? null) : found, error: null }),
      );
    } catch (error) {
      return Promise.resolve(reject!(error));
    }
  }
}

const supabase = { from: (table: keyof typeof tables) => new Query(table) };

vi.mock("@/lib/data/queries", () => ({
  requireUser: async () => ({ supabase, user: { id: OWNER } }),
}));

const { createFile, saveFile } = await import("@/lib/actions/files");

beforeEach(() => {
  tables.projects = [{ id: PROJECT, owner_id: OWNER }];
  tables.project_files = [
    {
      id: "f1",
      project_id: PROJECT,
      owner_id: OWNER,
      path: "src/server/Round.luau",
      content: "local a = 1\n",
      kind: "script",
      size_bytes: 12,
      revision: 3,
    },
  ];
  tables.file_revisions = [];
});

describe("saveFile", () => {
  it("writes the edit and bumps the revision", async () => {
    const result = await saveFile({
      projectId: PROJECT,
      path: "src/server/Round.luau",
      content: "local a = 2\n",
      expectedRevision: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.revision).toBe(4);
    expect(tables.project_files[0].content).toBe("local a = 2\n");
    expect(tables.project_files[0].revision).toBe(4);
  });

  it("keeps the version it replaced, so the edit is diffable and undoable", async () => {
    await saveFile({
      projectId: PROJECT,
      path: "src/server/Round.luau",
      content: "local a = 2\n",
    });

    expect(tables.file_revisions).toEqual([
      { file_id: "f1", project_id: PROJECT, owner_id: OWNER, revision: 3, content: "local a = 1\n" },
    ]);
  });

  it("refuses a path that escapes the project", async () => {
    for (const path of ["../../etc/passwd", "/etc/passwd", "src/../../x.luau", "secrets.env"]) {
      const result = await saveFile({ projectId: PROJECT, path, content: "x" });
      expect(result.ok, path).toBe(false);
    }
    expect(tables.file_revisions).toHaveLength(0);
  });

  it("refuses an extension the project does not support", async () => {
    const result = await saveFile({ projectId: PROJECT, path: "src/server/x.sh", content: "x" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/\.luau/);
  });

  it("refuses a save against a revision that has moved on", async () => {
    const result = await saveFile({
      projectId: PROJECT,
      path: "src/server/Round.luau",
      content: "local a = 2\n",
      expectedRevision: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/revision 3/);
    expect(tables.project_files[0].content).toBe("local a = 1\n");
  });

  it("does not write a revision when nothing changed", async () => {
    const result = await saveFile({
      projectId: PROJECT,
      path: "src/server/Round.luau",
      content: "local a = 1\n",
    });

    expect(result.ok).toBe(true);
    expect(tables.file_revisions).toHaveLength(0);
    expect(tables.project_files[0].revision).toBe(3);
  });

  it("refuses a project the caller does not own", async () => {
    tables.projects = [];
    const result = await saveFile({
      projectId: PROJECT,
      path: "src/server/Round.luau",
      content: "x",
    });
    expect(result.ok).toBe(false);
    expect(tables.project_files[0].content).toBe("local a = 1\n");
  });

  it("refuses a file that is not in the project", async () => {
    const result = await saveFile({
      projectId: PROJECT,
      path: "src/server/Missing.luau",
      content: "x",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no longer exists/);
  });
});

describe("createFile", () => {
  it("creates under an allowed root and infers the Roblox parent", async () => {
    const result = await createFile({ projectId: PROJECT, path: "src/client/Input.client.luau" });

    expect(result.ok).toBe(true);
    const created = tables.project_files.find((f) => f.path === "src/client/Input.client.luau");
    expect(created?.kind).toBe("localscript");
    expect(created?.roblox_parent).toBe("StarterPlayer.StarterPlayerScripts");
  });

  it("normalises a path before storing it", async () => {
    const result = await createFile({ projectId: PROJECT, path: "./src/shared/Config.luau" });
    expect(result.data?.path).toBe("src/shared/Config.luau");
  });

  it("refuses a duplicate path with a message the user can act on", async () => {
    const result = await createFile({ projectId: PROJECT, path: "src/server/Round.luau" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already exists/);
  });

  it("refuses a traversal", async () => {
    const result = await createFile({ projectId: PROJECT, path: "src/../../evil.luau" });
    expect(result.ok).toBe(false);
    expect(tables.project_files).toHaveLength(1);
  });
});
