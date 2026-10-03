import { describe, expect, it } from "vitest";
import { decodeEntities } from "../../supabase/functions/_shared/html-entities";

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Tata &amp; Sons &#8211; &#x27;A&#39; &quot;B&quot;&nbsp;&lt;C&gt;")).toBe("Tata & Sons – 'A' \"B\" <C>");
  });
  it("decodes once, so an escaped entity stays an entity", () => {
    expect(decodeEntities("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
  });
  it("leaves unknown names and impossible code points alone or empty", () => {
    expect(decodeEntities("&bogus; &#0; &#x110000;")).toBe("&bogus;  ");
  });
});
