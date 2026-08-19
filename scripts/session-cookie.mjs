#!/usr/bin/env node
/**
 * Mint a Supabase session cookie for the QA account.
 *
 * Prints a `name=value` string suitable for BW_COOKIE, so authenticated pages
 * can be screenshotted headlessly. @supabase/ssr 0.12 stores the session as
 * `base64-` + base64url(JSON), chunked past ~3180 chars.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = new URL(U).hostname.split(".")[0];

const session = await (
  await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: A, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.QA_USER_A, password: process.env.QA_PASSWORD }),
  })
).json();

if (!session.access_token) {
  console.error("sign-in failed:", session.error_description ?? session.msg);
  process.exit(1);
}

const payload = JSON.stringify({
  access_token: session.access_token,
  token_type: session.token_type,
  expires_in: session.expires_in,
  expires_at: session.expires_at,
  refresh_token: session.refresh_token,
  user: session.user,
});
const encoded = "base64-" + Buffer.from(payload, "utf8").toString("base64url");
const name = `sb-${ref}-auth-token`;

if (encoded.length <= 3180) {
  console.log(`${name}=${encoded}`);
} else {
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
  console.log(chunks.map((c, i) => `${name}.${i}=${c}`).join("; "));
}
