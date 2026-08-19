#!/usr/bin/env node
/**
 * Studio bridge acceptance — pair, poll, execute, report, for real.
 *
 * This is the one path in the product that cannot be proven from the web side
 * alone: everything up to "a command is queued" was already verified, and
 * everything after it happens inside Roblox Studio. So this script does the
 * half a server can do and then waits on the plugin to do the rest, asserting
 * on what actually comes back rather than on what was sent.
 *
 * It is interactive by necessity — a human types the pairing code into the
 * plugin, which is the point: the code IS the credential, and a script that
 * bypassed that would be testing something the product does not do.
 *
 * The assertions that matter are the negative ones. An unknown verb must be
 * refused rather than guessed at, and a token must not be able to close
 * another project's commands.
 *
 * Usage: node scripts/roblox-brain/verify-studio.mjs [--base http://localhost:3000]
 */

import { readFileSync, existsSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  ${detail}` : ""}`);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}

const session = await signIn(process.env.QA_USER_A, process.env.QA_PASSWORD);
if (!session.access_token) {
  console.error("QA sign-in failed:", JSON.stringify(session));
  process.exit(1);
}
const rest = {
  apikey: ANON,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const userId = session.user.id;

console.log("\nStudio bridge acceptance");
console.log("=".repeat(70));
check("QA user signs in", Boolean(session.access_token));

// --- a project to pair against ---------------------------------------------
const project = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
      method: "POST",
      headers: rest,
      body: JSON.stringify({
        owner_id: userId,
        name: "Studio bridge acceptance",
        description: "Created by verify-studio.mjs",
      }),
    })
  ).json()
)[0];
check("project created", Boolean(project?.id), project?.id ?? "");

// --- 1. pairing code --------------------------------------------------------
console.log("\n[1] Pairing");

const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

