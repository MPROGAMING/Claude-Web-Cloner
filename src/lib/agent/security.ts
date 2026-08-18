import { inferKind } from "@/lib/roblox/project-model";

/**
 * Roblox-specific static security review.
 *
 * These are the exploit classes that actually get Roblox games ruined: a client
 * that decides its own currency, a RemoteEvent handler that trusts whatever
 * arrives, a LocalScript sitting somewhere it will never run.
 *
 * This is lint, not proof. It reads one file at a time with regexes and cannot
 * follow data flow, so it will miss things and occasionally flag safe code.
 * Findings are reported as findings — nothing here licenses a claim that
 * generated code is secure.
 */

export type SecuritySeverity = "error" | "warning" | "info";

export interface SecurityFinding {
  rule: string;
  severity: SecuritySeverity;
  line: number;
  message: string;
  path: string;
}

export interface SecurityReport {
  ok: boolean;
  errors: number;
  warnings: number;
  findings: SecurityFinding[];
}

type Context = "server" | "client" | "shared";

export function contextFor(path: string): Context {
  const lower = path.toLowerCase();
  if (lower.startsWith("src/server") || lower.endsWith(".server.luau") || lower.endsWith(".server.lua")) {
    return "server";
  }
  if (
    lower.startsWith("src/client") ||
    lower.startsWith("src/ui") ||
    lower.endsWith(".client.luau") ||
    lower.endsWith(".client.lua")
  ) {
    return "client";
  }
  return "shared";
}

/** Strip strings and comments so a rule cannot fire on prose. */
function strip(line: string): string {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/--.*$/, "");
}

/**
 * Comments removed, string literals kept.
 *
 * Several rules look for evidence that only ever appears inside a string —
 * `game:GetService("ServerStorage")`, an API key, a URL. Blanking strings makes
 * those rules structurally incapable of firing, while keeping comments would
 * make them fire on prose. This is the middle that both need.
 */
function stripComments(line: string): string {
  return line.replace(/--.*$/, "");
}

interface Rule {
  id: string;
  severity: SecuritySeverity;
  message: string;
  appliesTo?: Context[];
  /**
   * Keep string literals (comments are still removed). Required for any rule
   * whose evidence lives *inside* a string — a hard-coded key, a URL, or a
   * service name passed to GetService.
   */
  raw?: boolean;
  /** Line-level test. */
  test?: (line: string, context: Context) => boolean;
  /**
   * Whole-file test, for things a single line cannot show. Returns the line
   * number, or a negative line number to report the finding as a warning
   * regardless of the rule's declared severity.
   */
  fileTest?: (source: string, context: Context, path: string) => number | null;
}

const CURRENCY = /\b(cash|coins?|money|currency|credits?|gems?|points?|balance|gold)\b/i;
const INVENTORY = /\b(inventory|items?|backpack|loadout|equipped)\b/i;

