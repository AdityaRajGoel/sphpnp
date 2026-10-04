import { describe, it, expect } from "vitest";
import { parse52Week } from "../../supabase/functions/_shared/nse-52wk";

/* Head of NSE's CM_52_wk_High_low_30092026.csv, verbatim (the first two lines are notes). */
const FILE = [
  '"Disclaimer - The Data provided in the adjusted 52 week high and adjusted 52 week low columns  are adjusted for corporate actions (bonus, splits & rights).For actual (unadjusted) 52 week high & low prices, kindly refer bhavcopy."',
  '"Effective for 30-Sep-2026"',
  '"SYMBOL","SERIES","Adjusted_52_Week_High","52_Week_High_Date","Adjusted_52_Week_Low","52_Week_Low_DT"',
  '"1STCUS$","EQ","-","-","-","-"',
  '"20MICRONS","EQ","    237.40","26-DEC-2025","    129.61","30-MAR-2026"',
  '"21STCENMGM","EQ","     53.79","29-DEC-2025","     28.25","06-APR-2026"',
  '"SOMEBOND","N1","   1000.00","01-JAN-2026","    990.00","02-FEB-2026"',
  '"SMESTOCK","SM","     88.00","15-JUL-2026","     41.10","05-NOV-2025"',
].join("\r\n");

describe("parse52Week", () => {
  const out = parse52Week(FILE);

  it("reads the effective date from the note line", () => {
    expect(out.effectiveDate).toBe("2026-09-30");
  });

  it("parses padded prices and NSE dates", () => {
    expect(out.rows.find((r) => r.symbol === "20MICRONS")).toEqual({
      symbol: "20MICRONS", series: "EQ", high_52: 237.4, high_date: "2025-12-26", low_52: 129.61, low_date: "2026-03-30",
    });
  });

  it("drops rows with no range ('-') and non-equity series", () => {
    const symbols = out.rows.map((r) => r.symbol);
    expect(symbols).not.toContain("1STCUS$");
    expect(symbols).not.toContain("SOMEBOND");
    expect(symbols).toEqual(["20MICRONS", "21STCENMGM", "SMESTOCK"]);
  });

  it("returns nothing for a file that is not the 52-week report", () => {
    expect(parse52Week("<html>blocked</html>")).toEqual({ effectiveDate: null, rows: [] });
  });
});
