import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Trash2, Plus, IndianRupee, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Admin feed for the numbers the site can't get from a live API:
// daily FII/DII/MF flows (published by NSE/AMFI after market close) and
// upcoming corporate actions. Public pages read these tables directly; writes go
// through manage-unlisted-shares with the admin password, because the tables only
// accept writes from a database admin and this page signs in with the password.

/** Runs one password-checked admin action; throws the server's message on failure. */
async function adminAction(password: string, action: string, data: Record<string, unknown>): Promise<void> {
  const { data: res, error } = await supabase.functions.invoke("manage-unlisted-shares", { body: { action, password, data } });
  if (error || !res?.success) throw new Error(res?.error ?? error?.message ?? "Request failed");
}

const FLOW_CATEGORIES = [
  { key: "fii_cash", label: "FII (Cash)" },
  { key: "dii_cash", label: "DII (Cash)" },
  { key: "fii_fno", label: "FII (F&O)" },
  { key: "mf_activity", label: "Mutual Funds" },
] as const;

const ACTION_TYPES = ["Dividend", "Bonus", "Split", "Buyback", "Rights", "Results", "AGM", "Other"];

type FlowRow = { buy: string; sell: string };
type CorpAction = {
  id: string;
  company: string;
  action_type: string;
  details: string;
  ex_date: string;
  is_active: boolean;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const FlowsEditor = ({ password }: { password: string }) => {
  const { toast } = useToast();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Record<string, FlowRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDate = useCallback(async (d: string) => {
    setLoading(true);
    const { data } = await (supabase.from("market_flows" as never) as ReturnType<typeof supabase.from>)
      .select("category, buy_cr, sell_cr")
      .eq("activity_date", d);
    const next: Record<string, FlowRow> = {};
    for (const c of FLOW_CATEGORIES) next[c.key] = { buy: "", sell: "" };
    (data as { category: string; buy_cr: number; sell_cr: number }[] | null)?.forEach((r) => {
      next[r.category] = { buy: String(r.buy_cr), sell: String(r.sell_cr) };
    });
    setRows(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDate(date);
  }, [date, loadDate]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = FLOW_CATEGORIES
        .filter((c) => rows[c.key]?.buy !== "" || rows[c.key]?.sell !== "")
        .map((c) => ({
          activity_date: date,
          category: c.key,
          buy_cr: Number(rows[c.key].buy) || 0,
          sell_cr: Number(rows[c.key].sell) || 0,
        }));
      if (!payload.length) {
        toast({ title: "Nothing to save", description: "Enter at least one buy/sell figure." });
        return;
      }
      await adminAction(password, "save_flows", { rows: payload });
      toast({ title: "Flows saved ✅", description: `${payload.length} entr${payload.length > 1 ? "ies" : "y"} for ${date}` });
    } catch (e: unknown) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-secondary" /> Daily FII / DII / MF Activity (₹ Cr)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Source: NSE "FII/DII trading activity" + AMFI daily figures, published after market close.
          The Market Intelligence section shows the latest saved date.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <label htmlFor="flow-date" className="text-sm font-medium">Date</label>
          <Input id="flow-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="space-y-2">
          {FLOW_CATEGORIES.map((c) => (
            <div key={c.key} className="grid grid-cols-[110px_1fr_1fr] items-center gap-3">
              <span className="text-sm font-medium">{c.label}</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Buy ₹ Cr"
                aria-label={`${c.label} buy value in crores`}
                value={rows[c.key]?.buy ?? ""}
                onChange={(e) => setRows((p) => ({ ...p, [c.key]: { ...p[c.key], buy: e.target.value } }))}
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Sell ₹ Cr"
                aria-label={`${c.label} sell value in crores`}
                value={rows[c.key]?.sell ?? ""}
                onChange={(e) => setRows((p) => ({ ...p, [c.key]: { ...p[c.key], sell: e.target.value } }))}
              />
            </div>
          ))}
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Flows for {date}
        </Button>
      </CardContent>
    </Card>
  );
};

const CorporateActionsEditor = ({ password }: { password: string }) => {
  const { toast } = useToast();
  const [actions, setActions] = useState<CorpAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const emptyDraft = { company: "", action_type: "Dividend", details: "", ex_date: todayISO() };
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("corporate_actions" as never) as ReturnType<typeof supabase.from>)
      .select("*")
      .order("ex_date", { ascending: true });
    setActions((data as CorpAction[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!draft.company.trim() || !draft.details.trim()) {
      toast({ title: "Missing fields", description: "Company and details are required." });
      return;
    }
    setSaving(true);
    try {
      await adminAction(password, "add_corporate_action", { ...draft, company: draft.company.trim(), details: draft.details.trim() });
      setDraft(emptyDraft);
      toast({ title: "Corporate action added ✅" });
      load();
    } catch (e: unknown) {
      toast({ title: "Add failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminAction(password, "delete_corporate_action", { id });
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
      return;
    }
    setActions((p) => p.filter((a) => a.id !== id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-secondary" /> Corporate Actions
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Shown in the Market Overview "Corp Actions" tab, ordered by ex-date. Delete entries once they pass.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_130px_1fr_150px_auto] gap-2">
          <Input placeholder="Company (e.g. TCS)" value={draft.company}
            onChange={(e) => setDraft((p) => ({ ...p, company: e.target.value }))} />
          <select
            aria-label="Action type"
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            value={draft.action_type}
            onChange={(e) => setDraft((p) => ({ ...p, action_type: e.target.value }))}
          >
            {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <Input placeholder="Details (e.g. ₹18/share or 1:1)" value={draft.details}
            onChange={(e) => setDraft((p) => ({ ...p, details: e.target.value }))} />
          <Input type="date" aria-label="Ex-date" value={draft.ex_date}
            onChange={(e) => setDraft((p) => ({ ...p, ex_date: e.target.value }))} />
          <Button onClick={add} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
        ) : actions.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No corporate actions yet - add the first one above.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-semibold flex-1 min-w-0 truncate">{a.company}</span>
                <span className="text-xs bg-secondary/10 text-secondary font-medium px-2 py-0.5 rounded-full">{a.action_type}</span>
                <span className="text-muted-foreground hidden sm:block">{a.details}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">Ex: {a.ex_date}</span>
                <Button variant="ghost" size="icon" aria-label={`Delete ${a.company} action`} onClick={() => remove(a.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MarketDataManager = ({ password }: { password: string }) => (
  <div className="space-y-6">
    <FlowsEditor password={password} />
    <CorporateActionsEditor password={password} />
  </div>
);

export default MarketDataManager;
