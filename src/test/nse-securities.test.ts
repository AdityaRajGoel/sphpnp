import { describe, expect, it } from "vitest";
import { listingDate, parseSecurities } from "../../supabase/functions/_shared/nse-securities";

// The first lines of each file as served on 3 Oct 2026.
const MAIN = "SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE\n20MICRONS,20 Microns Limited,EQ,06-OCT-2008,5,1,INE144J01027,5\n";
const SME = "SYMBOL,NAME_OF_COMPANY,SERIES,DATE_OF_LISTING,PAID_UP_VALUE,ISIN_NUMBER,FACE_VALUE,\nCOREIN,Coreintegra Consulting Services Limited,ST,30-Sep-26,10,INE11ES01010,10,\n";

describe("parseSecurities", () => {
  it("reads the main-board list", () => {
    expect(parseSecurities(MAIN, "main")).toEqual([{ symbol: "20MICRONS", name: "20 Microns Limited", series: "EQ", board: "main", listing_date: "2008-10-06", isin: "INE144J01027", face_value: 5 }]);
  });
  it("reads the SME list, with its underscored headers and two-digit years", () => {
    expect(parseSecurities(SME, "sme")[0]).toMatchObject({ symbol: "COREIN", series: "ST", board: "sme", listing_date: "2026-09-30", isin: "INE11ES01010" });
  });
  it("skips malformed rows and a file that is not the list", () => {
    expect(parseSecurities(`${MAIN}<b>,x,EQ\n`, "main")).toHaveLength(1);
    expect(parseSecurities("<html>Access Denied</html>", "main")).toEqual([]);
  });
  it("reads both date forms and rejects others", () => {
    expect(listingDate("1-JAN-2000")).toBe("2000-01-01");
    expect(listingDate("2026-09-30")).toBeNull();
  });
});
