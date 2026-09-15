/**
 * Browser error reporting without a third-party service or account.
 *
 * Errors are sent with navigator.sendBeacon to a same-origin nginx endpoint
 * (/api/client-error, infra/vps/nginx/sphpnp-com.conf) that writes each report to
 * /var/log/nginx/client-errors.log; the VPS's daily error digest reads that file.
 * Only the live site reports, never the prerender, local dev or staging, and each
 * page view sends at most MAX_REPORTS so a render loop cannot flood the log.
 */

export const CLIENT_ERROR_ENDPOINT = "/api/client-error";
export const MAX_REPORTS = 10;
const MAX_FIELD = 1500;

export type ClientErrorReport = {
  kind: "error" | "unhandledrejection" | "react";
  message: string;
  source?: string;
  stack?: string;
  page: string;
  at: string;
};

const truncate = (value: unknown, limit = MAX_FIELD): string =>
  (typeof value === "string" ? value : String(value ?? "")).slice(0, limit);

/** Builds a report from whatever was thrown: Error, string, or anything else. */
export function toReport(kind: ClientErrorReport["kind"], error: unknown, source?: string, page = ""): ClientErrorReport {
  const err = error instanceof Error ? error : null;
  return {
    kind,
    message: truncate(err ? err.message : error, 300),
    source: source ? truncate(source, 300) : undefined,
    stack: err?.stack ? truncate(err.stack) : undefined,
    page: truncate(page, 300),
    at: new Date().toISOString(),
  };
}

/** Noise from the visitor's environment rather than from the site. */
export function isNoise(report: ClientErrorReport): boolean {
  const text = `${report.message} ${report.source ?? ""} ${report.stack ?? ""}`;
  // "Script error." is what browsers report for a cross-origin script: no detail to act on.
  return /ResizeObserver loop|chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\//i.test(text)
    || /^Script error\.?$/i.test(report.message.trim());
}

export function shouldReport(hostname: string, isAutomated: boolean): boolean {
  return hostname === "www.sphpnp.com" && !isAutomated;
}

let sent = 0;

/** Sends one report (at most MAX_REPORTS per page view); never throws. */
export function reportClientError(report: ClientErrorReport): void {
  try {
    if (sent >= MAX_REPORTS || isNoise(report)) return;
    if (!shouldReport(window.location.hostname, navigator.webdriver === true)) return;
    sent += 1;
    const body = JSON.stringify(report);
    if (!navigator.sendBeacon?.(CLIENT_ERROR_ENDPOINT, new Blob([body], { type: "text/plain" }))) {
      void fetch(CLIENT_ERROR_ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
    }
  } catch {
    /* reporting must never break the page */
  }
}

/** Installs window-level handlers for uncaught errors and unhandled promise rejections. */
export function installClientErrorReporting(): void {
  if (!shouldReport(window.location.hostname, navigator.webdriver === true)) return;
  window.addEventListener("error", (event) => {
    reportClientError(toReport("error", event.error ?? event.message, event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined, window.location.pathname));
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(toReport("unhandledrejection", event.reason, undefined, window.location.pathname));
  });
}
