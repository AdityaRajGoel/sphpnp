import { describe, expect, it } from "vitest";
import { mcxName, mcxUnit } from "@/lib/mcx-data";

describe("MCX labels", () => {
  it("turns MCX quotation units into reader text", () => {
    expect(mcxUnit("10 GRMS")).toBe("per 10 g");
    expect(mcxUnit("1 KGS")).toBe("per kg");
    expect(mcxUnit("1 BBL")).toBe("per barrel");
    expect(mcxUnit("1 mmBtu")).toBe("per mmBtu");
    expect(mcxUnit("")).toBe("");
  });
  it("names contracts, falling back to the symbol", () => {
    expect(mcxName("GOLDM")).toBe("Gold Mini");
    expect(mcxName("NEWMETAL")).toBe("Newmetal");
  });
});
