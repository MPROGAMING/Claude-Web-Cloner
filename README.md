<div align="center">

# Blockwright

**An AI build partner for Roblox creators.**
Describe a mechanic — get working Luau, organised into a real project, applied
straight into Roblox Studio.

</div>

---

## What it does

You type:

> Create a simulator where players collect crystals, sell them, buy backpacks
> and unlock new islands.

Blockwright plans the build, writes the Luau into a properly structured project
(`ServerScriptService` / `ReplicatedStorage` / `StarterGui` …), statically checks
its own output for the mistakes models actually make in Roblox code, fixes what
it finds, and — if the Studio plugin is paired — pushes the scripts into the
place you have open.

Not "here is some code". The project exists when it is done.

## Requirements

- **Node 22+** (24 LTS or 26 recommended — the AI SDK v7 requires 22+)
- A **Supabase** project
- At least one AI provider API key

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` in development |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Studio only | **server-only**; required *only* for the Roblox Studio bridge. Auth, projects, chat and credits all work without it. |
| `ANTHROPIC_API_KEY` | one of | Claude Sonnet 4.5 / Opus 4.5 / Haiku 4.5 |
| `OPENAI_API_KEY` | one of | GPT-5 / GPT-5 mini |
| `GOOGLE_GENERATIVE_AI_API_KEY` | one of | Gemini 2.5 Pro / Flash |
| `OPENROUTER_API_KEY` | one of | GPT-5.6 Luna, Gemini 3.7 Flash, Hy3, Kimi K3, GLM 5.2, plus the live free tier |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | no | Comma-separated OAuth providers you enabled in Supabase |

Models whose provider has no key are shown in the picker as unavailable, naming
the key that is missing — they are never silently hidden.

**OpenRouter** adds the requested models plus a free tier that is discovered
live: the catalog is fetched at runtime, free status is read from real pricing,
and a model that becomes paid stops showing FREE on the next refresh. No code
change is needed when the free list moves.

Then create the schema: open the Supabase SQL editor and run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It
creates every table, all RLS policies, the credit functions, and the trigger
that grants 2,000 credits on signup.

```bash
npm run dev
```

Without Supabase credentials the marketing pages still render and the app area
shows a setup screen rather than crashing.

## Commands

```bash
npm run dev              # dev server (Turbopack)
npm run build            # production build
npm run lint             # ESLint + React Compiler rules
npm run typecheck        # tsc --noEmit
npm run test             # vitest
npm run check            # all four
npm run verify:security  # live RLS + privilege checks against your Supabase project
```

`verify:security` signs in as two real users and attempts every cross-tenant
access the schema is supposed to refuse. Run it after any migration — unit tests
prove our logic, this proves Postgres is enforcing it.

## Roblox Studio plugin

See [`roblox-plugin/README.md`](roblox-plugin/README.md).

Short version: drop `roblox-plugin/Blockwright.server.lua` into your local
Roblox `Plugins` folder, restart Studio, then in the web app open a project →
**Connect Roblox Studio** → paste the six-character code into the plugin.

The plugin only ever executes allowlisted verbs (`sync_files`, `inspect_place`,
`create_folder`, `remove_instance`). It is never sent code to run.

## Deploying

Vercel-ready as-is.

1. Import the repo.
2. Set the same environment variables in Project Settings → Environment
   Variables. `SUPABASE_SERVICE_ROLE_KEY` and the provider keys must **not** be
   prefixed with `NEXT_PUBLIC_`.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployed URL.
4. In Supabase → Authentication → URL Configuration, add
   `https://your-app.vercel.app/auth/callback` as a redirect URL.
5. In the Studio plugin, change the server URL box to your deployed URL.

## Documentation

| Document | What it covers |
| -------- | -------------- |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | What the product is, its principles, feature surface, scope boundaries |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layer boundaries, security model, AI SDK v7 gotchas, the Studio bridge |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, type scale, component rules, motion, accessibility |
| [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) | What is done, what is unverified, known gaps, next work |

## Model catalog

| Model | Routed via | Free | Context |
| ----- | ---------- | ---- | ------- |
| Claude Sonnet 4.5 / Opus 4.5 / Haiku 4.5 | Anthropic (direct) | No | 200K |
| GPT-5 / GPT-5 mini | OpenAI (direct) | No | 400K |
| Gemini 2.5 Pro / Flash | Google (direct) | No | 1M |
| GPT-5.6 Luna | OpenRouter | No | 1.05M |
| Gemini 3.7 Flash | OpenRouter | No | 1M |
| Hy3 | OpenRouter | No | 262K |
| Kimi K3 | OpenRouter | No | 1M |
| GLM 5.2 | OpenRouter | No | 1M |
| Free Models Router | OpenRouter | **Yes** | 200K |
| …plus every currently-free OpenRouter model | OpenRouter | **Yes** | varies |

All slugs, prices and capabilities were verified against the live OpenRouter
catalog — see `docs/IMPLEMENTATION_STATUS.md` for the verification table.

## Credits

`npm run verify:security` proves tenant isolation and credit integrity against
your live database (24 assertions).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict ·
Tailwind v4 · shadcn/ui on Base UI · Vercel AI SDK v7 · OpenRouter ·
Supabase (Postgres, Auth, RLS) · Vitest

## Credits and licences

- Provider logos — [`@lobehub/icons`](https://icons.lobehub.com) (MIT)
- Game genre icons — [Game-icons.net](https://game-icons.net) (CC BY 3.0)
- UI icons — [Lucide](https://lucide.dev) (ISC)

Provider names and logos are trademarks of their respective owners, shown for
identification only.

## Licence

MIT. Not affiliated with, endorsed by, or sponsored by Roblox Corporation.
Roblox and Luau are trademarks of their respective owners.
