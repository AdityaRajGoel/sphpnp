// MCX futures quotes from MCX's own market watch, for sync-mcx. MCX's CDN answers 403
// to plain HTTP clients and to Playwright's headless shell (tested 2026-10-03 from this
// Mac and the VPS), but serves full Chromium in its newer headless mode with the
// automation flag hidden. So: open the market-watch page once in that browser, call
// the same JSON endpoint the page itself calls, keep the commodity futures rows, and
// post them. One page load per run, every few minutes in MCX hours.
import { chromium } from "@playwright/test";

const SYNC_URL = process.env.SYNC_URL ?? "http://127.0.0.1:8000/functions/v1/sync-mcx";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SYNC_SECRET = process.env.MARKET_SYNC_SECRET ?? "";
const PAGE = "https://www.mcxindia.com/market-data/market-watch";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const BACKFILL_DELAY_MS = 1_500;

const postRows = (body: Record<string, unknown>) =>
  fetch(SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, "x-sync-secret": SYNC_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

const browser = await chromium.launch({ headless: true, channel: "chromium", args: ["--disable-blink-features=AutomationControlled"] });
try {
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: "en-IN", viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
  const page = await ctx.newPage();
  const res = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!res || res.status() !== 200) throw new Error(`market watch page answered ${res?.status() ?? "nothing"}`);

  // MCX_BACKFILL_FROM=2016-01-01 [MCX_BACKFILL_TO=...]: post each weekday's bhavcopy
  // instead of the live quotes, one day at a time, then stop.
  const from = process.env.MCX_BACKFILL_FROM;
  if (from) {
    const to = process.env.MCX_BACKFILL_TO ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    let stored = 0, empty = 0;
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
      const day = new Date(t);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      const ddmmyyyy = `${String(day.getUTCDate()).padStart(2, "0")}/${String(day.getUTCMonth() + 1).padStart(2, "0")}/${day.getUTCFullYear()}`;
      const rows = await page.evaluate(async (d) => {
        const r = await fetch(`/market-data/bhavcopy/GetDateWiseBhavCopy?InstrumentName=FUTCOM&fromDate=${encodeURIComponent(d)}`);
        if (!r.ok) return [];
        return ((await r.json())?.Data ?? []) as unknown[];
      }, ddmmyyyy).catch(() => [] as unknown[]);
      if (rows.length === 0) { empty += 1; continue; }
      const post = await postRows({ bhavcopy: rows });
      if (post.ok) stored += 1;
      else console.log(`${ddmmyyyy}: ${post.status}`);
      await page.waitForTimeout(BACKFILL_DELAY_MS);
    }
    console.log(`backfill ${from}..${to}: ${stored} days stored, ${empty} without data`);
    await browser.close();
    process.exit(0);
  }
  const rows = await page.evaluate(async () => {
    const r = await fetch("/market-data/market-watch/GetMarketWatch?culture=en", { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`GetMarketWatch answered ${r.status}`);
    const body = await r.json();
    return (body?.data?.Data ?? []).filter((x: { InstrumentName?: string }) => x.InstrumentName === "FUTCOM");
  });
  if (rows.length === 0) throw new Error("GetMarketWatch carried no FUTCOM rows");
  const post = await postRows({ rows });
  console.log(`posted ${rows.length} futures -> ${post.status} ${(await post.text()).slice(0, 200)}`);
} finally {
  await browser.close();
}
