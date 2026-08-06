import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type Entry = { symbol: string; name: string };

export default function SymbolSwitcher() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Loaded once on first open, not on mount - the universe is ~159 rows but
  // there is no reason to pay for it on a page view that never opens the palette.
  useEffect(() => {
    if (!open || entries.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("screener_stocks")
        .select("symbol,name")
        .order("symbol");
      if (!cancelled && data) setEntries(data);
    })();
    return () => { cancelled = true; };
  }, [open, entries.length]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground border rounded-md px-2 py-1 hover:bg-muted transition-colors"
      >
        Switch stock <kbd className="ml-1 font-mono">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search tracked stocks">
        <CommandInput placeholder="Search a stock by symbol or name..." />
        <CommandList>
          <CommandEmpty>No matching stock.</CommandEmpty>
          <CommandGroup heading="Tracked stocks">
            {entries.map((e) => (
              <CommandItem
                key={e.symbol}
                value={`${e.symbol} ${e.name}`}
                onSelect={() => {
                  setOpen(false);
                  navigate(`/stock/${encodeURIComponent(e.symbol)}`);
                }}
              >
                <span className="font-medium mr-2">{e.symbol}</span>
                <span className="text-muted-foreground truncate">{e.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
