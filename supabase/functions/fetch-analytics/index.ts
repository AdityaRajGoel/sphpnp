import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Same lockout as manage-unlisted-shares: 5 wrong passwords within 5 minutes locks
// that IP out for 15 minutes, so the admin password cannot be guessed by brute force.
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

function lockedFor(ip: string): number {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return 0;
  if (record.lockedUntil > now) return Math.ceil((record.lockedUntil - now) / 1000);
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) loginAttempts.delete(ip);
  return 0;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip) ?? { count: 0, lastAttempt: now, lockedUntil: 0 };
  record.count += 1;
  record.lastAttempt = now;
  if (record.count >= MAX_ATTEMPTS) record.lockedUntil = now + LOCKOUT_DURATION_MS;
  loginAttempts.set(ip, record);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = clientIp(req);
    const retryAfter = lockedFor(ip);
    if (retryAfter > 0) {
      return new Response(JSON.stringify({ success: false, error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { password, period } = body;

    // Verify admin password
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || !password || password !== adminPassword) {
      recordFailedAttempt(ip);
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    loginAttempts.delete(ip);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Default to last 30 days
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Page views
    const { data: pageViews } = await sb
      .from("page_analytics")
      .select("page_path, event_type, created_at, metadata")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const events = pageViews || [];

    // Aggregate page views by path
    const pageMap: Record<string, number> = {};
    events.filter(e => e.event_type === "page_view").forEach(e => {
      pageMap[e.page_path] = (pageMap[e.page_path] || 0) + 1;
    });
    const topPages = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([path, views]) => ({ path, views }));

    // Daily views trend
    const dailyMap: Record<string, number> = {};
    events.filter(e => e.event_type === "page_view").forEach(e => {
      const day = e.created_at.slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });
    const dailyViews = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, views]) => ({ date, views }));

    // Form conversions
    const formEvents = events.filter(e => e.event_type === "form_submission");
    const formMap: Record<string, number> = {};
    formEvents.forEach(e => {
      const form = (e.metadata as any)?.form || "unknown";
      formMap[form] = (formMap[form] || 0) + 1;
    });

    // Popular stocks viewed
    const stockEvents = events.filter(e => e.event_type === "stock_view");
    const stockMap: Record<string, number> = {};
    stockEvents.forEach(e => {
      const symbol = (e.metadata as any)?.symbol || "unknown";
      stockMap[symbol] = (stockMap[symbol] || 0) + 1;
    });
    const popularStocks = Object.entries(stockMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([symbol, views]) => ({ symbol, views }));

    // Unique sessions
    const uniqueSessions = new Set(events.map(e => e.session_id).filter(Boolean)).size;

    // Lead trends (from account_leads)
    const { data: leads } = await sb
      .from("account_leads")
      .select("status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const leadDailyMap: Record<string, { total: number; new: number; contacted: number; converted: number; closed: number }> = {};
    (leads || []).forEach(l => {
      const day = l.created_at.slice(0, 10);
      if (!leadDailyMap[day]) leadDailyMap[day] = { total: 0, new: 0, contacted: 0, converted: 0, closed: 0 };
      leadDailyMap[day].total++;
      const s = l.status as keyof typeof leadDailyMap[string];
      if (s in leadDailyMap[day]) (leadDailyMap[day] as any)[s]++;
    });
    const leadTrend = Object.entries(leadDailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));

    return new Response(
      JSON.stringify({
        success: true,
        totalPageViews: events.filter(e => e.event_type === "page_view").length,
        uniqueSessions,
        topPages,
        dailyViews,
        formConversions: formMap,
        popularStocks,
        leadTrend,
        period: `${days}d`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analytics error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
