import { describe, it, expect } from "vitest";
import { isQuoteStale, QUOTE_STALE_AFTER_DAYS } from "@/lib/unlisted";
import {
  SourceError,
  classifyFailure,
  classifyHttpStatus,
  errorMessage,
  summarizeRun,
  type SourceFailure,
} from "../../supabase/functions/_shared/quote-failures";

/**
 * The comparison block shows other dealers' indicative rates. The one rule that
 * has to hold is that nothing undated or old is presented as current, so that
 * is what these cover.
 */
describe("isQuoteStale", () => {
  const now = Date.parse("2026-08-03T12:00:00Z");

  it("treats a quote collected today as current", () => {
    expect(isQuoteStale("2026-08-03T08:00:00Z", now)).toBe(false);
  });

  it("treats a quote just inside the window as current", () => {
    const edge = new Date(now - (QUOTE_STALE_AFTER_DAYS * 86_400_000 - 60_000)).toISOString();
    expect(isQuoteStale(edge, now)).toBe(false);
  });

  it("treats a quote past the window as stale", () => {
    const old = new Date(now - (QUOTE_STALE_AFTER_DAYS + 1) * 86_400_000).toISOString();
    expect(isQuoteStale(old, now)).toBe(true);
  });

  it("treats an undateable quote as stale rather than current", () => {
    // Failing closed matters here: a quote we cannot date is precisely the
    // thing that must not appear as though it were today's price.
    expect(isQuoteStale("not-a-date", now)).toBe(true);
  });

  it("treats an empty timestamp as stale", () => {
    expect(isQuoteStale("", now)).toBe(true);
  });
});

/**
 * The collection side of the same block. A scheduled run that failed with
 * `{"upserted":59,"failures":["UnlistedZone: Signal timed out."]}` is what these
 * exist for: 59 quotes were written, one dealer's server was briefly
 * unreachable, and the workflow went red as though a parser had broken.
 *
 * The rule being pinned down is that only a failure meaning *our parser or URL
 * is now wrong* may turn the run red, because that is the failure nobody would
 * otherwise notice - the last-good rows stay in the table and age out on screen.
 */
describe("classifyHttpStatus", () => {
  it("treats 5xx as transient", () => {
    // The dealer's server answered, badly. Asking again tomorrow usually works.
    expect(classifyHttpStatus(500)).toBe("transient");
    expect(classifyHttpStatus(502)).toBe("transient");
    expect(classifyHttpStatus(503)).toBe("transient");
  });

  it("treats 4xx as structural", () => {
    // A 404 or 403 means the URL or our access changed. Retrying is pointless
    // and staying green would hide it.
    expect(classifyHttpStatus(404)).toBe("structural");
    expect(classifyHttpStatus(403)).toBe("structural");
    expect(classifyHttpStatus(410)).toBe("structural");
  });

  // 429 is the one 4xx that is not a statement about the URL. HTTP defines it as
  // explicitly retryable and it normally carries Retry-After, so it is weather,
  // not a broken contract. Classing it structural would red the build every
  // single day we happened to be rate-limited - which is precisely the
  // cry-wolf behaviour this whole classification exists to stop. If a 429
  // becomes permanent it still surfaces: it warns daily, and if it is the reason
  // nothing got written the upserted-zero rule reds the run anyway.
  it("treats 429 as transient, unlike the other 4xx", () => {
    expect(classifyHttpStatus(429)).toBe("transient");
  });
});

describe("classifyFailure", () => {
  it("honours the classification the throw site attached", () => {
    expect(classifyFailure(new SourceError("transient", "timed out"))).toBe("transient");
    expect(classifyFailure(new SourceError("structural", "HTTP 404"))).toBe("structural");
  });

  it("treats an unclassified error as structural", () => {
    // Failing closed: an error nobody classified is far more often a bug in our
    // own parsing (a TypeError, a JSON.parse blowing up) than a network blip,
    // and structural is the direction that stays visible.
    expect(classifyFailure(new Error("Cannot read properties of undefined"))).toBe("structural");
    expect(classifyFailure(new SyntaxError("Unexpected token < in JSON"))).toBe("structural");
    expect(classifyFailure("a bare string somebody threw")).toBe("structural");
  });
});

