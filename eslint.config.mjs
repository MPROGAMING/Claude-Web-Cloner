import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full copies of this tree. Without this, lint walks
    // every one of them and reports the same problems N+1 times — the first
    // run after three agents were spawned returned 54,000.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
