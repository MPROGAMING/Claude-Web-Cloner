import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static guards on the SQL, pinning two mistakes that were found only by
 * querying a live database — neither is visible by reading the migration.
 *
 * 1. `CREATE FUNCTION` grants EXECUTE to PUBLIC, and every role inherits from
 *    PUBLIC. Revoking from `anon`/`authenticated` alone is a no-op, and
 *    PostgREST then exposes the function at /rest/v1/rpc/<name> to anyone with
 *    the anon key. `grant_credits` was reachable that way and would mint
 *    unlimited credits.
 *
 * 2. A SECURITY DEFINER function that takes a user id *and* is callable by
 *    `authenticated` lets any signed-in user act on any account. The safe shape
 *    is to read `auth.uid()` inside the function instead.
 */

const MIGRATIONS_DIR = "supabase/migrations";

function sql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8"))
    .join("\n");
}

const initSql = readFileSync(`${MIGRATIONS_DIR}/0001_init.sql`, "utf8");

/**
 * Statements, not lines. Grants and revokes are wrapped across lines in later
 * migrations, and a line-based filter silently misses the wrapped half — which
 * is precisely how a revoke can look present while being absent.
 */
function statements(): string[] {
  return sql()
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
}

/** Every function name the migrations create. */
function createdFunctions(): string[] {
  return [
    ...new Set(
      [...sql().matchAll(/create (?:or replace )?function public\.(\w+)/gi)].map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  ];
}

/**
 * Roles Supabase's ALTER DEFAULT PRIVILEGES hands to every function created in
 * `public`. A function is born holding these — the set is NOT empty, and
 * modelling it as empty is what lets an unintended grant look absent.
 */
const SUPABASE_DEFAULT_EXECUTE_ROLES = ["anon", "authenticated", "service_role"];

/**
 * Functions whose *final* state grants EXECUTE to `role`, replaying creation,
 * grants and revokes in migration order the way Postgres actually would.
 *
 * The seeding on CREATE is the whole point: the danger is never a visible
 * `grant ... to authenticated`, it is a function that was never mentioned in a
 * revoke and quietly kept the default.
 *
 * `create or replace` on an existing function preserves its ACL rather than
 * re-applying default privileges, so each name is seeded only on first create.
 */
function functionsGrantedTo(role: string): string[] {
  const held = new Set<string>();
  const created = new Set<string>();

  for (const stmt of statements()) {
    const create = /^create (?:or replace )?function public\.(\w+)/.exec(stmt);
    if (create) {
      const fn = create[1];
      if (!created.has(fn)) {
        created.add(fn);
        if (SUPABASE_DEFAULT_EXECUTE_ROLES.includes(role)) held.add(fn);
      }
      continue;
    }

    const grant = /^grant execute on function public\.(\w+)\s*\(([^)]*)\)\s*to (.+)$/.exec(stmt);
    if (grant && grant[3].split(",").some((r) => r.trim() === role)) {
      held.add(grant[1]);
      continue;
    }

    const revoke = /^revoke (?:all|execute).* on function public\.(\w+)\s*\(([^)]*)\)\s*from (.+)$/.exec(
      stmt,
    );
    if (revoke && revoke[3].split(",").some((r) => r.trim() === role)) {
      held.delete(revoke[1]);
    }
  }

  return [...held];
}

describe("SECURITY DEFINER functions", () => {
  const definerFunctions = ["consume_credits", "grant_credits", "handle_new_user"];

  it.each(definerFunctions)("%s has EXECUTE revoked from PUBLIC", (fn) => {
    const revokes = initSql
      .split("\n")
      .filter((line) => line.includes("revoke") && line.includes(fn));

    expect(revokes.length).toBeGreaterThan(0);
    // The word `public` must appear as a revoke target, not just `anon`.
    expect(revokes.some((line) => /from[^;]*\bpublic\b/.test(line))).toBe(true);
  });

  it("never revokes from anon/authenticated without also revoking from public", () => {
    for (const line of sql().split("\n")) {
      if (!line.trim().startsWith("revoke")) continue;
      if (!/\bfrom\b/.test(line)) continue;
      const target = line.split(/\bfrom\b/)[1] ?? "";
      if (/\banon\b|\bauthenticated\b/.test(target)) {
        expect(
          /\bpublic\b/.test(target),
          `revoke misses PUBLIC and is therefore a no-op: ${line.trim()}`,
        ).toBe(true);
      }
    }
  });

  it("pins search_path on every SECURITY DEFINER function", () => {
    const blocks = initSql.split("create or replace function").slice(1);
    for (const block of blocks) {
      if (!block.includes("security definer")) continue;
      const head = block.slice(0, block.indexOf("as $$"));
      expect(head, `missing search_path: ${head.slice(0, 60)}`).toContain("set search_path");
    }
  });
});

describe("consume_credits shape", () => {
  it("takes no user id — it must read auth.uid() instead", () => {
    const start = initSql.indexOf("create or replace function public.consume_credits");
    expect(start).toBeGreaterThan(-1);

    const signature = initSql.slice(start, initSql.indexOf(")", start));
    expect(signature).not.toContain("p_user_id");
    expect(initSql.slice(start, start + 1200)).toContain("auth.uid()");
  });

  it("is the only credit function exposed to signed-in users", () => {
    const granted = functionsGrantedTo("authenticated");

    expect(granted).toContain("consume_credits");
    expect(granted).not.toContain("grant_credits");
  });

  it("checks the balance in the same statement that decrements it", () => {
    // Two statements would let concurrent requests both pass the check.
    const start = initSql.indexOf("create or replace function public.consume_credits");
    const body = initSql.slice(start, initSql.indexOf("$$;", start));
    const update = body.slice(body.indexOf("update public.credit_balances"));

    expect(update).toContain("balance >= p_amount");
    expect(update).toContain("returning balance");
  });
});

