import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BarChart3, ExternalLink, FileText, Landmark, Newspaper, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import IPOGmpChart from "@/components/ipo/IPOGmpChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatRupees, getIpos, type Ipo } from "@/lib/ipo";
import { supabase } from "@/integrations/supabase/client";

type NewsItem = { title: string; summary: string; source: string; url?: string };
const safeUrl = (url?: string) => url && /^https?:\/\//i.test(url) ? url : undefined;

export default function IpoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [ipo, setIpo] = useState<Ipo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => { if (slug) getIpos(slug).then((rows) => setIpo(rows[0] ?? null)).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, [slug]);
  useEffect(() => {
    if (!ipo) return;
    const terms = ipo.name.toLowerCase().split(/\s+/).filter((term) => term.length > 3).slice(0, 3);
    supabase.functions.invoke("fetch-news").then(({ data, error: newsError }) => {
      if (newsError || !data?.success) return;
      const all = [...(data.indian ?? []), ...(data.world ?? [])] as NewsItem[];
      setNews(all.filter((item) => terms.some((term) => `${item.title} ${item.summary}`.toLowerCase().includes(term))).slice(0, 4));
    }).catch(() => undefined);
  }, [ipo]);

  const subscriptions = ipo ? [["QIB", ipo.subscription_qib], ["NII", ipo.subscription_nii], ["Retail", ipo.subscription_retail]].filter((item): item is [string, number] => item[1] !== null) : [];
  const subscriptionMax = Math.max(1, ...subscriptions.map(([, value]) => value));

  return <PageTransition><ScrollProgress /><SEOHead title={ipo ? `${ipo.name} IPO GMP, dates and details` : "IPO details"} description={ipo ? `IPO dates, price band and recorded GMP history for ${ipo.name}. Information only; not investment advice.` : "IPO details and GMP history."} noindex={!ipo} breadcrumbs={[{ name: "Home", url: "/" }, { name: "IPO Tracker", url: "/ipo" }, { name: ipo?.name ?? "IPO details" }]} /><Header />
    <main className="container mx-auto max-w-6xl px-4 py-8 md:py-12"><VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "IPO Tracker", url: "/ipo" }, { name: ipo?.name ?? "IPO details" }]} />
      {loading ? <div className="space-y-5 mt-6"><div className="h-28 w-2/3 animate-pulse bg-muted rounded-xl" /><div className="h-72 animate-pulse bg-muted rounded-xl" /></div> : error ? <Message text={error} /> : !ipo ? <Message text="This IPO is not currently in our published catalogue." /> : <>
        <section className="mt-6 pb-8 border-b border-border"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex gap-2"><Badge>{ipo.type}</Badge><Badge variant="outline" className="capitalize">{ipo.status}</Badge></div><h1 className="mt-4 font-heading text-3xl md:text-5xl font-bold">{ipo.name} IPO</h1><p className="mt-3 text-muted-foreground">Source: {ipo.source}. Catalogue updated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ipo.data_as_of))}.</p></div><Link to="/open-account" className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground hover:bg-secondary/90">Open Demat Account <ExternalLink className="w-4 h-4" /></Link></div></section>
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><strong>GMP disclaimer:</strong> GMP is unofficial and unregulated. It is not a recommendation or a reliable estimate of listing price or returns. Consider the RHP and your own risk assessment before applying.</div>
        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">{[["Price band", ipo.price], ["Latest GMP", ipo.gmp === null ? "Awaited" : formatRupees(ipo.gmp)], ["Est. listing price", formatRupees(ipo.est_listing_price)], ["Issue size", ipo.size]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="font-heading text-xl font-bold mt-1">{value}</p></CardContent></Card>)}</section>
        <section className="grid lg:grid-cols-3 gap-6 mt-8"><Card className="lg:col-span-2"><CardContent className="p-5 md:p-6"><SectionTitle icon={BarChart3} title="GMP history" subtitle="Each point is a recorded observation from the scheduled data sync." /><div className="mt-5"><IPOGmpChart history={ipo.gmp_history} /></div></CardContent></Card><Card><CardContent className="p-5"><SectionTitle icon={Landmark} title="Issue details" /><dl className="mt-5 space-y-3 text-sm"><Detail label="Opens" value={formatDate(ipo.open_date)} /><Detail label="Closes" value={formatDate(ipo.close_date)} /><Detail label="Allotment" value={formatDate(ipo.allotment_date)} /><Detail label="Listing" value={formatDate(ipo.listing_date)} /><Detail label="Lot size" value={ipo.lot_size?.toLocaleString("en-IN") ?? "Awaited"} /><Detail label="Registrar" value={ipo.registrar ?? "Awaited"} /></dl>{(ipo.rhp_url || ipo.drhp_url) && <div className="mt-5 flex gap-3">{ipo.rhp_url && <DocumentLink href={ipo.rhp_url} label="RHP" />}{ipo.drhp_url && <DocumentLink href={ipo.drhp_url} label="DRHP" />}</div>}</CardContent></Card></section>
        {subscriptions.length > 0 && <section className="mt-8"><Card><CardContent className="p-5 md:p-6"><SectionTitle icon={Users} title="Subscription by category" /><div className="grid md:grid-cols-3 gap-5 mt-6">{subscriptions.map(([label, value]) => <div key={label}><div className="flex justify-between text-sm"><span>{label}</span><strong>{value.toFixed(2)}×</strong></div><div className="h-2 rounded-full bg-muted mt-2 overflow-hidden"><div className="h-full rounded-full bg-secondary" style={{ width: `${value / subscriptionMax * 100}%` }} /></div></div>)}</div></CardContent></Card></section>}
        <section className="mt-8"><Card><CardContent className="p-5 md:p-6"><SectionTitle icon={Newspaper} title="Related market news" subtitle="Matches from the current market-news feed; verify details with primary sources." />{news.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No matching stories are available right now.</p> : <div className="grid md:grid-cols-2 gap-3 mt-5">{news.map((item) => <a key={item.title} href={safeUrl(item.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border p-4 hover:border-secondary/50 transition-colors"><p className="font-semibold text-sm">{item.title}</p><p className="text-xs text-muted-foreground mt-2">{item.source}</p></a>)}</div>}</CardContent></Card></section>
      </>}
    </main><WhatsAppButton /><Footer /></PageTransition>;
}

const Message = ({ text }: { text: string }) => <Card className="mt-6"><CardContent className="p-8 text-center"><h1 className="font-heading text-2xl font-bold">IPO details unavailable</h1><p className="text-muted-foreground mt-2">{text}</p><Link className="text-secondary text-sm font-semibold inline-block mt-3" to="/ipo">Browse the IPO tracker</Link></CardContent></Card>;
const Detail = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium text-right">{value}</dd></div>;
const SectionTitle = ({ icon: Icon, title, subtitle }: { icon: typeof BarChart3; title: string; subtitle?: string }) => <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-secondary" /><div><h2 className="font-heading text-xl font-bold">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div></div>;
const DocumentLink = ({ href, label }: { href: string; label: string }) => <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary"><FileText className="w-4 h-4" />{label}</a>;