describe("errorMessage", () => {
  it("reads the message off an Error", () => {
    expect(errorMessage(new Error("Signal timed out."))).toBe("Signal timed out.");
  });

  it("stringifies a non-Error rather than reporting undefined", () => {
    expect(errorMessage("plain string")).toBe("plain string");
    expect(errorMessage(null)).toBe("null");
  });
});

describe("summarizeRun", () => {
  const transient = (source: string, message = "Signal timed out."): SourceFailure => ({
    source,
    message,
    kind: "transient",
  });
  const structural = (
    source: string,
    message = "parsed 0 quotes (markup likely changed)",
  ): SourceFailure => ({ source, message, kind: "structural" });

  it("returns 200 and an empty failures list when both sources are fine", () => {
    expect(summarizeRun(112, [])).toEqual({
      status: 200,
      body: { upserted: 112, failures: [] },
    });
  });

  it("returns 200 with a warning when a transient failure spared a source that wrote rows", () => {
    // The production failure. Stockify's 59 rows landed; UnlistedZone timed out
    // through its retry. Nothing is broken, so nothing should be red - but the
    // timeout still has to be visible.
    const summary = summarizeRun(59, [transient("UnlistedZone")]);
    expect(summary.status).toBe(200);
    expect(summary.body.failures).toEqual([]);
    expect(summary.body.warnings).toEqual(["UnlistedZone: Signal timed out."]);
  });

  it("returns 500 when a source parsed 0 quotes even though the other wrote rows", () => {
    // Markup changed. This is the failure the policy exists to catch.
    expect(summarizeRun(59, [structural("UnlistedZone")])).toEqual({
      status: 500,
      body: {
        upserted: 59,
        failures: ["UnlistedZone: parsed 0 quotes (markup likely changed)"],
      },
    });
  });

  it("returns 500 when a source 404s even though the other wrote rows", () => {
    const summary = summarizeRun(
      112,
      [structural("Stockify", "https://stockify.net.in/... returned HTTP 404")],
    );
    expect(summary.status).toBe(500);
    expect(summary.body.failures).toEqual([
      "Stockify: https://stockify.net.in/... returned HTTP 404",
    ]);
  });

  it("returns 500 when nothing was written at all, even if every failure was transient", () => {
    // The run achieved nothing. Whatever the cause, a human should look.
    const summary = summarizeRun(0, [transient("UnlistedZone"), transient("Stockify")]);
    expect(summary.status).toBe(500);
    expect(summary.body.failures).toEqual([]);
    expect(summary.body.warnings).toEqual([
      "UnlistedZone: Signal timed out.",
      "Stockify: Signal timed out.",
    ]);
  });

  it("reports a structural and a transient failure separately in the same run", () => {
    const summary = summarizeRun(59, [
      structural("UnlistedZone"),
      transient("Stockify", "could not be fetched: Signal timed out."),
    ]);
    expect(summary.status).toBe(500);
    expect(summary.body.failures).toEqual([
      "UnlistedZone: parsed 0 quotes (markup likely changed)",
    ]);
    expect(summary.body.warnings).toEqual([
      "Stockify: could not be fetched: Signal timed out.",
    ]);
  });

  it("omits warnings entirely when there is nothing to warn about", () => {
    // Keeps a clean run's body exactly as it was, so the presence of the key at
    // all is the signal the workflow annotates on.
    expect("warnings" in summarizeRun(112, []).body).toBe(false);
    expect("warnings" in summarizeRun(59, [structural("UnlistedZone")]).body).toBe(false);
  });

  it("returns 500 when nothing was written and nothing failed", () => {
    // Should not be reachable - it means SOURCES is empty - but a run that
    // wrote nothing must never report success.
    expect(summarizeRun(0, []).status).toBe(500);
  });
});
