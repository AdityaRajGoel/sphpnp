import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Simple session ID for grouping events
const getSessionId = () => {
  let sid = sessionStorage.getItem("analytics_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("analytics_sid", sid);
  }
  return sid;
};

/**
 * The nightly prerender loads every page in headless Chrome, and each load was
 * recorded as a visit: most of page_analytics was the build itself (2,525 "views"
 * at 04:00 IST in one week against ~25 an hour otherwise). Automated browsers are
 * not visitors.
 */
const isAutomated = () =>
  typeof window === "undefined" ||
  (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__ === true ||
  navigator.webdriver === true;

/**
 * Where the visit came from, sent once per session with its first page view:
 * the referring host (not the full URL) and any utm_* tags. Without it every
 * visit read as "direct" and no channel could be measured.
 */
const firstTouch = (): Record<string, string> => {
  if (sessionStorage.getItem("analytics_src")) return {};
  sessionStorage.setItem("analytics_src", "1");
  const out: Record<string, string> = {};
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    if (ref && ref !== window.location.hostname.replace(/^www\./, "")) out.referrer = ref;
  } catch { /* unparsable referrer: leave it out */ }
  const params = new URLSearchParams(window.location.search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 80);
  }
  return out;
};

const trackEvent = async (
  pagePath: string,
  eventType: string = "page_view",
  metadata: Record<string, unknown> = {}
) => {
  if (isAutomated()) return;
  try {
    if (eventType === "page_view") metadata = { ...firstTouch(), ...metadata };
    await (supabase.from("page_analytics" as never) as ReturnType<typeof supabase.from>).insert({
      page_path: pagePath,
      event_type: eventType,
      session_id: getSessionId(),
      metadata,
    } as never);
  } catch {
    // Silent fail - analytics should never break the app
  }
};

/** Auto-tracks page views on route changes */
export const usePageTracking = () => {
  const location = useLocation();
  const lastPath = useRef("");

  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      trackEvent(location.pathname, "page_view");
    }
  }, [location.pathname]);
};

/** Track a custom event (form submission, stock view, etc.) */
export const trackCustomEvent = (
  eventType: string,
  metadata: Record<string, unknown> = {}
) => {
  trackEvent(window.location.pathname, eventType, metadata);
};

export default usePageTracking;
