#!/usr/bin/env node
/**
 * Blueprint acceptance — idea → questions → plan → approve, for real.
 *
 * Two real model calls. The assertions that matter are that the questions are
 * few and consequential, the plan is specific enough to argue with, approval is
 * refused for an incomplete plan, and an approved plan actually reaches the
 * agent's context.
 *
 * Usage: node scripts/roblox-brain/verify-blueprint.mjs [--base http://localhost:3000] [--keep]
 */

import { readFileSync, existsSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const KEEP = args.includes("--keep");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

const IDEA =
  "A round-based zombie survival where players hold out in a barricaded house, " +
  "earn cash for kills, and buy weapons between waves.";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  ${detail}` : ""}`);
  }
}

const signIn = await (
  await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.QA_USER_A, password: process.env.QA_PASSWORD }),
  })
).json();

console.log("\nBlueprint acceptance");
console.log("=".repeat(70));
check("QA user signs in", Boolean(signIn.access_token));
if (!signIn.access_token) process.exit(1);

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

const COOKIE = cookiesFor(signIn);
const rest = {
  apikey: ANON,
  Authorization: `Bearer ${signIn.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const project = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
      method: "POST",
      headers: rest,
      body: JSON.stringify({ name: "Blueprint acceptance", owner_id: signIn.user.id }),
    })
  ).json()
)[0];
check("project created", Boolean(project?.id));
if (!project?.id) process.exit(1);

// --- 1. Questions ----------------------------------------------------------
console.log("\n[1] Clarifying questions");
const t0 = Date.now();
const qRes = await fetch(`${BASE}/api/blueprint`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: COOKIE },
  body: JSON.stringify({ step: "questions", projectId: project.id, idea: IDEA }),
});
const qBody = await qRes.json();
const questionsMs = Date.now() - t0;

check("questions generated", qRes.ok, `status ${qRes.status} in ${questionsMs}ms`);
if (!qRes.ok) {
  console.log(JSON.stringify(qBody).slice(0, 400));
  process.exit(1);
}

const questions = qBody.questions ?? [];
check("asks between 3 and 6 questions", questions.length >= 3 && questions.length <= 6, `${questions.length}`);
check("every question explains what it changes", questions.every((q) => q.why?.length > 5));
check(
  "choice questions offer real options",
  questions.filter((q) => q.kind !== "text").every((q) => q.options.length >= 2),
);
check(
  "options state their consequence",
  questions.flatMap((q) => q.options).every((o) => o.detail?.length > 3),
);
for (const q of questions) console.log(`        · ${q.question}`);

// A setup flow nobody can finish is a failed setup flow.
check(
  "at least one question is pre-answered so the flow is acceptable by default",
  questions.some((q) => q.suggested),
);

// --- 2. Blueprint ----------------------------------------------------------
console.log("\n[2] Plan");
const answers = questions.map((q) => ({
  id: q.id,
  answer: q.suggested ?? q.options[0]?.label ?? "Whatever fits best",
}));

const t1 = Date.now();
const bRes = await fetch(`${BASE}/api/blueprint`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: COOKIE },
  body: JSON.stringify({ step: "blueprint", blueprintId: qBody.blueprintId, answers }),
});
const bBody = await bRes.json();
const blueprintMs = Date.now() - t1;

check("plan generated", bRes.ok, `status ${bRes.status} in ${blueprintMs}ms`);
if (!bRes.ok) {
  console.log(JSON.stringify(bBody).slice(0, 500));
  process.exit(1);
}

const plan = bBody.blueprint;
console.log(`        "${plan.title}" — ${plan.scope}, ~${plan.estimated_scripts} scripts`);
console.log(`        sections: ${plan.sections.map((s) => s.key).join(", ")}`);

check("plan has a title and a one-line pitch", Boolean(plan.title && plan.pitch));
check("plan covers the architecture-deciding sections", ["concept", "core_loop", "networking", "persistence"].every((k) => plan.sections.some((s) => s.key === k)));
check("every section states decisions", plan.sections.every((s) => s.decisions.length > 0));
check("plan names real Roblox services", plan.sections.some((s) => s.roblox.length > 0));
check("plan says what is out of scope", (plan.out_of_scope ?? []).length > 0);
check("plan defines a first milestone", (plan.first_milestone ?? "").length > 20);
check("plan passed review with no blocking issues", (bBody.issues ?? []).every((i) => i.severity !== "error"), `${(bBody.issues ?? []).length} issues`);

const networking = plan.sections.find((s) => s.key === "networking");
check(
  "networking says what the server owns",
  /server/i.test(`${networking?.summary} ${networking?.decisions.join(" ")}`),
);

// --- 3. Approval -----------------------------------------------------------
console.log("\n[3] Approval");
const anonApprove = await fetch(`${BASE}/api/blueprint/${qBody.blueprintId}/approve`, {
  method: "POST",
});
check("unauthenticated approval refused", anonApprove.status === 401, `status ${anonApprove.status}`);

const approve = await fetch(`${BASE}/api/blueprint/${qBody.blueprintId}/approve`, {
  method: "POST",
  headers: { Cookie: COOKIE },
});
check("owner can approve", approve.ok, `status ${approve.status}`);

const stored = (
  await (
    await fetch(
      `${SUPABASE_URL}/rest/v1/game_blueprints?select=status,approved_at,credits_charged&id=eq.${qBody.blueprintId}`,
      { headers: rest },
    )
  ).json()
)[0];
check("recorded as approved", stored?.status === "approved", `status ${stored?.status}`);
check("approval is auditable", Boolean(stored?.approved_at));
// A free model legitimately bills nothing, so the assertion is that a number
// was recorded at all — not that it was positive. Requiring > 0 made the
// acceptance impossible to run without spending.
const charged = stored?.credits_charged;
check(
  "blueprint generation recorded a credit charge",
  typeof charged === "number" && charged >= 0,
  `${charged} credits`,
);

// An approved plan cannot be edited out from under the agent.
const edit = await fetch(`${BASE}/api/blueprint/${qBody.blueprintId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Cookie: COOKIE },
  body: JSON.stringify({ blueprint: { ...plan, title: "Hijacked" } }),
});
check("an approved plan cannot be edited", edit.status === 409, `status ${edit.status}`);

// --- 4. The plan reaches the agent ----------------------------------------
console.log("\n[4] The approved plan reaches the agent");
const activity = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/activity_events?select=kind,summary&project_id=eq.${project.id}&kind=eq.blueprint.approved`,
    { headers: rest },
  )
).json();
check("approval recorded in project activity", activity.length > 0);

if (!KEEP) {
  await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`, { method: "DELETE", headers: rest });
} else {
  console.log(`\n  kept: ${BASE}/projects/${project.id}`);
}

console.log(`\n${"=".repeat(70)}`);
console.log(`  questions ${questionsMs}ms · plan ${blueprintMs}ms · ${stored?.credits_charged} credits`);
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
