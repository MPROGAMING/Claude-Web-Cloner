#!/usr/bin/env node
/**
 * Step 6 — authenticated end-to-end verification through the real /api/chat route.
 *
 * The standalone generation check proves the model works. This proves the
 * *product* works: real auth, ownership, rate limit, credit pre-flight, Brain
 * pre-retrieval, OpenRouter streaming, persistence, and billing from actual
 * reported usage.
 *
 * Authenticates by minting a real Supabase session and presenting it as the
 * cookie @supabase/ssr expects, rather than typing a password into a browser.
 * That also lets us assert on the exact bytes the client receives — which is
 * the only way to prove no secret leaks into the stream.
 *
 * Usage: node scripts/roblox-brain/verify-chat-route.mjs [--base http://localhost:3000]
 */

import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const BASE = baseIndex >= 0 ? args[baseIndex + 1] : "http://localhost:3000";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.QA_USER_A;
const PASSWORD = process.env.QA_PASSWORD;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

const QUESTION =
  "How do I create a RemoteEvent and safely handle it between a client and server in Roblox?";

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

// --- 1. Real session -------------------------------------------------------
console.log("\nAuthentication");
const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const session = await signIn.json();
check("QA user signs in", Boolean(session.access_token), session.error_description ?? "");
if (!session.access_token) process.exit(1);

/**
 * @supabase/ssr 0.12 stores the session as `base64-` + base64url(JSON), split
 * into `.0`, `.1`… chunks past ~3180 chars. Reproducing that exactly is what
 * makes the server-side `auth.getUser()` succeed.
 */
function sessionCookies() {
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

  if (encoded.length <= 3180) return [`${name}=${encoded}`];

  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
  return chunks.map((c, i) => `${name}.${i}=${c}`);
}

const COOKIE = sessionCookies().join("; ");
const userId = session.user.id;

// --- 2. Rejects anonymous callers -----------------------------------------
console.log("\nAuthorization");
const anonCall = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: randomUUID(), projectId: randomUUID(), message: { id: "x", parts: [] } }),
});
check("unauthenticated /api/chat is refused", anonCall.status === 401, `status ${anonCall.status}`);

// --- 3. A project to talk about -------------------------------------------
const restHeaders = {
  apikey: ANON,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const created = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
  method: "POST",
  headers: restHeaders,
  body: JSON.stringify({ name: "Step 6 verification", owner_id: userId }),
});
const project = (await created.json())[0];
check("project created for the test", Boolean(project?.id));
if (!project?.id) process.exit(1);

const conversationId = randomUUID();

// The route refuses a conversation the caller does not own — correctly — so the
// row must exist first, exactly as the project-create action does in the UI.
const conversationRow = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
  method: "POST",
  headers: restHeaders,
  body: JSON.stringify({
    id: conversationId,
    project_id: project.id,
    owner_id: userId,
    title: "New conversation",
  }),
});
const conversation = (await conversationRow.json())[0];
check("conversation created for the test", Boolean(conversation?.id));
if (!conversation?.id) process.exit(1);

