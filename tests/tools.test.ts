import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the agent's tool layer against an in-memory stand-in for Supabase.
 *
 * This is where the model's output meets our data, so it is the layer most
 * worth pinning: path escapes must be refused, updates must snapshot the
 * previous revision, and a Studio action must degrade gracefully rather than
 * throw when the plugin is not connected.
 */

const studioState = {
  connection: null as { id: string; status: string; place_name: string | null } | null,
  enqueued: [] as { action: string; payload: unknown }[],
};

vi.mock("server-only", () => ({}));

// Session functions take the caller's client as their first argument, so the
// stubs must too — that shape is part of the contract these tools rely on.
vi.mock("@/lib/studio/service", () => ({
  getConnection: vi.fn(async () => studioState.connection),
  enqueueStudioCommand: vi.fn(
    async (_client: unknown, params: { action: string; payload: unknown }) => {
      studioState.enqueued.push({ action: params.action, payload: params.payload });
      return { id: "cmd-1" };
    },
  ),
}));

const { buildTools } = await import("@/lib/ai/tools");

// ---------------------------------------------------------------------------
// Minimal query-builder stand-in covering only what the tools actually use.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  project_id: string;
  owner_id: string;
  path: string;
  content: string;
  kind: string;
  size_bytes: number;
  revision: number;
  roblox_parent?: string | null;
}

