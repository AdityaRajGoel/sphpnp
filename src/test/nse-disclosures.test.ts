import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseShareholdingMaster, parseInsiderTrades, parseInsiderXbrl, parsePitFilings, parseShpPledge, nseDate, nseTimestamp } from "../../supabase/functions/_shared/nse-disclosures";

/*
 * NSE's shareholding-pattern filings and insider-trade (PIT) disclosures for
 * RELIANCE, captured 2026-09-11 from the exchange's JSON API.
 */

const fixture = (name: string) => JSON.parse(readFileSync(`src/test/fixtures/nse-api/${name}.json`, "utf-8"));

describe("nse dates", () => {
  it("reads NSE's day-month-year dates and IST timestamps", () => {
    expect(nseDate("30-JUN-2026")).toBe("2026-06-30");
    expect(nseDate("13-Feb-2026")).toBe("2026-02-13");
    expect(nseDate("-")).toBeNull();
    expect(nseTimestamp("16-JUL-2026 19:24:44")).toBe("2026-07-16T13:54:44.000Z");
    expect(nseTimestamp("18-Feb-2026 19:06")).toBe("2026-02-18T13:36:00.000Z");
  });
});

describe("parseShareholdingMaster", () => {
  const filings = parseShareholdingMaster(fixture("shareholding-reliance"), "RELIANCE");

  it("reads each quarter's promoter and public share, newest first, with its XBRL", () => {
    expect(filings[0]).toMatchObject({ symbol: "RELIANCE", quarter_end: "2026-06-30", promoter_pct: 50.48, public_pct: 49.52, employee_trust_pct: 0 });
    expect(filings[0].xbrl_url).toMatch(/^https:\/\/nsearchives\.nseindia\.com\/corporate\/xbrl\/SHP_/);
    expect(filings[0].filed_at).toBe("2026-07-16T13:54:44.000Z");
    expect(filings.map((f) => f.quarter_end)).toEqual([...filings.map((f) => f.quarter_end)].sort().reverse());
  });

  it("keeps the latest filing when a quarter was revised", () => {
    const raw = [
      { date: "31-MAR-2026", pr_and_prgrp: "50", public_val: "50", recordId: "1", broadcastDate: "21-APR-2026 01:25:04" },
      { date: "31-MAR-2026", pr_and_prgrp: "50.1", public_val: "49.9", recordId: "2", broadcastDate: "25-APR-2026 10:00:00" },
    ];
    expect(parseShareholdingMaster(raw, "X")).toMatchObject([{ record_id: "2", promoter_pct: 50.1 }]);
  });
});

describe("parseInsiderTrades", () => {
  const trades = parseInsiderTrades(fixture("pit-reliance"), "RELIANCE");

  it("reads who traded, which way, how much and when", () => {
    const sale = trades.find((t) => t.disclosure_id === "563850")!;
    expect(sale).toMatchObject({
      person: "BALANADU NARAYAN", category: "Other", transaction: "sell", mode: "Off Market",
      quantity: 2320, value: 3294168, traded_from: "2026-02-13", traded_to: "2026-02-13",
    });
    expect(sale.disclosed_at).toBe("2026-02-18T13:36:00.000Z");
  });

  it("sorts newest disclosure first and classifies pledges apart from trades", () => {
    expect(trades.map((t) => t.disclosed_at)).toEqual([...trades.map((t) => t.disclosed_at)].sort().reverse());
    const kinds = new Set(parseInsiderTrades({ data: [
      { did: "1", acqName: "A", tdpTransactionType: "Pledge Invoke" },
      { did: "2", acqName: "B", tdpTransactionType: "Pledge Revoke" },
      { did: "3", acqName: "C", tdpTransactionType: "Buy" },
    ] }, "X").map((t) => t.transaction));
    expect(kinds).toEqual(new Set(["pledge", "revoke", "buy"]));
  });

  it("drops another company's rows", () => {
    expect(parseInsiderTrades({ data: [{ did: "1", acqName: "A", symbol: "TCS", tdpTransactionType: "Buy" }] }, "RELIANCE")).toEqual([]);
  });
});