const balanceBefore = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/credit_balances?select=balance`, { headers: restHeaders })
  ).json()
)[0]?.balance;

// --- 4. The real request ---------------------------------------------------
console.log("\nGeneration through /api/chat");
const startedAt = Date.now();

const response = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: COOKIE },
  body: JSON.stringify({
    id: conversationId,
    projectId: project.id,
    message: {
      id: randomUUID(),
      role: "user",
      parts: [{ type: "text", text: QUESTION }],
    },
  }),
});

check("authenticated request accepted", response.ok, `status ${response.status}`);
if (!response.ok) {
  console.log(`    body: ${(await response.text()).slice(0, 400)}`);
  process.exit(1);
}

const raw = [];
let firstByteMs = null;
let frames = 0;

const reader = response.body.getReader();
const decoder = new TextDecoder();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  if (firstByteMs === null) firstByteMs = Date.now() - startedAt;
  frames += 1;
  raw.push(decoder.decode(value, { stream: true }));
}
const totalMs = Date.now() - startedAt;
const stream = raw.join("");

check("response streamed incrementally", frames > 5, `${frames} network frames`);
check("time to first byte under 20s", firstByteMs < 20_000, `${firstByteMs}ms`);

const textDeltas = [...stream.matchAll(/"type":"text-delta"/g)].length;
check("stream carries incremental text deltas", textDeltas > 20, `${textDeltas} deltas`);

// --- 5. Citations reached the client --------------------------------------
console.log("\nRoblox Brain citations");
const citationFrame = /"type":"data-citations"/.test(stream);
check("citations data part present in stream", citationFrame);

const citationUrls = [
  ...new Set([...stream.matchAll(/https:\\?\/\\?\/create\.roblox\.com\\?\/docs[^"\\]*/g)].map((m) => m[0].replace(/\\/g, ""))),
];
check("citations point at canonical Roblox docs", citationUrls.length > 0, `${citationUrls.length} unique URLs`);
for (const url of citationUrls.slice(0, 5)) console.log(`        ${url}`);

// --- 6. No secrets in what the client received ----------------------------
console.log("\nSecret containment");
const secrets = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
};
for (const [name, value] of Object.entries(secrets)) {
  if (!value) continue;
  check(`${name} absent from the response stream`, !stream.includes(value));
}
check("no 'sk-' style key fragment in stream", !/sk-[a-zA-Z0-9]{20,}/.test(stream));
check("no service-role JWT in stream", !/"role":"service_role"/.test(stream));
check("no raw SQL echoed to the client", !/select .* from public\./i.test(stream));

// --- 7. Persistence and billing -------------------------------------------
console.log("\nPersistence and billing");
await new Promise((r) => setTimeout(r, 1500));

const messages = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/messages?select=role,created_at&conversation_id=eq.${conversationId}&order=created_at`,
    { headers: restHeaders },
  )
).json();
check("user and assistant messages persisted", messages.length >= 2, `${messages.length} rows`);

const requests = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/ai_requests?select=model_id,input_tokens,output_tokens,credits_charged,status&conversation_id=eq.${conversationId}`,
    { headers: restHeaders },
  )
).json();
const record = requests[0];
check("ai_requests row written", Boolean(record), JSON.stringify(record ?? {}).slice(0, 140));

// The assertion that would have caught the wiring gap immediately: everything
// else passed while the route billed a completely different model.
const expectedModel = `openrouter:${process.env.ROBLOX_BRAIN_MODEL?.trim() || "openai/gpt-5.6-sol"}`;
check(
  "generated on the configured Roblox Brain model",
  record?.model_id === expectedModel,
  `expected ${expectedModel}, got ${record?.model_id}`,
);
check("real token usage recorded", (record?.input_tokens ?? 0) > 0 && (record?.output_tokens ?? 0) > 0);
check("credits charged from real usage", (record?.credits_charged ?? 0) > 0, `${record?.credits_charged} credits`);

const balanceAfter = (
  await (
    await fetch(`${SUPABASE_URL}/rest/v1/credit_balances?select=balance`, { headers: restHeaders })
  ).json()
)[0]?.balance;
check(
  "balance decreased by exactly the charge",
  balanceBefore - balanceAfter === record?.credits_charged,
  `${balanceBefore} -> ${balanceAfter} (charged ${record?.credits_charged})`,
);

// --- 8. Cleanup ------------------------------------------------------------
// `--keep` leaves the project in place so the rendered result can be inspected
// in the browser without paying for another generation.
if (args.includes("--keep")) {
  console.log(`\n  kept for inspection: ${BASE}/projects/${project.id}`);
} else {
  await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`, {
    method: "DELETE",
    headers: restHeaders,
  });
}

console.log(`\n  latency: first byte ${firstByteMs}ms, complete ${totalMs}ms`);
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
