import { useState, useRef, useCallback, memo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lock, Plus, Pencil, Trash2, Save, X, ArrowLeft, Upload, ImageIcon, LogOut,
  Users, Phone, Mail, MapPin, Clock, Eye, CheckCircle2, Search, Filter,
  Download, BarChart3, TrendingUp, Globe, MousePointer, FileText
} from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import SEOHead from "@/components/SEOHead";
import MarketDataManager from "@/components/admin/MarketDataManager";
import PageTransition from "@/components/PageTransition";

// ---- Types ----
type UnlistedShare = {
  id: string; name: string; short_code: string; tag: string; tag_color: string;
  price: string; buy_price: string | null; sell_price: string | null; min_qty: string;
  gradient_color: string; display_order: number; is_active: boolean; image_url: string | null;
  company_description: string | null; sector: string | null; founded_year: string | null; headquarters: string | null;
};

type Lead = {
  id: string; name: string; phone: string; email: string | null; city: string | null;
  message: string | null; status: string; created_at: string;
};

// ---- Constants ----
const TAG_PRESETS = [
  { label: "Most Bought", value: "Most Bought", color: "bg-secondary/10 text-secondary" },
  { label: "Top Gainer", value: "Top Gainer", color: "bg-brand-gold/10 text-brand-gold" },
  { label: "Hot Right Now", value: "Hot Right Now", color: "bg-destructive/10 text-destructive" },
  { label: "Popular", value: "Popular", color: "bg-secondary/10 text-secondary" },
  { label: "Exchange", value: "Exchange", color: "bg-primary/10 text-primary" },
  { label: "Financial", value: "Financial", color: "bg-primary/10 text-primary" },
  { label: "HealthTech", value: "HealthTech", color: "bg-secondary/10 text-secondary" },
];

const GRADIENT_PRESETS = [
  { label: "Blue", value: "from-blue-600 to-blue-800" },
  { label: "Indigo", value: "from-indigo-600 to-indigo-800" },
  { label: "Green", value: "from-emerald-600 to-green-700" },
  { label: "Yellow", value: "from-yellow-500 to-amber-600" },
  { label: "Red", value: "from-red-500 to-rose-600" },
  { label: "Purple", value: "from-purple-600 to-violet-700" },
  { label: "Teal", value: "from-teal-500 to-cyan-600" },
  { label: "Cyan", value: "from-blue-500 to-cyan-600" },
];

const SECTOR_OPTIONS = ["General", "Exchange", "Financial Services", "Technology", "Healthcare", "Energy", "Sports", "Hospitality", "Insurance", "FMCG", "Real Estate"];

const emptyShare: Omit<UnlistedShare, "id"> = {
  name: "", short_code: "", tag: "Popular", tag_color: "bg-secondary/10 text-secondary",
  price: "", buy_price: null, sell_price: null, min_qty: "1 Share",
  gradient_color: "from-blue-600 to-blue-800", display_order: 0, is_active: true, image_url: null,
  company_description: null, sector: "General", founded_year: null, headquarters: null,
};

type ShareFormData = Omit<UnlistedShare, "id"> & { id?: string };

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const LEAD_STATUS_OPTIONS = ["new", "contacted", "converted", "closed"];
const statusColors: Record<string, string> = {
  new: "bg-brand-orange/10 text-brand-orange",
  contacted: "bg-primary/10 text-primary",
  converted: "bg-secondary/10 text-secondary",
  closed: "bg-muted text-muted-foreground",
};

const CHART_COLORS = ["hsl(var(--secondary))", "hsl(var(--primary))", "hsl(var(--brand-gold))", "hsl(var(--destructive))"];