const RULES: Rule[] = [
  // --- client authority -----------------------------------------------------
  {
    id: "client-authoritative-currency",
    severity: "error",
    appliesTo: ["client"],
    message:
      "Client code is writing a currency value. Currency must be owned by the server; the client may display it but never set it.",
    // A write, not a read: `coins.Value = n`, `cash += n`. Reading a balance to
    // display it is exactly what a client should do, so `= x.Value` must not fire.
    test: (line) => CURRENCY.test(line) && /\.Value\s*=(?!=)|\b\w*\s*[+-]=/.test(line),
  },
  {
    id: "client-authoritative-damage",
    severity: "error",
    appliesTo: ["client"],
    message:
      "Client code is applying damage. Damage must be resolved on the server, or any exploiter can kill anyone.",
    test: (line) => /:TakeDamage\s*\(|\bHumanoid\.Health\s*(-|\+)?=/.test(line),
  },
  {
    id: "client-authoritative-inventory",
    severity: "warning",
    appliesTo: ["client"],
    message:
      "Client code appears to mutate inventory state. The server must own the authoritative inventory.",
    test: (line) => INVENTORY.test(line) && /table\.insert|table\.remove|\.Value\s*=/.test(line),
  },
  {
    id: "server-trusts-client-value",
    severity: "error",
    appliesTo: ["server"],
    message:
      "A RemoteEvent handler assigns a client-supplied value straight into game state without validating it.",
    fileTest: (source, context) => {
      if (context !== "server") return null;
      const lines = source.split("\n");
      let inHandler = false;
      let handlerStart = 0;
      let validated = false;

      for (let i = 0; i < lines.length; i += 1) {
        const line = strip(lines[i]);
        if (/OnServerEvent[:.]Connect|OnServerInvoke\s*=/.test(line)) {
          inHandler = true;
          handlerStart = i + 1;
          validated = false;
          continue;
        }
        if (!inHandler) continue;

        if (/\btype(of)?\s*\(|\bassert\s*\(|\bif\s+not\s+\w|:IsA\s*\(|\btonumber\s*\(/.test(line)) {
          validated = true;
        }
        if (/\b(end\)|end\b)/.test(line) && /^\s*end/.test(lines[i])) {
          inHandler = false;
        }
        if (!validated && CURRENCY.test(line) && /\.Value\s*=|\+=|-=/.test(line)) {
          return handlerStart;
        }
      }
      return null;
    },
  },
  {
    id: "unvalidated-remote-handler",
    severity: "warning",
    appliesTo: ["server"],
    message:
      "RemoteEvent handler has no visible type validation on its arguments. Validate every parameter — the client controls all of them.",
    fileTest: (source, context) => {
      if (context !== "server") return null;
      const lines = source.split("\n");
      const index = lines.findIndex((l) => /OnServerEvent[:.]Connect|OnServerInvoke\s*=/.test(strip(l)));
      if (index === -1) return null;
      const window = lines.slice(index, index + 25).join("\n");
      const validates = /\btype(of)?\s*\(|\bassert\s*\(|:IsA\s*\(|\btonumber\s*\(|\bif\s+not\s+/.test(
        strip(window),
      );
      return validates ? null : index + 1;
    },
  },
  {
    id: "missing-player-ownership-check",
    severity: "warning",
    appliesTo: ["server"],
    message:
      "Handler acts on an Instance supplied by the client without checking the calling player owns it.",
    fileTest: (source, context) => {
      if (context !== "server") return null;
      const lines = source.split("\n");
      const index = lines.findIndex((l) =>
        /OnServerEvent[:.]Connect\s*\(\s*function\s*\(\s*\w+\s*,\s*\w*(instance|part|tool|object|target)/i.test(
          strip(l),
        ),
      );
      if (index === -1) return null;
      const window = strip(lines.slice(index, index + 25).join("\n"));
      return /GetPlayerFromCharacter|\.Parent\s*==|player\.Character|:IsDescendantOf\s*\(/.test(window)
        ? null
        : index + 1;
    },
  },

  // --- context placement ----------------------------------------------------
  {
    id: "server-storage-from-client",
    severity: "error",
    raw: true,
    appliesTo: ["client"],
    message:
      "Client code references ServerStorage or ServerScriptService. Those never replicate to clients, so this is always nil at runtime.",
    test: (line) => /\bServerStorage\b|\bServerScriptService\b/.test(line),
  },
  {
    id: "localplayer-on-server",
    severity: "error",
    appliesTo: ["server"],
    message:
      "Server code uses LocalPlayer or UserInputService, which only exist on a client.",
    test: (line) => /\bLocalPlayer\b|\bUserInputService\b|:GetMouse\s*\(/.test(line),
  },
  {
    id: "remote-direction-mismatch",
    severity: "error",
    message:
      "RemoteEvent used in the wrong direction: FireServer/OnClientEvent are client-side, FireClient/OnServerEvent are server-side.",
    test: (line, context) =>
      (context === "server" && /:FireServer\s*\(|OnClientEvent/.test(line)) ||
      (context === "client" && /:FireClient\s*\(|:FireAllClients\s*\(|OnServerEvent/.test(line)),
  },

  // --- dangerous primitives -------------------------------------------------
  {
    id: "loadstring",
    severity: "error",
    message: "loadstring executes arbitrary code at runtime. Do not use it.",
    test: (line) => /\bloadstring\s*\(/.test(line),
  },
  {
    id: "http-from-untrusted-context",
    severity: "warning",
    raw: true,
    message:
      "HttpService request. Only the server may call out, the endpoint must be trusted, and no secret may be embedded here.",
    test: (line) => /HttpService|:RequestAsync\s*\(|:GetAsync\s*\(\s*["']https?:/.test(line),
  },
  {
    id: "hard-coded-secret",
    severity: "error",
    raw: true,
    message:
      "This looks like a hard-coded credential. Secrets must never live in a Roblox script — every client can read them.",
    test: (line) =>
      /\b(api[_-]?key|secret|token|password|bearer|private[_-]?key)\b\s*=\s*["'][^"']{8,}/i.test(line),
  },
  {
    id: "suspicious-external-url",
    severity: "warning",
    raw: true,
    message: "External URL in a script. Confirm the domain is intended and trusted.",
    test: (line) =>
      /https?:\/\/(?!(www\.)?(roblox\.com|create\.roblox\.com|rbxcdn\.com))[a-z0-9.-]+/i.test(line),
  },

  // --- runtime hazards ------------------------------------------------------
  {
    id: "datastore-overwrite-without-read",
    severity: "warning",
    appliesTo: ["server"],
    message:
      "SetAsync without a preceding read can destroy player data on a partial load. Prefer UpdateAsync.",
    test: (line) => /:SetAsync\s*\(/.test(line),
  },
  {
    // Severity is decided per finding: this rule cannot follow a call, and the
    // ordinary Roblox round pattern — `while true do waitForPlayers(); runRound() end`
    // — yields inside the callees. Reporting that as an error would block a
    // correct build, so certainty is required before escalating.
    id: "non-yielding-loop",
    severity: "error",
    message: "A while-true loop with no yield freezes the whole script. Add task.wait().",
    fileTest: (source) => {
      const lines = source.split("\n");

      for (let i = 0; i < lines.length; i += 1) {
        if (!/\bwhile\s+true\s+do\b/.test(strip(lines[i]))) continue;

        // Scan the actual loop body by tracking block depth. A fixed line window
        // reports every loop longer than the window as non-yielding, and a real
        // round loop is comfortably longer than any window worth picking.
        let depth = 1;
        let yields = false;
        let calls = false;

        for (let j = i + 1; j < lines.length && depth > 0; j += 1) {
          const line = strip(lines[j]);
          depth += (line.match(/\b(function|if|for|while|do|repeat)\b/g)?.length ?? 0);
          depth -= (line.match(/\b(end|until)\b/g)?.length ?? 0);
          depth -= (line.match(/\b(for|while)\b[^\n]*\bdo\b/g)?.length ?? 0);

          if (/task\.wait|:Wait\s*\(|RunService\.\w+:Wait|task\.delay|\bwait\s*\(|coroutine\.yield/.test(line)) {
            yields = true;
          }
          if (/\w\s*\(/.test(line)) calls = true;
        }

        // No yield and no call at all: the loop provably spins. With a call
        // present the yield may be one frame deeper, which this cannot see.
        if (!yields) return calls ? -(i + 1) : i + 1;
      }
      return null;
    },
  },
  {
    id: "connection-inside-loop",
    severity: "warning",
    message:
      "Event connection created inside a loop. This leaks a handler on every iteration — connect once, or disconnect.",
    fileTest: (source) => {
      const lines = source.split("\n");
      let loopDepth = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const line = strip(lines[i]);
        if (/\b(for|while)\b.*\bdo\b/.test(line)) loopDepth += 1;
        if (/^\s*end\b/.test(line) && loopDepth > 0) loopDepth -= 1;
        if (loopDepth > 0 && /[:.]Connect\s*\(/.test(line)) return i + 1;
      }
      return null;
    },
  },
];

/**
 * Review one file.
 *
 * `path` decides which rules apply, because the same line is safe or fatal
 * depending on whether it runs on the server or the client.
 */
export function reviewFile(path: string, source: string): SecurityFinding[] {
  const context = contextFor(path);
  const findings: SecurityFinding[] = [];
  const lines = source.split("\n");

  for (const rule of RULES) {
    if (rule.appliesTo && !rule.appliesTo.includes(context)) continue;

    if (rule.fileTest) {
      const line = rule.fileTest(source, context, path);
      if (line !== null) {
        // A negative line number means "found, but not with enough certainty to
        // block" — the rule downgrades itself rather than the caller guessing.
        const certain = line > 0;
        findings.push({
          rule: rule.id,
          severity: certain ? rule.severity : "warning",
          line: Math.abs(line),
          message: certain
            ? rule.message
            : `${rule.message} (the loop calls other functions, so the yield may be inside one — verify it)`,
          path,
        });
      }
      continue;
    }

    if (!rule.test) continue;
    for (let i = 0; i < lines.length; i += 1) {
      const line = rule.raw ? stripComments(lines[i]) : strip(lines[i]);
      if (!line.trim()) continue;
      if (rule.test(line, context)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          line: i + 1,
          message: rule.message,
          path,
        });
        break; // One finding per rule per file keeps the report readable.
      }
    }
  }

  // A LocalScript that cannot run is a placement error, not a code error.
  const kind = inferKind(path);
  if (kind === "localscript" && context === "server") {
    findings.push({
      rule: "localscript-in-server-container",
      severity: "error",
      line: 1,
      message: "A LocalScript under ServerScriptService will never run. Move it to src/client.",
      path,
    });
  }
  if (kind === "script" && context === "client") {
    findings.push({
      rule: "server-script-in-client-container",
      severity: "error",
      line: 1,
      message: "A server Script under StarterPlayerScripts will never run. Move it to src/server.",
      path,
    });
  }

  return findings;
}

export function reviewFiles(files: { path: string; content: string }[]): SecurityReport {
  const findings = files
    .filter((file) => /\.luau?$/i.test(file.path))
    .flatMap((file) => reviewFile(file.path, file.content));

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;

  return { ok: errors === 0, errors, warnings, findings };
}

/** Compact rendering for the model to read during repair. */
export function formatSecurityReport(report: SecurityReport): string {
  if (!report.findings.length) return "Security review: no findings.";
  const lines = report.findings.map(
    (f) => `  ${f.severity === "error" ? "ERROR" : f.severity === "warning" ? "warn " : "info "} ${f.path}:${f.line} [${f.rule}] ${f.message}`,
  );
  return `Security review: ${report.errors} error(s), ${report.warnings} warning(s)\n${lines.join("\n")}`;
}