describe("NSE insider filings since May 2026 (corporates-pit-gg + XBRL)", () => {
  const filing = { appId: "3425", xbrlUrl: "https://nsearchives.nseindia.com/corporate/xbrl/IT_1828.xml", disclosedAt: "2026-09-18T14:11:31.000Z" };
  const fact = (name: string, ctx: string, v: string) => `<in-bse-co:${name} contextRef="${ctx}" decimals="INF">${v}</in-bse-co:${name}>`;
  const line = (ctx: string, person: string, type: string, value: string, to: string) => [
    fact("CategoryOfPerson", ctx, "Promoter Group"), fact("NameOfThePerson", ctx, person),
    fact("SecuritiesAcquiredOrDisposedNumberOfSecurity", ctx, "514"), fact("SecuritiesAcquiredOrDisposedValueOfSecurity", ctx, value),
    fact("SecuritiesAcquiredOrDisposedTransactionType", ctx, type), fact("ModeOfAcquisitionOrDisposal", ctx, "Market Sale"),
    fact("DateOfAllotmentAdviceOrAcquisitionOfSharesOrSaleOfSharesSpecifyFromDate", ctx, to),
    fact("DateOfAllotmentAdviceOrAcquisitionOfSharesOrSaleOfSharesSpecifyToDate", ctx, to),
  ].join("");
  const xml = `<xbrli:xbrl>${fact("Symbol", "MainI", "HCLTECH")}${line("Disclosure1", "A Person", "Buy", "641883", "2026-09-09")}${line("Disclosure2", "B Person", "Sell", "1000", "2026-11-09")}</xbrli:xbrl>`;

  it("reads one trade per DisclosureN context, keyed by filing and line", () => {
    const trades = parseInsiderXbrl(xml, "HCLTECH", filing);
    expect(trades.map((t) => [t.disclosure_id, t.person, t.transaction, t.value])).toEqual([
      ["gg:3425:Disclosure1", "A Person", "buy", 641883],
      ["gg:3425:Disclosure2", "B Person", "sell", 1000],
    ]);
    expect(trades[0].traded_to).toBe("2026-09-09");
  });

  it("drops a trade date later than the disclosure, which is a filing typo", () => {
    expect(parseInsiderXbrl(xml, "HCLTECH", filing)[1].traded_to).toBeNull();
  });

  it("lists filings with an XBRL link for the requested symbol only", () => {
    const raw = { data: [
      { appId: "1", symbol: "HCLTECH", xmlFileName: "https://nsearchives.nseindia.com/corporate/xbrl/a.xml", broadcastDateTime: "18-Sep-2026 19:41:31" },
      { appId: "2", symbol: "TCS", xmlFileName: "https://nsearchives.nseindia.com/corporate/xbrl/b.xml" },
      { appId: "3", symbol: "HCLTECH", xmlFileName: "-" },
    ] };
    expect(parsePitFilings(raw, "HCLTECH")).toEqual([{ appId: "1", xbrlUrl: "https://nsearchives.nseindia.com/corporate/xbrl/a.xml", disclosedAt: "2026-09-18T14:11:31.000Z" }]);
  });
});

describe("parseShpPledge", () => {
  const f = (name: string, ctx: string, v: string) => `<in-bse-shp:${name} contextRef="${ctx}" unitRef="shares">${v}</in-bse-shp:${name}>`;
  it("reads the promoter group's pledge from the shareholding-pattern total", () => {
    const xml = f("NumberOfShares", "ShareholdingOfPromoterAndPromoterGroup_ContextI", "974234554")
      + f("NumberOfSharesEncumberedUnderPledged", "ShareholdingOfPromoterAndPromoterGroup_ContextI", "7700000")
      + f("NumberOfSharesEncumberedUnderPledged", "Indian_ContextI", "99");
    const p = parseShpPledge(xml)!;
    expect(p.promoter_shares).toBe(974234554);
    expect(p.promoter_pledged_shares).toBe(7700000);
    expect(p.promoter_pledged_pct).toBeCloseTo(0.79, 2);
  });
  it("returns null for a company with no promoter total", () => {
    expect(parseShpPledge(f("NumberOfShares", "Indian_ContextI", "5"))).toBeNull();
  });
});
