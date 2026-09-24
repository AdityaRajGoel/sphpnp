import { describe, it, expect } from "vitest";
import { BANK, virtualAccountFor } from "@/lib/fund-transfer";

describe("virtualAccountFor", () => {
  it("builds the published example: CSAMB -> PRSM99CSAMB", () => {
    expect(virtualAccountFor("CSAMB")).toEqual({ ok: true, code: "CSAMB", account: "PRSM99CSAMB" });
  });

  it("normalises case and surrounding spaces", () => {
    expect(virtualAccountFor("  csamb ")).toEqual({ ok: true, code: "CSAMB", account: "PRSM99CSAMB" });
  });

  it("accepts digits and codes of the templated eight characters", () => {
    expect(virtualAccountFor("AB12CD34")).toMatchObject({ ok: true, account: "PRSM99AB12CD34" });
  });

  it("rejects anything that is not a plain code", () => {
    expect(virtualAccountFor("")).toMatchObject({ ok: false });
    expect(virtualAccountFor("CS-AMB")).toMatchObject({ ok: false });
    expect(virtualAccountFor("CS AMB")).toMatchObject({ ok: false });
    expect(virtualAccountFor("ABCDEFGHIJKLMNOPQ")).toMatchObject({ ok: false });
  });
});

describe("published bank details", () => {
  // Pinned on purpose: these must only change when the parent page does.
  it("match parasramindia.com/fund-transfer as checked", () => {
    expect(BANK).toMatchObject({
      pooledAccount: "00030340008301",
      ifsc: "HDFC0000003",
      micr: "400234009",
      virtualPrefix: "PRSM99",
    });
  });
});
