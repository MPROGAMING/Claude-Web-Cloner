#!/usr/bin/env node
/**
 * Screenshots of real rendered pages, for design comparison.
 *
 * Shares the a11y harness's approach — spawn headless Chrome, drive it over
 * raw CDP — because the questions design review asks are the same kind the
 * a11y audit asks: they can only be answered after the page has actually
 * painted. Fonts, theme class, Base UI composition and every CSS variable
 * have to resolve before a capture means anything.
 *
 * Usage:
 *   node scripts/shot.mjs <url> [url...] --out <dir> [--name a,b] \
 *     [--width 1440] [--height 900] [--theme dark|light] [--full] [--wait 1400]
 *
 * BW_COOKIE=... captures an authenticated app surface.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const flag = (name, fallback) =>
  argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback;
const has = (name) => argv.includes(`--${name}`);

const OUT = resolve(flag("out", "screenshots"));
const WIDTH = Number(flag("width", 1440));
const HEIGHT = Number(flag("height", 900));
const THEME = flag("theme", "dark");
const WAIT = Number(flag("wait", 1400));
const FULL = has("full");
const NAMES = flag("name", "").split(",").filter(Boolean);

const urls = argv.filter((a, i) => a.startsWith("http") && !argv[i - 1]?.startsWith("--"));
if (urls.length === 0) {
  console.error("usage: shot.mjs <url> [url...] --out <dir> [--width] [--height] [--theme] [--full] [--wait]");
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

const PORT = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/bw-shot-${PORT}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  "--hide-scrollbars",
  "--no-first-run",
  "--disable-extensions",
  "--force-device-scale-factor=2",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const page = (await res.json()).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch { /* still starting */ }
    await sleep(250);
  }
  throw new Error("chrome did not expose a page target");
}

async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    socket.addEventListener("open", res, { once: true });
    socket.addEventListener("error", rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    const resolveFn = pending.get(msg.id);
    if (resolveFn) { pending.delete(msg.id); resolveFn(msg.result ?? {}); }
  });
  return {
    send(method, params = {}) {
      id += 1;
      const mine = id;
      return new Promise((res) => { pending.set(mine, res); socket.send(JSON.stringify({ id: mine, method, params })); });
    },
    close: () => socket.close(),
  };
}

/** A capture is only meaningful once webfonts have swapped in and entrance
 *  animations have settled — otherwise every shot races the design. */
const SETTLE = `(async () => {
  try { await document.fonts.ready; } catch {}
  // The Next.js dev overlay injects a fixed badge that is not part of the
  // design and would be judged as one. It never ships to production, so a
  // capture that includes it is measuring the wrong thing.
  document.querySelectorAll('nextjs-portal, [data-nextjs-toast], #__next-build-watcher').forEach((el) => el.remove());
  document.querySelectorAll('*').forEach((el) => {
    const s = getComputedStyle(el);
    if (s.animationName && s.animationName !== 'none' && s.animationIterationCount === 'infinite') {
      el.style.animationPlayState = 'paused';
    }
  });
  window.scrollTo(0, 0);
  return document.documentElement.scrollHeight;
})()`;

const cdp = await connect(await endpoint());
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");

if (process.env.BW_COOKIE) {
  await cdp.send("Network.enable");
  await cdp.send("Network.setCookies", {
    cookies: process.env.BW_COOKIE.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
      const eq = p.indexOf("=");
      return { name: p.slice(0, eq), value: p.slice(eq + 1), domain: "localhost", path: "/" };
    }),
  });
}

const results = [];
for (const [i, url] of urls.entries()) {
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: THEME }, { name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: WIDTH < 768,
  });

  await cdp.send("Page.navigate", { url });
  await sleep(WAIT);
  // next-themes writes the class from localStorage; force it so the capture
  // shows the theme that was asked for rather than whatever was last stored.
  await cdp.send("Runtime.evaluate", {
    expression: `document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(${JSON.stringify(THEME)});document.documentElement.style.colorScheme=${JSON.stringify(THEME)};`,
  });
  await sleep(320);
  const settled = await cdp.send("Runtime.evaluate", { expression: SETTLE, awaitPromise: true, returnByValue: true });
  const docHeight = Math.min(Number(settled.result?.value) || HEIGHT, 20000);

  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: FULL,
    ...(FULL ? { clip: { x: 0, y: 0, width: WIDTH, height: docHeight, scale: 1 } } : {}),
  });

  const name = NAMES[i] || new URL(url).hostname.replace(/\W+/g, "-") + (new URL(url).pathname.replace(/\//g, "-") || "");
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  results.push({ url, file, height: FULL ? docHeight : HEIGHT });
  console.log(`${file}  [${THEME} ${WIDTH}x${FULL ? docHeight : HEIGHT}]  ${url}`);
}

cdp.close();
chrome.kill();
process.exit(0);
