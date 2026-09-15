import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { classifyFiling } from "@/lib/legal-filings";

const f = (subject: string, summary: string | null = null, attachment_url: string | null = "https://www.bseindia.com/x.pdf") =>
  classifyFiling({ news_id: subject, subject, summary, attachment_url, published_at: "2026-09-01T00:00:00Z" });

describe("classifyFiling", () => {
  it("files tribunal hearings under insolvency and tribunals, ahead of courts", () => {
    const r = f("Announcement under Regulation 30 (LODR)-Newspaper Publication", "Petition hearing date before the Hon'ble NCLT for the scheme of amalgamation.");
    expect(r?.topic).toBe("Insolvency & tribunals");
    expect(r?.subject).toBe("Newspaper Publication");
  });

  it("marks penalties and tax demands as adverse", () => {
    const r = f("Disclosure under Regulation 30", "The company received a GST demand order of Rs 4.2 crore with penalty.");
    expect(r).toMatchObject({ topic: "Tax & penalties", adverse: true });
  });

  it("recognises rating downgrades and auditor resignations", () => {
    expect(f("Credit Rating", "CARE has downgraded the long term rating")?.topic).toBe("Credit rating");
    expect(f("Resignation of Statutory Auditors")?.topic).toBe("Auditor & governance");
  });

  it("ignores routine filings and sales orders", () => {
    expect(f("Analyst / Investor Meet", "Meeting to discuss the tribunal ruling")).toBeNull();
    expect(f("Award of Order / Receipt of Order", "Received a purchase order worth Rs 300 crore")).toBeNull();
    expect(f("Closure of Trading Window")).toBeNull();
    expect(f("Board meeting to define the dividend")).toBeNull();
  });

  it("only links to the exchange's own documents", () => {
    expect(f("Litigation update", null, "javascript:alert(1)")?.url).toBeNull();
    expect(f("Litigation update", null, "https://evil.example/bseindia.com/x.pdf")?.url).toBeNull();
    expect(f("Litigation update")?.url).toBe("https://www.bseindia.com/x.pdf");
  });
});
