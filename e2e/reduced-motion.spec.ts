import { test, expect } from "@playwright/test";

/*
 * Regression guard for the "animations don't work on Linux" bug.
 *
 * GNOME's "Reduce Animation" toggle (and GTK's `enable-animations=false`, which
 * several distros and most VMs ship as the default) makes Chrome and Firefox
 * report `prefers-reduced-motion: reduce`. Users never opted in — their desktop
 * did it for them — and a blanket `*{transition-duration:.01ms!important}` then
 * strips every one of the site's ~477 transitions, leaving a completely static
 * page.
 *
 * The fix is not to stop honouring the preference. WCAG 2.3.3 targets
 * large-scale motion — parallax, scroll reveals, autoplay loops, momentum
 * scrolling — not a 140ms hover fade, which carries no vestibular risk and
 * whose absence just reads as a broken interface.
 *
 * So these tests pin both halves of that line: decorative motion must go, and
 * interaction feedback must survive.
 */

/** `--duration-press` is 140ms. Anything above this reads as a real transition. */
const FEEDBACK_MIN_SECONDS = 0.05;

const computed = (selector: string, prop: string) =>
  `(() => {
     const el = document.querySelector(${JSON.stringify(selector)});
     return el ? getComputedStyle(el).getPropertyValue(${JSON.stringify(prop)}) : null;
   })()`;

/*
 * NOTE: `test.use({ reducedMotion })` is a silent no-op in Playwright 1.61.1 —
 * it sets nothing and fails open, so a suite written against it looks like it
 * covers the reduce path while actually testing the default one. `emulateMedia`
 * is applied explicitly per page instead; the first test in each block asserts
 * the emulation really took, so this can never silently rot again.
 */
test.describe("reduced motion: reduce", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the browser preference is actually being emulated", async ({ page }) => {
    await page.goto("/");
    const matches = await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(matches).toBe(true);
  });

  test("interaction feedback still animates", async ({ page }) => {
    await page.goto("/");

    // Every Button carries `duration-press` from its cva base classes.
    const button = page.locator(".duration-press").first();
    await expect(button).toBeAttached();

    const duration = await button.evaluate(
      (el) => parseFloat(getComputedStyle(el).transitionDuration) || 0,
    );

    expect(
      duration,
      "press/hover feedback must survive reduced motion — killing it makes the UI feel broken",
    ).toBeGreaterThanOrEqual(FEEDBACK_MIN_SECONDS);
  });

  test("focus-visible feedback still animates", async ({ page }) => {
    await page.goto("/");

    // Focused explicitly rather than by pressing Tab: the first tab stop is
    // whatever the header happens to render first (a skip link, at time of
    // writing), which makes the assertion depend on markup order instead of on
    // the motion policy being tested.
    const button = page.locator(".duration-press").first();
    await expect(button).toBeAttached();
    await button.focus();

    const duration = await button.evaluate(
      (el) => parseFloat(getComputedStyle(el).transitionDuration) || 0,
    );

    expect(
      duration,
      "focus feedback is itself an accessibility feature and must not be stripped",
    ).toBeGreaterThanOrEqual(FEEDBACK_MIN_SECONDS);
  });

  /*
   * Asserted as a policy over the whole page rather than against named
   * components: `.hero-aurora` is conditionally unmounted under reduced motion
   * (Hero.tsx:342) and lazy sections may not have mounted yet, so pinning class
   * names tests the fixture, not the rule. What actually matters is that no
   * ambient loop is left running anywhere.
   */
  test("no ambient looping animation runs anywhere on the page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const looping = await page.evaluate(() =>
      Array.from(document.querySelectorAll("body *"))
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.animationName === "none") return false;
          if (cs.animationIterationCount !== "infinite") return false;
          return (parseFloat(cs.animationDuration) || 0) > 0.01;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80))
        .slice(0, 10),
    );

    expect(
      looping,
      "ambient loops are exactly the motion the preference exists to stop",
    ).toEqual([]);
  });

  test("momentum scrolling is disabled", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);

    const rootClass = await page.evaluate(() => document.documentElement.className);
    expect(rootClass, "Lenis must not drive the scroll under reduced motion").not.toContain(
      "lenis",
    );
  });
});

