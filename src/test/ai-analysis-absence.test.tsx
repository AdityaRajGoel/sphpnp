import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { StockForAnalysis } from "@/components/AIAnalysisModal";

/**
 * The AI report is generated for named, real, SEBI-regulated listed companies,
 * and every figure in it is read by the public as a statement about that
 * company. This file guards the one rule that makes that safe: a field nobody
 * supplied must arrive at the model, and at the reader, as ABSENT.
 *
 * It used to arrive as a number. `computeAnalysis` substituted 52-week bounds
 * at spot ±15% and a flat 12% ROE / 0.4 debt-equity (14.5 / 3.5 for financials);
 * the edge function mirrored the 52W substitution and then built its Fibonacci
 * support/resistance ladder out of it, so support came out at exactly 96.5% of
 * spot and resistance at 103.5% for every stock, under a heading that calls
 * them AUTHORITATIVE.
 *
 * None of that was ever visible from the screener, which supplies high_52,
 * low_52, day_high, day_low, volume and pe on every row - so the substitutes
 * were never reached. The stock page's Ask AI button supplies none of them.
 * That asymmetry is exactly why this regresses silently, and why the tests
 * below drive the modal from a stock-page-shaped stock rather than a complete
 * one, and assert on BOTH ends: what goes over the wire, and what is rendered.
 */

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

/** What StockPage hands the modal: a price, a name, nothing else priced. */
const STOCK_PAGE_SHAPED: StockForAnalysis = {
  symbol: "RELIANCE",
  name: "Reliance Industries Ltd",
  price: 1000,
  change_pct: 1.5,
  market_cap: 1_800_000,
  sector: "Energy",
};

/** What the screener hands it: every quote column populated. */
const SCREENER_SHAPED: StockForAnalysis = {
  ...STOCK_PAGE_SHAPED,
  pe: 24,
  high_52: 1400,
  low_52: 900,
  day_high: 1010,
  day_low: 990,
  volume: 5_000_000,
  roe: 18.4,
  debt_equity: 0.62,
};

/** A server reply shaped like a run where the 52W ladder had no input. */
const REPORT_WITHOUT_LEVELS = {
  markdown_report: "### Verdict\nHOLD.",
  structured_data: {
    sentiment_score: 55,
    action_verdict: "HOLD",
    technical_signals: [],
    bullish_signals: [],
    bearish_signals: [],
    price_targets: { support: null, resistance: null, target_1m: 1040, target_3m: 1080 },
    volume_signal: null,
  },
};

const mountModal = async (stock: StockForAnalysis, verdict: unknown = REPORT_WITHOUT_LEVELS) => {
  invoke.mockImplementation((fn: string) => {
    // The header sparkline. Answering "no data" keeps recharts' ResponsiveContainer
    // out of jsdom, where it has no box to measure.
    if (fn === "fetch-stock-chart") return Promise.resolve({ data: { success: false }, error: null });
    return Promise.resolve({ data: { verdict, model: "test-model" }, error: null });
  });
  const { AIAnalysisModal } = await import("@/components/AIAnalysisModal");
  render(<AIAnalysisModal isOpen onClose={() => {}} stock={stock} />);
};

/** The body of the ai-stock-analysis call, once it has been made. */
const analysisBody = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => {
    expect(invoke.mock.calls.some((c) => c[0] === "ai-stock-analysis")).toBe(true);
  });
  const call = invoke.mock.calls.find((c) => c[0] === "ai-stock-analysis")!;
  return (call[1] as { body: Record<string, unknown> }).body;
};

beforeEach(() => invoke.mockReset());
afterEach(cleanup);

describe("AI analysis with an incomplete quote", () => {
  it("sends nulls, not stand-ins, for the fields the stock page cannot supply", async () => {
    await mountModal(STOCK_PAGE_SHAPED);
    const body = await analysisBody();

    // Each of these had a specific fabricated value before: 1150 / 850 from
    // spot ±15%, and the sector-default ratios.
    expect(body.high_52).toBeNull();
    expect(body.low_52).toBeNull();
    expect(body.roe).toBeNull();
    expect(body.debt_equity).toBeNull();

    // Volume and the day range were never populated here and must stay that way
    // rather than being invented on the way out.
    expect(body.volume ?? null).toBeNull();
    expect(body.day_high ?? null).toBeNull();
    expect(body.day_low ?? null).toBeNull();

    // The price it IS given must survive untouched - withholding must not
    // become withholding everything.
    expect(body.price).toBe(1000);
    expect(body.symbol).toBe("RELIANCE");
  });

  it("renders a withheld state instead of a fabricated ROE or debt-equity figure", async () => {
    await mountModal(STOCK_PAGE_SHAPED);

    expect(await screen.findAllByText("Not reported", {}, { timeout: 4000 })).toHaveLength(2);

    // The exact strings the old fallbacks produced. 12.0% was the non-financial
    // ROE default and 0.40 the debt-equity default; either appearing again means
    // a stand-in has been reintroduced somewhere upstream of the card.
    expect(screen.queryByText(/Return on Equity: 12\.0%/)).toBeNull();
    expect(screen.queryByText(/D\/E Ratio: 0\.40/)).toBeNull();
    expect(screen.queryByText(/Average efficiency/)).toBeNull();
    expect(screen.queryByText(/Healthy balance sheet/)).toBeNull();
  });

  it("says support and resistance are unavailable rather than printing a level", async () => {
    await mountModal(STOCK_PAGE_SHAPED);

    // Two withheld cells - support and resistance - beside two real ATR targets.
    const withheld = await screen.findAllByText("Not available", {}, { timeout: 4000 });
    expect(withheld).toHaveLength(2);
    expect(screen.getByText("₹1,040")).toBeDefined();

    // The support/resistance band needs both ends; with neither there is no band.
    expect(screen.queryByText(/^Support ₹/)).toBeNull();
    expect(screen.queryByText(/^Resistance ₹/)).toBeNull();
  });

  it("shows no volume verdict when volume was never fetched", async () => {
    await mountModal(STOCK_PAGE_SHAPED);
    await screen.findAllByText("Not available", {}, { timeout: 4000 });

    // "Vol: Low" is the badge the old vol-defaults-to-0 path produced for every
    // stock the screener did not originate.
    expect(screen.queryByText(/^Vol:/)).toBeNull();
  });

  it("still reports the figures a complete quote does carry", async () => {
    // The counterweight: withholding must be driven by absence, not applied
    // wholesale. A screener row has to keep rendering its real ratios.
    await mountModal(SCREENER_SHAPED, {
      ...REPORT_WITHOUT_LEVELS,
      structured_data: {
        ...REPORT_WITHOUT_LEVELS.structured_data,
        price_targets: { support: 950, resistance: 1200, target_1m: 1040, target_3m: 1080 },
        volume_signal: "High",
      },
    });

    expect(await screen.findByText(/Return on Equity: 18\.4%/, {}, { timeout: 4000 })).toBeDefined();
    expect(screen.getByText(/D\/E Ratio: 0\.62/)).toBeDefined();
    expect(screen.getByText("Vol: High")).toBeDefined();
    expect(screen.queryByText("Not reported")).toBeNull();
    expect(screen.queryByText("Not available")).toBeNull();

    const body = await analysisBody();
    expect(body.high_52).toBe(1400);
    expect(body.roe).toBe(18.4);
    expect(body.debt_equity).toBe(0.62);
  });
});
