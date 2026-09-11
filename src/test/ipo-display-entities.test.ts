import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { decodeEntities } from "@/lib/ipo";

/* Chittorgarh left some entities encoded in stored IPO page text ("&minus; Anchor Investor"). */
describe("decodeEntities", () => {
  it("decodes entities a source left in stored text", () => {
    expect(decodeEntities("&minus; Anchor Investor")).toBe("− Anchor Investor");
    expect(decodeEntities("A &amp; B &#8377;5")).toBe("A & B ₹5");
    expect(decodeEntities("&unknown; stays")).toBe("&unknown; stays");
    expect(decodeEntities("plain")).toBe("plain");
  });
});

describe("decodeEntities - malformed code points", () => {
  it("drops an entity no character has rather than throwing", () => {
    expect(decodeEntities("a&#99999999;b")).toBe("ab");
    expect(decodeEntities("a&#x110000;b")).toBe("ab");
  });
});
