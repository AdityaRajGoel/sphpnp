import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, AlertCircle, PartyPopper, Timer, Landmark, CalendarClock } from "lucide-react";
import Header from "@/components/Header";
import ImageBanner from "@/components/ImageBanner";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import PageTransition from "@/components/PageTransition";
import StockTicker from "@/components/StockTicker";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { revealItem } from "@/lib/motion";
import { HOLIDAYS, HOLIDAY_YEAR, SESSIONS, expiryCalendar, tradingDaysBetween, type Exchange } from "@/lib/market-holidays";
import { istToday, trackedSymbols, upcomingEvents } from "@/lib/market-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayName = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
const dayMonth = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const daysFrom = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const EXCHANGE_BADGE: Record<Exchange, string> = {
  NSE: "bg-primary text-primary-foreground",
  BSE: "bg-secondary text-secondary-foreground",
  MCX: "border border-brand-gold text-brand-gold bg-transparent",
};

/** Result and board-meeting purposes carry the most weight; the rest read as corporate actions. */
const eventTone = (purpose: string) =>
  /result|financial/i.test(purpose) ? "text-secondary" : /dividend|bonus|split|buyback|rights/i.test(purpose) ? "text-brand-orange" : "text-muted-foreground";

function StatCard({ icon: Icon, label, value, note }: { icon: typeof Clock; label: string; value: string; note: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4 text-secondary" aria-hidden="true" />{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>
    </Card>
  );
}

