/**
 * A real (if deliberately small) static checker for generated Luau.
 *
 * This is not a parser. It catches the specific mistakes language models
 * actually make when writing Roblox code, and it runs server-side before a file
 * is written so the agent can see and fix its own errors. Every rule here is
 * something that either fails to compile in Studio or is a genuine Roblox
 * anti-pattern — none of it is decorative.
 */

export type Severity = "error" | "warning";

export interface LuauDiagnostic {
  line: number;
  severity: Severity;
  rule: string;
  message: string;
}

export interface LuauValidationResult {
  ok: boolean;
  errors: number;
  warnings: number;
  diagnostics: LuauDiagnostic[];
}

const BLOCK_OPENERS = /\b(function|if|for|while|do|repeat)\b/g;
const BLOCK_CLOSERS = /\b(end|until)\b/g;

/** Strip strings and comments so token scanning doesn't trip over them. */
function stripNoise(line: string): string {
  return line
    .replace(/\[\[[\s\S]*?\]\]/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/--.*$/, "");
}

export function validateLuau(source: string, path = "script.luau"): LuauValidationResult {
  const diagnostics: LuauDiagnostic[] = [];
  const lines = source.split("\n");

  let depth = 0;
  let inLongComment = false;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;

    // --- long comment tracking ------------------------------------------------
    if (inLongComment) {
      if (rawLine.includes("]]")) inLongComment = false;
      return;
    }
    if (/--\[\[/.test(rawLine) && !rawLine.includes("]]")) {
      inLongComment = true;
      return;
    }

    const line = stripNoise(rawLine);
    if (!line.trim()) return;

    // --- block balance --------------------------------------------------------
    // `function` used as an expression on one line (e.g. `f(function() end)`)
    // is still balanced by its own `end`, so a plain token count works.
    const openers = line.match(BLOCK_OPENERS)?.length ?? 0;
    const closers = line.match(BLOCK_CLOSERS)?.length ?? 0;
    // `elseif ... then` re-opens without a new `end`; `for/while ... do` already
    // counted `do`, so subtract the duplicate.
    const duplicateDo = (line.match(/\b(for|while)\b[^\n]*\bdo\b/g)?.length ?? 0);
    depth += openers - closers - duplicateDo;

    // --- Roblox-specific correctness -----------------------------------------
    if (/(?<![:.\w])wait\s*\(/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        rule: "deprecated-globals",
        message: "Global wait() is deprecated. Use task.wait().",
      });
    }
    if (/(?<![:.\w])spawn\s*\(/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        rule: "deprecated-globals",
        message: "Global spawn() is deprecated. Use task.spawn().",
      });
    }
    if (/(?<![:.\w])delay\s*\(/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        rule: "deprecated-globals",
        message: "Global delay() is deprecated. Use task.delay().",
      });
    }
    if (/game\.Workspace/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        rule: "service-access",
        message: "Prefer workspace or game:GetService(\"Workspace\").",
      });
    }
    if (/game\.(Players|ReplicatedStorage|ServerScriptService|ServerStorage|RunService|DataStoreService|TweenService|HttpService|StarterGui|Lighting|UserInputService)\b/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        rule: "service-access",
        message: "Use game:GetService(...) so the script works before the service replicates.",
      });
    }
    if (/:connect\(|:FindFirstChild\(\s*\)|\bLoadLibrary\b/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "error",
        rule: "removed-api",
        message: "This API was removed from Roblox. Use the modern equivalent (:Connect, etc).",
      });
    }
    if (/\bprint\s*\(\s*["'].*(?:token|key|secret|password)/i.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        rule: "no-secret-logging",
        message: "Do not print secrets.",
      });
    }
    // A stray `=` in a condition is a common generated-code bug.
    if (/\bif\b[^\n]*[^~<>=!]=[^=][^\n]*\bthen\b/.test(line) && !/[=~<>]=/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "error",
        rule: "assignment-in-condition",
        message: "Assignment inside an if condition — did you mean == ?",
      });
    }
    if (/!=/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "error",
        rule: "syntax",
        message: "Luau uses ~= for inequality, not !=.",
      });
    }
    if (/(^|\s)(\/\/|&&|\|\|)(\s|$)/.test(line)) {
      diagnostics.push({
        line: lineNumber,
        severity: "error",
        rule: "syntax",
        message: "Use and/or/not — C-style operators are not valid Luau.",
      });
    }
  });

  if (depth > 0) {
    diagnostics.push({
      line: lines.length,
      severity: "error",
      rule: "unbalanced-blocks",
      message: `${depth} block${depth === 1 ? "" : "s"} left open — a matching 'end' is missing.`,
    });
  } else if (depth < 0) {
    diagnostics.push({
      line: lines.length,
      severity: "error",
      rule: "unbalanced-blocks",
      message: `${-depth} unexpected 'end' — more block terminators than openers.`,
    });
  }

  // Server scripts touching client-only services is a real class of bug.
  if (/\.server\.luau$|^src\/server\//.test(path)) {
    if (/UserInputService|GetMouse\(|LocalPlayer/.test(source)) {
      diagnostics.push({
        line: 1,
        severity: "error",
        rule: "context-mismatch",
        message:
          "Server script uses client-only APIs (LocalPlayer / UserInputService). Move that logic to src/client.",
      });
    }
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return { ok: errors === 0, errors, warnings, diagnostics };
}

/** Compact, model-readable rendering of a validation result. */
export function formatDiagnostics(path: string, result: LuauValidationResult): string {
  if (result.diagnostics.length === 0) return `${path}: no issues found.`;
  const lines = result.diagnostics.map(
    (d) => `  ${d.severity === "error" ? "ERROR" : "warn "} L${d.line} [${d.rule}] ${d.message}`,
  );
  return `${path}: ${result.errors} error(s), ${result.warnings} warning(s)\n${lines.join("\n")}`;
}
