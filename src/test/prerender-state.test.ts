import { describe, expect, it } from "vitest";
import { isPlainJson, pickDehydrated } from "@/lib/prerender";
import { shipPageState } from "../../scripts/lib/prerender-html.mjs";

const query = (hash: string, data: unknown, status = "success") => ({ queryHash: hash, queryKey: [hash], state: { data, status } });

describe("isPlainJson", () => {
  it("accepts what JSON round-trips and rejects what it silently changes", () => {
    expect(isPlainJson({ a: [1, "x", null, { b: true }] })).toBe(true);
    expect(isPlainJson({ m: new Map() })).toBe(false);
    expect(isPlainJson([new Date()])).toBe(false);
    expect(isPlainJson({ n: Number.NaN })).toBe(false);
  });
});

describe("pickDehydrated", () => {
  it("keeps successful JSON-safe queries and drops errors, Maps and oversized data", () => {
    const state = {
      mutations: [{}],
      queries: [query("ok", { rows: [1, 2] }), query("failed", undefined, "error"), query("map", new Map()), query("huge", "x".repeat(200_000))],
    };
    const picked = pickDehydrated(state);
    expect(picked.queries.map((q) => q.queryHash)).toEqual(["ok"]);
    expect(picked.mutations).toEqual([]);
  });

  it("fills the budget smallest first, so one big list cannot crowd out the rest", () => {
    const big = Array.from({ length: 4 }, (_, i) => query(`big${i}`, "x".repeat(140_000)));
    const picked = pickDehydrated({ mutations: [], queries: [...big, query("small", 1)] });
    expect(picked.queries[0].queryHash).toBe("small");
    expect(picked.queries.length).toBe(3);
  });
});

describe("shipPageState", () => {
  const page = '<html><body><div id="app-splash" aria-hidden="true"></div><div id="root">x</div></body></html>';

  it("hides the splash and writes the state before the last </body>, escaping <", () => {
    const out = shipPageState(page, JSON.stringify({ s: "</script>" }));
    expect(out).toContain('<div id="app-splash" style="display:none"');
    expect(out).toContain('<script type="application/json" id="rq-state">{"s":"\\u003c/script>"}</script></body>');
    expect(out).not.toContain("</script></script>");
  });

  it("is idempotent and works with no state", () => {
    const once = shipPageState(page, null);
    expect(shipPageState(once, null)).toBe(once);
    expect(once).not.toContain("rq-state");
  });
});
