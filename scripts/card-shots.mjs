#!/usr/bin/env node
/**
 * Capture each template card as its own image.
 *
 * A banner is judged one card at a time, at the size a person actually sees it
 * — not as a thumbnail of a whole page. This measures every card in the live
 * grid and clips a screenshot to each one, so a reviewer compares like with
 * like instead of squinting at a contact sheet.
 *
 * Usage:
 *   BW_COOKIE=... node scripts/card-shots.mjs [--out dir] [--url http://localhost:3000/templates]
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);

const URL_ = flag("url", "http://localhost:3000/templates");
const OUT = flag("out", "/tmp/cards");
const WIDTH = Number(flag("width", 1440));

mkdirSync(OUT, { recursive: true });

const PORT = 9200 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/bw-cards-${PORT}`,
  `--window-size=${WIDTH},1200`,
  "--hide-scrollbars",
  "--force-device-scale-factor=2",
  "--no-first-run",
  "--disable-extensions",
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
    } catch { /* starting */ }
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
  socket.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    const r = pending.get(msg.id);
    if (r) { pending.delete(msg.id); r(msg.result ?? {}); }
  });
  return {
    send(method, params = {}) {
      id += 1;
      const mine = id;
      return new Promise((resolve) => {
        pending.set(mine, resolve);
        socket.send(JSON.stringify({ id: mine, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

try {
  const cdp = await connect(await endpoint());
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH, height: 1200, deviceScaleFactor: 2, mobile: false,
  });

  if (process.env.BW_COOKIE) {
    const { hostname } = new URL(URL_);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCookies", {
      cookies: process.env.BW_COOKIE.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
        const eq = p.indexOf("=");
        return { name: p.slice(0, eq), value: p.slice(eq + 1), domain: hostname, path: "/" };
      }),
    });
  }

  await cdp.send("Page.navigate", { url: URL_ });
  await sleep(4500);

  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('button[aria-label^="Create a project from"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: (el.querySelector("h3,h4,p")?.textContent || el.getAttribute("aria-label") || "card").trim(),
        x: r.x + scrollX, y: r.y + scrollY,
        width: r.width, height: r.height,
      };
    }))`,
    returnByValue: true,
  });

  const cards = JSON.parse(result.value);
  if (cards.length === 0) throw new Error("no template cards found — signed out?");

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

  for (const card of cards) {
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: card.x, y: card.y, width: card.width, height: card.height, scale: 2 },
    });
    if (!shot.data) { console.log(`  skipped ${card.name} (no data)`); continue; }
    const file = `${OUT}/${slug(card.name)}.png`;
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`${file}  ${Math.round(card.width)}x${Math.round(card.height)} css`);
  }

  cdp.close();
} finally {
  chrome.kill();
}
