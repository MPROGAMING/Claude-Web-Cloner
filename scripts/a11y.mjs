#!/usr/bin/env node
/**
 * Accessibility audit over real rendered pages.
 *
 * Static analysis cannot answer the questions that actually matter here —
 * whether a colour pair clears WCAG once every CSS variable, theme class and
 * opacity has been resolved, or whether a control ends up with an accessible
 * name after Base UI has composed it. So this drives headless Chrome, lets the
 * page render, and measures the computed result.
 *
 * Contrast is computed against the first ancestor with an opaque background,
 * because the design layers translucent surfaces and the immediate parent is
 * usually transparent. Touch targets are only checked below 768px, where a
 * control is a thumb target rather than a mouse target.
 *
 * Usage:
 *   node scripts/a11y.mjs <url> [url...] [--theme dark|light] [--width 1440]
 *   BW_COOKIE=... node scripts/a11y.mjs http://localhost:3000/dashboard
 */

import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const flag = (name, fallback) =>
  argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback;

const THEME = flag("theme", "dark");
const WIDTH = Number(flag("width", 1440));
const urls = argv.filter((a, i) => a.startsWith("http") && argv[i - 1]?.startsWith("--") !== true);

if (urls.length === 0) {
  console.error("usage: a11y.mjs <url> [url...] [--theme dark|light] [--width 1440]");
  process.exit(2);
}

const PORT = 9800 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/bw-a11y-${PORT}`,
  `--window-size=${WIDTH},1000`,
  "--hide-scrollbars",
  "--no-first-run",
  "--disable-extensions",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The page target — the browser target does not implement Page or Runtime. */
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
    const resolve = pending.get(msg.id);
    if (resolve) { pending.delete(msg.id); resolve(msg.result ?? {}); }
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

/** Runs inside the page. Returns a plain object. */
const AUDIT = function () {
  const out = { structure: {}, issues: [] };
  const add = (rule, detail, el) => out.issues.push({
    rule, detail,
    where: el ? `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(/\s+/).slice(0, 2).join(".") : ""}` : null,
  });

  // --- structure -----------------------------------------------------------
  out.structure = {
    lang: document.documentElement.lang || null,
    h1: document.querySelectorAll("h1").length,
    main: document.querySelectorAll("main").length,
    theme: document.documentElement.className.includes("dark") ? "dark" : "light",
    pointerCoarse: matchMedia("(pointer: coarse)").matches,
    width: window.innerWidth,
  };
  if (!out.structure.lang) add("no-lang", "<html> has no lang attribute");
  if (out.structure.h1 !== 1) add("h1-count", `${out.structure.h1} h1 elements`);
  if (out.structure.main === 0) add("no-main", "no <main> landmark");

  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  for (let i = 1; i < headings.length; i += 1) {
    const jump = +headings[i].tagName[1] - +headings[i - 1].tagName[1];
    if (jump > 1) {
      add("heading-jump", `${headings[i - 1].tagName} → ${headings[i].tagName}: "${headings[i].textContent.trim().slice(0, 40)}"`, headings[i]);
    }
  }

  // --- names ---------------------------------------------------------------
  const nameOf = (el) => (
    el.getAttribute("aria-label") ||
    (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent) ||
    el.textContent.trim() ||
    el.querySelector("img")?.getAttribute("alt") ||
    el.getAttribute("title") || ""
  ).trim();

  for (const el of document.querySelectorAll("button, a[href], [role=button], [role=link]")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (!nameOf(el)) add("no-accessible-name", el.outerHTML.slice(0, 110), el);
  }
  for (const img of document.querySelectorAll("img")) {
    if (!img.hasAttribute("alt")) add("img-no-alt", img.currentSrc || img.src, img);
  }
  for (const el of document.querySelectorAll("input, textarea, select")) {
    const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") ||
      (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
      el.closest("label") || el.getAttribute("placeholder");
    if (!labelled) add("unlabelled-control", el.outerHTML.slice(0, 110), el);
  }

  // --- touch targets -------------------------------------------------------
  // Only meaningful on a narrow viewport: the same button is a mouse target at
  // 1440px and a thumb target at 390px, and only the second has a minimum.
  if (window.innerWidth < 768) {
    const MIN = 44;
    const seen = new Set();
    for (const el of document.querySelectorAll("a[href], button, [role=button], input[type=checkbox], input[type=radio]")) {
      let r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;

      // The "stretched link" pattern: a small title anchor with an absolutely
      // positioned ::before covering inset 0, so the whole card is clickable.
      // The element box underreports the real hit area by a lot — a 23px title
      // whose actual target is the 284x96 card it sits in.
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.position === "absolute" && ps.content !== "none" &&
            ["top", "right", "bottom", "left"].every((side) => ps[side] === "0px")) {
          let anc = el.parentElement;
          while (anc && getComputedStyle(anc).position === "static") anc = anc.parentElement;
          if (anc) r = anc.getBoundingClientRect();
          break;
        }
      }
      // A link inside a large tappable card is not its own target.
      if (el.closest("a[href], button") !== el && el.parentElement?.closest("a[href], button")) continue;

      // WCAG 2.5.8 exempts a target "in a sentence or block of text", because
      // enlarging it would break the line it sits in. An attribution link in a
      // paragraph is the exempt case, not a failure to fix.
      const flow = el.closest("p, li, figcaption, blockquote");
      if (flow && flow.textContent.trim().length > el.textContent.trim().length + 12) continue;

      if (r.width < MIN || r.height < MIN) {
        const label = (el.getAttribute("aria-label") || el.textContent.trim() || el.tagName).slice(0, 34);
        const key = `${label}|${Math.round(r.width)}x${Math.round(r.height)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        add("touch-target", `${Math.round(r.width)}x${Math.round(r.height)}px, needs ${MIN}x${MIN} — "${label}"`, el);
      }
    }
  }

  // --- contrast ------------------------------------------------------------
  // Resolved through a 1x1 canvas rather than a regex. Every colour in this
  // design system is authored in oklch, and the moment an opacity modifier is
  // applied (`text-muted-foreground/45`) Chrome computes it as `oklab(...)` —
  // which an `rgba()` regex does not match, so the check silently skipped it
  // and returned null. That blind spot covered most of the palette: a 2.29:1
  // line-number gutter audited as clean because its colour was never parsed.
  const swatch = document.createElement("canvas");
  swatch.width = swatch.height = 1;
  const swatchCtx = swatch.getContext("2d", { willReadFrequently: true });
  const parseCache = new Map();
  const parse = (c) => {
    const key = String(c);
    if (parseCache.has(key)) return parseCache.get(key);
    let value = null;
    if (key && key !== "none") {
      swatchCtx.clearRect(0, 0, 1, 1);
      swatchCtx.fillStyle = "#000";
      swatchCtx.fillStyle = key;
      // An unparseable value leaves fillStyle at the previous colour, so a
      // second probe against a different base tells us whether it took.
      swatchCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = swatchCtx.getImageData(0, 0, 1, 1).data;
      // Canvas premultiplies, so recover the unmultiplied channels.
      value = a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r, g, b, a: a / 255 };
    }
    parseCache.set(key, value);
    return value;
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

  // The design layers translucent surfaces, so the immediate parent is usually
  // transparent; walk up to the first thing that actually paints.
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const bgOf = (el) => {
    // Collect every translucent layer down to the first opaque one, then
    // composite them. Stopping at the first layer over 85% alpha treated a
    // stack of tints as if only the last one existed.
    const layers = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.999) break;
      }
      n = n.parentElement;
    }
    const base = parse(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 };
    if (!layers.length || layers[layers.length - 1].a < 0.999) layers.push({ ...base, a: 1 });
    return layers.reduceRight((acc, layer) => over(layer, acc), { r: 0, g: 0, b: 0, a: 1 });
  };

  for (const el of document.querySelectorAll("p,span,a,h1,h2,h3,h4,h5,li,button,dt,dd,figcaption,label,td,th")) {
    const text = el.textContent.trim();
    if (!text || el.children.length > 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;

    const fg = parse(cs.color);
    if (!fg) continue;
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
    const need = large ? 3 : 4.5;
    const behind = bgOf(el);
    // Translucent text is its colour over the background, not its colour.
    const got = ratio(fg.a < 1 ? over(fg, behind) : fg, behind);
    if (got < need) {
      add("contrast", `${got.toFixed(2)}:1 needs ${need}:1 — "${text.slice(0, 44)}" @ ${size.toFixed(0)}px`, el);
    }
  }

  return out;
};