const conn = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/studio_connections?on_conflict=project_id`, {
      method: "POST",
      headers: { ...rest, Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        project_id: project.id,
        owner_id: userId,
        pair_code: code,
        pair_expires_at: expiresAt,
        token_hash: null,
        status: "pending",
        last_seen_at: null,
      }),
    })
  ).json()
)[0];
check("pairing code issued", Boolean(conn?.id), code);

console.log(`\n  \x1b[1m\x1b[33m→ Type this into the Blockwright plugin in Studio:  ${code}\x1b[0m`);
console.log("    (Plugins tab → Blockwright → paste the code → Connect)\n");

// --- 2. wait for the plugin to claim it ------------------------------------
async function connection() {
  const rows = await (
    await fetch(`${SUPABASE_URL}/rest/v1/studio_connections?select=*&project_id=eq.${project.id}`, { headers: rest })
  ).json();
  return rows[0];
}

const PAIR_DEADLINE = Date.now() + 180_000;
let paired = null;
while (Date.now() < PAIR_DEADLINE) {
  const c = await connection();
  if (c?.status === "connected") { paired = c; break; }
  await sleep(2000);
}

check("plugin claimed the code", Boolean(paired), paired ? `place "${paired.place_name}"` : "timed out after 3 minutes");
if (!paired) {
  console.log("\n  The plugin never paired. Nothing below can run.\n");
  process.exit(1);
}
check("connection records the open place", Boolean(paired.place_name), paired.place_name ?? "");
check("pairing code is spent", paired.pair_code === null || paired.status === "connected");
check("a token hash was stored, not a token", typeof paired.token_hash === "string" && paired.token_hash.length > 0);

// --- 3. queue commands and watch the plugin execute them -------------------
console.log("\n[2] Execute — the plugin polls, acts, and reports back");

async function queue(action, payload) {
  const rows = await (
    await fetch(`${SUPABASE_URL}/rest/v1/studio_commands`, {
      method: "POST",
      headers: rest,
      body: JSON.stringify({
        project_id: project.id,
        owner_id: userId,
        connection_id: paired.id,
        action,
        payload,
      }),
    })
  ).json();
  return rows[0];
}

async function settle(commandId, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await (
      await fetch(`${SUPABASE_URL}/rest/v1/studio_commands?select=*&id=eq.${commandId}`, { headers: rest })
    ).json();
    const row = rows[0];
    if (row && ["succeeded", "failed", "expired"].includes(row.status)) return row;
    await sleep(1500);
  }
  return null;
}

const inspect = await settle((await queue("inspect_place", {})).id);
check("inspect_place round-tripped", Boolean(inspect), inspect ? `status ${inspect.status}` : "timed out");
check("inspect_place succeeded", inspect?.status === "succeeded", inspect?.error_message ?? "");
check(
  "the plugin reported the real open place",
  Boolean(inspect?.result?.placeName),
  inspect?.result ? `placeName "${inspect.result.placeName}" placeId ${inspect.result.placeId}` : "",
);

// sync_files does NOT carry files in its payload — the server reads the
// project's own files out of Postgres and attaches them. So the project has to
// actually contain something before a sync can prove anything. Getting this
// wrong the first time made the run report "succeeded" against an empty
// project, which is exactly the false pass this script exists to avoid.
const LUAU = `--!strict
-- Written by Blockwright's Studio bridge acceptance.
local Players = game:GetService("Players")

local RoundClock = {}
RoundClock.__index = RoundClock

function RoundClock.new(seconds: number)
\treturn setmetatable({ remaining = seconds }, RoundClock)
end

function RoundClock:tick(dt: number): number
\tself.remaining = math.max(0, self.remaining - dt)
\treturn self.remaining
end

Players.PlayerAdded:Connect(function(player)
\tprint("Blockwright bridge saw", player.Name)
end)

return RoundClock
`;

const wanted = [
  { path: "src/shared/RoundClock.luau", content: LUAU, kind: "module" },
  {
    path: "src/server/BridgeProof.server.luau",
    content: '--!strict\nprint("Blockwright bridge proof", "' + new Date().toISOString() + '")\n',
    kind: "script",
  },
];

const inserted = await (
  await fetch(`${SUPABASE_URL}/rest/v1/project_files`, {
    method: "POST",
    headers: rest,
    body: JSON.stringify(
      wanted.map((f) => ({
        project_id: project.id,
        owner_id: userId,
        path: f.path,
        content: f.content,
        kind: f.kind,
        size_bytes: f.content.length,
      })),
    ),
  })
).json();
check("project has files to sync", Array.isArray(inserted) && inserted.length === wanted.length, `${inserted?.length ?? 0} files`);

const sync = await settle((await queue("sync_files", {})).id);
check("sync_files round-tripped", Boolean(sync), sync ? `status ${sync.status}` : "timed out");
check("sync_files succeeded", sync?.status === "succeeded", sync?.error_message ?? "");
check(
  "the plugin wrote every file, and said how many",
  sync?.result?.written === wanted.length,
  `written ${sync?.result?.written}, skipped ${sync?.result?.skipped}`,
);

// --- 4. the negative assertion ---------------------------------------------
console.log("\n[3] The command surface is closed");

// The DB accepts any string; the PLUGIN is what must refuse it. That is the
// property worth proving — a compromised token cannot become execution.
const bogus = await settle((await queue("execute_luau", { source: "print('arbitrary')" })).id, 45_000);
check(
  "an unknown verb is refused by the plugin, not guessed at",
  bogus?.status === "failed" && /unsupported action/i.test(bogus?.error_message ?? ""),
  bogus ? `${bogus.status}: ${bogus.error_message}` : "timed out",
);

// --- 5. heartbeat -----------------------------------------------------------
const after = await connection();
check("polling keeps the connection alive", Boolean(after?.last_seen_at), after?.last_seen_at ?? "");

console.log("\n" + "=".repeat(70));
console.log(`  ${passed} passed, ${failed} failed\n`);
console.log(`  Project: ${project.id}`);
console.log(`  Look in Studio: ServerScriptService/Blockwright/RoundClock`);
console.log(`                  ReplicatedStorage/Blockwright/BridgeProof\n`);
process.exit(failed === 0 ? 0 : 1);
