import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PipelineCompany } from "@/lib/ipo-pipeline";

// The page chrome is not under test; only the list and its "Show more" button.
vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/SEOHead", () => ({ default: () => null }));
vi.mock("@/components/ScrollProgress", () => ({ default: () => null }));
vi.mock("@/components/WhatsAppButton", () => ({ default: () => null }));
vi.mock("@/components/ipo/PipelineOverview", () => ({ default: () => null }));
vi.mock("@/components/PageTransition", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const companies: PipelineCompany[] = Array.from({ length: 25 }, (_, i) => ({
  key: `co-${i}`,
  name: `Company ${i}`,
  stage: "drhp_filed",
  first_filed_on: "2026-01-01",
  latest_filed_on: "2026-01-01",
  ipo_slug: null,
  filings: [],
}));

vi.mock("@/lib/ipo-pipeline", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/ipo-pipeline")>()),
  getPipeline: () => Promise.resolve(companies),
}));

const { default: IpoPipelinePage } = await import("@/pages/IpoPipelinePage");

const isHidden = (name: string) => screen.getByRole("heading", { name, hidden: true }).closest("[hidden]") !== null;

afterEach(cleanup);

describe("IPO pipeline Show more", () => {
  it("shows the first 20, keeps the rest in the page hidden, and reveals them from a button", async () => {
    render(<MemoryRouter><IpoPipelinePage /></MemoryRouter>);
    const button = await screen.findByRole("button", { name: "Show 5 more" });

    expect(isHidden("Company 19")).toBe(false);
    // Still rendered, so the prerendered HTML names every company.
    expect(isHidden("Company 20")).toBe(true);
    expect(isHidden("Company 24")).toBe(true);

    fireEvent.click(button);
    expect(isHidden("Company 24")).toBe(false);
    expect(screen.queryByRole("button", { name: /more$/ })).toBeNull();
  });
});
