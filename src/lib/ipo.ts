import { supabase } from "@/integrations/supabase/client";

export type GmpSnapshot = {
  captured_at: string;
  gmp: number;
  est_listing_price: number | null;
  source: string;
};

export type Ipo = {
  id: string;
  slug: string;
  name: string;
  board: "mainboard" | "sme";
  type: "Mainboard" | "SME";
  status: "upcoming" | "open" | "closed" | "listed";
  price_band_min: number | null;
  price_band_max: number | null;
  price: string;
  lot_size: number | null;
  issue_size_crore: number | null;
  size: string;
  open_date: string | null;
  close_date: string | null;
  date: string;
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
  gmp: number | null;
  est_listing_price: number | null;
  gmp_history: GmpSnapshot[];
};

type IpoResponse = { success: boolean; ipos?: Ipo[]; error?: string; fetchedAt?: string };

export async function getIpos(slug?: string): Promise<Ipo[]> {
  const { data, error } = await supabase.functions.invoke<IpoResponse>("fetch-ipos", {
    body: slug ? { slug } : {},
  });
  if (error || !data?.success) throw new Error(data?.error || error?.message || "Could not load IPO data");
  return data.ipos ?? [];
}

export const formatRupees = (value: number | null, fractionDigits = 0) =>
  value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: fractionDigits }).format(value);

export const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Awaited";