test.describe("reduced motion: no-preference", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("the browser preference is actually being emulated", async ({ page }) => {
    await page.goto("/");
    expect(
      await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
    ).toBe(false);
  });

  test("decorative motion runs when the user has no preference", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero-aurora")).toBeAttached();

    const animation = await page.evaluate(computed(".hero-aurora", "animation-name"));
    expect(animation).not.toBe("none");
  });

  test("interaction feedback runs when the user has no preference", async ({ page }) => {
    await page.goto("/");
    const button = page.locator(".duration-press").first();
    await expect(button).toBeAttached();

    const duration = await button.evaluate(
      (el) => parseFloat(getComputedStyle(el).transitionDuration) || 0,
    );
    expect(duration).toBeGreaterThanOrEqual(FEEDBACK_MIN_SECONDS);
  });
});

/*
 * The override exists for the case that caused this bug: a desktop reporting
 * `reduce` on behalf of a user who never asked for it. Honouring the OS by
 * default is right; offering no way out is not.
 */
test.describe("motion override", () => {
  test("a user can force motion back on despite the OS preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("motion-preference", "on"));
    await page.goto("/");
    await page.waitForTimeout(1200);

    const loopingCount = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("body *")).filter((el) => {
          const cs = getComputedStyle(el);
          return (
            cs.animationName !== "none" &&
            cs.animationIterationCount === "infinite" &&
            (parseFloat(cs.animationDuration) || 0) > 0.01
          );
        }).length,
    );

    expect(
      loopingCount,
      "an explicit opt-in must beat the media query the desktop set on the user's behalf",
    ).toBeGreaterThan(0);
  });

  test("a user can force motion off despite having no OS preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => localStorage.setItem("motion-preference", "off"));
    await page.goto("/");
    await page.waitForTimeout(1200);

    const loopingCount = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("body *")).filter((el) => {
          const cs = getComputedStyle(el);
          return (
            cs.animationName !== "none" &&
            cs.animationIterationCount === "infinite" &&
            (parseFloat(cs.animationDuration) || 0) > 0.01
          );
        }).length,
    );

    expect(loopingCount, "an explicit opt-out must be honoured too").toBe(0);
  });

  test("momentum scrolling follows the override, not the media query", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("motion-preference", "on"));
    await page.goto("/");
    await page.waitForTimeout(1200);

    const rootClass = await page.evaluate(() => document.documentElement.className);
    expect(rootClass).toContain("lenis");
  });
});

/*
 * Toggling motion must update the page, not rebuild it.
 *
 * SmoothScroll returned either <ReactLenis>{children}</ReactLenis> or a bare
 * fragment depending on whether motion was enabled. Those are different
 * component types at the same position, so flipping the preference made React
 * unmount and remount the entire app: every lazy section re-suspended, all
 * component state was lost and every reveal replayed. That was invisible while
 * the value came only from the OS and never changed mid-session; the in-app
 * toggle made it a thing a user does, and it read as the page hanging.
 */
test.describe("motion toggle cost", () => {
  test("toggling motion does not remount the page", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // main.tsx deliberately leaves the splash in place when navigator.webdriver
    // is true, so the prerendered HTML keeps it. Unmasked, #app-splash sits over
    // the whole page and swallows the click this test needs to make.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      localStorage.setItem("motion-preference", "on");
    });
    await page.goto("/");
    await page.waitForTimeout(2500);

    // Tag a node React does not own. If the subtree is remounted the tag is
    // gone; if it is merely re-rendered the same DOM node survives.
    await page.evaluate(() => {
      const el = document.querySelector("main section");
      if (el) el.setAttribute("data-remount-probe", "1");
    });
    expect(await page.locator("[data-remount-probe]").count()).toBe(1);

    await page.getByRole("button", { name: /reduce animations|turn on animations/i }).click();
    await page.waitForTimeout(1200);

    expect(
      await page.locator("[data-remount-probe]").count(),
      "flipping the motion preference rebuilt the page instead of updating it",
    ).toBe(1);
  });
});
