import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
// Roboto, as on the group's webtrade calculator; imported here so only this page loads it.
import "@fontsource/roboto/latin-300.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import { calculateMargin, searchContracts, type ContractOption, type SpanLeg } from "@/lib/span-margin";
import { isPrerender } from "@/lib/prerender";

/*
 * Styled after the group's webtrade.parasramindia.com F&O margin calculator:
 * Roboto, slate #445A64 text, orange #E9671D actions, flat 46px inputs, a blue
 * gradient positions band and a results card with an orange top rule.
 */
const INK = "text-[#445A64]";
const FIELD = "h-[46px] w-full border border-[#EEEEEE] bg-white px-3 text-sm text-[#445A64] outline-none transition-colors focus:border-[#E9671D]";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const expiryLabel = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Multi-leg F&O margin from the exchanges' SPAN files, via the span-margin function. */
export default function SpanCalculator({ seed }: { seed?: string }) {
  const listId = useId();
  const [query, setQuery] = useState(seed ?? "");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ContractOption | null>(null);
  const [lots, setLots] = useState("1");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [legs, setLegs] = useState<SpanLeg[]>([]);

  // A stock page link (?symbol=TCS) or a click in the margin list seeds the search.
  useEffect(() => {
    if (!seed) return;
    setQuery(seed);
    setPicked(null);
    setOpen(true);
  }, [seed]);

  const debounced = useDebounced(query.trim(), 250);
  const search = useQuery({
    queryKey: ["span-search", debounced.toUpperCase()],
    queryFn: () => searchContracts(debounced),
    enabled: !isPrerender() && debounced.length >= 2 && !picked,
    staleTime: 10 * 60_000,
  });

  // Recalculated whenever the portfolio changes, so a hedge shows its offset at once.
  const legsKey = useMemo(() => legs.map((l) => `${l.contract.id}:${l.side}:${l.lots}`).join(","), [legs]);
  const margin = useQuery({
    queryKey: ["span-margin", legsKey],
    queryFn: () => calculateMargin(legs),
    enabled: legs.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const lotCount = Math.max(1, Math.floor(Number(lots) || 1));
  const add = () => {
    if (!picked) return;
    setLegs((prev) => [...prev, { contract: picked, lots: lotCount, side }]);
    setPicked(null);
    setQuery("");
    setLots("1");
  };
  const choose = (c: ContractOption) => {
    setPicked(c);
    setQuery(c.label);
    setOpen(false);
  };

  const results = search.data ?? [];
  const r = margin.data;

  return (
    <div className={`font-['Roboto',sans-serif] ${INK}`}>
      {/* Add a position */}
      <section aria-labelledby="span-add" className="bg-white py-10">
        <div className="mx-auto max-w-[830px] px-4">
          <h2 id="span-add" className="mb-4 text-base font-normal">Add Position</h2>
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div className="relative">
              <label htmlFor="span-symbol" className="mb-1 block text-sm">Contract</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA9B0]" aria-hidden="true" />
                <input
                  id="span-symbol"
                  role="combobox"
                  aria-expanded={open && results.length > 0}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  placeholder="e.g. NIFTY 27OCT, RELIANCE CE 1300"
                  className={`${FIELD} pl-9`}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                />
                {search.isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#9AA9B0]" aria-hidden="true" />}
              </div>
              {open && !picked && debounced.length >= 2 && (
                <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto border border-[#EEEEEE] bg-white shadow-lg">
                  {results.length === 0 && !search.isFetching && (
                    <li className="px-3 py-2.5 text-sm text-[#7A8C94]">{search.isError ? "Search is unavailable right now. Try again shortly." : "No contract matches. Try the symbol and expiry, e.g. NIFTY 27OCT."}</li>
                  )}
                  {results.map((c) => (
                    <li key={c.id} role="option" aria-selected={false}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-[#F4F7FB]">
                        <span className="font-medium">{c.label}</span>
                        <span className="shrink-0 text-xs text-[#7A8C94]">{c.series.startsWith("FUT") ? "Future" : "Option"} · lot {c.lotSize.toLocaleString("en-IN")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="span-lots" className="mb-1 block text-sm">Lots</label>
              <input id="span-lots" type="number" inputMode="numeric" min={1} step={1} className={FIELD} value={lots} onChange={(e) => setLots(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <fieldset className="flex gap-6">
              <legend className="sr-only">Side</legend>
              {(["buy", "sell"] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm uppercase">
                  <input type="radio" name="span-side" value={s} checked={side === s} onChange={() => setSide(s)} className="h-4 w-4 accent-[#E9671D]" />
                  {s}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              onClick={add}
              disabled={!picked}
              className="h-[46px] min-w-[142px] border border-[#E9671D] bg-[#E9671D] px-7 text-base uppercase text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="mt-3 min-h-5 text-xs text-[#7A8C94]">
            {picked
              ? `${picked.label} · lot ${picked.lotSize.toLocaleString("en-IN")} · ${lotCount} lot${lotCount > 1 ? "s" : ""} = ${(lotCount * picked.lotSize).toLocaleString("en-IN")} units${picked.expiry ? ` · expires ${expiryLabel(picked.expiry)}` : ""}`
              : "Pick a contract from the list, choose buy or sell, and add as many positions as your strategy has."}
          </p>
        </div>
      </section>

      {/* Positions */}
      <section aria-labelledby="span-positions" className="bg-[linear-gradient(to_right,#3AA3FF,#0E83E9)] py-10">
        <div className="mx-auto max-w-[830px] px-4">
          <h2 id="span-positions" className="mb-4 text-base font-medium text-white">Positions</h2>
          <div className="relative overflow-x-auto rounded-lg bg-white">
            {legs.length === 0 ? (
              <p className="px-5 py-4 text-center text-sm">No positions yet. Add one above to see its margin.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EEEEEE] text-left">
                    <th scope="col" className="px-3 py-3 font-medium sm:px-5">Contract</th>
                    <th scope="col" className="px-3 py-3 font-medium">Side</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Lots</th>
                    <th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">Quantity</th>
                    <th scope="col" className="px-2 py-3 sm:px-5"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((l, i) => (
                    <tr key={`${l.contract.id}-${i}`} className="border-b border-[#EEEEEE] last:border-0">
                      <td className="px-3 py-3 font-medium sm:px-5">{l.contract.label}</td>
                      <td className={`px-3 py-3 font-medium uppercase ${l.side === "buy" ? "text-[#1B8A4B]" : "text-[#D23B2F]"}`}>{l.side}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.lots}</td>
                      <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{(l.lots * l.contract.lotSize).toLocaleString("en-IN")}</td>
                      <td className="px-2 py-3 text-right sm:px-5">
                        <button type="button" onClick={() => setLegs((prev) => prev.filter((_, k) => k !== i))} aria-label={`Remove ${l.contract.label}`} className="inline-flex h-8 w-8 items-center justify-center rounded text-[#7A8C94] hover:bg-[#F4F7FB] hover:text-[#D23B2F]">
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Result */}
      <section aria-labelledby="span-result" className="bg-[#F4F7FB] py-10">
        <div className="mx-auto max-w-[830px] px-4">
          <h2 id="span-result" className="mb-4 flex items-center gap-2 text-base font-normal">
            Required margin for this strategy
            {margin.isFetching && <Loader2 className="h-4 w-4 animate-spin text-[#9AA9B0]" aria-hidden="true" />}
          </h2>
          <dl className="overflow-hidden rounded-lg border-t-[3px] border-[#E9671D] bg-white" aria-live="polite">
            {[
              ["Initial margin (SPAN)", r?.span],
              ["Exposure margin", r?.exposure],
              ["Net premium (paid +, received −)", r?.netPremium],
            ].map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 text-sm">
                <dt>{label}</dt>
                <dd className="font-medium tabular-nums">{v === undefined ? "0.00" : inr(v as number)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between bg-[#0E83E9] px-5 py-4 text-white">
              <dt className="text-lg font-medium">Total amount required</dt>
              <dd className="text-lg font-medium tabular-nums">₹{r ? inr(r.total) : "0.00"}</dd>
            </div>
          </dl>
          {margin.isError && <p className="mt-3 text-sm text-[#D23B2F]">The margin service did not answer. Your positions are kept; it will retry when you change them.</p>}
          <p className="mt-3 text-xs text-[#7A8C94]">
            SPAN and exposure come from the exchanges&apos; SPAN files, loaded through the day on Parasram&apos;s trading platform, and are
            calculated for all positions together, so hedges and spreads get their offset. Your broker may add its own margin on top.
          </p>
        </div>
      </section>
    </div>
  );
}
