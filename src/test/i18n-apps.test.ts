import { describe, it, expect } from "vitest";
import { APPS_EN, APPS_HI } from "@/i18n/apps";
import { fill, translations, NAV_LABEL_KEYS } from "@/i18n/config";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("apps translations", () => {
  it("has a Hindi string for every English one, and no strays", () => {
    expect(Object.keys(APPS_HI).sort()).toEqual(Object.keys(APPS_EN).sort());
  });

  it("keeps the same {placeholders} in both languages", () => {
    for (const key of Object.keys(APPS_EN)) expect(placeholders(APPS_HI[key]), key).toEqual(placeholders(APPS_EN[key]));
  });

  it("reaches the live translation table and the Apps nav label", () => {
    expect(translations.hi["apps.hero.tagline"]).toBe(APPS_HI["apps.hero.tagline"]);
    expect(translations.hi[NAV_LABEL_KEYS.Apps]).toBe("ऐप्स");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{rating}★ from {reviews} reviews", { rating: 3.9, reviews: 256 })).toBe("3.9★ from 256 reviews");
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
