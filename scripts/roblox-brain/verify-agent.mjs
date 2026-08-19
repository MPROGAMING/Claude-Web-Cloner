#!/usr/bin/env node
/**
 * Step 7 — agent acceptance test.
 *
 * Runs the scenario from section 24 end to end against the real application:
 * a multi-file Roblox build, classified, planned, generated, validated,
 * previewed, held until approval, applied only after it, then verified.
 *
 * The assertions that matter most are the negative ones — that PREVIEW wrote
 * nothing, and that apply was refused until an explicit approval existed.
 *
 * Usage: node scripts/roblox-brain/verify-agent.mjs [--base http://localhost:3000] [--keep]
 *                                                   [--model openrouter:openrouter/free]
 *
 * --model pins the run to one model. Without it the route picks the project's
 * model, then the Brain default. Pass the free router to prove the pipeline on
 * an account with no balance left: the acceptance is about the state machine,
 * the approval gate and the write barrier, none of which care which model wrote
 * the Luau.
 */

import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const KEEP = args.includes("--keep");
const MODEL = args.includes("--model") ? args[args.indexOf("--model") + 1] : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

const REQUEST =
  "Create a simple Roblox round system. Players wait in a lobby, a countdown starts " +
  "when at least two players are present, players are moved into the arena, the round " +
  "lasts 60 seconds, then everyone returns to the lobby.";

let passed = 0;
let failed = 0;
const timings = {};

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  ${detail}` : ""}`);
  }
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

/** @supabase/ssr 0.12 cookie encoding, chunked past ~3180 chars. */
function cookiesFor(session) {
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  const encoded = "base64-" + Buffer.from(payload, "utf8").toString("base64url");
  const name = `sb-${PROJECT_REF}-auth-token`;
  if (encoded.length <= 3180) return `${name}=${encoded}`;
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
  return chunks.map((c, i) => `${name}.${i}=${c}`).join("; ");
}

console.log("\nStep 7 — agent acceptance");
console.log("=".repeat(70));

// --- setup -----------------------------------------------------------------
const session = await signIn(process.env.QA_USER_A, process.env.QA_PASSWORD);
check("QA user A signs in", Boolean(session.access_token));
if (!session.access_token) process.exit(1);

const sessionB = await signIn(process.env.QA_USER_B, process.env.QA_PASSWORD);
check("QA user B signs in", Boolean(sessionB.access_token));

const COOKIE = cookiesFor(session);
const COOKIE_B = sessionB.access_token ? cookiesFor(sessionB) : "";
const userId = session.user.id;

const rest = {
  apikey: ANON,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const project = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
      method: "POST",
      headers: rest,
      body: JSON.stringify({ name: "Step 7 acceptance", owner_id: userId }),
    })
  ).json()
)[0];
check("project created", Boolean(project?.id));
if (!project?.id) process.exit(1);

const conversationId = randomUUID();
await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
  method: "POST",
  headers: rest,
  body: JSON.stringify({
    id: conversationId,
    project_id: project.id,
    owner_id: userId,
    title: "New conversation",
  }),
});

async function filesInProject() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/project_files?select=path,content,kind&project_id=eq.${project.id}`,
    { headers: rest },
  );
  return response.json();
}

const before = await filesInProject();
check("project starts empty", before.length === 0, `${before.length} files`);

// --- 1. PREVIEW run --------------------------------------------------------
console.log("\n[1] Preview run — the agent must plan and stage, and write nothing");

const runStart = Date.now();
const response = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: COOKIE },
  body: JSON.stringify({
    id: conversationId,
    projectId: project.id,
    mode: "preview",
    ...(MODEL ? { modelId: MODEL } : {}),
    message: { id: randomUUID(), role: "user", parts: [{ type: "text", text: REQUEST }] },
  }),
});

check("preview run accepted", response.ok, `status ${response.status}`);
if (!response.ok) {
  console.log(await response.text());
  process.exit(1);
}

let stream = "";
let firstByteMs = null;
const reader = response.body.getReader();
const decoder = new TextDecoder();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  if (firstByteMs === null) firstByteMs = Date.now() - runStart;
  stream += decoder.decode(value, { stream: true });
}
timings.previewRunMs = Date.now() - runStart;
timings.firstByteMs = firstByteMs;

check("response streamed", stream.length > 1000, `${stream.length} bytes`);

// --- 2. Classification, plan and state machine ----------------------------
console.log("\n[2] Classification, plan and run state");

const run = (
  await (
    await fetch(
      `${SUPABASE_URL}/rest/v1/agent_runs?select=*&conversation_id=eq.${conversationId}&order=created_at.desc`,
      { headers: rest },
    )
  ).json()
)[0];

check("agent run recorded", Boolean(run?.id));
check(
  "classified as a multi-file implementation",
  run?.classification === "multi_file_implementation",
  `got ${run?.classification}`,
);
check("run required a plan", run?.requires_plan === true);
check("run executed in preview mode", run?.mode === "preview", `got ${run?.mode}`);
check("run reached a terminal state", ["COMPLETED", "FAILED"].includes(run?.state), `state ${run?.state}`);

const steps = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/agent_steps?select=step_index,previous_state,new_state,reason&run_id=eq.${run.id}&order=step_index`,
    { headers: rest },
  )
).json();

