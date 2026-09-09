import { test, expect } from "@playwright/test";

/*
 * Regression guard for "the banner won't close and makes problems".
 *
 * The banner's own close logic was never broken — verified in a real browser:
 * it dismisses, Radix restores `pointer-events` on <body>, and the page stays
 * clickable. What actually happens on a first visit is that TWO modal layers
 * open at once: the cookie-consent dialog (legally required, shown whenever no
 * decision is stored) and the admin-managed promo banner on top of it.
 *
 * Closing the banner therefore reveals a second dark overlay that is still
 * sitting there, which reads as "the banner didn't close" and leaves the page
 * feeling stuck behind a scrim.
 *
 * Consent must win: it gates data collection, so it is answered first and the
 * promotional banner waits its turn.
 */

const BANNER = [
  {
    id: "e2e-banner-1",
    title: "E2E Banner",
    message: "Stacking regression guard",
    type: "info",
    link_url: null,
    link_text: null,
    button_text: null,
    image_url: null,
    bg_theme: "default",
  },
];

/** The splash only self-hides for real browsers; unmask so this sees what a user sees. */
const asRealUser = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  await page.route("**/rest/v1/banner_messages*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(BANNER),
    }),
  );
};

const openDialogTitles = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="dialog"]'))
      .filter((d) => d instanceof HTMLElement && (d.offsetWidth || d.offsetHeight))
      .map((d) =>
        (
          d.getAttribute("aria-label") ||
          d.querySelector("h2, h3")?.textContent ||
          "untitled"
        )
          .trim()
          .slice(0, 40),
      ),
  );

test.describe("modal layering on the home page", () => {
  test.beforeEach(async ({ page }) => {
    await asRealUser(page);
  });

  test("only one modal is open at a time on a first visit", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);

    const open = await openDialogTitles(page);
    expect(
      open,
      `two modal layers stacked on first visit: ${open.join(" + ")}`,
    ).toHaveLength(1);
  });

  test("consent is the layer that gets shown first", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);

    const open = await openDialogTitles(page);
    expect(open[0]).toMatch(/privacy|cookie/i);
  });

  test("the promo banner appears only after consent is answered", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /accept|allow|essential|reject/i }).first().click();
    await page.waitForTimeout(2000);

    await expect(page.getByText("E2E Banner")).toBeVisible();
    expect(await openDialogTitles(page)).toHaveLength(1);
  });

  test("dismissing the banner leaves the page usable", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /accept|allow|essential|reject/i }).first().click();
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /close/i }).first().click();
    await page.waitForTimeout(1200);

    expect(await openDialogTitles(page)).toHaveLength(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe(
      "none",
    );
    await expect(page.getByRole("link", { name: /open account/i }).first()).toBeVisible();
  });
});
