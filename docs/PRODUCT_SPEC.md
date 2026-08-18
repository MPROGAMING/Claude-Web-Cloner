# Product spec

## What Blockwright is

An AI build partner for Roblox creators. The user describes a mechanic in plain
language; Blockwright plans it, writes real Luau into a structured project,
statically checks its own output, and — when the Studio plugin is paired —
pushes the scripts into the place they have open.

The distinction the whole product rests on:

> A chatbot answers *"how do I build a shop?"*
> Blockwright answers *"build me a shop"* and then the shop exists.

## Who it is for

Roblox creators who can describe what they want and evaluate whether it works,
but for whom writing every system from scratch is the bottleneck. They are not
necessarily strong Luau programmers, and they are not looking for a tutorial.

## Core loop

```
Prompt  →  Plan  →  Files written  →  Self-validation  →  Studio sync  →  Summary
```

Each stage is visible and each corresponds to a real operation. There is no
synthetic progress anywhere in the product; if the status rail says
"Validated 7 scripts", seven scripts were validated.

## Principles

1. **Build, don't advise.** The agent is instructed never to paste whole files
   into chat. Files go in the file tree; chat explains the decisions.
2. **Never fake it.** No mocked AI, no invented progress, no fabricated
   testimonials or customer logos, no pricing claims the system cannot honour.
3. **Studio is optional.** The web app is the product. Everything works
   disconnected; syncing is an enhancement.
4. **The model is an untrusted caller.** Every action it proposes is
   schema-validated and then re-validated against project rules server-side.
5. **Honest failure.** Errors say what happened and what to do. No stack traces
   reach the browser.

## Feature surface

### Landing (`/`, `/pricing`)
Hero with a scripted preview built from real product components, how-it-works,
Studio bridge explainer, feature grid, templates, model wall rendered from the
registry, credit packs, FAQ. No fabricated social proof.

### Auth (`/sign-in`, `/sign-up`)
Supabase email + password. Server actions only — the browser never calls the
auth API directly, so the session cookie is always set server-side. Signup
provisions a profile and 2,000 credits via a database trigger.

### Dashboard (`/dashboard`)
Welcome state, three stat tiles (projects / credits / live Studio connections),
recent projects, template shortcuts, recent activity.

### Projects (`/projects`, `/projects/[id]`)
Create, rename, duplicate (files copied, conversation not), archive, delete.
Active/archived tabs.

### Workspace (`/projects/[id]`)
The primary screen. Three regions:

- **Left** — file tree with search, kind-coloured icons, changed-this-session markers
- **Centre** — conversation, live status rail, composer
- **Right** — code viewer (line numbers, in-file search, diagnostics, revert) and Studio panel

Panels collapse; below `lg` they become overlay sheets.

### Chat
Streaming, markdown, syntax-highlighted code blocks with copy, expandable tool
rows, plan checklists, regenerate, stop, smart auto-scroll (never yanks a
reading user back down), empty-state suggestions, honest error presentation.

Composer: multiline, Enter to send / Shift+Enter for newline, model selector,
context indicator, credit estimate, attachment slot reserved.

### Templates (`/templates`)
Eight starters across Economy / Progression / Combat / Systems / Social. A
template is a **well-specified prompt**, not frozen code — so it never goes
stale against current Roblox APIs and never ships unreviewed source.

### Credits (`/credits`)
Balance, lifetime granted/spent, per-model breakdown, per-request table with
tokens and latency, full transaction ledger, low-balance warning.

### Settings (`/settings`)
Display name, Roblox username, default model, account facts, plugin install
instructions.

### Studio bridge
Per-project pairing with a 6-character code. Plugin polls; results and errors
flow back into the activity feed and are readable by the agent on the next turn.

## Agent action surface

| Tool | Purpose |
| ---- | ------- |
| `plan_build` | Announce goal + 2–8 steps; renders as a live checklist |
| `list_files` | See what exists |
| `read_file` | Read before writing |
| `create_file` / `update_file` / `delete_file` | Mutate the project |
| `validate_scripts` | Static Luau check; the agent must fix what it reports |
| `studio_status` | Is the plugin connected |
| `request_studio_action` | Queue an allowlisted verb for the plugin |

## Credits

An internal unit. Each model publishes a rate per million input and output
tokens (`lib/ai/registry.ts`); a request costs the linear combination, rounded
up so a non-zero request never costs zero.

- Pre-flight refuses a request that clearly cannot be paid for.
- The actual charge comes from the provider's reported tokens after the stream.
- A request that fails before reaching a provider costs nothing.
- Balance mutations are atomic and server-only.

Packs are configured in `CREDIT_PACKS`. **Checkout is not implemented** — the
interfaces exist and the UI says so plainly rather than faking a success flow.

## Explicitly out of scope for v0.1

- Payment processing (Stripe interfaces prepared, not wired)
- Team workspaces / sharing
- Roblox OAuth identity (schema has `roblox_username`; the auth flow is not built)
- File attachments in the composer (slot reserved, disabled with a tooltip)
- Publishing to Roblox or analytics on published games
- Real-time multiplayer editing

## Non-goals

- Being a general-purpose coding assistant. The system prompt, tools, validator
  and project model are all Roblox-specific on purpose.
- Replacing Roblox Studio. Blockwright generates and syncs; the creator still
  builds, tests and ships in Studio.
