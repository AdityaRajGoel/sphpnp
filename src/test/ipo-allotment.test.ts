import { describe, it, expect } from "vitest";
import { allotmentChecks, allotmentSteps } from "@/lib/ipo-allotment";
import type { Ipo } from "@/lib/ipo";

const ipo = (over: Partial<Ipo>): Ipo =>
  ({
    registrar: null, documents: null, allotment_date: null, refund_date: null, credit_date: null, listing_date: null,
    ...over,
  }) as Ipo;

describe("IPO allotment checks", () => {
  it("prefers the issue's own allotment link over the registrar's generic page", () => {
    const checks = allotmentChecks(ipo({
      registrar: "Kfin Technologies Ltd.",
      documents: [{ kind: "allotment", label: "Allotment status", url: "https://ipostatus.kfintech.com/?ipo=ABC" }],
    }));
    expect(checks.registrar).toEqual({ name: "Kfin Technologies Ltd.", url: "https://ipostatus.kfintech.com/?ipo=ABC" });
  });

  it("falls back to the registrar's page, matched however the name is spelt", () => {
    expect(allotmentChecks(ipo({ registrar: "MUFG Intime India Pvt.Ltd." })).registrar?.url).toBe("https://in.mpms.mufg.com/Initial_Offer/public-issues.html");
    expect(allotmentChecks(ipo({ registrar: "Link Intime India Private Ltd" })).registrar?.url).toBe("https://in.mpms.mufg.com/Initial_Offer/public-issues.html");
    expect(allotmentChecks(ipo({ registrar: "Bigshare Services Pvt.Ltd." })).registrar?.url).toBe("https://ipo.bigshareonline.com/IPO_Status.html");
  });

  it("names an unknown registrar without inventing a link, and never links a non-web URL", () => {
    expect(allotmentChecks(ipo({ registrar: "Some New RTA Ltd." })).registrar).toEqual({ name: "Some New RTA Ltd.", url: null });
    expect(allotmentChecks(ipo({ registrar: null })).registrar).toBeNull();
    const bad = allotmentChecks(ipo({ registrar: "Odd RTA", documents: [{ kind: "allotment", label: "x", url: "javascript:alert(1)" }] }));
    expect(bad.registrar?.url).toBeNull();
  });

  it("always offers both exchanges", () => {
    expect(allotmentChecks(ipo({})).exchanges.map((e) => e.label)).toEqual(["BSE", "NSE"]);
  });
});

describe("IPO allotment timeline", () => {
  it("marks the steps already past, in order, and skips unknown dates", () => {
    const steps = allotmentSteps(ipo({ allotment_date: "2026-09-25", refund_date: "2026-09-28", credit_date: null, listing_date: "2026-09-30" }), "2026-09-28");
    expect(steps).toEqual([
      { label: "Allotment finalised", date: "2026-09-25", done: true },
      { label: "Refunds start", date: "2026-09-28", done: true },
      { label: "Listing", date: "2026-09-30", done: false },
    ]);
  });
});
