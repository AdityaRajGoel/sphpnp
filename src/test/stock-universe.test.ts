import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/*
 * Guards on the screener's stock universe.
 *
 * Read as text rather than imported: fetch-screener-data/index.ts calls
 * Deno.serve() at module scope, so importing it into vitest would start a
 * server. The array is a literal, so a regex over the source is a faithful
 * reading of what ships.
 */

const SOURCE = readFileSync("supabase/functions/fetch-screener-data/index.ts", "utf-8");

const entries = [
  ...SOURCE.matchAll(
    /\{\s*symbol:\s*"([^"]+)",\s*yahoo:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*sector:\s*"([^"]+)"\s*\}/g,
  ),
].map(([, symbol, yahoo, name, sector]) => ({ symbol, yahoo, name, sector }));

describe("stock universe", () => {
  it("parses every entry out of the source", () => {
    // A parse that silently found nothing would make every assertion below
    // vacuously true, which is worse than no test at all.
    expect(entries.length).toBeGreaterThan(200);
  });

  it("has no duplicate symbols", () => {
    /*
     * This is the important one. The upsert uses onConflict: "symbol" and
     * processes the array in order, so a duplicate does not error - the later
     * entry silently overwrites the earlier one. Eleven duplicates once sat in
     * this array, three of them BSE (.BO) tickers keyed under the NSE symbol,
     * which meant RELIANCE, TCS and HDFCBANK served BSE prices under names like
     * "Reliance (BSE)" until someone noticed.
     */
    const counts = new Map<string, number>();
    for (const { symbol } of entries) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    const duplicates = [...counts].filter(([, n]) => n > 1).map(([s]) => s);

    expect(duplicates, `duplicate symbols silently overwrite each other: ${duplicates}`).toEqual([]);
  });

  it("keys every entry on a plain NSE symbol, never an exchange-suffixed one", () => {
    // ".BO" under a bare symbol is exactly how the BSE rows crept in.
    for (const { symbol } of entries) {
      expect(symbol, `${symbol} carries an exchange suffix`).not.toMatch(/\.(NS|BO)$/i);
    }
  });

  it("points every entry at an NSE Yahoo ticker matching its symbol", () => {
    for (const { symbol, yahoo } of entries) {
      expect(yahoo, `${symbol} -> ${yahoo}`).toBe(`${symbol}.NS`);
    }
  });

  it("gives every entry a non-empty name and sector", () => {
    for (const { symbol, name, sector } of entries) {
      expect(name.trim(), `${symbol} has no name`).not.toBe("");
      expect(sector.trim(), `${symbol} has no sector`).not.toBe("");
    }
  });

  it("draws sectors from the established vocabulary", () => {
    // Free-text sectors would quietly fragment the screener's sector filter.
    const allowed = new Set([
      "Auto", "Banking", "Chemicals", "Consumer", "Defence", "Diversified", "Energy",
      "FMCG", "IT", "Infra", "Insurance", "Metals", "NBFC", "Pharma", "Tech", "Telecom",
    ]);
    const unknown = [...new Set(entries.map((e) => e.sector))].filter((s) => !allowed.has(s));
    expect(unknown, `unrecognised sector labels: ${unknown}`).toEqual([]);
  });
});
