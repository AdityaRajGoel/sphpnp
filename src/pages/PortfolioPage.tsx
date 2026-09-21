import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Briefcase, Trash2, Upload } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { parseHoldings, type Holding } from "@/lib/portfolio-csv";
import { fetchRedFlagInputsMany, redFlags, type RedFlag } from "../../supabase/functions/_shared/red-flags";

const STORAGE_KEY = "panipat_portfolio";

// Per-viewer convenience only: the holdings live in this browser, nowhere else.
function loadSaved(): Holding[] {
  try { return parseHoldingsJson(localStorage.getItem(STORAGE_KEY)); } catch { return []; }
}
function parseHoldingsJson(raw: string | null): Holding[] {
  const v: unknown = JSON.parse(raw ?? "[]");
  if (!Array.isArray(v)) return [];
  return v.filter((h): h is Holding => !!h && typeof h.symbol === "string" && typeof h.qty === "number" && h.qty > 0).slice(0, 200);
}
function save(h: Holding[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch { /* private mode: the page still works for this visit */ }
}

const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>(loadSaved);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { data: universe } = useScreenerUniverse();
  const symbols = holdings.map((h) => h.symbol);
  const flags = useQuery({
    queryKey: ["portfolio-flags", symbols.join(",")],
    queryFn: async () => {
      const inputs = await fetchRedFlagInputsMany(supabase, symbols);
      return new Map(symbols.map((s) => [s, redFlags(inputs.get(s)!)] as [string, RedFlag[]]));
    },
    enabled: symbols.length > 0,
    staleTime: 30 * 60_000,
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) { setError("That file is over 2 MB; a holdings export is usually a few KB."); return; }
    const { holdings: parsed, error: parseError } = parseHoldings(await file.text());
    setError(parseError);
    if (parsed.length) { setHoldings(parsed); save(parsed); }
  };

  const rows = useMemo(() => holdings.map((h) => {
    const quote = universe?.get(h.symbol)?.quote ?? null;
    const price = quote && quote.price > 0 ? quote.price : null;
    const value = price === null ? null : price * h.qty;
    const pnl = price !== null && h.avg ? ((price - h.avg) / h.avg) * 100 : null;
    return { h, name: quote?.name ?? null, price, value, pnl };
  }), [holdings, universe]);

  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const cost = rows.reduce((a, r) => a + (r.value !== null && r.h.avg ? r.h.avg * r.h.qty : 0), 0);
  const flagged = rows.filter((r) => (flags.data?.get(r.h.symbol)?.length ?? 0) > 0);
  const high = flagged.filter((r) => flags.data!.get(r.h.symbol)!.some((f) => f.severity === "high"));

  return (
    <PageTransition>
      <SEOHead title="Portfolio Check | Shri Parasram Holdings" description="Upload your broker's holdings file and see red flags and insider moves across your stocks. The file stays in your browser." noindex />
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "My Watchlist", url: "/watchlist" }, { name: "Portfolio check" }]} />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-3xl font-bold"><Briefcase className="h-7 w-7 text-secondary" aria-hidden="true" /> Portfolio check</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Upload the holdings CSV from Zerodha, Groww, Upstox, Angel or any broker. It is read in your browser and never uploaded;
              we only look up public filings for the symbols in it.
            </p>
          </div>
          <div className="flex gap-2">
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Holdings CSV file" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button onClick={() => input.current?.click()}><Upload className="mr-1.5 h-4 w-4" aria-hidden="true" /> {holdings.length ? "Replace file" : "Upload holdings CSV"}</Button>
            {holdings.length > 0 && <Button variant="outline" onClick={() => { setHoldings([]); save([]); }}><Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Clear</Button>}
          </div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

        {holdings.length > 0 && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Current value", total ? inr(total) : "—"],
                ["Overall P&L", cost ? signed(((total - cost) / cost) * 100) : "—"],
                ["Holdings", String(holdings.length)],
                ["With red flags", flags.isLoading ? "…" : `${flagged.length}${high.length ? ` (${high.length} high)` : ""}`],
              ].map(([label, value]) => (
                <Card key={label} className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums">{value}</div></Card>
              ))}
            </div>

            <Card className="mt-4 overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Your holdings with red flags from exchange filings</caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    {["Stock", "Qty", "Avg cost", "Price", "Value", "Weight", "P&L", "Red flags"].map((h, i) => <th key={h} scope="col" className={`px-3 py-2.5 font-medium ${i === 0 || i === 7 ? "text-left" : "text-right"}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((r) => {
                    const f = flags.data?.get(r.h.symbol) ?? [];
                    return (
                      <tr key={r.h.symbol} className="border-t align-top">
                        <td className="px-3 py-2.5">
                          {r.name ? <Link to={`/stock/${encodeURIComponent(r.h.symbol)}`} className="font-semibold hover:text-secondary">{r.h.symbol}</Link> : <span className="font-semibold">{r.h.symbol}</span>}
                          <div className="max-w-[200px] truncate text-xs text-muted-foreground">{r.name ?? "Not in our coverage yet"}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.h.qty.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.h.avg ? inr(r.h.avg) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.price ? inr(r.price) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.value !== null ? inr(r.value) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.value !== null && total ? `${((r.value / total) * 100).toFixed(1)}%` : "—"}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.pnl === null ? "" : r.pnl >= 0 ? "text-secondary" : "text-destructive"}`}>{r.pnl === null ? "—" : signed(r.pnl)}</td>
                        <td className="px-3 py-2.5">
                          {f.length === 0 ? <span className="text-muted-foreground">{flags.isLoading ? "…" : "None"}</span> : (
                            <ul className="space-y-1">
                              {f.map((x) => (
                                <li key={x.id} className="flex items-start gap-1.5" title={x.detail}>
                                  <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${x.severity === "high" ? "text-destructive" : "text-brand-orange"}`} aria-hidden="true" />
                                  <span><span className="font-medium">{x.title}</span>{x.severity === "high" && <span className="block text-xs text-muted-foreground">{x.detail}</span>}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground">Flags come from NSE and BSE filings: promoter pledges and selling, exchange surveillance, weak Piotroski scores and material filings. They are reasons to read further, not advice.</p>
          </>
        )}
      </main>
      <Footer />
    </PageTransition>
  );
}
