// Public, read-only IPO catalogue endpoint. Collection happens in sync-ipos;
// visitors never trigger third-party scraping or create GMP observations.

import { createClient } from "npm:@supabase/supabase-js@2";

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

    const snapshotMap = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots ?? []) {
      const group = snapshotMap.get(snapshot.ipo_id) ?? [];
      group.push(snapshot);
      snapshotMap.set(snapshot.ipo_id, group);
    }
    const payload = ipos.map((ipo) => {
      const history = snapshotMap.get(ipo.id) ?? [];
      const latest = history.at(-1) ?? null;
      return {
        ...ipo,
        type: ipo.board === "sme" ? "SME" : "Mainboard",
        price: formatPriceBand(ipo),
        date: formatDateRange(ipo),
        size: ipo.issue_size_crore === null ? "—" : `₹${ipo.issue_size_crore} Cr`,
        gmp: latest?.gmp ?? null,
        est_listing_price: latest?.est_listing_price ?? null,
        gmp_history: history,
      };
    });

    return new Response(JSON.stringify({ success: true, ipos: payload, fetchedAt: new Date().toISOString() }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("fetch-ipos failed:", message);
    return new Response(JSON.stringify({ success: false, error: "IPO data is temporarily unavailable" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
