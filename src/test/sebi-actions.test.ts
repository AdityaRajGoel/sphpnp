import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseSebiRows,
  redactPan,
  orderKind,
  titleNamesCompany,
  actionsForStock,
  searchName,
} from "../../supabase/functions/_shared/sebi-actions";

/*
 * SEBI enforcement orders and corporate-action filings, found per stock with
 * SEBI's own search (captured 2026-09-11). The search is broad - "Tata Motors"
 * also finds Tata Motors Finance - so every result is kept only if its title
 * names this company. And order titles often carry individuals' PANs, which
 * SEBI publishes but this site has no reason to repeat.
 */

const page = (name: string) => readFileSync(`src/test/fixtures/sebi/${name}.html`, "utf-8");

describe("parseSebiRows", () => {
  it("reads each result's date, title and link", () => {
    const rows = parseSebiRows(page("orders-tata-motors"));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ filed_on: "2025-12-23", title: "Settlement Order in respect of Tata Motors Finance Limited" });
    expect(rows[0].url).toMatch(/^https:\/\/www\.sebi\.gov\.in\//);
  });

  it("drops the invisible characters SEBI leaves in some titles", () => {
    // SEBI's title is "Infosys Limited" followed by a zero-width space (U+200B),
    // which would defeat any exact match.
    expect(parseSebiRows(page("buybacks-infosys"))[0].title).toBe("Infosys Limited");
  });
});

describe("redactPan", () => {
  it("withholds a PAN in any of the forms SEBI prints it", () => {
    expect(redactPan("Mr. Rajinder Singh [Defaulter] (PAN: ABNPS5493D) in the matter of X"))
      .toBe("Mr. Rajinder Singh [Defaulter] in the matter of X");
    expect(redactPan("against Rahul Khandelwal (PAN:AWPPK7085E)")).toBe("against Rahul Khandelwal");
    expect(redactPan("Lataben Rangi (AYRPR1234K)")).toBe("Lataben Rangi");
  });

  it("leaves a title with no PAN alone", () => {
    expect(redactPan("Adjudication Order in the matter of Reliance Industries Limited"))
      .toBe("Adjudication Order in the matter of Reliance Industries Limited");
  });
});

describe("titleNamesCompany", () => {
  it("matches the company followed by Limited or Ltd", () => {
    expect(titleNamesCompany("Directions in the matter of Tata Motors Limited", "Tata Motors")).toBe(true);
    expect(titleNamesCompany("Adjudication Order in the matter of Reliance Industries Ltd", "Reliance Industries")).toBe(true);
    expect(titleNamesCompany("Order in respect of Central Depository Services (India) Limited", "Central Depository Services")).toBe(true);
  });

  it("refuses a different company that shares the name's first words", () => {
    expect(titleNamesCompany("Settlement Order in respect of Tata Motors Finance Limited", "Tata Motors")).toBe(false);
    expect(titleNamesCompany("Judgment in the matter of Yes Bank ATI Bondholders Association vs. RBI", "Yes Bank")).toBe(false);
  });

  it("matches a short name only as a whole word followed by Limited", () => {
    expect(titleNamesCompany("Settlement Order in the matter of ITC Limited", "ITC")).toBe(true);
    expect(titleNamesCompany("Order in the matter of Pitch Limited", "ITC")).toBe(false);
  });

  it("accepts a stock name that already ends in Ltd", () => {
    expect(titleNamesCompany("Order in the matter of SRF Limited", "SRF Ltd")).toBe(true);
  });
});

describe("orderKind", () => {
  it("names the kind of order from its title", () => {
    expect(orderKind("Settlement Order in respect of Yes Bank Limited")).toBe("Settlement order");
    expect(orderKind("Adjudication Order in the matter of Reliance Industries Limited")).toBe("Adjudication order");
    expect(orderKind("Adjudication Proceedings in respect of Reliance Industries Limited")).toBe("Adjudication order");
    expect(orderKind("Interim Order in the matter of X Limited")).toBe("Interim order");
    expect(orderKind("Final Order in the matter of X Limited")).toBe("Final order");
    expect(orderKind("Directions in the matter of Tata Motors Limited")).toBe("Directions");
    expect(orderKind("Judgment in the matter of X vs. Y")).toBe("Judgment");
    expect(orderKind("Order in the matter of X Limited")).toBe("Order");
  });
});

describe("actionsForStock", () => {
  it("keeps only orders that name this company", () => {
    const actions = actionsForStock(parseSebiRows(page("orders-tata-motors")), "order", "Tata Motors");
    expect(actions.map((a) => a.title)).toEqual([
      "Adjudication Order In the matter of circulation of UPSI through WhatsApp messages with respect to Tata Motors Limited",
      "Directions in the matter of Tata Motors Limited",
      "Adjudication Order in respect of Tata Motors Ltd",
    ]);
    expect(actions[1]).toMatchObject({ category: "order", kind: "Directions", filed_on: "2018-03-06" });
  });

  it("keeps a buyback filing whose company is this stock", () => {
    const actions = actionsForStock(parseSebiRows(page("buybacks-infosys")), "buyback", "Infosys");
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]).toMatchObject({ category: "buyback", kind: "Buyback", filed_on: "2025-11-10" });
    expect(actions.some((a) => a.kind === "Buyback - Public Announcement")).toBe(true);
  });

  it("finds nothing for a company absent from the results", () => {
    expect(actionsForStock(parseSebiRows(page("takeovers-page")), "open_offer", "Infosys")).toEqual([]);
  });
});

describe("searchName", () => {
  it("searches the company's name without its legal suffix", () => {
    expect(searchName("SRF Ltd")).toBe("SRF");
    expect(searchName("Reliance Industries Limited")).toBe("Reliance Industries");
    expect(searchName("Infosys")).toBe("Infosys");
  });
});
