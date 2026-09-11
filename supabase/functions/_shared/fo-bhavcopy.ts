// NSE's daily F&O bhavcopy (UDiFF), for every stock and index in F&O:
//   nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_YYYYMMDD_F_0000.csv.zip
// ~1 MB zipped, ~34,000 contracts. Read into one end-of-day snapshot per
// underlying: open interest by strike for the nearest expiry (PCR, max pain,
// support and resistance) and the near-month future's price and open-interest
// change, which classify the day's positioning (long build-up and so on).
//
// Pure apart from DecompressionStream (a web standard in Deno and Node).

import { summariseChain, type OptionRow } from "./option-chain.ts";

/** The first file in a zip archive, as text. Reads the central directory, so a data-descriptor zip works too. */
export async function unzipFirstFile(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("not a zip archive");
  const cd = view.getUint32(eocd + 16, true);
  if (view.getUint32(cd, true) !== 0x02014b50) throw new Error("zip central directory not found");
  const method = view.getUint16(cd + 10, true);
  const compressedSize = view.getUint32(cd + 20, true);
  const localOffset = view.getUint32(cd + 42, true);
  if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("zip local header not found");
  const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
  const data = bytes.subarray(start, start + compressedSize);
  if (method === 0) return new TextDecoder().decode(data);
  if (method !== 8) throw new Error(`unsupported zip compression ${method}`);
  const source = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(data); controller.close(); } });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

export type FoContract = {
  type: "IDF" | "IDO" | "STF" | "STO"; symbol: string; expiry: string; strike: number | null; option: "CE" | "PE" | null;
  close: number | null; prevClose: number | null; underlying: number | null; oi: number; oiChange: number; volume: number;
  tradeDate: string; lot: number | null;
};

