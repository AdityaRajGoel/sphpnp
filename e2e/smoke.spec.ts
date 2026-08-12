import { test, expect } from "@playwright/test";

// Critical-flow smoke tests. Deterministic: no assertions on live market data.

test("homepage renders hero and primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Trusted Partner");
  await expect(page.getByRole("link", { name: /open account/i }).first()).toBeVisible();
});

test("screener page loads with working filter UI", async ({ page }) => {
  await page.goto("/screener");
  await expect(page.locator("h1")).toContainText("Stock Screener");
  const search = page.getByPlaceholder("Search stock...");
  await expect(search).toBeVisible();
  await search.fill("TATA");
  // filters sync into the URL (shareable screens)
  await expect(page).toHaveURL(/q=TATA/);
});

test("learn article renders full content with styling", async ({ page }) => {
  await page.goto("/learn/demat-account");
  await expect(page.locator("h1")).toContainText("Demat Account");
  await expect(page.locator("article")).toContainText("Depository Participant");
  // typography plugin active (regression guard for the missing-prose bug)
  await expect(page.locator("article.prose, article[class*='prose']")).toHaveCount(1);
});

test("open-account page shows the lead form", async ({ page }) => {
  await page.goto("/open-account");
  await expect(page.locator("h1")).toContainText(/demat account/i);
  await expect(page.locator("input").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /submit|open|apply|get started|call/i }).first()).toBeVisible();
});

test("unknown learn slug redirects to the learning center", async ({ page }) => {
  await page.goto("/learn/this-does-not-exist");
  await expect(page).toHaveURL(/\/learn$/);
});

test("pricing page renders the full charges tables", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("h1")).toContainText("Brokerage Charges");
  await expect(page.getByText("0.15%").first()).toBeVisible();
  await expect(page.getByText("₹885 / year")).toBeVisible();
  await expect(page.getByText("Equity Options")).toBeVisible();
});

/**
 * Guards a class of bug that unit tests provably cannot see.
 *
 * react-fast-marquee is CJS-only, and Vite 8's rolldown interop handed the app
 * the module's `exports` object instead of the component. Rendering it threw
 * React error #130 and took the whole homepage down to the error boundary in
 * production - while all 304 unit tests passed, because Vitest transforms that
 * dependency through a different path that interops it correctly.
 *
 * Only a real browser running the real bundle can catch that, so this asserts
 * on uncaught exceptions and React errors directly rather than on any one
 * component. Routes are checked as a set because a broken interop surfaces
 * wherever the offending import happens to be rendered, not where it was
 * introduced.
 */
for (const route of ["/", "/screener", "/unlisted-space", "/learn", "/pricing"]) {
  test(`${route} renders with no uncaught errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      // Network noise is not what this test is about - an upstream feed being
      // down must not fail the build. React invariants and prop warnings are.
      if (/Failed to load resource|net::ERR|ERR_|status of 5\d\d|unavailable:/i.test(text)) return;
      errors.push(text);
    });

    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    // The ticker and other client-only widgets mount after first paint.
    await page.waitForTimeout(1500);

    expect(errors, `console/page errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
  });
}
