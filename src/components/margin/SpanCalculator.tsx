import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { calculateMargin, searchContracts, type ContractOption, type SpanLeg } from "@/lib/span-margin";
import { isPrerender } from "@/lib/prerender";
import ContractPicker from "@/components/margin/ContractPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";

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
  const [mode, setMode] = useState<"search" | "picker">("search");

  // A stock page link (?symbol=TCS) or a click in the margin list seeds the search.
  useEffect(() => {
    if (!seed) return;
    setMode("search");
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
    setLots("1");
    // Search starts over; the picker keeps its contract so the other side or
    // another strike is one change away.
    if (mode === "search") {
      setPicked(null);
      setQuery("");
    }
  };
  const choose = (c: ContractOption) => {
    setPicked(c);
    setQuery(c.label);
    setOpen(false);
  };

  const results = search.data ?? [];
  const r = margin.data;

  return (
    <div className="space-y-6">
      {/* Add a position */}
      <section aria-labelledby="span-add">
        <Card className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="span-add" className="text-lg font-semibold text-foreground">Add Position</h2>
            <div role="group" aria-label="How to find the contract" className={segmentTrack}>
              {([["search", "Search"], ["picker", "Expiry & strike"]] as const).map(([m, label]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setPicked(null); }} className={segmentItem(mode === m)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {mode === "picker" && <ContractPicker seed={seed} onPick={setPicked} />}
          <div className={mode === "picker" ? "mt-4 grid gap-4 md:grid-cols-[1fr_140px]" : "grid gap-4 md:grid-cols-[1fr_140px]"}>
            <div className={mode === "picker" ? "hidden md:block" : "relative"}>
              {mode === "search" && (<>
              <Label htmlFor="span-symbol" className="mb-2 block">Contract</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="span-symbol"
                  role="combobox"
                  aria-expanded={open && results.length > 0}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  placeholder="e.g. NIFTY 27OCT, RELIANCE CE 1300, GOLD"
                  className="pl-9 pr-9"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                />
                {search.isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
              </div>
              {open && !picked && debounced.length >= 2 && (
                <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-lg">
                  {results.length === 0 && !search.isFetching && (
                    <li className="px-3 py-2.5 text-sm text-muted-foreground">{search.isError ? "Search is unavailable right now. Try again shortly." : "No contract matches. Try the symbol and expiry, e.g. NIFTY 27OCT."}</li>
                  )}
                  {results.map((c) => (
                    <li key={c.id} role="option" aria-selected={false}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors duration-fast hover:bg-accent hover:text-accent-foreground">
                        <span className="font-medium">{c.label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{c.series.startsWith("FUT") ? "Future" : "Option"} · lot {c.lotSize.toLocaleString("en-IN")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              </>)}
            </div>
            <div className={mode === "picker" ? "md:col-start-2" : undefined}>
              <Label htmlFor="span-lots" className="mb-2 block">Lots</Label>
              <Input id="span-lots" type="number" inputMode="numeric" min={1} step={1} className="tabular-nums" value={lots} onChange={(e) => setLots(e.target.value)} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <fieldset className="flex gap-6">
              <legend className="sr-only">Side</legend>
              {(["buy", "sell"] as const).map((s) => (
                <label key={s} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium uppercase">
                  <input type="radio" name="span-side" value={s} checked={side === s} onChange={() => setSide(s)} className="h-4 w-4 accent-secondary dark:[color-scheme:dark]" />
                  {s}
                </label>
              ))}
            </fieldset>
            <Button type="button" variant="secondary" size="lg" onClick={add} disabled={!picked} className="w-full sm:w-auto sm:min-w-36">
              Add
            </Button>
          </div>
          <p className="mt-3 min-h-5 text-sm text-muted-foreground">
            {picked
              ? `${picked.label} · lot ${picked.lotSize.toLocaleString("en-IN")} · ${lotCount} lot${lotCount > 1 ? "s" : ""} = ${(lotCount * picked.lotSize).toLocaleString("en-IN")} units${picked.expiry ? ` · expires ${expiryLabel(picked.expiry)}` : ""}`
              : "Pick a contract from the list, choose buy or sell, and add as many positions as your strategy has."}
          </p>
        </Card>
      </section>

      {/* Positions */}
      <section aria-labelledby="span-positions">
        <Card className="overflow-x-auto p-0">
          <h2 id="span-positions" className="px-4 pb-2 pt-4 text-lg font-semibold text-foreground sm:px-6 sm:pt-5">Positions</h2>
          {legs.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-sm text-muted-foreground sm:px-6">No positions yet. Add one above to see its margin.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium sm:px-6">Contract</th>
                  <th scope="col" className="px-3 py-3 font-medium">Side</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Lots</th>
                  <th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">Quantity</th>
                  <th scope="col" className="px-2 py-3 sm:px-5"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={`${l.contract.id}-${i}`} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium sm:px-6">{l.contract.label}</td>
                    <td className={`px-3 py-3 font-medium uppercase ${l.side === "buy" ? "text-secondary" : "text-destructive"}`}>{l.side}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{l.lots}</td>
                    <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{(l.lots * l.contract.lotSize).toLocaleString("en-IN")}</td>
                    <td className="px-2 py-1 text-right sm:px-4">
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLegs((prev) => prev.filter((_, k) => k !== i))} aria-label={`Remove ${l.contract.label}`} className="text-muted-foreground hover:text-destructive">
                        <X aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      {/* Result */}
      <section aria-labelledby="span-result">
        <Card className="overflow-hidden p-0">
          <h2 id="span-result" className="flex items-center gap-2 border-b px-4 pb-4 pt-4 text-lg font-semibold text-foreground sm:px-6 sm:pt-5">
            Required margin for this strategy
            {margin.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          </h2>
          <dl aria-live="polite">
            {[
              ["Initial margin (SPAN)", r?.span],
              ["Exposure margin", r?.exposure],
              ["Net premium (paid +, received −)", r?.netPremium],
            ].map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between gap-4 border-b px-4 py-3.5 text-sm sm:px-6">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums text-foreground">{v === undefined ? "0.00" : inr(v as number)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 bg-muted px-4 py-4 sm:px-6">
              <dt className="text-base font-semibold text-foreground sm:text-lg">Total amount required</dt>
              <dd className="text-lg font-bold tabular-nums text-foreground sm:text-xl">₹{r ? inr(r.total) : "0.00"}</dd>
            </div>
          </dl>
        </Card>
        {margin.isError && <p className="mt-3 text-sm text-destructive">The margin service did not answer. Your positions are kept; it will retry when you change them.</p>}
        <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">
          SPAN and exposure come from the exchanges&apos; SPAN files, loaded through the day on Parasram&apos;s trading platform, and are
          calculated for all positions together, so hedges and spreads get their offset. Parasram may add its own margin on top.
        </p>
      </section>
    </div>
  );
}
