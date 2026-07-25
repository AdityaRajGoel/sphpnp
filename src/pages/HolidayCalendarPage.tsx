import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Building2, Clock, AlertCircle, PartyPopper } from "lucide-react";
import { useMemo } from "react";
import PageTransition from "@/components/PageTransition";

import { revealItem } from "@/lib/motion";
type Holiday = {
  date: string;
  day: string;
  name: string;
  exchanges: ("NSE" | "BSE" | "MCX")[];
};

const HOLIDAYS_2026: Holiday[] = [
  { date: "Jan 26", day: "Monday", name: "Republic Day", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "Mar 3", day: "Tuesday", name: "Holi", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "Mar 26", day: "Thursday", name: "Shri Ram Navami", exchanges: ["NSE", "BSE"] },
  { date: "Mar 31", day: "Tuesday", name: "Shri Mahavir Jayanti", exchanges: ["NSE", "BSE"] },
  { date: "Apr 3", day: "Friday", name: "Good Friday", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "Apr 14", day: "Tuesday", name: "Dr. Ambedkar Jayanti", exchanges: ["NSE", "BSE"] },
  { date: "May 1", day: "Friday", name: "Maharashtra Day", exchanges: ["NSE", "BSE"] },
  { date: "May 28", day: "Thursday", name: "Bakri Id", exchanges: ["NSE", "BSE"] },
  { date: "Jun 26", day: "Friday", name: "Muharram", exchanges: ["NSE", "BSE"] },
  { date: "Sep 14", day: "Monday", name: "Ganesh Chaturthi", exchanges: ["NSE", "BSE"] },
  { date: "Oct 2", day: "Friday", name: "Mahatma Gandhi Jayanti", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "Oct 20", day: "Tuesday", name: "Dussehra", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "Nov 10", day: "Tuesday", name: "Diwali Balipratipada", exchanges: ["NSE", "BSE"] },
  { date: "Nov 24", day: "Tuesday", name: "Guru Nanak Jayanti", exchanges: ["NSE", "BSE"] },
  { date: "Dec 25", day: "Friday", name: "Christmas", exchanges: ["NSE", "BSE", "MCX"] },
];

const getMonth = (dateStr: string) => dateStr.split(" ")[0];

const parseHolidayDate = (dateStr: string): Date => {
  const [mon, day] = dateStr.split(" ");
  const monthMap: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  return new Date(CALENDAR_YEAR, monthMap[mon] ?? 0, parseInt(day));
};

const CALENDAR_YEAR = 2026;

