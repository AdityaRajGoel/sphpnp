import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getContract, getExpiries, getStrikes, type ContractOption, type Kind } from "@/lib/span-margin";
import { isPrerender } from "@/lib/prerender";

const FIELD = "h-[46px] w-full border border-[#EEEEEE] bg-white px-3 text-sm text-[#445A64] outline-none transition-colors focus:border-[#E9671D] disabled:bg-[#F4F7FB] disabled:text-[#9AA9B0]";
const KIND_LABEL: Record<Kind, string> = { FUT: "Future", CE: "Call", PE: "Put" };
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The structured way to reach a contract: symbol, then future / call / put,
 * then expiry, then strike - the platform's own lookups, so every strike on
 * offer is listed and none has to be typed. Hands the resolved contract to the
 * calculator through onPick (null while incomplete).
 */
export default function ContractPicker({ seed, onPick }: { seed?: string; onPick: (c: ContractOption | null) => void }) {
  const [symbol, setSymbol] = useState((seed ?? "NIFTY").toUpperCase());
  const [kind, setKind] = useState<Kind>("FUT");
  const [expiry, setExpiry] = useState("");
  const [strike, setStrike] = useState("");
  const live = !isPrerender();
  const sym = symbol.trim();

  const exp = useQuery({ queryKey: ["span-expiries", sym, kind], queryFn: () => getExpiries(sym, kind), enabled: live && /^[A-Z0-9&-]{2,20}$/.test(sym), staleTime: 30 * 60_000 });
  const series = exp.data?.series ?? null;
  const expiries = exp.data?.expiries ?? [];
  const nearest = expiries[0] ?? "";
  // A new symbol or instrument starts from its nearest expiry.
  useEffect(() => {
    setExpiry(nearest);
    setStrike("");
  }, [nearest, sym, kind]);

  const str = useQuery({ queryKey: ["span-strikes", sym, series, expiry, kind], queryFn: () => getStrikes(sym, series!, expiry, kind), enabled: live && kind !== "FUT" && !!series && !!expiry, staleTime: 30 * 60_000 });
  const ready = !!series && !!expiry && (kind === "FUT" || !!strike);
  const con = useQuery({
    queryKey: ["span-contract", sym, series, expiry, kind, strike],
    queryFn: () => getContract(sym, series!, expiry, kind, kind === "FUT" ? null : Number(strike)),
    enabled: live && ready,
    staleTime: 30 * 60_000,
  });
  // onPick must be stable (a state setter): the calculator passes setPicked.
  const resolved = ready && con.data ? con.data : null;
  useEffect(() => {
    onPick(resolved);
  }, [onPick, resolved]);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div>
        <label htmlFor="pick-symbol" className="mb-1 block text-sm">Symbol</label>
        <input id="pick-symbol" className={`${FIELD} uppercase`} value={symbol} autoComplete="off" onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9&-]/g, ""))} placeholder="NIFTY" />
      </div>
      <div>
        <span id="pick-kind" className="mb-1 block text-sm">Instrument</span>
        <div role="radiogroup" aria-labelledby="pick-kind" className="grid h-[46px] grid-cols-3 border border-[#EEEEEE]">
          {(["FUT", "CE", "PE"] as Kind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`text-sm transition-colors ${kind === k ? "bg-[#E9671D] text-white" : "bg-white hover:bg-[#F4F7FB]"}`}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="pick-expiry" className="mb-1 block text-sm">Expiry</label>
        <select id="pick-expiry" className={FIELD} value={expiry} onChange={(e) => { setExpiry(e.target.value); setStrike(""); }} disabled={expiries.length === 0}>
          {expiries.length === 0 && <option value="">{exp.isFetching ? "Loading…" : sym.length < 2 ? "Type a symbol" : "No F&O contracts"}</option>}
          {expiries.map((d) => <option key={d} value={d}>{dateLabel(d)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="pick-strike" className="mb-1 block text-sm">Strike</label>
        <select id="pick-strike" className={FIELD} value={strike} onChange={(e) => setStrike(e.target.value)} disabled={kind === "FUT" || !str.data?.length}>
          <option value="">{kind === "FUT" ? "Not for futures" : str.isFetching ? "Loading…" : "Choose a strike"}</option>
          {kind !== "FUT" && str.data?.map((s) => <option key={s} value={s}>{s.toLocaleString("en-IN")}</option>)}
        </select>
      </div>
    </div>
  );
}
