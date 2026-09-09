import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Rocket } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getIpos, formatRupees, type Ipo } from "@/lib/ipo";

const statusLabel: Record<Ipo["status"], string> = { upcoming: "Upcoming", open: "Open now", closed: "Closed", listed: "Listed" };

export default function IpoPage() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Ipo["status"]>("all");

  useEffect(() => { getIpos().then(setIpos).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => filter === "all" ? ipos : ipos.filter((ipo) => ipo.status === filter), [ipos, filter]);

  return <PageTransition>
    <ScrollProgress /><SEOHead title="IPO Tracker & GMP History" description="Track Indian mainboard and SME IPO dates, price bands and recorded grey market premium history. Information only; not investment advice." breadcrumbs={[{ name: "Home", url: "/" }, { name: "IPO Tracker" }]} />
    <Header />
    <main>
      <section className="bg-hero text-primary-foreground py-16 md:py-24"><div className="container mx-auto px-4 max-w-6xl">
        <Badge className="bg-brand-gold/20 text-brand-gold border-brand-gold/30 mb-5"><Rocket className="w-3.5 h-3.5 mr-1.5" />IPO Central</Badge>
        <h1 className="font-heading text-4xl md:text-6xl font-bold max-w-3xl leading-tight">IPO decisions, grounded in the details.</h1>
        <p className="mt-5 max-w-2xl text-primary-foreground/70 text-base md:text-lg">Issue dates, price bands and a transparent record of observed GMP—not a recommendation to apply, buy or sell.</p>
      </div></section>
      <section className="container mx-auto px-4 max-w-6xl py-10 md:py-14">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"><strong>Important:</strong> Grey market premium (GMP) is unofficial, unregulated and can change quickly. It is shown for information only and is not investment advice or a prediction of listing performance.</div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-10 mb-6"><div><h2 className="font-heading text-2xl font-bold">IPO calendar</h2><p className="text-sm text-muted-foreground mt-1">Mainboard and SME issues tracked by our scheduled data service.</p></div>
          <div className="flex gap-2 overflow-x-auto">{(["all", "upcoming", "open", "closed", "listed"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${filter === item ? "bg-secondary text-secondary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{item === "all" ? "All" : statusLabel[item]}</button>)}</div></div>
        {loading ? <div className="grid md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-56 animate-pulse rounded-xl bg-muted" />)}</div> : error ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{error}. Please try again shortly.</CardContent></Card> : visible.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No IPOs match this view yet. The next scheduled sync will refresh the calendar.</CardContent></Card> : <div className="grid md:grid-cols-2 gap-4">{visible.map((ipo) => <IpoCard key={ipo.id} ipo={ipo} />)}</div>}
      </section>
    </main><WhatsAppButton /><Footer />
  </PageTransition>;
}

function IpoCard({ ipo }: { ipo: Ipo }) {
  return <Link to={`/ipo/${ipo.slug}`} className="group"><Card className="h-full border-border/70 transition-[border-color,box-shadow] hover:border-secondary/50 hover:shadow-lg"><CardContent className="p-5">
    <div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 items-center"><Badge variant="outline">{ipo.type}</Badge><span className="text-xs font-semibold text-muted-foreground">{statusLabel[ipo.status]}</span></div><h3 className="mt-3 font-heading text-xl font-bold group-hover:text-secondary transition-colors">{ipo.name}</h3></div><ArrowRight className="w-5 h-5 mt-1 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-[color,transform]" /></div>
    <div className="grid grid-cols-2 gap-4 mt-6 text-sm"><div><span className="text-muted-foreground">Price band</span><p className="font-semibold mt-1">{ipo.price}</p></div><div><span className="text-muted-foreground">Latest GMP</span><p className={`font-semibold mt-1 ${ipo.gmp === null ? "" : ipo.gmp >= 0 ? "text-secondary" : "text-destructive"}`}>{ipo.gmp === null ? "Awaited" : formatRupees(ipo.gmp)}</p></div><div className="col-span-2 flex items-center gap-2 text-muted-foreground"><CalendarDays className="w-4 h-4" />{ipo.date}</div></div>
  </CardContent></Card></Link>;
}
