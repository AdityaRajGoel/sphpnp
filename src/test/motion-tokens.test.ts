import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { DURATION_ALLOWLIST, REVEAL_ALLOWLIST } from "./motion-allowlist";

/** Vitest runs from the repo root, so cwd is the right anchor. */
const ROOT = process.cwd();

/** Hardcoded Tailwind duration, e.g. `duration-300`. Token durations are named. */
const HARDCODED_DURATION = /\bduration-\d+\b/;

/** A `whileInView` prop written by hand rather than spread from a preset. */
const HAND_ROLLED_REVEAL = /whileInView=\{\{/;

/**
 * Walk `src/` for .tsx files. Hand-rolled rather than using fs.globSync or
 * readdirSync({recursive:true}), both of which need a newer Node than this
 * repo pins. Returns repo-relative POSIX paths so they match the allowlist.
 */
function sourceFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out.sort();
}

function violating(pattern: RegExp): string[] {
  return sourceFiles().filter((f) =>
    pattern.test(readFileSync(join(ROOT, f), "utf8")),
  );
}

describe("motion token ratchet", () => {
  it("has no hardcoded durations outside the allowlist", () => {
    const unexpected = violating(HARDCODED_DURATION).filter(
      (f) => !DURATION_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
  });

  it("has no stale entries in the duration allowlist", () => {
    const actual = violating(HARDCODED_DURATION);
    const stale = DURATION_ALLOWLIST.filter((f) => !actual.includes(f));
    expect(stale).toEqual([]);
  });

  it("has no hand-rolled reveals outside the allowlist", () => {
    const unexpected = violating(HAND_ROLLED_REVEAL).filter(
      (f) => !REVEAL_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
  });

  it("has no stale entries in the reveal allowlist", () => {
    const actual = violating(HAND_ROLLED_REVEAL);
    const stale = REVEAL_ALLOWLIST.filter((f) => !actual.includes(f));
    expect(stale).toEqual([]);
  });
});
