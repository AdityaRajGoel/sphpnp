// Public, read-only IPO catalogue endpoint. Collection happens in sync-ipos;
// visitors never trigger third-party scraping or create GMP observations.

import { createClient } from "npm:@supabase/supabase-js@2";
import { deriveIpoStatus, istDate } from "../_shared/ipo-status.ts";
import { performanceBySlug, type EodBar, type ListingPerformance, type NseIpoLink } from "../_shared/ipo-listing.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IpoRow = {
  id: string;
  slug: string;
  name: string;
  board: "mainboard" | "sme";
  status: "upcoming" | "open" | "closed" | "listed";
  price_band_min: number | null;
  price_band_max: number | null;
  lot_size: number | null;
  issue_size_crore: number | null;
  open_date: string | null;
  close_date: string | null;
  allotment_date: string | null;
  listing_date: string | null;
  registrar: string | null;
  rhp_url: string | null;
  drhp_url: string | null;
  subscription_qib: number | null;
  subscription_nii: number | null;
  subscription_retail: number | null;
  listing_price: number | null;
  listing_gain_pct: number | null;
  source: string;
  source_url: string | null;
  data_as_of: string;
};

const formatPriceBand = (ipo: IpoRow) => {
  if (ipo.price_band_min === null) return "TBA";
  if (ipo.price_band_min === ipo.price_band_max || ipo.price_band_max === null) return `₹${ipo.price_band_min}`;
  return `₹${ipo.price_band_min}–${ipo.price_band_max}`;
};

const formatDateRange = (ipo: IpoRow) => {
  if (!ipo.open_date) return "Dates awaited";
  const format = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  return ipo.close_date ? `${format(ipo.open_date)} – ${format(ipo.close_date)}` : format(ipo.open_date);
};

import { forListing } from "../_shared/ipo-payload.ts";

const client = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({})) as { slug?: string };
    const supabase = client();
    let query = supabase.from("ipos").select("*").order("open_date", { ascending: true, nullsFirst: false });
    if (body.slug) query = query.eq("slug", body.slug);
    const { data, error } = await query;
    if (error) throw error;
    const ipos = (data ?? []) as IpoRow[];

    const ids = ipos.map((ipo) => ipo.id);
    const { data: snapshots, error: snapshotError } = ids.length
      ? await supabase.from("ipo_gmp_snapshots").select("ipo_id,captured_at,gmp,est_listing_price,source").in("ipo_id", ids).order("captured_at", { ascending: true })
      : { data: [], error: null };
    if (snapshotError) throw snapshotError;

    // Listing performance from exchange bars, for listed issues the catalogue
    // has no listing price for (which, as of Sept 2026, is all of them). A
    // failure here leaves those fields null rather than failing the catalogue.
    const needsListing = ipos.filter((ipo) => ipo.listing_date && ipo.listing_price === null).map((ipo) => ipo.slug);
    let performance = new Map<string, ListingPerformance>();
    if (needsListing.length > 0) {
      try {
        const { data: links } = await supabase.from("nse_ipos").select("symbol,ipo_slug,issue_price,listing_date").in("ipo_slug", needsListing);
        const symbols = (links ?? []).map((l) => l.symbol);
        const earliest = (links ?? []).map((l) => l.listing_date).filter(Boolean).sort()[0];
        if (symbols.length > 0 && earliest) {
          const { data: bars } = await supabase.from("eq_eod").select("symbol,trade_date,open,close").eq("exchange", "NSE").in("symbol", symbols).gte("trade_date", earliest).order("trade_date", { ascending: true }).limit(20000);
          performance = performanceBySlug((links ?? []) as NseIpoLink[], (bars ?? []) as EodBar[]);
        }
      } catch (e) {
        console.error("listing performance skipped:", e instanceof Error ? e.message : e);
      }
    }

    const snapshotMap = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots ?? []) {
      const group = snapshotMap.get(snapshot.ipo_id) ?? [];
      group.push(snapshot);
      snapshotMap.set(snapshot.ipo_id, group);
    }
    // Re-derived on every read, not just at sync time: sync-ipos runs three times
    // a day on weekdays, so a stored status can be up to a weekend old. The
    // stored value only ever moves the answer forward (see ipo-status.ts).
    const today = istDate();
    const single = Boolean(body.slug);
    const payload = ipos.map((ipo) => {
      const history = snapshotMap.get(ipo.id) ?? [];
      const latest = history.at(-1) ?? null;
      const perf = performance.get(ipo.slug) ?? null;
      return {
        ...ipo,
        listing_price: ipo.listing_price ?? perf?.listing_price ?? null,
        listing_gain_pct: ipo.listing_gain_pct ?? perf?.listing_gain_pct ?? null,
        listing_day_close: perf?.listing_day_close ?? null,
        latest_close: perf?.latest_close ?? null,
        latest_close_date: perf?.latest_close_date ?? null,
        gain_since_issue_pct: perf?.gain_since_issue_pct ?? null,
        nse_symbol: perf?.nse_symbol ?? null,
        status: deriveIpoStatus(ipo, ipo.status, today),
        type: ipo.board === "sme" ? "SME" : "Mainboard",
        price: formatPriceBand(ipo),
        date: formatDateRange(ipo),
        size: ipo.issue_size_crore === null ? "—" : `₹${ipo.issue_size_crore} Cr`,
        gmp: latest?.gmp ?? null,
        est_listing_price: latest?.est_listing_price ?? null,
        gmp_history: history,
      };
    }).map((ipo) => forListing(ipo, single));

    return new Response(JSON.stringify({ success: true, ipos: payload, fetchedAt: new Date().toISOString() }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("fetch-ipos failed:", message);
    return new Response(JSON.stringify({ success: false, error: "IPO data is temporarily unavailable" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
