<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

---
description: Project conventions for AI Website Clone Template
alwaysApply: true
---
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Blockwright

An AI build partner for Roblox creators. The user describes a mechanic;
the agent plans it, writes real Luau into a structured project, validates its
own output, and syncs it into Roblox Studio through a dedicated plugin.

**Read `docs/ARCHITECTURE.md` before changing anything in `src/lib/`.**

## Commands

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run lint       # ESLint + React Compiler rules
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run check      # lint + typecheck + test + build
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
shadcn/ui on **Base UI** (not Radix) · Vercel AI SDK **v7** · Supabase · Vitest

## Things that will bite you

These are the mistakes that are easy to make here and expensive to debug.

**Next.js 16**
- `middleware.ts` is now **`proxy.ts`**, exporting `proxy()`. Node runtime only.
- `params`, `searchParams`, `cookies()`, `headers()` are all **async**.
- Turbopack is the default for `dev` and `build`.

**AI SDK v7** — a lot was renamed. See the table in `docs/ARCHITECTURE.md`.
The two that cause the most confusion:
- `system:` → **`instructions:`**, `onFinish` → **`onEnd`**, `fullStream` → **`stream`**, `stepCountIs` → **`isStepCount`**.
- `convertToModelMessages` is **async** and needs `{ tools }`.

**Postgres grants** — a new function is **never** born private, and there are
**two** separate reasons why. Both have bitten this repo.

1. `CREATE FUNCTION` grants EXECUTE to `PUBLIC`, and every role inherits it, so
   `REVOKE ... FROM anon, authenticated` alone does **nothing**.
2. Supabase additionally ships `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT
   EXECUTE ON FUNCTIONS TO anon, authenticated, service_role`. Once a
   `pg_default_acl` entry exists Postgres applies it **instead of** the built-in
   PUBLIC default, so the function is born holding three *explicit* role grants
   and no PUBLIC entry at all — and `REVOKE ... FROM public, anon` then reads as
   correct, reviews as correct, and still leaves `authenticated` with EXECUTE.

So the rule is: **`REVOKE ... FROM public, anon, authenticated`, then grant back
only the roles you actually want.** Naming all three is not redundant.

PostgREST publishes every `public`-schema function at `/rest/v1/rpc/<name>`,
which turns a missed revoke into an internet endpoint. #1 made `grant_credits`
an unauthenticated credit-minting endpoint; #2 left `knowledge_pending_chunks`
callable by any signed-in user (no escalation — it is INVOKER and those tables
are already readable — but unintended, and the next server-only function would
have leaked the same way). Fixed in `0006`.

Neither is visible by reading the migration, so both are pinned two ways:
`tests/migration-safety.test.ts` replays creation + grants + revokes with the
Supabase defaults **seeded on CREATE**, and `npm run verify:security` probes the
RPCs live as a real signed-in user. Trust the live probe over the SQL.

**Supabase types** — `lib/supabase/types.ts` is hand-maintained and its row
shapes must be **type aliases, not interfaces**. An interface has no implicit
index signature, so it fails postgrest-js's `Record<string, unknown>`
constraint and every query silently resolves to `never`. If you change the SQL,
change that file in the same commit.

**Base UI** — navigation uses `<LinkButton href>` from
`components/ui/link-button.tsx`, never `<Button render={<Link/>}>`. Base UI's
Button asserts native button semantics and will warn (correctly) at runtime.
Compose with the `render` prop, not `asChild`.

**React Compiler lint** — `setState` inside an effect is an error, not a
warning. If you hit it, the state is almost certainly derived; use `useMemo`,
a lazy initial value, or move the write into the callback that learns the news.

## Code style

- TypeScript strict, no `any`.
- Named exports; PascalCase components; camelCase utils.
- Tailwind utilities only — no inline styles, no ad-hoc colours. Extend
  `src/app/globals.css` instead (see `docs/DESIGN_SYSTEM.md`).
- 2-space indent, mobile-first responsive.
- Server-only modules import `"server-only"` at the top.
- Comment *why*, not *what*. No decorative banners.

## Security rules that are not negotiable

- Provider API keys and the Supabase service-role key are **server-only**.
  Never import them into a client component.
- Use `lib/supabase/server.ts` (user-scoped, RLS applies) by default.
  `lib/supabase/admin.ts` bypasses RLS and is for the **Roblox Studio bridge
  only** — do not widen its use. Credits and AI logging were deliberately moved
  off it, and the app runs fully without a service-role key.
- `consume_credits` takes no user id (it reads `auth.uid()`), which is why it is
  safe for `authenticated`. `grant_credits` takes one, so it stays server-only.
  Preserve that asymmetry.
- After any migration, run `npm run verify:security` against a live project.
- Every path the model proposes goes through `validateProjectPath`.
- Studio commands are allowlisted verbs. Never send the plugin code to execute.
- Internal error detail is logged, never returned to the browser.

## Structure

```
src/
  app/
    (marketing)/   landing, pricing
    (auth)/        sign-in, sign-up, callback
    (app)/         dashboard, projects, templates, activity, credits, settings
    api/           chat, studio/{pair,poll,status}, projects/[id]/files
  components/      ui/ (shadcn) · app/ · marketing/ · workspace/ · brand/
  lib/
    ai/            registry, providers, tools, system-prompt, types
    credits/       pricing (pure) · service (server)
    roblox/        project-model, luau-validator
    studio/        protocol, service, liveness
    supabase/      client, server, admin, types
    actions/       server actions
    data/          server-component queries
  proxy.ts
supabase/migrations/
roblox-plugin/
docs/
tests/
```

## Handing this project to another AI

`docs/PROJECT-CONTEXT-FOR-AI.md` is a single self-contained file that explains
the whole project — stack, architecture, data model, the traps in §7, the
security rules, and what is genuinely unfinished. Paste that one file into
another assistant instead of uploading the repository.

Keep it current when architecture changes. Its numbers were extracted from the
codebase, not remembered, and it is only useful while that stays true.

## Working notes

- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh`.
- Keep `docs/IMPLEMENTATION_STATUS.md` current — it is how the next session
  learns what is verified versus merely written.
- Do not introduce Redux, an ORM, or MCP into the web app. The stack is
  deliberately small.
