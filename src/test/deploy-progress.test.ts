import { describe, expect, it } from "vitest";
import { buildProgress } from "../../infra/vps/tools/deploy-api/progress.mjs";

const t0 = Date.parse("2026-10-03T22:00:00+05:30");

describe("buildProgress", () => {
  it("reads pages done, the rate from timestamped lines, and the time left", () => {
    const log = `Prerendering /...\nSaved /a.html (100/1000) t=${t0 + 5 * 60_000}\nSaved /b.html (300/1000) t=${t0 + 15 * 60_000}\n`;
    const p = buildProgress(log, t0, t0 + 15 * 60_000, true);
    expect(p).toMatchObject({ phase: "rendering pages", done: 300, total: 1000, ratePerMin: 20, elapsedSec: 900 });
    // 700 pages at 20 a minute plus ~4 minutes of publishing.
    expect(p.etaSec).toBe(700 * 3 + 240);
  });
  it("falls back to the start time when the lines carry no timestamps", () => {
    const p = buildProgress("Saved /a.html (130/1000)\n", t0, t0 + 13 * 60_000, true);
    expect(p.ratePerMin).toBe(13);
  });
  it("names the phases before and after the pages", () => {
    expect(buildProgress("vite v8 building...", t0, t0, true).phase).toBe("building the app");
    expect(buildProgress("Saved /a (1000/1000) t=1\nPrerendering completed successfully.", t0, t0, true)).toMatchObject({ phase: "publishing", etaSec: 240 });
    expect(buildProgress("", t0, t0, false).phase).toBe("finished");
  });
});
