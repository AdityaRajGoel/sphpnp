import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { insiderBoard, type BoardTrade } from "@/lib/insider-board";

const t = (symbol: string, transaction: string, value: number, mode = "Market Purchase", category: string | null = "Promoter Group"): BoardTrade =>
  ({ symbol, transaction, value, mode, category });

describe("insiderBoard", () => {
  it("nets buys against sells per company and ranks both sides", () => {
    const { buying, selling } = insiderBoard([
      t("A", "buy", 50), t("A", "sell", 20, "Market Sale"),
      t("B", "buy", 10),
      t("C", "sell", 90, "Market Sale", "Director"),
    ]);
    expect(buying.map((r) => [r.symbol, r.net])).toEqual([["A", 30], ["B", 10]]);
    expect(selling.map((r) => [r.symbol, r.net, r.promoterNet])).toEqual([["C", -90, 0]]);
  });

  it("ignores ESOP exercises, gifts, pledges and missing values", () => {
    const { buying, selling } = insiderBoard([
      t("A", "buy", 500, "ESOP"), t("A", "buy", 5, "Gift"), t("A", "pledge", 5), t("A", "buy", 0),
    ]);
    expect(buying).toEqual([]);
    expect(selling).toEqual([]);
  });
});
