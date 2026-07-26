import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Clock, TrendingUp, TrendingDown, AlertTriangle, Shield, RefreshCw, ArrowUpRight, Repeat2, MessageSquare, ExternalLink, Search, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { revealBar, revealFade, revealItem, revealSection, revealTracking } from "@/lib/motion";

type TelegramMessage = {
  id: string;
  telegram_message_id: number;
  message_text: string | null;
  message_date: string;
  has_photo: boolean;
  photo_url: string | null;
  is_forwarded: boolean;
  forward_from_title: string | null;
  created_at: string;
};

type MessageCategory = "buy" | "sell" | "hold" | "target" | "update";

const categoryConfig: Record<MessageCategory, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof TrendingUp;
  glowColor: string;
}> = {
  buy: {
    label: "BUY",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800/50",
    glowColor: "shadow-emerald-500/10",
    icon: TrendingUp,
  },
  sell: {
    label: "SELL",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    borderColor: "border-red-200 dark:border-red-800/50",
    glowColor: "shadow-red-500/10",
    icon: TrendingDown,
  },
  hold: {
    label: "HOLD",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800/50",
    glowColor: "shadow-amber-500/10",
    icon: AlertTriangle,
  },
  target: {
    label: "TARGET HIT",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    borderColor: "border-blue-200 dark:border-blue-800/50",
    glowColor: "shadow-blue-500/10",
    icon: ArrowUpRight,
  },
  update: {
    label: "UPDATE",
    color: "text-slate-600 dark:text-slate-300",
    bgColor: "bg-slate-50 dark:bg-slate-900/40",
    borderColor: "border-slate-200 dark:border-slate-700/50",
    glowColor: "shadow-slate-500/5",
    icon: MessageSquare,
  },
};