// ---- Unlisted Shares Components ----
const LogoUpload = memo(({ form, setForm, shareId, password }: {
  form: ShareFormData; setForm: (f: ShareFormData) => void; shareId?: string; password: string;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowedTypes.includes(file.type)) { toast({ title: "Invalid file type", variant: "destructive" }); return; }
    if (file.size > 2 * 1024 * 1024) { toast({ title: "File too large (max 2MB)", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("file", file);
      if (shareId) formData.append("share_id", shareId);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-unlisted-shares`, {
        method: "POST", headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` }, body: formData,
      });
      const result = await response.json();
      if (result.success && result.url) { toast({ title: "Logo uploaded" }); setForm({ ...form, image_url: result.url }); }
      else toast({ title: "Upload failed", description: result.error, variant: "destructive" });
    } catch { toast({ title: "Upload error", variant: "destructive" }); }
    setUploading(false);
  };
  return (
    <div>
      <Label>Logo / Image</Label>
      <div className="flex items-center gap-3 mt-1">
        {form.image_url ? (
          <img src={form.image_url} alt="Logo" className="w-14 h-14 rounded-xl object-contain border border-border bg-white" />
        ) : (
          <div className="w-14 h-14 rounded-xl border border-dashed border-border flex items-center justify-center bg-muted/30"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
        )}
        <div className="flex flex-col gap-1">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" />{uploading ? "Uploading..." : "Upload Logo"}</Button>
          {form.image_url && <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs h-7" onClick={() => setForm({ ...form, image_url: null })}>Remove</Button>}
        </div>
      </div>
    </div>
  );
});