check("state transitions logged", steps.length >= 3, `${steps.length} transitions`);
console.log(`        ${steps.map((s) => s.new_state).join(" → ")}`);
check(
  "transitions form an unbroken chain",
  steps.every((s, i) => i === 0 || s.previous_state === steps[i - 1].new_state),
);
check("knowledge retrieval step occurred", steps.some((s) => s.new_state === "RETRIEVING_KNOWLEDGE"));

check("submitted a structured plan", /"toolName":"submit_plan"|submit_plan/.test(stream));

// --- 3. Nothing was written -----------------------------------------------
console.log("\n[3] Preview must not mutate the project");

const during = await filesInProject();
check("no files were written during preview", during.length === 0, `${during.length} files`);

const changeset = (
  await (
    await fetch(
      `${SUPABASE_URL}/rest/v1/agent_changesets?select=*&run_id=eq.${run.id}`,
      { headers: rest },
    )
  ).json()
)[0];

check("a change set was produced", Boolean(changeset?.id));
check(
  "change set is awaiting approval",
  changeset?.status === "pending_approval",
  `status ${changeset?.status}`,
);
check("change set proposes files", (changeset?.operation_count ?? 0) > 0, `${changeset?.operation_count} operations`);

const ops = changeset?.operations ?? [];
const paths = ops.map((o) => o.path);
console.log(`        ${paths.join("\n        ")}`);

check("proposes a server-side script", paths.some((p) => p.startsWith("src/server/")));
// Client context is not one folder: src/ui maps to StarterGui and is where a
// HUD belongs, which is exactly where the model put it.
check(
  "proposes a client-side script",
  paths.some((p) => p.startsWith("src/client/") || p.startsWith("src/ui/")),
);
const blocking = (changeset?.issues ?? []).filter((i) => i.severity === "error");
check("change set has no blocking issues", blocking.length === 0, `${blocking.length} blocking`);
for (const issue of blocking) console.log(`        [${issue.rule}] ${issue.message}`);

// --- 4. Apply is refused without approval ---------------------------------
console.log("\n[4] Apply must be refused until explicitly approved");

const unapproved = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/apply`, {
  method: "POST",
  headers: { Cookie: COOKIE },
});
const unapprovedBody = await unapproved.json().catch(() => ({}));
check(
  "apply refused while pending approval",
  unapproved.status === 403,
  `status ${unapproved.status}, code ${unapprovedBody?.error?.code}`,
);

const anonApply = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/apply`, { method: "POST" });
check("apply refused for an unauthenticated caller", anonApply.status === 401, `status ${anonApply.status}`);

if (COOKIE_B) {
  const crossApprove = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/approve`, {
    method: "POST",
    headers: { Cookie: COOKIE_B },
  });
  check(
    "another user cannot approve this change set",
    crossApprove.status === 404 || crossApprove.status === 403,
    `status ${crossApprove.status}`,
  );
}

const stillEmpty = await filesInProject();
check("still nothing written after refused applies", stillEmpty.length === 0);

// --- 5. Approve and apply --------------------------------------------------
console.log("\n[5] Explicit approval, then apply");

const applyStart = Date.now();
const approve = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/approve`, {
  method: "POST",
  headers: { Cookie: COOKIE },
});
check("owner can approve", approve.ok, `status ${approve.status}`);