function detectCategory(text: string | null): MessageCategory {
  if (!text) return "update";
  const lower = text.toLowerCase();
  if (/\b(buy|long|accumulate|bullish|entry)\b/i.test(lower)) return "buy";
  if (/\b(sell|short|exit|bearish|book\s?profit|booked|profit\s?booking)\b/i.test(lower)) return "sell";
  if (/\b(hold|wait|neutral|avoid)\b/i.test(lower)) return "hold";
  if (/\b(target\s?(hit|achieved|reached)|tgt\s?(hit|achieved))\b/i.test(lower)) return "target";
  return "update";
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Extract structured fields from typical stock recommendation messages */
function parseStockInfo(text: string | null): {
  stockName: string | null;
  action: string | null;
  upside: string | null;
  targetPeriod: string | null;
  cta: { text: string; url: string } | null;
} {
  if (!text) return { stockName: null, action: null, upside: null, targetPeriod: null, cta: null };

  // Try to extract stock name - pattern: "📈 Stock Name (SYMBOL)" or "Stock Name Ltd."
  const stockMatch = text.match(/📈\s*(.+?)(?:\n|$)/);
  const stockName = stockMatch ? stockMatch[1].trim() : null;

  // Action: "Action: BUY" or "Action: SELL"
  const actionMatch = text.match(/Action:\s*(\w+)/i);
  const action = actionMatch ? actionMatch[1].toUpperCase() : null;

  // Upside: "Upside: 21.3%"
  const upsideMatch = text.match(/(?:Upside|Target|Return):\s*([\d.]+%)/i);
  const upside = upsideMatch ? upsideMatch[1] : null;

  // Target Period: "Target Period: 2 months 1 days"
  const periodMatch = text.match(/Target\s?Period:\s*(.+?)(?:\n|$)/i);
  const targetPeriod = periodMatch ? periodMatch[1].trim() : null;

  return { stockName, action, upside, targetPeriod, cta: null };
}

/** Safely render message text as React nodes - no dangerouslySetInnerHTML */
function SafeMessageText({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(...text.slice(last, match.index).split('\n').flatMap((line, i, arr) =>
        i < arr.length - 1 ? [line, <br key={`br-${key++}`} />] : [line]
      ));
    }
    parts.push(
      <a key={`url-${key++}`} href={match[1]} target="_blank" rel="noopener noreferrer"
        className="text-secondary hover:underline inline-flex items-center gap-0.5">
        Link ↗
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(...text.slice(last).split('\n').flatMap((line, i, arr) =>
      i < arr.length - 1 ? [line, <br key={`br-${key++}`} />] : [line]
    ));
  }
  return <>{parts}</>;
}

const MessageCard = ({ message, index }: { message: TelegramMessage; index: number }) => {
  const category = detectCategory(message.message_text);
  const config = categoryConfig[category];
  const Icon = config.icon;
  const parsed = parseStockInfo(message.message_text);
  const hasStructuredData = parsed.stockName || parsed.upside;

  return (
    <motion.div
      {...revealSection}
      transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.35 }}
    >
      <Card className={`group overflow-hidden transition-[box-shadow,transform] ease-out duration-base hover:shadow-xl ${config.glowColor} border ${config.borderColor} hover:scale-[1.01]`}>
        {/* Category accent - left border */}
        <div className="flex">
          <div className={`w-1.5 flex-shrink-0 ${config.bgColor}`}
            style={{ background: category === "buy" ? "linear-gradient(to bottom, #059669, #10b981)" : category === "sell" ? "linear-gradient(to bottom, #dc2626, #ef4444)" : category === "target" ? "linear-gradient(to bottom, #2563eb, #3b82f6)" : category === "hold" ? "linear-gradient(to bottom, #d97706, #f59e0b)" : "linear-gradient(to bottom, #64748b, #94a3b8)" }}
          />

          <CardContent className="p-4 flex-1 min-w-0">
            {/* Top bar: category badge + forwarded tag + time */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${config.bgColor} ${config.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </span>
                {message.is_forwarded && message.forward_from_title && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                    <Repeat2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{message.forward_from_title.replace(/[^\w\s]/g, '').trim()}</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                <Clock className="w-3 h-3" />
                {getTimeAgo(message.message_date)}
              </span>
            </div>

            {/* Structured data highlight (for stock reco messages) */}
            {hasStructuredData && (
              <div className={`rounded-lg ${config.bgColor} p-3 mb-3`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {parsed.stockName && (
                    <h3 className="font-heading font-bold text-foreground text-base leading-tight">
                      {parsed.stockName}
                    </h3>
                  )}
                  {parsed.upside && (
                    <span className={`text-sm font-bold ${config.color} bg-background/60 px-2 py-0.5 rounded-md`}>
                      {category === "sell" ? `↓ ${parsed.upside} Downside` : `↑ ${parsed.upside}`}
                    </span>
                  )}
                </div>
                {parsed.targetPeriod && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    ⏱️ Target: {parsed.targetPeriod}
                  </p>
                )}
              </div>
            )}

            {/* Message text */}
            {message.message_text && (
              <div className="text-[13px] text-foreground/85 leading-relaxed">
                <SafeMessageText text={message.message_text} />
              </div>
            )}

            {/* Photo */}
            {message.has_photo && message.photo_url && (
              <div className="mt-3 rounded-lg overflow-hidden border border-border/30">
                <img
                  src={message.photo_url}
                  alt={message.message_text ? `${message.message_text.slice(0, 60).trim()}…` : "Stock chart or market analysis from Parasram India"}
                  width={600}
                  height={400}
                  className="w-full h-auto max-h-64 object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
};

const MessageSkeleton = () => (
  <Card className="overflow-hidden border-border/40">
    <div className="flex">
      <div className="w-1.5 bg-muted flex-shrink-0" />
      <CardContent className="p-4 flex-1 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
    </div>
  </Card>
);

interface TelegramChannelProps {
  limit?: number;
  showViewAll?: boolean;
  showFilters?: boolean;
}

// Chip order for the category filter (dedicated recommendations page).
const FILTER_ORDER: MessageCategory[] = ["buy", "sell", "target", "hold", "update"];

// Bucket a message date into a feed section header.
function dateBucket(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Earlier";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

const TelegramChannel = ({ limit = 10, showViewAll = false, showFilters = false }: TelegramChannelProps) => {
  const { t } = useT();
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<MessageCategory | "all">("all");
  const [search, setSearch] = useState("");

  // Classify once, tally per category, and derive the visible list.
  const { counts, visible } = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const m of messages) {
      const c = detectCategory(m.message_text);
      tally[c] = (tally[c] ?? 0) + 1;
    }
    const q = search.trim().toLowerCase();
    const list = messages.filter((m) => {
      if (filter !== "all" && detectCategory(m.message_text) !== filter) return false;
      if (q && !(m.message_text ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    return { counts: tally, visible: list };
  }, [messages, filter, search]);

  // Group the visible feed under date headers (dedicated page only).
  const grouped = useMemo(() => {
    if (!showFilters) return null;
    const buckets = new Map<string, TelegramMessage[]>();
    for (const m of visible) {
      const b = dateBucket(m.message_date);
      const arr = buckets.get(b) ?? [];
      buckets.set(b, [...arr, m]);
    }
    return BUCKET_ORDER.filter((b) => buckets.has(b)).map((b) => ({ label: b, items: buckets.get(b)! }));
  }, [visible, showFilters]);

  const fetchMessages = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("telegram_updates")
        .select("*")
        .order("message_date", { ascending: false })
        .limit(limit);

      if (!error && data) {
        setMessages(data as TelegramMessage[]);
      }
    } catch (err) {
      console.error("Failed to fetch telegram updates:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Auto-refresh every 3 minutes
    const interval = setInterval(() => {
      if (!document.hidden) fetchMessages();
    }, 3 * 60 * 1000);

    const handleVisibility = () => {
      if (!document.hidden) fetchMessages();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on symbol/mount by design; object identities change every render
  }, []);

  return (
    <section className="py-12 md:py-20 bg-muted/20 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-10 left-10 w-80 h-80 bg-[#229ED9]/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 right-10 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          {...revealSection}
        >
          <motion.span
            className="inline-flex items-center gap-2 text-[#229ED9] font-semibold text-sm uppercase tracking-wider mb-3"
            {...revealTracking}
          >
            <Send className="w-4 h-4" />
            Live Updates
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t("page.recommendations")}
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-[#229ED9] to-[#1a7aab] mx-auto rounded-full mb-4"
            {...revealBar}
          />
          <p className="text-muted-foreground max-w-xl mx-auto">
            Latest stock picks and market updates from our research team, delivered in real-time.
          </p>
        </motion.div>

        {/* Refresh button */}
        <motion.div
          className="flex justify-end mb-4"
          {...revealFade}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchMessages(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </motion.div>

        {/* Research-desk summary band (dedicated recommendations page) */}
        {showFilters && !loading && messages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Buy Calls", value: counts.buy ?? 0, icon: TrendingUp, cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
              { label: "Sell / Exit Calls", value: counts.sell ?? 0, icon: TrendingDown, cls: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
              { label: "Targets Hit", value: counts.target ?? 0, icon: Target, cls: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
              { label: "Total Updates", value: messages.length, icon: Send, cls: "text-[#229ED9]", bg: "bg-[#229ED9]/10" },
            ].map(({ label, value, icon: TileIcon, cls, bg }) => (
              <div key={label} className={`rounded-xl border border-border/50 ${bg} px-4 py-3 flex items-center gap-3`}>
                <TileIcon className={`w-5 h-5 shrink-0 ${cls}`} />
                <div>
                  <div className={`text-xl font-black font-mono leading-none ${cls}`}>{value}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground mt-1">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search (dedicated recommendations page) */}
        {showFilters && !loading && messages.length > 0 && (
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stock or keyword..."
              aria-label="Search recommendations"
              className="pl-9 h-10"
            />
          </div>
        )}

        {/* Category filter chips (dedicated recommendations page) */}
        {showFilters && !loading && messages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`min-h-[40px] px-4 rounded-full text-xs font-bold transition-colors ${filter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              All <span className="opacity-70">{messages.length}</span>
            </button>
            {FILTER_ORDER.filter((c) => (counts[c] ?? 0) > 0).map((c) => {
              const cfg = categoryConfig[c];
              const CIcon = cfg.icon;
              const active = filter === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full text-xs font-bold border transition-colors ${active ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}` : "bg-card text-muted-foreground border-border/60 hover:bg-muted/50"}`}
                >
                  <CIcon className="w-3.5 h-3.5" />
                  {cfg.label} <span className="opacity-70">{counts[c]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Messages grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <MessageSkeleton key={i} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-20 h-20 bg-[#229ED9]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Send className="w-10 h-10 text-[#229ED9]/50" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-muted-foreground mb-2">
              No updates yet
            </h3>
            <p className="text-sm text-muted-foreground/70">
              Stock recommendations will appear here once published. Check back soon!
            </p>
          </motion.div>
        ) : visible.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No updates match your filter - try clearing the search or category.
          </p>
        ) : grouped ? (
          // Dedicated page: feed grouped under date headers
          <AnimatePresence mode="popLayout">
            <div className="space-y-8">
              {grouped.map((g) => (
                <div key={g.label}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <h3 className="text-sm font-heading font-bold text-foreground">{g.label}</h3>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{g.items.length}</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {g.items.map((msg, i) => (
                      <MessageCard key={msg.id} message={msg} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AnimatePresence>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid md:grid-cols-2 gap-4">
              {visible.map((msg, i) => (
                <MessageCard key={msg.id} message={msg} index={i} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {showViewAll && messages.length > 0 && (
          <motion.div
            className="mt-8 flex justify-center"
            {...revealItem()}
            transition={{ delay: 0.3 }}
          >
            <Button asChild variant="outline" className="gap-2 text-[#229ED9] border-[#229ED9]/30 hover:bg-[#229ED9]/10">
              <Link to="/learn/recommendations">
                View All Recommendations
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        )}

        {/* Auto-refresh indicator */}
        {messages.length > 0 && (
          <motion.p
            className="text-center text-xs text-muted-foreground/50 mt-6"
            {...revealFade}
            transition={{ delay: 0.5 }}
          >
            <Send className="w-3 h-3 inline mr-1" />
            Auto-refreshes every 3 minutes • Powered by Telegram
          </motion.p>
        )}

        {/* ⚠️ SEBI Investment Disclaimer */}
        <motion.div
          className="mt-8 md:mt-12"
          {...revealItem()}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 md:p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="font-heading font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1.5 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Important Disclaimer – Investment Risk Warning
                </h4>
                <p className="text-amber-700/90 dark:text-amber-400/80 text-xs leading-relaxed">
                  <strong>Investments in securities market are subject to market risks. Read all related documents carefully before investing.</strong>{" "}
                  The stock recommendations displayed above are for educational and informational purposes only and should not be construed as investment advice.
                  Past performance is not indicative of future results. Parasram India Pvt. Ltd. (SEBI Reg: INZ000220838) does not guarantee any assured returns.
                  Please consult your financial advisor before making any investment decisions. Trading in equity, derivatives, and commodities involves substantial risk of loss and is not suitable for every investor.
                  All investment decisions are made at your own risk.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TelegramChannel;
