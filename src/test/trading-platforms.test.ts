import { describe, it, expect } from "vitest";
import { TRADING_PLATFORMS } from "@/lib/trading-platforms";
import { translations } from "@/i18n/config";

describe("TRADING_PLATFORMS", () => {
  it("offers Parasram Trade and Parasram Money at their exact addresses", () => {
    expect(TRADING_PLATFORMS.map((p) => p.href)).toEqual([
      "https://webtrade.parasramindia.com/#!/app",
      "https://money.parasramindia.com:28001/",
    ]);
  });

  it("names each platform by the host its link opens", () => {
    for (const p of TRADING_PLATFORMS) expect(new URL(p.href).hostname).toBe(p.host);
  });

  it("has a label in every language", () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const p of TRADING_PLATFORMS) expect(translations[lang][p.labelKey], `${lang} ${p.labelKey}`).toBeTruthy();
    }
  });
});