const HolidayCalendarPage = () => {
  const today = istToday();
  const nextHoliday = HOLIDAYS.find((h) => h.date >= today);
  const daysUntilNext = nextHoliday ? daysFrom(today, nextHoliday.date) : null;
  const pastCount = HOLIDAYS.filter((h) => h.date < today).length;
  const expiries = useMemo(() => expiryCalendar(today, 45), [today]);
  const nextMonthly = expiries.find((e) => e.exchange === "NSE" && e.kind === "monthly");
  const sessionsLeftInYear = tradingDaysBetween(today, `${HOLIDAY_YEAR}-12-31`);

  const events = useQuery({ queryKey: ["corporate-calendar", today], queryFn: () => upcomingEvents(today, 21), staleTime: 60 * 60_000 });
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });
  const eventList = events.data;
  const eventsByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof eventList>>();
    for (const e of eventList ?? []) map.set(e.event_date, [...(map.get(e.event_date) ?? []), e]);
    return [...map.entries()].slice(0, 10);
  }, [eventList]);

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`NSE BSE Holiday Calendar ${HOLIDAY_YEAR}, F&O Expiry Dates & Results Calendar | Parasram India`}
        description={`NSE, BSE and MCX trading holidays for ${HOLIDAY_YEAR}, every Nifty and Sensex weekly and monthly F&O expiry with holiday shifts, market timings and upcoming company results and board meetings.`}
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Market Calendar" }]}
        jsonLd={{
          "@type": "ItemList",
          name: `NSE BSE MCX Trading Holidays ${HOLIDAY_YEAR}`,
          numberOfItems: HOLIDAYS.length,
          itemListElement: HOLIDAYS.map((h, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "Event",
              name: h.name,
              startDate: h.date,
              endDate: h.date,
              description: `${h.name} - market holiday for ${h.exchanges.join(", ")}`,
              eventStatus: "https://schema.org/EventScheduled",
              location: { "@type": "Place", name: "India", address: { "@type": "PostalAddress", addressCountry: "IN" } },
              organizer: { "@type": "Organization", name: "NSE/BSE", url: "https://www.nseindia.com/" },
            },
          })),
        }}
      />
      <ScrollProgress />
      <Header />
      <StockTicker />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Market Calendar" }]} />
      <main className="container mx-auto px-4 py-8">
        <ImageBanner
          slug="orbit-arc"
          className="mb-8"
          focus={{ mobile: "50% 40%", desktop: "50% 45%" }}
          eyebrow={<><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Market calendar</>}
          title={`Market Calendar ${HOLIDAY_YEAR}`}
          description="Trading holidays, every F&O expiry with its holiday shift, session timings and the next three weeks of company results and board meetings, in one place."
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard icon={daysUntilNext === 0 ? PartyPopper : Clock} label="Next holiday" value={daysUntilNext === null ? "—" : daysUntilNext === 0 ? "Today" : `${daysUntilNext} days`} note={nextHoliday ? `${nextHoliday.name}, ${dayMonth(nextHoliday.date)}` : "None left this year"} />
          <StatCard icon={Timer} label="Next NSE monthly expiry" value={nextMonthly ? dayMonth(nextMonthly.date) : "—"} note={nextMonthly ? `${tradingDaysBetween(today, nextMonthly.date)} sessions away${nextMonthly.shifted ? " · moved for a holiday" : ""}` : ""} />
          <StatCard icon={CalendarClock} label="Sessions left in the year" value={String(sessionsLeftInYear)} note="NSE trading days after today" />
          <StatCard icon={Landmark} label="Holidays" value={`${HOLIDAYS.length - pastCount} of ${HOLIDAYS.length}`} note={`still to come · ${pastCount} past`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] mb-10">
          <section aria-labelledby="expiry-heading" className="min-w-0">
            <h2 id="expiry-heading" className="text-xl font-heading font-bold mb-1">F&amp;O expiry calendar</h2>
            <p className="text-xs text-muted-foreground mb-3">NSE contracts expire on Tuesday, BSE's on Thursday (SEBI, from September 2025). An expiry on a holiday moves to the previous trading day.</p>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Date</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Exchange</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Type</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {expiries.map((e) => (
                    <tr key={`${e.exchange}-${e.date}`} className={`border-t ${e.kind === "monthly" ? "bg-secondary/5" : ""}`}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-semibold tabular-nums">{dayMonth(e.date)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{dayName(e.date).slice(0, 3)}</span>
                        {e.shifted && <span className="ml-2 rounded bg-brand-orange/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-orange" title={`Scheduled ${dayMonth(e.scheduled)}, a holiday`}>shifted</span>}
                      </td>
                      <td className="px-3 py-2"><Badge className={`text-[10px] ${EXCHANGE_BADGE[e.exchange]}`}>{e.exchange}</Badge></td>
                      <td className={`px-3 py-2 text-xs font-semibold ${e.kind === "monthly" ? "text-secondary" : "text-muted-foreground"}`}>{e.kind === "monthly" ? "Monthly" : "Weekly"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{e.contracts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <div className="min-w-0 space-y-6">
            <section aria-labelledby="sessions-heading">
              <h2 id="sessions-heading" className="text-xl font-heading font-bold mb-3">Market timings (IST)</h2>
              <Card className="divide-y p-0">
                {SESSIONS.map((s) => (
                  <div key={s.name} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                    <div><div className="text-sm font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">{s.note}</div></div>
                    <div className="font-mono text-sm tabular-nums whitespace-nowrap">{s.start}–{s.end}</div>
                  </div>
                ))}
              </Card>
            </section>

            <section aria-labelledby="events-heading">
              <h2 id="events-heading" className="text-xl font-heading font-bold mb-1">Results &amp; board meetings</h2>
              <p className="text-xs text-muted-foreground mb-3">Next three weeks, from the NSE and BSE event calendars.</p>
              {events.isLoading ? <Skeleton className="h-64 w-full" /> : eventsByDate.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">No company events announced for the next three weeks yet.</Card>
              ) : (
                <Card className="max-h-[28rem] overflow-y-auto p-0">
                  {eventsByDate.map(([date, list]) => (
                    <div key={date} className="border-b last:border-b-0">
                      <div className="sticky top-0 bg-card/95 px-4 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">{dayMonth(date)} · {dayName(date)} · {list.length}</div>
                      <ul>
                        {list.slice(0, 12).map((e) => (
                          <li key={e.event_key} className="flex items-baseline justify-between gap-3 px-4 py-1.5 text-sm">
                            {e.symbol && tracked.data?.has(e.symbol)
                              ? <Link to={`/stock/${encodeURIComponent(e.symbol)}`} className="truncate font-semibold hover:text-primary">{e.symbol}</Link>
                              : <span className="truncate font-semibold">{e.symbol ?? e.company}</span>}
                            <span className={`shrink-0 text-xs ${eventTone(e.purpose)}`}>{e.purpose}</span>
                          </li>
                        ))}
                        {list.length > 12 && <li className="px-4 pb-2 text-xs text-muted-foreground">+{list.length - 12} more</li>}
                      </ul>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          </div>
        </div>

        <section aria-labelledby="holidays-heading">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 id="holidays-heading" className="text-xl font-heading font-bold">Trading holidays</h2>
            {(["NSE", "BSE", "MCX"] as Exchange[]).map((ex) => <Badge key={ex} className={EXCHANGE_BADGE[ex]}>{ex}</Badge>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HOLIDAYS.map((h) => {
              const isPast = h.date < today;
              const isToday = h.date === today;
              const d = new Date(`${h.date}T00:00:00Z`);
              return (
                <motion.div key={h.date} {...revealItem()} className="min-w-0">
                  <Card className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40 ${isPast ? "opacity-45" : ""} ${isToday ? "ring-1 ring-secondary bg-secondary/5" : ""}`}>
                    <div className="w-12 shrink-0 rounded-lg bg-muted/60 py-1 text-center">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{MONTHS[d.getUTCMonth()]}</div>
                      <div className="text-lg font-bold leading-none tabular-nums">{d.getUTCDate()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{h.name}{isToday && <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">TODAY</span>}</div>
                      <div className="text-xs text-muted-foreground">{dayName(h.date)}{!isPast && !isToday && ` · in ${daysFrom(today, h.date)} days`}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">{h.exchanges.map((ex) => <Badge key={ex} className={`px-1.5 text-[10px] ${EXCHANGE_BADGE[ex]}`}>{ex}</Badge>)}</div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <Card className="mt-8 p-4 bg-muted/50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Exchanges can change holidays, expiry days and timings by circular; Muhurat trading on Diwali is announced separately. Weekends are not listed. Verify with the official NSE/BSE circulars before planning trades.</p>
        </Card>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default HolidayCalendarPage;
