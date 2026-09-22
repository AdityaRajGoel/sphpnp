// Exact F&O margin (SPAN + exposure) for a portfolio of positions, from the
// SPAN calculator on webtrade.parasramindia.com - the group's trading platform,
// which loads the exchanges' SPAN files through the day. It sends no CORS
// headers for this site, so the browser cannot call it: this function forwards
// the two calls the calculator needs, after validating them.
//
//   { action: "search", query: "RELIANCE 27OCT" } -> matching contracts (NSE F&O, currency, MCX)
//   { action: "calculate", positions: [{ exchange, id, quantity }] }
//       -> span, exposure, netPremium, total (quantity < 0 is a sell)
//   Structured picker (NSE F&O):
//   { action: "expiries", symbol: "NIFTY", kind: "FUT" | "CE" | "PE" } -> series, expiries
//   { action: "strikes", symbol, series, expiry: "2026-10-27", kind: "CE" | "PE" } -> strikes
//   { action: "contract", symbol, series, expiry, kind, strike? } -> contract

import {
  KINDS, MAX_LEGS, PICKER_SERIES, cleanExpiries, pickContracts, seriesFor, sortedStrikes, toOption, tradeable, upstreamDate,
  validExpiry, validPositions, validQuery, validSymbol, type Contract, type Kind, type Position,
} from "../_shared/span-margin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://webtrade.parasramindia.com/marketdata";
const SEARCH_CACHE_MS = 30 * 60_000;
const MAX_CACHED = 200;
const searchCache = new Map<string, { at: number; contracts: Contract[] }>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * The upstream search matches one symbol-like word ("NIFTY" works, "NIFTY FUT"
 * finds nothing), so it is asked for the first word only, cached per word, and
 * the rest of the query ("27OCT", "CE", "25000") filters locally.
 */
async function upstreamContracts(word: string): Promise<Contract[]> {
  const hit = searchCache.get(word);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.contracts;
  const res = await fetch(`${BASE}/search/spansearch?source=WEB&searchString=${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`webtrade search answered HTTP ${res.status}`);
  const upstream = (await res.json()) as { result?: Contract[] };
  const contracts = (upstream.result ?? []).filter(tradeable);
  if (searchCache.size >= MAX_CACHED) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(word, { at: Date.now(), contracts });
  return contracts;
}

const INSTRUMENTS = `${BASE}/instruments/instrument`;

async function lookup(path: string): Promise<unknown> {
  const res = await fetch(`${INSTRUMENTS}/${path}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`webtrade lookup answered HTTP ${res.status}`);
  return ((await res.json()) as { result?: unknown }).result;
}

/** Index contracts are tried first (NIFTY, BANKNIFTY), then stock contracts. */
async function expiries(symbol: string, kind: Kind) {
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  for (const index of [true, false]) {
    const series = seriesFor(kind, index);
    // The platform answers a symbol it has no contracts for in this series with
    // HTTP 400 for some series and an error body for others: either means "none".
    const raw = await lookup(`expiryDate?exchangeSegment=2&series=${series}&symbol=${encodeURIComponent(symbol)}`).catch(() => null);
    const list = cleanExpiries(raw, today);
    if (list.length) return { success: true, series, expiries: list };
  }
  return { success: true, series: null, expiries: [] };
}

async function strikes(symbol: string, series: string, expiry: string, kind: Kind) {
  const raw = await lookup(`strikePrice?exchangeSegment=2&series=${series}&symbol=${encodeURIComponent(symbol)}&expiryDate=${upstreamDate(expiry)}&optionType=${kind}`);
  return { success: true, strikes: sortedStrikes(raw) };
}

async function contract(symbol: string, series: string, expiry: string, kind: Kind, strike: number | null) {
  const base = `exchangeSegment=2&series=${series}&symbol=${encodeURIComponent(symbol)}&expiryDate=${upstreamDate(expiry)}`;
  const raw = kind === "FUT"
    ? await lookup(`futureSymbol?${base}`)
    : await lookup(`optionSymbol?${base}&optionType=${kind}&strikePrice=${strike}`);
  const found = Array.isArray(raw) ? (raw as Contract[]).find(tradeable) : undefined;
  return found ? { success: true, contract: toOption(found) } : { success: false, error: "No such contract" };
}

async function calculate(positions: Position[]) {
  const res = await fetch(`${BASE}/instruments/calculator/span`, {
    method: "POST",
    headers: { "Content-Type": "application/json", api: "true" },
    body: JSON.stringify({ Portfolio: positions.map((p) => ({ Exchange: p.exchange, ExchangeInstrumentID: p.id, Position: p.quantity, Price: "0.0" })) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`webtrade span answered HTTP ${res.status}`);
  const upstream = (await res.json()) as { type?: string; description?: string; result?: Record<string, number> };
  if (upstream.type !== "success" || !upstream.result) throw new Error(upstream.description ?? "webtrade span returned no result");
  const r = upstream.result;
  return { success: true, span: r.SpanMargin ?? 0, exposure: r.ExposureMargin ?? 0, netPremium: r.NetOptionsPremium ?? 0, total: r.TotalMargin ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "search") {
      if (!validQuery(body.query)) return json({ success: false, error: "Type at least two letters of a symbol" }, 400);
      const query = body.query.trim();
      const word = query.toUpperCase().split(/\s+/)[0];
      return json({ success: true, contracts: pickContracts(await upstreamContracts(word), query) });
    }
    if (body.action === "calculate") {
      const positions = validPositions(body.positions);
      if (!positions) return json({ success: false, error: `Send 1-${MAX_LEGS} positions, each a contract id and a nonzero whole quantity` }, 400);
      return json(await calculate(positions));
    }
    if (body.action === "expiries" || body.action === "strikes" || body.action === "contract") {
      const kind = body.kind as Kind;
      if (!validSymbol(body.symbol) || !KINDS.includes(kind)) return json({ success: false, error: "symbol (e.g. NIFTY) and kind FUT, CE or PE are required" }, 400);
      if (body.action === "expiries") return json(await expiries(body.symbol, kind));
      if (!PICKER_SERIES.includes(body.series) || !validExpiry(body.expiry)) return json({ success: false, error: "series and expiry (YYYY-MM-DD) are required" }, 400);
      if (body.action === "strikes") {
        if (kind === "FUT") return json({ success: false, error: "Futures have no strikes" }, 400);
        return json(await strikes(body.symbol, body.series, body.expiry, kind));
      }
      const strike = kind === "FUT" ? null : Number(body.strike);
      if (strike !== null && !(Number.isFinite(strike) && strike > 0 && strike < 10_000_000)) return json({ success: false, error: "A positive strike is required for options" }, 400);
      return json(await contract(body.symbol, body.series, body.expiry, kind, strike));
    }
    return json({ success: false, error: "action must be search, calculate, expiries, strikes or contract" }, 400);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 502);
  }
});