const HolidayCalendarPage = () => {
  const months = [...new Set(HOLIDAYS_2026.map(h => getMonth(h.date)))];
  const now = new Date();
  const currentMonthAbbr = now.toLocaleString("en", { month: "short" });

  const nextHoliday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return HOLIDAYS_2026.find(h => parseHolidayDate(h.date) >= today);
  }, []);

  const daysUntilNext = useMemo(() => {
    if (!nextHoliday) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = parseHolidayDate(nextHoliday.date);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  }, [nextHoliday]);

  const pastCount = HOLIDAYS_2026.filter(h => parseHolidayDate(h.date) < new Date()).length;
  const upcomingCount = HOLIDAYS_2026.length - pastCount;

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`NSE BSE Market Holiday Calendar ${CALENDAR_YEAR} | Parasram India`}
        description={`Complete list of NSE, BSE and MCX stock market trading holidays for ${CALENDAR_YEAR}. Plan your trades around market closures and avoid missed opportunities.`}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Holiday Calendar" },
        ]}
        jsonLd={{
          "@type": "ItemList",
          "name": `NSE BSE MCX Trading Holidays ${CALENDAR_YEAR}`,
          "description": `Complete list of stock market trading holidays for NSE, BSE, and MCX exchanges in ${CALENDAR_YEAR}.`,
          "numberOfItems": HOLIDAYS_2026.length,
          "itemListElement": HOLIDAYS_2026.map((h, idx) => {
            const formattedDate = `${CALENDAR_YEAR}-${String(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(h.date.split(" ")[0]) + 1).padStart(2, "0")}-${h.date.split(" ")[1].padStart(2,"0")}`;
            return {
              "@type": "ListItem",
              "position": idx + 1,
              "item": {
                "@type": "Event",
                "name": h.name,
                "startDate": formattedDate,
                "endDate": formattedDate,
                "image": "https://www.sphpnp.com/logo.png",
                "description": `${h.name} - Market holiday for ${h.exchanges.join(", ")}`,
                "eventStatus": "https://schema.org/EventScheduled",
                "location": {
                  "@type": "Place",
                  "name": "India",
                  "address": {
                    "@type": "PostalAddress",
                    "addressCountry": "IN"
                  }
                },
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "INR",
                  "url": "https://www.sphpnp.com/holidays",
                  "availability": "https://schema.org/InStock",
                  "validFrom": `${CALENDAR_YEAR}-01-01`
                },
                "performer": {
                  "@type": "Organization",
                  "name": "Market Participants"
                },
                "organizer": { 
                  "@type": "Organization", 
                  "name": "NSE/BSE",
                  "url": "https://www.nseindia.com/"
                }
              }
            };
          })
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Holiday Calendar" }]} />
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="w-8 h-8 text-secondary" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">Market Holiday Calendar {CALENDAR_YEAR}</h1>
          </div>
          <p className="text-muted-foreground">NSE, BSE & MCX trading holidays - plan your trades in advance</p>
        </motion.div>

        {/* Next holiday banner */}
        {nextHoliday && daysUntilNext !== null && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="mb-6 p-4 border-secondary/30 bg-secondary/5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  {daysUntilNext === 0 ? <PartyPopper className="w-5 h-5 text-secondary" /> : <Clock className="w-5 h-5 text-secondary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {daysUntilNext === 0 ? "Today is a market holiday!" : `Next holiday in ${daysUntilNext} day${daysUntilNext > 1 ? "s" : ""}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nextHoliday.name} - {nextHoliday.date}, {nextHoliday.day}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-3 mb-6 text-sm flex-wrap"
        >
          <Badge className="bg-primary text-primary-foreground">NSE</Badge>
          <Badge className="bg-secondary text-secondary-foreground">BSE</Badge>
          <Badge variant="outline" className="border-brand-gold text-brand-gold">MCX</Badge>
          <span className="text-muted-foreground">Total: {HOLIDAYS_2026.length}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{pastCount} past</span>
          <span className="text-secondary font-semibold">{upcomingCount} upcoming</span>
        </motion.div>

        <div className="space-y-8">
          {months.map((month, mIdx) => {
            const holidays = HOLIDAYS_2026.filter(h => getMonth(h.date) === month);
            const isCurrent = month === currentMonthAbbr;
            return (
              <motion.div
                key={month}
                {...revealItem()}
                transition={{ delay: mIdx * 0.03 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-heading font-semibold text-foreground">{month} {CALENDAR_YEAR}</h2>
                  {isCurrent && <Badge className="bg-secondary/20 text-secondary text-xs">Current Month</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">{holidays.length} holiday{holidays.length > 1 ? "s" : ""}</span>
                </div>
                <div className="grid gap-2">
                  {holidays.map((h, i) => {
                    const holidayDate = parseHolidayDate(h.date);
                    const isPast = holidayDate < new Date();
                    const isToday = daysUntilNext === 0 && nextHoliday?.name === h.name;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <Card className={`flex items-center justify-between px-4 py-3 transition-[color,background-color,border-color,box-shadow] hover:bg-muted/50 hover:shadow-sm ${isPast ? "opacity-40" : ""} ${isToday ? "ring-1 ring-secondary bg-secondary/5" : ""}`}>
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[50px]">
                              <div className={`text-lg font-bold ${isToday ? "text-secondary" : "text-foreground"}`}>{h.date.split(" ")[1]}</div>
                              <div className="text-xs text-muted-foreground">{h.day}</div>
                            </div>
                            <div>
                              <div className="font-medium text-foreground flex items-center gap-2">
                                {h.name}
                                {isToday && <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full font-bold">TODAY</span>}
                                {isPast && <span className="text-[10px] text-muted-foreground">(Past)</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {h.exchanges.map(ex => (
                              <Badge key={ex} variant={ex === "MCX" ? "outline" : "default"} className={`text-[10px] px-1.5 ${ex === "NSE" ? "bg-primary text-primary-foreground" : ex === "BSE" ? "bg-secondary text-secondary-foreground" : "border-brand-gold text-brand-gold"}`}>
                                {ex}
                              </Badge>
                            ))}
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <Card className="mt-8 p-4 bg-muted/50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Disclaimer</p>
            <p className="text-sm text-muted-foreground">Holiday dates are subject to change by exchange authorities. Special trading sessions (e.g., Muhurat Trading on Diwali) are not listed. Weekends (Saturday & Sunday) are regular non-trading days and are not included. Always verify with official NSE/BSE circulars before planning trades.</p>
          </div>
        </Card>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default HolidayCalendarPage;
