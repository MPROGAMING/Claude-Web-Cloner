/**
 * Module resolver hook for the Roblox Brain CLI scripts.
 *
 * Node 26 strips TypeScript types natively, so the knowledge libraries in
 * src/lib/knowledge can be imported directly by these scripts. The only thing
 * Node cannot resolve is the project's "@/..." path alias, which is a
 * tsconfig/bundler convention. This maps it to src/ so the SAME modules power
 * both the Next.js app and the CLI — no duplicated chunking or symbol logic
 * that could silently drift apart.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = join(ROOT, "src", specifier.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  // "server-only" is a Next.js build guard with no meaning outside the bundler.
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export{}", shortCircuit: true };
  }
  return next(specifier, context);
}
