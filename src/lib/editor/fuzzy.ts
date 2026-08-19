/**
 * Subsequence matching for go-to-file.
 *
 * Substring matching is not enough for paths: nobody types
 * `server/RoundService` to find `src/server/RoundService.luau`, they type
 * `srvround`. So the characters must be allowed to be spread out, and the score
 * has to prefer the spellings that are actually intended — runs of adjacent
 * characters, and characters that start a path segment or an extension.
 */
export function scorePath(path: string, query: string): number {
  if (!query) return 1;
  const haystack = path.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");

  let score = 0;
  let cursor = 0;
  let previous = -2;

  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return 0;
    score += 1;
    if (found === previous + 1) score += 4;
    if (found === 0 || haystack[found - 1] === "/" || haystack[found - 1] === ".") score += 3;
    previous = found;
    cursor = found + 1;
  }

  // A short path that matched is a better answer than a long one that also did.
  return score * 100 - path.length;
}