describe("row level security", () => {
  it("enables RLS on every table it creates", () => {
    const tables = [...initSql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(10);

    for (const table of tables) {
      expect(
        initSql.includes(`alter table public.${table} enable row level security`),
        `RLS not enabled on ${table}`,
      ).toBe(true);
    }
  });

  /**
   * The check above only looks at 0001, which means every table added since —
   * the knowledge tables, the agent tables, blueprints, notifications — could
   * ship without RLS and the suite would still be green.
   *
   * Matched against normalised statements rather than raw text: 0004 and 0008
   * column-align their `alter table` runs, and a naive substring search finds
   * none of them. The same trap the grant checks above already document, in a
   * new place.
   */
  it("enables RLS on every table any migration creates", () => {
    const enabled = new Set(
      statements()
        .map((stmt) => /^alter table public\.(\w+) enable row level security$/.exec(stmt)?.[1])
        .filter((name): name is string => Boolean(name)),
    );

    const tables = [...sql().matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(15);

    for (const table of tables) {
      expect(enabled.has(table.toLowerCase()), `RLS not enabled on ${table}`).toBe(true);
    }
  });

  /**
   * A policy without `to authenticated` also applies to `anon`, which for an
   * owner-scoped table means the whole guard rests on `auth.uid()` being null
   * for an anonymous caller. That is true today; naming the role is the part
   * that does not depend on it staying true.
   */
  it("scopes every notifications policy to signed-in owners", () => {
    const notificationsSql = readFileSync(`${MIGRATIONS_DIR}/0010_notifications.sql`, "utf8");
    const policies = [...notificationsSql.matchAll(/create policy[^;]+;/g)].map((m) => m[0]);

    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy, `policy is not restricted to authenticated: ${policy}`).toContain(
        "to authenticated",
      );
      expect(policy, `policy does not scope to the owner: ${policy}`).toContain(
        "owner_id = auth.uid()",
      );
    }
  });

  it("dedupes notifications in the database rather than in process", () => {
    // Both handlers that close a run can fire, and both notify. Only a unique
    // index makes "notify once" true.
    const notificationsSql = readFileSync(`${MIGRATIONS_DIR}/0010_notifications.sql`, "utf8");
    expect(notificationsSql).toMatch(
      /create unique index[^;]+on public\.notifications \(owner_id, dedupe_key\)/,
    );
  });

  it("gives credit_balances no write policy", () => {
    const section = initSql.slice(
      initSql.indexOf("create table public.credit_balances"),
      initSql.indexOf("create table public.credit_transactions"),
    );
    expect(section).toContain("for select");
    expect(section).not.toMatch(/for (insert|update|delete|all)/);
  });
});

/**
 * Supabase's ALTER DEFAULT PRIVILEGES is a second, independent way for a
 * function to end up callable by signed-in users — separate from the PUBLIC
 * default that these tests already guard.
 *
 * Supabase ships `alter default privileges in schema public grant execute on
 * functions to anon, authenticated, service_role`. Once a pg_default_acl entry
 * exists, Postgres applies it INSTEAD of the built-in PUBLIC default, so a new
 * function is born holding three explicit role grants and no PUBLIC entry at
 * all. `revoke ... from public, anon` then reads as correct, reviews as
 * correct, and still leaves `authenticated` with EXECUTE.
 *
 * That is exactly what happened to knowledge_pending_chunks: the migration
 * granted it to service_role only, and the live ACL said otherwise. Caught by
 * querying real ACLs, fixed in 0006, pinned here.
 */
describe("Supabase default function privileges", () => {
  it("never lets a function inherit the default authenticated grant", () => {
    for (const fn of createdFunctions()) {
      const mentions = statements().filter((s) =>
        new RegExp(`(grant|revoke).*on function public\\.${fn}\\b`).test(s),
      );
      // Revoking from PUBLIC says nothing about `authenticated`, which holds an
      // explicit grant of its own. The role must be named outright.
      const decides = mentions.some((s) => /\bauthenticated\b/.test(s));
      expect(decides, `${fn} never states an intent for the authenticated role`).toBe(true);
    }
  });

  it("grants EXECUTE to signed-in users only where intended", () => {
    // Deliberate and reviewed. The knowledge_* readers are SECURITY INVOKER, so
    // RLS decides what they return, and the corpus they read is public
    // documentation already exposed by the knowledge_* select policies.
    const allowed = [
      "consume_credits",
      "knowledge_symbol_lookup",
      "knowledge_lexical_search",
      "knowledge_vector_search",
      "knowledge_code_search",
    ].sort();

    expect(functionsGrantedTo("authenticated").sort()).toEqual(allowed);
  });

  it("keeps server-only functions off both anon and authenticated", () => {
    const serverOnly = ["grant_credits", "handle_new_user", "knowledge_pending_chunks"];

    for (const fn of serverOnly) {
      expect(functionsGrantedTo("authenticated"), `${fn} is exposed to signed-in users`).not.toContain(fn);
      expect(functionsGrantedTo("anon"), `${fn} is exposed to anonymous callers`).not.toContain(fn);
    }
  });
});
