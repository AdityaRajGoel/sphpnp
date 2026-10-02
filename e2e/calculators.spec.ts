import { test, expect } from "@playwright/test";

// The calculator pack: every page renders its heading and an answer with no
// console or page errors, and XIRR says so, instead of printing NaN, when the
// flows cannot be solved.
const ROUTES = [
  "/calculators", "/lumpsum-calculator", "/step-up-sip-calculator", "/swp-calculator", "/cagr-calculator", "/xirr-calculator",
  "/stock-average-calculator", "/capital-gains-tax-calculator", "/option-value-calculator", "/income-tax-calculator",
  "/tax-saving-investments", "/tax-loss-harvesting-calculator",
];

for (const route of ROUTES) {
  test(`${route} renders with no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource|net::ERR|ERR_|status of 5\d\d|unavailable:/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText("NaN");
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("XIRR explains an unsolvable set of flows", async ({ page }) => {
  // The splash stays up under webdriver (main.tsx) and would take the clicks;
  // unmask so it fades as it does for a reader.
  await page.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  await page.goto("/xirr-calculator");
  await expect(page.getByText("XIRR (annualised)")).toBeVisible();
  for (const name of ["Cash flow 3 direction", "Cash flow 4 direction"]) {
    await page.getByRole("group", { name }).getByRole("button", { name: "Paid in" }).click();
  }
  await expect(page.getByText("No return could be worked out")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("NaN");
});