const n = (v: string | undefined) => {
  if (v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * Every futures and options contract. The file has no quoted fields, so a
 * plain split is safe - and ~10x faster than a quote-aware parser on 34,000
 * rows, which is what keeps the whole file inside an edge worker's CPU limit.
 */
export function parseFoBhavcopy(csv: string): FoContract[] {
  const lines = csv.split(/\r?\n/);
  const header = (lines[0] ?? "").split(",");
  const col = (name: string) => header.indexOf(name);
  const [iType, iSym, iExp, iStrike, iOpt, iClose, iPrev, iUnd, iOi, iOiChg, iVol, iDate, iLot] =
    ["FinInstrmTp", "TckrSymb", "XpryDt", "StrkPric", "OptnTp", "ClsPric", "PrvsClsgPric", "UndrlygPric", "OpnIntrst", "ChngInOpnIntrst", "TtlTradgVol", "TradDt", "NewBrdLotQty"].map(col);
  if (iType === -1 || iSym === -1 || iExp === -1) return [];
  const out: FoContract[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const type = c[iType];
    if (type !== "IDF" && type !== "IDO" && type !== "STF" && type !== "STO") continue;
    const option = c[iOpt] === "CE" || c[iOpt] === "PE" ? c[iOpt] as "CE" | "PE" : null;
    out.push({
      type, symbol: c[iSym], expiry: c[iExp], strike: option ? n(c[iStrike]) : null, option,
      close: n(c[iClose]), prevClose: n(c[iPrev]), underlying: n(c[iUnd]),
      oi: n(c[iOi]) ?? 0, oiChange: n(c[iOiChg]) ?? 0, volume: n(c[iVol]) ?? 0, tradeDate: c[iDate], lot: n(c[iLot]),
    });
  }
  return out;
}

export type BuildUp = "long_buildup" | "short_buildup" | "short_covering" | "long_unwinding" | "neutral";

/**
 * The day's positioning from the future's price and open-interest change:
 * rising price with rising OI is fresh buying (long build-up), falling price
 * with rising OI fresh selling (short build-up), rising price with falling OI
 * shorts closing (short covering), falling price with falling OI longs exiting.
 */
export function buildUp(priceChangePct: number | null, oiChangePct: number | null): BuildUp {
  if (priceChangePct === null || oiChangePct === null || Math.abs(priceChangePct) < 0.05 || Math.abs(oiChangePct) < 0.5) return "neutral";
  if (oiChangePct > 0) return priceChangePct > 0 ? "long_buildup" : "short_buildup";
  return priceChangePct > 0 ? "short_covering" : "long_unwinding";
}

export type FoSnapshot = {
  trade_date: string; symbol: string; expiry: string; spot: number | null;
  pcr: number | null; max_pain: number | null; total_call_oi: number; total_put_oi: number; call_wall: number | null; put_wall: number | null;
  strikes: { k: number; c: number; p: number; dc: number; dp: number; ci: number; pi: number }[];
  fut_close: number | null; fut_prev_close: number | null; fut_oi: number | null; fut_oi_change: number | null; build_up: BuildUp; lot_size: number | null;
};

/** One snapshot per underlying: its nearest option expiry's chain and its near-month future. */
export function summariseUnderlyings(contracts: FoContract[], strikesEach = 20): FoSnapshot[] {
  const bySymbol = new Map<string, FoContract[]>();
  for (const c of contracts) {
    const list = bySymbol.get(c.symbol);
    if (list) list.push(c); else bySymbol.set(c.symbol, [c]);
  }
  const out: FoSnapshot[] = [];
  for (const [symbol, list] of bySymbol) {
    const options = list.filter((c) => c.option);
    const futures = list.filter((c) => !c.option).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const expiry = [...new Set(options.map((o) => o.expiry))].sort()[0];
    if (!expiry) continue;
    const byStrike = new Map<number, OptionRow>();
    for (const o of options) {
      if (o.expiry !== expiry || o.strike === null) continue;
      const row = byStrike.get(o.strike) ?? { strike: o.strike, callOI: 0, callChange: 0, callLTP: 0, callIV: 0, callVolume: 0, putOI: 0, putChange: 0, putLTP: 0, putIV: 0, putVolume: 0 };
      if (o.option === "CE") Object.assign(row, { callOI: o.oi, callChange: o.oiChange, callLTP: o.close ?? 0, callVolume: o.volume });
      else Object.assign(row, { putOI: o.oi, putChange: o.oiChange, putLTP: o.close ?? 0, putVolume: o.volume });
      byStrike.set(o.strike, row);
    }
    const rows = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
    const spot = options.find((o) => o.underlying !== null)?.underlying ?? futures[0]?.underlying ?? null;
    const summary = summariseChain(rows);
    const atm = spot === null ? Math.floor(rows.length / 2) : rows.reduce((bi, r, i) => (Math.abs(r.strike - spot) < Math.abs(rows[bi].strike - spot) ? i : bi), 0);
    const near = futures[0];
    const priorOi = near ? near.oi - near.oiChange : null;
    const priceChg = near?.close && near.prevClose ? (near.close / near.prevClose - 1) * 100 : null;
    const oiChg = near && priorOi && priorOi > 0 ? (near.oiChange / priorOi) * 100 : null;
    out.push({
      trade_date: list[0].tradeDate, symbol, expiry, spot,
      pcr: summary.pcr, max_pain: summary.maxPain, total_call_oi: summary.totalCallOI, total_put_oi: summary.totalPutOI,
      call_wall: summary.callWall, put_wall: summary.putWall,
      strikes: rows.slice(Math.max(0, atm - strikesEach), atm + strikesEach + 1).map((r) => ({ k: r.strike, c: r.callOI, p: r.putOI, dc: r.callChange, dp: r.putChange, ci: 0, pi: 0 })),
      fut_close: near?.close ?? null, fut_prev_close: near?.prevClose ?? null, fut_oi: near?.oi ?? null, fut_oi_change: near?.oiChange ?? null,
      build_up: buildUp(priceChg, oiChg), lot_size: near?.lot ?? options[0]?.lot ?? null,
    });
  }
  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