function createFakeSupabase() {
  const tables: Record<string, Record<string, unknown>[]> = {
    project_files: [],
    file_revisions: [],
  };
  let nextId = 1;

  /**
   * A thenable query builder: every method returns `this`, and awaiting it
   * runs whichever terminal operation was requested. That mirrors how
   * postgrest-js chains behave closely enough for these tools.
   */
  class Query implements PromiseLike<{ data: unknown; error: null; count?: number | null }> {
    private eqFilters: [string, unknown][] = [];
    private inFilter: { column: string; values: unknown[] } | null = null;
    private op: "select" | "insert" | "update" | "delete" = "select";
    private payload: unknown = null;
    private wantCount = false;
    private wantSingle = false;

    constructor(private readonly table: string) {}

    private rows() {
      return tables[this.table].filter((row) => {
        if (!this.eqFilters.every(([column, value]) => row[column] === value)) return false;
        if (this.inFilter && !this.inFilter.values.includes(row[this.inFilter.column])) return false;
        return true;
      });
    }

    select() {
      if (this.op === "select") this.op = "select";
      return this;
    }
    eq(column: string, value: unknown) {
      this.eqFilters.push([column, value]);
      return this;
    }
    in(column: string, values: unknown[]) {
      this.inFilter = { column, values };
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    insert(payload: unknown) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: unknown) {
      this.op = "update";
      this.payload = payload;
      return this;
    }
    delete(options?: { count?: string }) {
      this.op = "delete";
      this.wantCount = Boolean(options?.count);
      return this;
    }
    maybeSingle() {
      this.wantSingle = true;
      return this;
    }
    async single() {
      this.wantSingle = true;
      return this.run();
    }

    private run() {
      switch (this.op) {
        case "insert": {
          const items = Array.isArray(this.payload) ? this.payload : [this.payload];
          const inserted = items.map((item) => {
            const row = { id: `row-${nextId++}`, revision: 1, ...(item as object) } as Record<
              string,
              unknown
            >;
            tables[this.table].push(row);
            return row;
          });
          return { data: this.wantSingle ? inserted[0] : inserted, error: null };
        }
        case "update": {
          const matched = this.rows();
          for (const row of matched) Object.assign(row, this.payload as object);
          return { data: matched, error: null };
        }
        case "delete": {
          const matched = this.rows();
          // Splice in place: tests hold a reference to this array.
          for (const row of matched) {
            const index = tables[this.table].indexOf(row);
            if (index >= 0) tables[this.table].splice(index, 1);
          }
          return { data: null, error: null, count: this.wantCount ? matched.length : null };
        }
        default: {
          const matched = this.rows();
          return { data: this.wantSingle ? (matched[0] ?? null) : matched, error: null };
        }
      }
    }

    then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  return {
    client: { from: (table: string) => new Query(table) },
    get files() {
      return tables.project_files as unknown as Row[];
    },
    get revisions() {
      return tables.file_revisions as unknown as { file_id: string; revision: number; content: string }[];
    },
  };
}

function makeContext() {
  const fake = createFakeSupabase();
  const activity: { kind: string; summary: string }[] = [];

  const tools = buildTools({
    // The fake only needs to satisfy the calls the tools make.
    supabase: fake.client as never,
    projectId: "project-1",
    userId: "user-1",
    onActivity: (event) => activity.push({ kind: event.kind, summary: event.summary }),
  });

  return { tools, activity, ...fake };
}

type ToolResult = Record<string, unknown>;

const call = async (tool: unknown, input: unknown): Promise<ToolResult> => {
  const execute = (tool as { execute: (i: unknown, o: unknown) => Promise<ToolResult> }).execute;
  return execute(input, {} as never);
};

beforeEach(() => {
  studioState.connection = null;
  studioState.enqueued = [];
});

describe("create_file", () => {
  it("writes a valid file and reports its validation result", async () => {
    const { tools, files, activity } = makeContext();

    const result = await call(tools.create_file, {
      path: "src/shared/Config.luau",
      content: '--!strict\nlocal Config = {}\nreturn Config\n',
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe("src/shared/Config.luau");
    expect(files).toHaveLength(1);
    expect(files[0].roblox_parent).toBe("ReplicatedStorage");
    expect(activity.map((a) => a.kind)).toContain("file.created");
    expect((result.validation as { ok: boolean }).ok).toBe(true);
  });

  it("refuses a path that escapes the project sandbox", async () => {
    const { tools, files } = makeContext();

    for (const path of ["../../etc/passwd", "/etc/passwd", ".env", "node_modules/x.luau"]) {
      const result = await call(tools.create_file, { path, content: "x" });
      expect(result.ok).toBe(false);
      expect(typeof result.error).toBe("string");
    }
    expect(files).toHaveLength(0);
  });

  it("refuses a file larger than the cap", async () => {
    const { tools, files } = makeContext();
    const result = await call(tools.create_file, {
      path: "src/shared/Big.luau",
      content: "a".repeat(200_001),
    });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/limit/i);
    expect(files).toHaveLength(0);
  });

  it("refuses to overwrite an existing file", async () => {
    const { tools } = makeContext();
    await call(tools.create_file, { path: "src/shared/A.luau", content: "return {}" });

    const result = await call(tools.create_file, {
      path: "src/shared/A.luau",
      content: "return {2}",
    });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/already exists/);
  });

  it("surfaces validation failures instead of silently accepting bad Luau", async () => {
    const { tools } = makeContext();
    const result = await call(tools.create_file, {
      path: "src/shared/Broken.luau",
      content: "local function f()\n\tif a != b then\n",
    });

    // The file is still written — the agent is told to fix it on the next step.
    expect(result.ok).toBe(true);
    const validation = result.validation as { ok: boolean; errors: number; report: string };
    expect(validation.ok).toBe(false);
    expect(validation.errors).toBeGreaterThan(0);
    expect(validation.report).toMatch(/~=/);
  });
});

describe("update_file", () => {
  it("snapshots the previous revision before overwriting", async () => {
    const { tools, files, revisions } = makeContext();
    await call(tools.create_file, { path: "src/shared/A.luau", content: "return 1" });

    const result = await call(tools.update_file, {
      path: "src/shared/A.luau",
      content: "return 2",
    });

    expect(result.ok).toBe(true);
    expect(files[0].content).toBe("return 2");
    expect(files[0].revision).toBe(2);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].content).toBe("return 1");
  });

  it("refuses to update a file that does not exist", async () => {
    const { tools } = makeContext();
    const result = await call(tools.update_file, {
      path: "src/shared/Missing.luau",
      content: "return 1",
    });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/does not exist/);
  });
});