const ShareForm = memo(({ form, setForm, onSave, onCancel, title, shareId, password }: {
  form: ShareFormData; setForm: (f: ShareFormData) => void; onSave: () => void; onCancel: () => void;
  title: string; shareId?: string; password: string;
}) => (
  <Card className="border-secondary/30 mb-4">
    <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base sm:text-lg">{title}</CardTitle></CardHeader>
    <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div><Label>Company Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} /></div>
        <div><Label>Short Code *</Label><Input value={form.short_code} onChange={(e) => setForm({ ...form, short_code: e.target.value })} placeholder="e.g. NSE" maxLength={20} /></div>
        <div><Label>Price (Display) *</Label><Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. ₹2,060" maxLength={50} /></div>
        <div><Label>Min Quantity</Label><Input value={form.min_qty} onChange={(e) => setForm({ ...form, min_qty: e.target.value })} placeholder="e.g. 1 Share" maxLength={50} /></div>
        <div><Label>Buy Rate</Label><Input value={form.buy_price || ""} onChange={(e) => setForm({ ...form, buy_price: e.target.value || null })} placeholder="e.g. ₹2,100" maxLength={50} /></div>
        <div><Label>Sell Rate</Label><Input value={form.sell_price || ""} onChange={(e) => setForm({ ...form, sell_price: e.target.value || null })} placeholder="e.g. ₹2,020" maxLength={50} /></div>
        <div><Label>Sector</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.sector || "General"} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
            {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><Label>Founded Year</Label><Input value={form.founded_year || ""} onChange={(e) => setForm({ ...form, founded_year: e.target.value || null })} placeholder="e.g. 1992" maxLength={10} /></div>
        <div className="sm:col-span-2"><Label>Headquarters</Label><Input value={form.headquarters || ""} onChange={(e) => setForm({ ...form, headquarters: e.target.value || null })} placeholder="e.g. Mumbai, Maharashtra" maxLength={200} /></div>
        <div className="sm:col-span-2"><Label>Company Description</Label><Textarea value={form.company_description || ""} onChange={(e) => setForm({ ...form, company_description: e.target.value || null })} placeholder="Brief description..." maxLength={2000} rows={3} /></div>
        <LogoUpload form={form} setForm={setForm} shareId={shareId} password={password} />
        <div className="sm:col-span-2"><Label>Tag</Label>
          {/* Preset tag buttons */}
          <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
            {TAG_PRESETS.map((t) => (
              <button key={t.value} type="button" onClick={() => setForm({ ...form, tag: t.value, tag_color: t.color })}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-[color,background-color,border-color,box-shadow] ${form.tag === t.value && form.tag_color === t.color ? "ring-2 ring-secondary" : ""} ${t.color}`}>{t.label}</button>
            ))}
          </div>
          {/* Custom tag input */}
          <div className="flex items-center gap-2">
            <Input
              value={form.tag || ""}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              placeholder="Or type a custom tag…"
              maxLength={50}
              className="h-8 text-xs flex-1"
            />
            {form.tag && (
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${form.tag_color}`}>
                {form.tag}
              </span>
            )}
          </div>
          {/* Tag color picker */}
          <div className="mt-1.5">
            <p className="text-[10px] text-muted-foreground mb-1">Tag color:</p>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PRESETS.map((t) => (
                <button
                  key={t.color}
                  type="button"
                  title={t.label}
                  onClick={() => setForm({ ...form, tag_color: t.color })}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-[color,background-color,border-color,box-shadow] ${t.color} ${form.tag_color === t.color ? "ring-2 ring-secondary scale-105" : ""}`}
                >
                  Aa
                </button>
              ))}
            </div>
          </div>
        </div>
        <div><Label>Color (fallback)</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {GRADIENT_PRESETS.map((g) => (
              <button key={g.value} type="button" onClick={() => setForm({ ...form, gradient_color: g.value })}
                className={`w-7 h-7 rounded-lg bg-gradient-to-br ${g.value} border-2 transition-[color,background-color,border-color,box-shadow] ${form.gradient_color === g.value ? "ring-2 ring-secondary scale-110" : "border-transparent"}`} title={g.label} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} /></div>
      <div className="flex gap-2">
        <Button onClick={onSave} size="sm"><Save className="w-4 h-4 mr-1" /> Save</Button>
        <Button variant="outline" onClick={onCancel} size="sm"><X className="w-4 h-4 mr-1" /> Cancel</Button>
      </div>
    </CardContent>
  </Card>
));

const ShareListItem = memo(({ share, onEdit, onDelete }: { share: UnlistedShare; onEdit: () => void; onDelete: () => void; }) => (
  <Card className={`${!share.is_active ? "opacity-50" : ""}`}>
    <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      {share.image_url ? (
        <img src={share.image_url} alt={share.short_code} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain border border-border bg-white shrink-0" />
      ) : (
        <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${share.gradient_color} rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0`}>{share.short_code}</div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{share.name}</h3>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {share.buy_price && <span className="text-xs text-secondary font-bold">Buy: {share.buy_price}</span>}
          {share.sell_price && <span className="text-xs text-destructive font-bold">Sell: {share.sell_price}</span>}
          {!share.buy_price && !share.sell_price && <span className="font-bold text-foreground text-xs">{share.price}</span>}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${share.tag_color}`}>{share.tag}</span>
          {share.sector && <span className="text-[9px] text-muted-foreground">({share.sector})</span>}
          {!share.is_active && <span className="text-[9px] text-muted-foreground">(Hidden)</span>}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button size="sm" variant="outline" onClick={onEdit} className="h-8 w-8 p-0"><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </CardContent>
  </Card>
));

// ---- Leads Management with Bulk Actions & CSV Export ----
const LeadsPanel = ({ password }: { password: string }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-unlisted-shares", {
        body: { action: "list_leads", password },
      });
      if (!error && data?.success) setLeads(data.leads || []);
      else toast({ title: "Failed to load leads", variant: "destructive" });
    } catch {
      toast({ title: "Failed to load leads", variant: "destructive" });
    }
    setLoading(false);
  }, [password]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateLeadStatus = async (id: string, status: string) => {
    const { data } = await supabase.functions.invoke("manage-unlisted-shares", {
      body: { action: "update_lead", password, data: { id, status } },
    });
    if (data?.success) {
      toast({ title: "Status updated" });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } else {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    let successCount = 0;
    for (const id of selectedIds) {
      const { data } = await supabase.functions.invoke("manage-unlisted-shares", {
        body: { action: "update_lead", password, data: { id, status } },
      });
      if (data?.success) successCount++;
    }
    toast({ title: `Updated ${successCount} of ${selectedIds.size} leads to "${status}"` });
    setSelectedIds(new Set());
    fetchLeads();
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    const { data } = await supabase.functions.invoke("manage-unlisted-shares", {
      body: { action: "delete_lead", password, data: { id } },
    });
    if (data?.success) {
      toast({ title: "Lead deleted" });
      setLeads(prev => prev.filter(l => l.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "City", "Message", "Status", "Created At"];
    const rows = filtered.map(l => [
      l.name, l.phone, l.email || "", l.city || "", (l.message || "").replace(/,/g, ";"),
      l.status, new Date(l.created_at).toLocaleString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${filtered.length} leads` });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  };

  const filtered = leads.filter(l => {
    const matchesSearch = !searchQuery ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      (l.email && l.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.city && l.city.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Lead trend data for chart
  const leadsByDay = leads.reduce<Record<string, number>>((acc, l) => {
    const day = l.created_at.slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const trendData = Object.entries(leadsByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, count]) => ({ date: date.slice(5), count }));

  const statusCounts = LEAD_STATUS_OPTIONS.map(s => ({
    name: s, value: leads.filter(l => l.status === s).length,
  }));

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    converted: leads.filter(l => l.status === "converted").length,
  };

  if (loading) return <div className="space-y-3 py-8">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: stats.total, icon: Users, color: "text-foreground" },
          { label: "New", value: stats.new, icon: Eye, color: "text-brand-orange" },
          { label: "Contacted", value: stats.contacted, icon: Phone, color: "text-primary" },
          { label: "Converted", value: stats.converted, icon: CheckCircle2, color: "text-secondary" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lead Trend Chart + Status Pie */}
      {trendData.length > 1 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="p-3 pb-0"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-secondary" /> Lead Trend (30 days)</CardTitle></CardHeader>
            <CardContent className="p-3 pt-2">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-0"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Status Distribution</CardTitle></CardHeader>
            <CardContent className="p-3 pt-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusCounts.filter(s => s.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusCounts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filter + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone, email, city..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {LEAD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="p-3 border-secondary/30 bg-secondary/5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
            {LEAD_STATUS_OPTIONS.map(s => (
              <Button key={s} size="sm" variant="outline" onClick={() => bulkUpdateStatus(s)} className="text-xs capitalize h-7">{s}</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs h-7">Clear</Button>
          </div>
        </Card>
      )}

      {/* Leads List */}
      <div className="space-y-2">
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
            <span className="text-xs text-muted-foreground">Select all ({filtered.length})</span>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No leads found.</p>
        ) : filtered.map(lead => (
          <Card key={lead.id} className={selectedIds.has(lead.id) ? "ring-1 ring-secondary" : ""}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} className="mt-1" />
                <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm text-foreground">{lead.name}</h4>
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 cursor-pointer ${statusColors[lead.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {LEAD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-secondary transition-colors">
                      <Phone className="w-3 h-3" />{lead.phone}
                    </a>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-secondary transition-colors">
                        <Mail className="w-3 h-3" />{lead.email}
                      </a>
                    )}
                    {lead.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.city}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(lead.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {lead.message && <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">{lead.message}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <a
                    href={`https://wa.me/91${lead.phone.replace(/\D/g, '').replace(/^91/, '')}?text=${encodeURIComponent(`Hi ${lead.name}, this is Parasram India, Panipat. Thank you for your interest in opening a Demat account with us!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-secondary" title="WhatsApp">
                      <Phone className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => deleteLead(lead.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};



// ---- Analytics Panel ----
const AnalyticsPanel = ({ password }: { password: string }) => {
  // analytics payload is dynamic (edge function aggregate)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("fetch-analytics", {
        body: { password, period },
      });
      if (!error && res?.success) setData(res);
      else toast({ title: "Failed to load analytics", variant: "destructive" });
    } catch {
      toast({ title: "Analytics unavailable", variant: "destructive" });
    }
    setLoading(false);
  }, [password, period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) return <div className="space-y-3 py-8">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!data) return <p className="text-muted-foreground text-center py-8">No analytics data available yet.</p>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {["7d", "30d", "90d"].map(p => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)} className="text-xs h-7">{p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}</Button>
        ))}
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-3"><Eye className="w-5 h-5 text-primary" /><div><div className="text-lg font-bold text-foreground">{data.totalPageViews}</div><div className="text-[10px] text-muted-foreground">Page Views</div></div></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3"><Globe className="w-5 h-5 text-secondary" /><div><div className="text-lg font-bold text-foreground">{data.uniqueSessions}</div><div className="text-[10px] text-muted-foreground">Sessions</div></div></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3"><FileText className="w-5 h-5 text-brand-gold" /><div><div className="text-lg font-bold text-foreground">{String((Object.values(data.formConversions || {}) as number[]).reduce((a, b) => a + b, 0))}</div><div className="text-[10px] text-muted-foreground">Form Submissions</div></div></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3"><MousePointer className="w-5 h-5 text-destructive" /><div><div className="text-lg font-bold text-foreground">{data.popularStocks?.length || 0}</div><div className="text-[10px] text-muted-foreground">Stocks Viewed</div></div></CardContent></Card>
      </div>

      {/* Daily Views Chart */}
      {data.dailyViews?.length > 1 && (
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-secondary" /> Daily Page Views</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.dailyViews}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="views" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Pages */}
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Top Pages</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2">
            {data.topPages?.length > 0 ? (
              <div className="space-y-1.5">
                {data.topPages.map((p: { path: string; views: number }) => (
                  <div key={p.path} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground truncate max-w-[200px]">{p.path}</span>
                    <span className="font-bold text-foreground">{p.views}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>

        {/* Popular Stocks */}
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Popular Stocks Viewed</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2">
            {data.popularStocks?.length > 0 ? (
              <div className="space-y-1.5">
                {data.popularStocks.slice(0, 10).map((s: { symbol: string; views: number }) => (
                  <div key={s.symbol} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                    <span className="text-muted-foreground">{s.views} views</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">No stock views tracked yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Lead Trend */}
      {data.leadTrend?.length > 1 && (
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-brand-orange" /> Lead Acquisition Trend</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.leadTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ---- Main Admin Page ----
const AdminPage = () => {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [shares, setShares] = useState<UnlistedShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UnlistedShare>>({});
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState(emptyShare);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      setAuthenticated(false); setPassword(""); setShares([]); setEditingId(null); setCreating(false);
      toast({ title: "Session expired", description: "Logged out due to inactivity." });
    }, SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    resetSessionTimer();
    const handleActivity = () => {
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(resetSessionTimer, 1000);
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    return () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [authenticated, resetSessionTimer]);

  const handleLogout = useCallback(() => { setAuthenticated(false); setPassword(""); setShares([]); setEditingId(null); setCreating(false); }, []);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("manage-unlisted-shares", { body: { action: "list" } });
      if (data?.success) setShares(data.data);
    } catch { toast({ title: "Failed to load shares", variant: "destructive" }); }
    setLoading(false);
  }, []);

  const handleLogin = useCallback(async () => {
    if (!password.trim()) { toast({ title: "Please enter a password", variant: "destructive" }); return; }
    if (lockoutUntil && Date.now() < lockoutUntil) { toast({ title: "Too many attempts", variant: "destructive" }); return; }
    setLoginLoading(true);
    try {
      const { data } = await supabase.functions.invoke("manage-unlisted-shares", { body: { action: "verify", password } });
      if (data?.success === true) { setAuthenticated(true); setFailedAttempts(0); setLockoutUntil(null); fetchShares(); }
      else {
        const newAttempts = failedAttempts + 1; setFailedAttempts(newAttempts);
        if (newAttempts >= 5) { setLockoutUntil(Date.now() + 15 * 60 * 1000); toast({ title: "Account locked", description: "Try again in 15 minutes.", variant: "destructive" }); }
        else toast({ title: "Invalid password", description: `${5 - newAttempts} attempts remaining.`, variant: "destructive" });
      }
    } catch { toast({ title: "Login failed", variant: "destructive" }); }
    setLoginLoading(false);
  }, [password, fetchShares, failedAttempts, lockoutUntil]);

  const handleUpdate = useCallback(async (share: UnlistedShare) => {
    const { data } = await supabase.functions.invoke("manage-unlisted-shares", { body: { action: "update", password, data: { ...share, ...editForm } } });
    if (data?.success) { toast({ title: "Share updated" }); setEditingId(null); fetchShares(); }
    else toast({ title: "Error updating", description: data?.error, variant: "destructive" });
  }, [password, editForm, fetchShares]);

  const handleCreate = useCallback(async () => {
    if (!newForm.name.trim() || !newForm.price.trim() || !newForm.short_code.trim()) { toast({ title: "Fill name, short code, and price", variant: "destructive" }); return; }
    const { data } = await supabase.functions.invoke("manage-unlisted-shares", { body: { action: "create", password, data: { ...newForm, display_order: shares.length + 1 } } });
    if (data?.success) { toast({ title: "Share created" }); setCreating(false); setNewForm(emptyShare); fetchShares(); }
    else toast({ title: "Error creating", description: data?.error, variant: "destructive" });
  }, [password, newForm, shares.length, fetchShares]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this share?")) return;
    const { data } = await supabase.functions.invoke("manage-unlisted-shares", { body: { action: "delete", password, data: { id } } });
    if (data?.success) { toast({ title: "Share deleted" }); fetchShares(); }
  }, [password, fetchShares]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  if (!authenticated) {
    return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-secondary" /></div>
            <CardTitle className="font-heading text-2xl">Admin Panel</CardTitle>
            <p className="text-muted-foreground text-sm">Enter admin password to manage your site</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
              <Input type="password" placeholder="Admin Password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" disabled={isLockedOut} />
              <Button className="w-full" type="submit" disabled={loginLoading || isLockedOut}>
                {isLockedOut ? "Locked - Try later" : loginLoading ? "Verifying..." : "Login"}
              </Button>
              {failedAttempts > 0 && !isLockedOut && <p className="text-xs text-destructive text-center">{5 - failedAttempts} attempts remaining</p>}
              {isLockedOut && <p className="text-xs text-destructive text-center">Too many failed attempts. Wait 15 minutes.</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin Panel | Parasram India" description="Admin panel" noindex />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" /> Back to site</Link>
            <h1 className="font-heading text-xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Manage shares, leads & view analytics</p>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm"><LogOut className="w-4 h-4 mr-1" /> Logout</Button>
        </div>

        <Tabs defaultValue="shares" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="shares" className="flex-1 sm:flex-none">Unlisted Shares</TabsTrigger>
            <TabsTrigger value="leads" className="flex-1 sm:flex-none">Account Leads</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 sm:flex-none">Analytics</TabsTrigger>
            <TabsTrigger value="market" className="flex-1 sm:flex-none">Market Data</TabsTrigger>
          </TabsList>

          <TabsContent value="shares">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setCreating(true)} disabled={creating} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Share</Button>
            </div>
            {creating && <ShareForm form={newForm} setForm={setNewForm} onSave={handleCreate} onCancel={() => { setCreating(false); setNewForm(emptyShare); }} title="Add New Share" password={password} />}
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {shares.map((share) =>
                  editingId === share.id ? (
                    <ShareForm key={share.id} form={{ ...share, ...editForm }} setForm={(f: ShareFormData) => setEditForm(f)} onSave={() => handleUpdate(share)}
                      onCancel={() => setEditingId(null)} title={`Edit: ${share.name}`} shareId={share.id} password={password} />
                  ) : (
                    <ShareListItem key={share.id} share={share} onEdit={() => { setEditingId(share.id); setEditForm(share); }} onDelete={() => handleDelete(share.id)} />
                  )
                )}
                {shares.length === 0 && <p className="text-muted-foreground text-center py-8">No shares yet. Click "Add Share" to get started.</p>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leads">
            <LeadsPanel password={password} />
          </TabsContent>


          <TabsContent value="analytics">
            <AnalyticsPanel password={password} />
          </TabsContent>

          <TabsContent value="market">
            <MarketDataManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