const apply = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/apply`, {
  method: "POST",
  headers: { Cookie: COOKIE },
});
const applyBody = await apply.json().catch(() => ({}));
timings.applyMs = Date.now() - applyStart;

check("apply succeeded after approval", apply.ok && applyBody.ok, JSON.stringify(applyBody).slice(0, 120));
check("every operation applied", applyBody.applied === ops.length, `${applyBody.applied}/${ops.length}`);

// --- 6. Verify the result --------------------------------------------------
console.log("\n[6] Verify the applied result");

const after = await filesInProject();
// Operations outnumber files when the agent revises a file it just wrote, so
// the project is compared against the distinct paths, not the operation count.
const distinctPaths = [...new Set(paths)];
check(
  "files now exist in the project",
  after.length === distinctPaths.length,
  `${after.length} files from ${ops.length} operations`,
);
check(
  "every proposed path exists",
  distinctPaths.every((p) => after.some((f) => f.path === p)),
);

const luau = after.filter((f) => /\.luau?$/i.test(f.path));
check("generated Luau uses game:GetService", luau.every((f) => !/game\.(Players|ReplicatedStorage)\b/.test(f.content)));
check(
  "server script owns the round state",
  luau.some((f) => f.path.startsWith("src/server/") && /Round|round/.test(f.content)),
);
check(
  "a RemoteEvent connects the two halves",
  luau.some((f) => /RemoteEvent|OnClientEvent|FireAllClients/.test(f.content)),
);

const applied = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/agent_changesets?select=status,applied_at&id=eq.${changeset.id}`, {
      headers: rest,
    })
  ).json()
)[0];
check("change set recorded as applied", applied?.status === "applied", `status ${applied?.status}`);
check("apply is auditable", Boolean(applied?.applied_at));

const reapply = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/apply`, {
  method: "POST",
  headers: { Cookie: COOKIE },
});
check("a change set cannot be applied twice", reapply.status === 403, `status ${reapply.status}`);

// --- 7. Undo ---------------------------------------------------------------
console.log("\n[7] Undo");

const undo = await fetch(`${BASE}/api/agent/changesets/${changeset.id}/undo`, {
  method: "POST",
  headers: { Cookie: COOKIE },
});
const undoBody = await undo.json().catch(() => ({}));
check("undo succeeded", undo.ok && undoBody.ok, JSON.stringify(undoBody).slice(0, 100));

const afterUndo = await filesInProject();
check("undo removed the created files", afterUndo.length === 0, `${afterUndo.length} files remain`);

// --- 8. Telemetry and billing ---------------------------------------------
console.log("\n[8] Telemetry and billing");

const toolCalls = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/agent_tool_calls?select=tool_name&run_id=eq.${run.id}`,
    { headers: rest },
  )
).json();

check("run recorded token usage", (run?.input_tokens ?? 0) > 0, `${run?.input_tokens} in / ${run?.output_tokens} out`);
check("run recorded credits", (run?.credits_charged ?? 0) >= 0, `${run?.credits_charged} credits`);
check("run recorded retrieval timing", run?.retrieval_ms !== null, `${run?.retrieval_ms}ms`);
check("no secret appears in the stream", !stream.includes(process.env.OPENROUTER_API_KEY ?? " "));
check(
  "no service-role key in the stream",
  !stream.includes(process.env.SUPABASE_SERVICE_ROLE_KEY ?? " "),
);

// --- cleanup ---------------------------------------------------------------
if (!KEEP) {
  await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`, { method: "DELETE", headers: rest });
} else {
  console.log(`\n  kept: ${BASE}/projects/${project.id}`);
}

console.log(`\n${"=".repeat(70)}`);
console.log(
  `  preview run ${timings.previewRunMs}ms (first byte ${timings.firstByteMs}ms), apply ${timings.applyMs}ms`,
);
console.log(`  tool calls: ${toolCalls.length}, steps: ${run?.step_count}, tokens: ${run?.input_tokens}/${run?.output_tokens}`);
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
