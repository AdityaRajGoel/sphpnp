import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { DURATION_ALLOWLIST, REVEAL_ALLOWLIST } from "./motion-allowlist";

/** Vitest runs from the repo root, so cwd is the right anchor. */
const ROOT = process.cwd();

/** Hardcoded Tailwind duration, e.g. `duration-300`. Token durations are named. */
const HARDCODED_DURATION = /\bduration-\d+\b/;

/**
 * A `whileInView` prop written by hand rather than spread from a preset.
 *
 * Not every reveal can be a preset — a few animate `pathLength`, a rotation or
 * a letter-spacing effect that the shared vocabulary deliberately does not
 * cover. Those opt out with a `motion-exempt:` comment carrying a reason, on
 * the line before the prop. Everything else is a violation.
 *
 * The reason is required on purpose. An exemption someone has to justify in
 * writing stays rare; a bare pragma would be pasted everywhere within a month.
 */
const HAND_ROLLED_REVEAL = /whileInView=\{\{/;

/**
 * Reason text runs from the colon to the end of the comment. Excluding the
 * asterisk stops the capture consuming the comment terminator, which a naive
 * `\S+` would otherwise accept as a perfectly good reason.
 */
const EXEMPT_MARKER = /motion-exempt:([^*\n]*)/;

/** An exemption counts only if it carries a real, word-shaped reason. */
function hasReasonedExemption(text: string): boolean {
  const match = text.match(EXEMPT_MARKER);
  if (!match) return false;
  const reason = match[1].replace(/[}/\s]+$/, "").trim();
  return reason.length >= 3 && /[A-Za-z]{3}/.test(reason);
}

/** Count hand-rolled reveals in `src` that are not preceded by an exemption. */
export function unexemptedReveals(source: string): number {
  const lines = source.split("\n");
  return lines.filter((line, i) => {
    if (!HAND_ROLLED_REVEAL.test(line)) return false;
    // Look back a few lines: the marker may sit above a multi-line JSX prop list.
    const preceding = lines.slice(Math.max(0, i - 4), i).join("\n");
    return !hasReasonedExemption(preceding);
  }).length;
}

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

/** Files with at least one reveal that is neither a preset nor exempted. */
function revealViolators(): string[] {
  return sourceFiles().filter(
    (f) => unexemptedReveals(readFileSync(join(ROOT, f), "utf8")) > 0,
  );
}

describe("exemption marker", () => {
  it("counts a bare hand-rolled reveal as a violation", () => {
    expect(unexemptedReveals(`<motion.div whileInView={{ scale: 1 }} />`)).toBe(1);
  });

  it("ignores a reveal preceded by a reasoned exemption", () => {
    const src = [
      `{/* motion-exempt: SVG pathLength has no preset equivalent. */}`,
      `<motion.path whileInView={{ pathLength: 1 }} />`,
    ].join("\n");
    expect(unexemptedReveals(src)).toBe(0);
  });

  it("rejects an exemption with no reason given", () => {
    const src = [`{/* motion-exempt: */}`, `<motion.div whileInView={{ scale: 1 }} />`].join("\n");
    expect(unexemptedReveals(src)).toBe(1);
  });

  it("does not let one exemption cover a distant second reveal", () => {
    const src = [
      `{/* motion-exempt: bespoke keyframe sequence. */}`,
      `<motion.div whileInView={{ scale: [0, 1.2, 1] }} />`,
      ``,
      ``,
      ``,
      ``,
      `<motion.div whileInView={{ opacity: 1, y: 0 }} />`,
    ].join("\n");
    expect(unexemptedReveals(src)).toBe(1);
  });
});

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
    const unexpected = revealViolators().filter(
      (f) => !REVEAL_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
  });

  it("has no stale entries in the reveal allowlist", () => {
    const actual = revealViolators();
    const stale = REVEAL_ALLOWLIST.filter((f) => !actual.includes(f));
    expect(stale).toEqual([]);
  });
});