describe("read_file / list_files / delete_file", () => {
  it("reads back what was written", async () => {
    const { tools } = makeContext();
    await call(tools.create_file, { path: "src/shared/A.luau", content: "return 42" });

    const result = await call(tools.read_file, { path: "src/shared/A.luau" });
    expect(result.ok).toBe(true);
    expect(result.content).toBe("return 42");
  });

  it("refuses to read outside the sandbox", async () => {
    const { tools } = makeContext();
    const result = await call(tools.read_file, { path: "../../.env" });
    expect(result.ok).toBe(false);
  });

  it("lists every file with its size", async () => {
    const { tools } = makeContext();
    await call(tools.create_file, { path: "src/shared/A.luau", content: "return 1" });
    await call(tools.create_file, { path: "src/server/B.server.luau", content: "print('x')" });

    const result = await call(tools.list_files, {});
    expect(result.count).toBe(2);
  });

  it("deletes an existing file and refuses a missing one", async () => {
    const { tools, files } = makeContext();
    await call(tools.create_file, { path: "src/shared/A.luau", content: "return 1" });

    expect((await call(tools.delete_file, { path: "src/shared/A.luau", reason: "obsolete" })).ok).toBe(
      true,
    );
    expect(files).toHaveLength(0);

    const missing = await call(tools.delete_file, { path: "src/shared/A.luau", reason: "again" });
    expect(missing.ok).toBe(false);
  });
});

describe("validate_scripts", () => {
  it("reports clean when every script passes", async () => {
    const { tools } = makeContext();
    await call(tools.create_file, {
      path: "src/shared/A.luau",
      content: '--!strict\nlocal M = {}\nreturn M\n',
    });

    const result = await call(tools.validate_scripts, {});
    expect(result.ok).toBe(true);
    expect(result.errors).toBe(0);
  });

  it("reports errors the agent can act on", async () => {
    const { tools } = makeContext();
    await call(tools.create_file, {
      path: "src/shared/Bad.luau",
      content: "if a != b then end",
    });

    const result = await call(tools.validate_scripts, {});
    expect(result.ok).toBe(false);
    expect(result.errors as number).toBeGreaterThan(0);
    expect(String(result.report)).toContain("src/shared/Bad.luau");
  });

  it("skips non-Luau files", async () => {
    const { tools } = makeContext();
    await call(tools.create_file, { path: "docs/plan.md", content: "# not luau != fine" });

    const result = await call(tools.validate_scripts, {});
    expect(result.checked).toBe(0);
    expect(result.ok).toBe(true);
  });
});

describe("studio tools", () => {
  it("reports disconnected without throwing", async () => {
    const { tools } = makeContext();
    const result = await call(tools.studio_status, {});
    expect(result.ok).toBe(true);
    expect(result.connected).toBe(false);
  });

  it("refuses to queue an action when Studio is not connected", async () => {
    const { tools } = makeContext();
    const result = await call(tools.request_studio_action, { action: "sync_files" });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/not connected/i);
    expect(studioState.enqueued).toHaveLength(0);
  });

  it("queues the action when Studio is connected", async () => {
    studioState.connection = { id: "conn-1", status: "connected", place_name: "My Place" };
    const { tools, activity } = makeContext();

    const result = await call(tools.request_studio_action, { action: "sync_files" });

    expect(result.ok).toBe(true);
    expect(result.commandId).toBe("cmd-1");
    expect(studioState.enqueued).toEqual([
      { action: "sync_files", payload: { action: "sync_files" } },
    ]);
    expect(activity.map((a) => a.kind)).toContain("studio.queued");
  });
});

describe("plan_build", () => {
  it("records the plan for the live checklist", async () => {
    const { tools, activity } = makeContext();
    const result = await call(tools.plan_build, {
      goal: "Build a crystal simulator",
      steps: ["Config module", "Currency service", "Shop UI"],
    });

    expect(result.ok).toBe(true);
    expect(activity[0]).toMatchObject({ kind: "plan", summary: "Build a crystal simulator" });
  });
});
