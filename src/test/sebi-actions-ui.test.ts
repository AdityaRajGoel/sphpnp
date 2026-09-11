import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { splitSebiActions, isSebiLink, type SebiAction } from "@/lib/sebi-actions";

const action = (over: Partial<SebiAction>): SebiAction => ({
  category: "order", kind: "Order", title: "Order in the matter of X Limited", filed_on: "2024-01-01",
  url: "https://www.sebi.gov.in/enforcement/orders/x.html", ...over,
});

describe("splitSebiActions", () => {
  it("separates corporate actions from regulatory orders, newest first", () => {
    const { corporate, orders } = splitSebiActions([
      action({ category: "order", filed_on: "2021-09-20" }),
      action({ category: "buyback", kind: "Buyback", filed_on: "2022-12-06" }),
      action({ category: "buyback", kind: "Buyback", filed_on: "2025-11-10" }),
      action({ category: "order", filed_on: "2022-06-20" }),
    ]);
    expect(corporate.map((a) => a.filed_on)).toEqual(["2025-11-10", "2022-12-06"]);
    expect(orders.map((a) => a.filed_on)).toEqual(["2022-06-20", "2021-09-20"]);
  });
});

describe("isSebiLink", () => {
  it("renders only SEBI's own links", () => {
    expect(isSebiLink("https://www.sebi.gov.in/enforcement/orders/sep-2021/x.html")).toBe(true);
    expect(isSebiLink("javascript:alert(1)")).toBe(false);
  });
});
