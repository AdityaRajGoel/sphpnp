import { describe, it, expect } from "vitest";
import { activeSection, megaMenuItems, menuLinks } from "@/components/header/megaMenuData";

describe("header menu", () => {
  it("underlines the section a page belongs to, deep pages included", () => {
    expect(activeSection("/ipo")).toBe("IPO");
    expect(activeSection("/ipo/acme-ltd")).toBe("IPO");
    expect(activeSection("/ipo-pipeline")).toBe("Markets");
    expect(activeSection("/stock/RELIANCE")).toBe("Markets");
    expect(activeSection("/indices/nifty-50")).toBe("Markets");
    expect(activeSection("/learn/what-is-a-demat-account")).toBe("Learn");
    expect(activeSection("/brokerage-calculator")).toBe("Tools");
    expect(activeSection("/apps")).toBe("Tools");
    expect(activeSection("/pricing")).toBe("Services");
    expect(activeSection("/team")).toBe("About");
    expect(activeSection("/contact")).toBe("Contact");
    expect(activeSection("/")).toBeNull();
  });

  it("has no top-level Apps item and no external SPAN calculator link", () => {
    expect(megaMenuItems.map((i) => i.label)).not.toContain("Apps");
    expect(megaMenuItems.flatMap(menuLinks).some((l) => l.href.includes("calculator#!/span"))).toBe(false);
  });

  it("reaches every page a visitor can use from the menu", () => {
    const hrefs = new Set([...megaMenuItems.map((i) => i.href), ...megaMenuItems.flatMap(menuLinks).map((l) => l.href.split("#")[0])]);
    for (const page of ["/services", "/pricing", "/open-account", "/unlisted-space", "/products", "/depository-services", "/market-pulse", "/indices",
      "/reports", "/screener", "/compare", "/52-week-tracker", "/fno", "/ipo", "/ipo-pipeline", "/brokerage-calculator", "/margin-calculator",
      "/sip-calculator", "/watchlist", "/portfolio", "/holidays", "/apps", "/learn", "/learn/recommendations", "/help", "/about", "/team",
      "/careers", "/investor-corner", "/contact", "/fund-transfer", "/downloads"]) expect(hrefs.has(page), page).toBe(true);
  });
});