let failures = 0;

try {
  const cdp = await connect(await endpoint());
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: THEME },
      // The touch-target rules key on `pointer`, not on width, so the audit has
      // to emulate the same thing the CSS asks about or it measures a layout
      // no real device ever sees.
    ],
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH, height: 1000, deviceScaleFactor: 1, mobile: WIDTH < 768,
  });
  // setEmulatedMedia has no `pointer` feature. Touch emulation is what makes
  // Chrome answer `(pointer: coarse)` with true, which is what the touch-target
  // CSS keys on — without it the check measures the desktop layout and passes
  // or fails for the wrong reason.
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: WIDTH < 768,
    maxTouchPoints: 5,
  });

  if (process.env.BW_COOKIE) {
    const { hostname } = new URL(urls[0]);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCookies", {
      cookies: process.env.BW_COOKIE.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
        const eq = p.indexOf("=");
        return { name: p.slice(0, eq), value: p.slice(eq + 1), domain: hostname, path: "/" };
      }),
    });
  }

  for (const url of urls) {
    await cdp.send("Page.navigate", { url });
    await sleep(4000);

    // next-themes writes the class from localStorage, so the emulated media
    // query alone does not flip an app that has a stored preference.
    await cdp.send("Runtime.evaluate", {
      expression: `document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(${JSON.stringify(THEME)});`,
    });
    await sleep(400);

    const { result } = await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify((${AUDIT.toString()})())`,
      returnByValue: true,
    });
    const report = JSON.parse(result.value);

    const path = new URL(url).pathname;
    console.log(`\n${path}  [${THEME}, ${WIDTH}px, pointer:${report.structure.pointerCoarse ? "coarse" : "fine"}]  ${report.issues.length === 0 ? "\x1b[32mclean\x1b[0m" : `\x1b[31m${report.issues.length} issue(s)\x1b[0m`}`);
    for (const issue of report.issues) {
      console.log(`  ${issue.rule.padEnd(20)} ${issue.detail}${issue.where ? `  (${issue.where})` : ""}`);
    }
    failures += report.issues.length;
  }

  cdp.close();
} finally {
  chrome.kill();
}

console.log(`\n${failures === 0 ? "\x1b[32mno accessibility issues\x1b[0m" : `\x1b[31m${failures} issue(s)\x1b[0m`}`);
process.exit(failures === 0 ? 0 : 1);
