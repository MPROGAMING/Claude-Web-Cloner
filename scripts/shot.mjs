#!/usr/bin/env node
/**
 * Deterministic page screenshots via headless Chrome over CDP.
 *
 * The in-app browser pane returns black or torn frames after scrolling, because
 * a backgrounded tab stops compositing — every visual review in this project has
 * hit it. Driving Chrome directly avoids the whole class of problem and makes
 * before/after comparisons trustworthy, which is the point of taking them.
 *
 * Authenticated pages: set BW_COOKIE to a `name=value; name2=value2` string and
 * the cookies are installed before navigation, so signed-in surfaces can be
 * captured without a browser session. `scripts/session-cookie.mjs` mints one.
 *
 * Usage:
 *   node scripts/shot.mjs <url> <out.png> [width] [height] [scrollY|full]
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , url, out, w = "1440", h = "900", scroll = "0"] = process.argv;

if (!url || !out) {
  console.error("usage: shot.mjs <url> <out.png> [width] [height] [scrollY|full]");
  process.exit(2);
}

const PORT = 9400 + Math.floor(Math.random() * 400);
const profile = `/tmp/bw-shot-${PORT}`;

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${w},${h}`,
  "--hide-scrollbars",
  "--force-device-scale-factor=2",
  "--no-first-run",
  "--disable-extensions",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The page target, not the browser target.
 *
 * /json/version returns the browser-level socket, which does not implement the
 * Page domain — captureScreenshot there silently returns nothing.
 */
async function endpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      /* chrome still starting */
    }
    await sleep(250);
  }
  throw new Error("chrome did not expose a page target");
}

/** Minimal CDP client — one socket, sequential commands, no dependency. */
async function connect(wsUrl) {
  // Node 22+ ships a global WebSocket, so no dependency is needed.
  const socket = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    socket.addEventListener("open", res, { once: true });
    socket.addEventListener("error", rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg.result ?? {});
    }
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
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: Number(w),
    height: Number(h),
    deviceScaleFactor: 2,
    mobile: Number(w) < 768,
  });

  // Install the session cookies before the first navigation, otherwise the app
  // redirects to sign-in and the screenshot is of a login form.
  const cookieHeader = process.env.BW_COOKIE;
  if (cookieHeader) {
    const { hostname } = new URL(url);
    const cookies = cookieHeader
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf("=");
        return {
          name: pair.slice(0, eq),
          value: pair.slice(eq + 1),
          domain: hostname,
          path: "/",
        };
      });
    await cdp.send("Network.enable");
    await cdp.send("Network.setCookies", { cookies });
  }

  await cdp.send("Page.navigate", { url });
  // Fonts, images and the entrance animations all need a moment to settle;
  // a screenshot taken too early is a screenshot of a skeleton.
  await sleep(3800);

  if (scroll === "full") {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "document.documentElement.scrollHeight",
      returnByValue: true,
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: Number(w),
      height: Math.min(result.value, 20000),
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(1200);
  } else if (Number(scroll) > 0) {
    await cdp.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${Number(scroll)})` });
    await sleep(1400);
  }

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  if (!shot?.data) throw new Error("captureScreenshot returned no data");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`${out}  ${w}x${h}${scroll !== "0" ? ` @${scroll}` : ""}`);

  cdp.close();
} finally {
  chrome.kill();
}
