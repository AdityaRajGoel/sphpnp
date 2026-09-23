import { describe, it, expect } from "vitest";
import { TRADING_APPS, appById } from "@/lib/trading-apps";
import { TRADING_PLATFORMS } from "@/lib/trading-platforms";

describe("TRADING_APPS", () => {
  it("links each app to its exact store listings", () => {
    expect(appById("money").playHref).toBe("https://play.google.com/store/apps/details?id=com.saral_info.moneymakerapi.parasrammoney");
    expect(appById("money").iosHref).toBe("https://apps.apple.com/in/app/parasram-money/id6753166585");
    expect(appById("trade").playHref).toBe("https://play.google.com/store/apps/details?id=com.parasramindia.xts");
    expect(appById("trade").iosHref).toBe("https://apps.apple.com/us/app/parasram-trade/id1564728869");
  });

  it("sends each app's web link to the matching Web Trade platform", () => {
    expect(TRADING_APPS.map((a) => a.webHref).sort()).toEqual(TRADING_PLATFORMS.map((p) => p.href).sort());
    expect(new URL(appById("money").webHref).hostname).toBe("money.parasramindia.com");
  });

  it("features Parasram Money first as the new app", () => {
    expect(TRADING_APPS[0].id).toBe("money");
    expect(TRADING_APPS.filter((a) => a.isNew).map((a) => a.id)).toEqual(["money"]);
  });
});
