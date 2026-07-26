# Motion Sweep Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every animation on the site onto the motion token scale, so the same gesture behaves the same way on every page.

**Architecture:** Two ratchet guards — automated tests that enumerate remaining violations against a shrinking allowlist. Each migration task deletes its files from the allowlist, so the suite stays green after every task and no new violations can be introduced. The sweep is finished when both allowlists are empty.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind 3, `motion` (Framer) v12, Vitest 3 + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-25-ui-motion-sweep-design.md`
**Branch:** `feat/ui-motion-sweep` (already created; spec committed at `266d40c`)

## Global Constraints

- Do not change layout, brand, copy, or routes. This is a consistency sweep, not a redesign.
- Do not touch `scripts/prerender.js`, `scripts/generate-sitemap.js`, or `public/sitemap.xml`. SEO-critical.
- Do not touch any file under `supabase/functions/`.
- Do not touch form submit logic. Forms are Plan 2. Where a form file appears here, only its reveal animation changes.
- `tsc --noEmit`, `npm test`, and `npm run build` must all pass before every commit.
- Never animate layout-bound properties (`width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`). Transform and opacity only.
- Reduced motion is already handled globally by `<MotionConfig reducedMotion="user">` in `src/App.tsx:196`. Do not re-implement it per component.

## Token reference

Defined in `src/index.css` and exposed through `tailwind.config.ts`:

| Tailwind class | CSS var | Value |
|---|---|---|
| `duration-press` | `--duration-press` | 140ms |
| `duration-fast` | `--duration-fast` | 180ms |
| `duration-base` | `--duration-base` | 240ms |
| `duration-slow` | `--duration-slow` | 360ms |
| `ease-out` | `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `ease-in-out` | `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` |
| `ease-drawer` | `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` |

**Migration mapping — apply exactly this, do not improvise:**

| Found | Replace with |
|---|---|
| `duration-200` | `duration-fast` |
| `duration-300` | `duration-base` |
| `duration-500` | `duration-slow` |
| `duration-1000` | See Task 2 (ambient exception) |
| `duration-700` | `duration-slow` |

JS-side presets in `src/lib/motion.ts`: `EASE_OUT`, `EASE_IN_OUT`, `EASE_DRAWER`, `DURATION`, `REVEAL_Y`, `STAGGER`, `revealSection`, `revealItem(index)`.

---

### Task 1: Duration ratchet guard

Builds the guard that makes the whole sweep safe. It must go green immediately, with today's 34 violating files recorded as the starting allowlist.

**Files:**
- Create: `src/test/motion-tokens.test.ts`
- Create: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DURATION_ALLOWLIST: readonly string[]` and `REVEAL_ALLOWLIST: readonly string[]` from `src/test/motion-allowlist.ts`. Every later task deletes entries from these two arrays. Paths are repo-relative POSIX, e.g. `src/components/Services.tsx`.

- [ ] **Step 1: Write the allowlist module**

Create `src/test/motion-allowlist.ts`:

```ts
/**
 * Ratchet allowlists for the motion sweep.
 *
 * These are the files that still violate the motion token rules. They shrink
 * to empty as the sweep proceeds and must never grow. `motion-tokens.test.ts`
 * fails both if a file outside the list violates (a regression) and if a file
 * on the list no longer violates (a stale entry), so deleting an entry is a
 * required part of migrating a file.
 */

/** Files still containing hardcoded `duration-<number>` Tailwind classes. */
export const DURATION_ALLOWLIST: readonly string[] = [
  "src/components/AIAnalysisModal.tsx",
  "src/components/About.tsx",
  "src/components/AnnouncementBar.tsx",
  "src/components/AwardsSection.tsx",
  "src/components/BannerMessage.tsx",
  "src/components/ClientMarquee.tsx",
  "src/components/Contact.tsx",
  "src/components/DailyResearch.tsx",
  "src/components/FloatingActions.tsx",
  "src/components/GoogleReviews.tsx",
  "src/components/InvestmentProducts.tsx",
  "src/components/InvestmentTools.tsx",
  "src/components/MarketNews.tsx",
  "src/components/MarketOverview.tsx",
  "src/components/MobileApp.tsx",
  "src/components/ScrollySteps.tsx",
  "src/components/Services.tsx",
  "src/components/TelegramChannel.tsx",
  "src/components/Testimonials.tsx",
  "src/components/ThemeToggle.tsx",
  "src/components/UnlistedShares.tsx",
  "src/components/WhatsAppButton.tsx",
  "src/components/WhyChooseUs.tsx",
  "src/components/ui/accordion.tsx",
  "src/components/ui/alert-dialog.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/input-otp.tsx",
  "src/components/ui/navigation-menu.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/sidebar.tsx",
  "src/pages/BrokerageCalculatorPage.tsx",
  "src/pages/ContactPage.tsx",
  "src/pages/DepositoryServicesPage.tsx",
  "src/pages/TeamPage.tsx",
];

/** Files still hand-rolling `whileInView` reveals instead of using the presets. */
export const REVEAL_ALLOWLIST: readonly string[] = [
  "src/components/AwardsSection.tsx",
  "src/components/BecomePartner.tsx",
  "src/components/CompanyTimeline.tsx",
  "src/components/CompanyValues.tsx",
  "src/components/ContactForm.tsx",
  "src/components/DailyResearch.tsx",
  "src/components/FAQ.tsx",
  "src/components/Footer.tsx",
  "src/components/HowItWorks.tsx",
  "src/components/IPOTracker.tsx",
  "src/components/InvestmentTools.tsx",
  "src/components/LiveChart.tsx",
  "src/components/MarketDashboard.tsx",
  "src/components/MarketNews.tsx",
  "src/components/MarketOverview.tsx",
  "src/components/MobileApp.tsx",
  "src/components/SIPCalculator.tsx",
  "src/components/TelegramChannel.tsx",
  "src/components/TrustBadges.tsx",
  "src/pages/ArticlePage.tsx",
  "src/pages/BrokerageCalculatorPage.tsx",
  "src/pages/ContactPage.tsx",
  "src/pages/DepositoryServicesPage.tsx",
  "src/pages/HolidayCalendarPage.tsx",
  "src/pages/OpenAccountPage.tsx",
  "src/pages/PricingPage.tsx",
  "src/pages/ProductsPage.tsx",
  "src/pages/ReportsPage.tsx",
  "src/pages/UnlistedZonePage.tsx",
];
```

- [ ] **Step 2: Write the guard test**

Create `src/test/motion-tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { DURATION_ALLOWLIST, REVEAL_ALLOWLIST } from "./motion-allowlist";

/** Vitest runs from the repo root, so cwd is the right anchor. */
const ROOT = process.cwd();

/** Hardcoded Tailwind duration, e.g. `duration-300`. Token durations are named. */
const HARDCODED_DURATION = /\bduration-\d+\b/;

/** A `whileInView` prop written by hand rather than spread from a preset. */
const HAND_ROLLED_REVEAL = /whileInView=\{\{/;

/**
 * Walk `src/` for .tsx files. Hand-rolled rather than using fs.globSync or
 * readdirSync({recursive:true}), both of which need a newer Node than this
 * repo pins. Returns repo-relative POSIX paths so they match the allowlist.
 */
function sourceFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out.sort();
}

function violating(pattern: RegExp): string[] {
  return sourceFiles().filter((f) =>
    pattern.test(readFileSync(join(ROOT, f), "utf8")),
  );
}

describe("motion token ratchet", () => {
  it("has no hardcoded durations outside the allowlist", () => {
    const unexpected = violating(HARDCODED_DURATION).filter(
      (f) => !DURATION_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
  });

  it("has no stale entries in the duration allowlist", () => {
    const actual = violating(HARDCODED_DURATION);
    const stale = DURATION_ALLOWLIST.filter((f) => !actual.includes(f));
    expect(stale).toEqual([]);
  });

  it("has no hand-rolled reveals outside the allowlist", () => {
    const unexpected = violating(HAND_ROLLED_REVEAL).filter(
      (f) => !REVEAL_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
  });

  it("has no stale entries in the reveal allowlist", () => {
    const actual = violating(HAND_ROLLED_REVEAL);
    const stale = REVEAL_ALLOWLIST.filter((f) => !actual.includes(f));
    expect(stale).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the guard and confirm it is green**

Run: `npm test -- motion-tokens`
Expected: 4 tests PASS. The allowlists exactly describe today's violations.

If "stale entries" fails, the listed files no longer violate — delete them from the allowlist. If "outside the allowlist" fails, the listed files were missed — add them. Either way the allowlist must end up matching reality before moving on.

- [ ] **Step 4: Prove the guard actually catches a regression**

A guard that cannot fail is worthless. Temporarily add `duration-300` to a class string in `src/components/Header.tsx` (not on either allowlist).

Run: `npm test -- motion-tokens`
Expected: FAIL on "no hardcoded durations outside the allowlist", listing `src/components/Header.tsx`.

Now revert that edit.

Run: `npm test -- motion-tokens`
Expected: PASS again.

- [ ] **Step 5: Commit**

```bash
git add src/test/motion-tokens.test.ts src/test/motion-allowlist.ts
git commit -m "test: add ratchet guard for motion token violations"
```

---

### Task 2: Extend presets for the ambient case

Two `duration-1000` uses exist (`ClientMarquee`, one other). They are ambient decorative loops, not UI feedback, and the capped UI scale is deliberately wrong for them. Give them a real token rather than an unexplained exemption.

**Files:**
- Modify: `src/index.css` (token block added at `49b6d7e`)
- Modify: `tailwind.config.ts` (`transitionDuration` block)
- Modify: `src/lib/motion.ts`
- Test: `src/test/motion-presets.test.ts` (create)

**Interfaces:**
- Consumes: `DURATION` from `src/lib/motion.ts`.
- Produces: `--duration-ambient` CSS var, `duration-ambient` Tailwind class, and `DURATION.ambient` (seconds) for JS consumers.

- [ ] **Step 1: Write the failing test**

Create `src/test/motion-presets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DURATION, REVEAL_Y, STAGGER, revealItem } from "@/lib/motion";

describe("motion presets", () => {
  it("keeps every interactive duration under 250ms", () => {
    const interactive = [DURATION.press, DURATION.fast, DURATION.base, DURATION.slow];
    for (const d of interactive) {
      expect(d).toBeLessThanOrEqual(0.36);
    }
  });

  it("exposes an ambient duration for decorative loops", () => {
    expect(DURATION.ambient).toBe(1);
  });

  it("staggers items without gating interaction", () => {
    expect(STAGGER).toBeLessThanOrEqual(0.08);
    expect(revealItem(5).transition.delay).toBeCloseTo(5 * STAGGER);
  });

  it("reveals items a shorter distance than whole sections", () => {
    expect(REVEAL_Y.item).toBeLessThan(REVEAL_Y.section);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- motion-presets`
Expected: FAIL — "exposes an ambient duration" gets `undefined`, expected `1`.

- [ ] **Step 3: Add the token**

In `src/index.css`, immediately after the `--duration-slow: 360ms;` line:

```css
    /* Decorative loops only — marquees, ambient pulses. Never UI feedback.
       The capped UI scale above is deliberately too fast for these. */
    --duration-ambient: 1000ms;
```

In `tailwind.config.ts`, inside `transitionDuration`, after the `slow` entry:

```ts
        ambient: "var(--duration-ambient)",
```

In `src/lib/motion.ts`, inside the `DURATION` object, after `reveal`:

```ts
  /** Decorative loops only — marquees, ambient pulses. Never UI feedback. */
  ambient: 1,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- motion-presets`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.css tailwind.config.ts src/lib/motion.ts src/test/motion-presets.test.ts
git commit -m "feat(motion): add ambient duration token for decorative loops"
```

---

### Task 3: Migrate durations in shadcn primitives

7 files, 10 occurrences. Done first and alone because these primitives render on every page, so a mistake here is immediately visible everywhere — which is exactly what you want from the first batch.

**Files:**
- Modify: `src/components/ui/sidebar.tsx` (3), `src/components/ui/sheet.tsx` (2), `src/components/ui/navigation-menu.tsx` (1), `src/components/ui/input-otp.tsx` (1), `src/components/ui/dialog.tsx` (1), `src/components/ui/alert-dialog.tsx` (1), `src/components/ui/accordion.tsx` (1)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `DURATION_ALLOWLIST` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Find every occurrence**

Run: `grep -rn "duration-[0-9]" src/components/ui/`
Expected: 10 matches across the 7 files above.

- [ ] **Step 2: Apply the mapping**

For each match, substitute per the mapping table in Global Constraints (`duration-200`→`duration-fast`, `duration-300`→`duration-base`, `duration-500`→`duration-slow`, `duration-700`→`duration-slow`).

Change only the duration token. Do not touch easing, transform values, or any other class in the same string.

Sheets and drawers travel a long distance — where a `sheet.tsx` or `sidebar.tsx` transition has no explicit easing, also add `ease-drawer`. That is the curve that exists for exactly this case.

- [ ] **Step 3: Delete these files from the allowlist**

In `src/test/motion-allowlist.ts`, remove these 7 lines from `DURATION_ALLOWLIST`:

```
  "src/components/ui/accordion.tsx",
  "src/components/ui/alert-dialog.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/input-otp.tsx",
  "src/components/ui/navigation-menu.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/sidebar.tsx",
```

- [ ] **Step 4: Verify**

Run: `npm test -- motion-tokens`
Expected: PASS. A "stale entries" failure means a file still has a hardcoded duration — go back to Step 2. An "outside the allowlist" failure means a typo introduced a new one.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Check it by eye**

Run: `npm run dev`, then open a dialog, the mobile nav sheet, and an accordion.
Expected: all still animate, sheets feel like they decelerate into place rather than stopping abruptly. Nothing snaps instantly or crawls.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): move shadcn primitives onto duration tokens"
```

---

### Task 4: Migrate durations in marketing components

5 files, 26 occurrences — the densest batch.

**Files:**
- Modify: `src/components/Services.tsx` (6), `src/components/InvestmentProducts.tsx` (6), `src/components/Contact.tsx` (6), `src/components/WhyChooseUs.tsx` (4), `src/components/Testimonials.tsx` (4)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `DURATION_ALLOWLIST` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Find every occurrence**

```bash
grep -rn "duration-[0-9]" src/components/Services.tsx src/components/InvestmentProducts.tsx \
  src/components/Contact.tsx src/components/WhyChooseUs.tsx src/components/Testimonials.tsx
```

Expected: 26 matches.

- [ ] **Step 2: Apply the mapping**

Substitute per the mapping table. Duration token only — leave easing and transforms alone.

- [ ] **Step 3: Delete these 5 files from `DURATION_ALLOWLIST`**

Remove the lines for `Contact.tsx`, `InvestmentProducts.tsx`, `Services.tsx`, `Testimonials.tsx`, `WhyChooseUs.tsx`.

- [ ] **Step 4: Verify**

Run: `npm test -- motion-tokens` → PASS
Run: `npx tsc --noEmit` → no output

- [ ] **Step 5: Check it by eye**

Run `npm run dev` and scroll the homepage through the Services, Products, Why-Choose-Us and Testimonials sections. Hover the cards.
Expected: hover and reveal timing now feel identical between sections. Previously they did not.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): move marketing sections onto duration tokens"
```

---

### Task 5: Migrate durations in market-data components

6 files, 16 occurrences.

**Files:**
- Modify: `src/components/MarketNews.tsx` (4), `src/components/DailyResearch.tsx` (4), `src/components/MarketOverview.tsx` (3), `src/components/AIAnalysisModal.tsx` (2), `src/components/InvestmentTools.tsx` (2), `src/components/UnlistedShares.tsx` (1)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `DURATION_ALLOWLIST` from Task 1.
- Produces: nothing new.

`AIAnalysisModal.tsx` is 1281 lines. Change only the two duration classes in it. Its form logic belongs to Plan 2 — do not touch it.

- [ ] **Step 1: Find every occurrence**

```bash
grep -rn "duration-[0-9]" src/components/MarketNews.tsx src/components/DailyResearch.tsx \
  src/components/MarketOverview.tsx src/components/AIAnalysisModal.tsx \
  src/components/InvestmentTools.tsx src/components/UnlistedShares.tsx
```

Expected: 16 matches.

- [ ] **Step 2: Apply the mapping**

Substitute per the mapping table.

- [ ] **Step 3: Delete these 6 files from `DURATION_ALLOWLIST`**

- [ ] **Step 4: Verify**

Run: `npm test -- motion-tokens` → PASS
Run: `npx tsc --noEmit` → no output

- [ ] **Step 5: Check it by eye**

Run `npm run dev`, visit the homepage market sections and open the AI analysis modal.
Expected: modal still opens and animates; live-updating tickers are unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): move market-data components onto duration tokens"
```

---

### Task 6: Migrate durations in site chrome

7 files, 13 occurrences. Persistent chrome — visible on every route.

**Files:**
- Modify: `src/components/WhatsAppButton.tsx` (3), `src/components/FloatingActions.tsx` (3), `src/components/AnnouncementBar.tsx` (2), `src/components/BannerMessage.tsx` (1), `src/components/ThemeToggle.tsx` (1), `src/components/ClientMarquee.tsx` (1), `src/components/ScrollySteps.tsx` (2)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `DURATION_ALLOWLIST` from Task 1, `duration-ambient` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Find every occurrence**

```bash
grep -rn "duration-[0-9]" src/components/WhatsAppButton.tsx src/components/FloatingActions.tsx \
  src/components/AnnouncementBar.tsx src/components/BannerMessage.tsx \
  src/components/ThemeToggle.tsx src/components/ClientMarquee.tsx src/components/ScrollySteps.tsx
```

Expected: 13 matches.

- [ ] **Step 2: Apply the mapping, with the ambient exception**

Standard mapping for all of them, except: any `duration-1000` on a continuous decorative loop (the `ClientMarquee` scroll) becomes `duration-ambient`, not `duration-slow`. Collapsing a 1s marquee to 360ms would make it visibly frantic.

Add a short comment at each `duration-ambient` use saying why it is exempt from the UI scale.

- [ ] **Step 3: Delete these 7 files from `DURATION_ALLOWLIST`**

- [ ] **Step 4: Verify**

Run: `npm test -- motion-tokens` → PASS
Run: `npx tsc --noEmit` → no output

- [ ] **Step 5: Check it by eye**

Run `npm run dev`. Watch the client marquee for a full cycle, toggle the theme, scroll to trigger the floating actions and the sticky CTA.
Expected: marquee speed unchanged from before the edit. Theme toggle and floating buttons feel snappier.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): move site chrome onto duration tokens"
```

---

### Task 7: Migrate remaining durations

9 files, 13 occurrences. Empties `DURATION_ALLOWLIST`.

**Files:**
- Modify: `src/components/GoogleReviews.tsx` (2), `src/components/AwardsSection.tsx` (2), `src/components/MobileApp.tsx` (2), `src/components/About.tsx` (1), `src/components/TelegramChannel.tsx` (1), `src/pages/TeamPage.tsx` (2), `src/pages/DepositoryServicesPage.tsx` (1), `src/pages/ContactPage.tsx` (1), `src/pages/BrokerageCalculatorPage.tsx` (1)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `DURATION_ALLOWLIST` from Task 1.
- Produces: an empty `DURATION_ALLOWLIST`.

- [ ] **Step 1: Find every remaining occurrence**

Run: `grep -rn "duration-[0-9]" src/`
Expected: 13 matches, in exactly the 9 files above and nowhere else.

- [ ] **Step 2: Apply the mapping**

- [ ] **Step 3: Empty the duration allowlist**

`DURATION_ALLOWLIST` becomes:

```ts
export const DURATION_ALLOWLIST: readonly string[] = [];
```

Leave `REVEAL_ALLOWLIST` untouched — Tasks 8 and 9 still need it.

- [ ] **Step 4: Verify the sweep is complete**

Run: `grep -rn "duration-[0-9]" src/`
Expected: no matches at all.

Run: `npm test -- motion-tokens` → PASS
Run: `npx tsc --noEmit` → no output
Run: `npm run build` → completes, prerender finishes, sitemap written

- [ ] **Step 5: Commit**

```bash
git add src/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): complete duration token migration"
```

---

### Task 8: Migrate component reveals to presets

19 components. Replaces hand-written `whileInView` blocks with `revealSection` / `revealItem`.

**Files:**
- Modify: `src/components/TelegramChannel.tsx` (8 reveals), `MarketOverview.tsx` (6), `MobileApp.tsx` (5), `MarketDashboard.tsx` (5), `IPOTracker.tsx` (5), `Footer.tsx` (5), `SIPCalculator.tsx` (4), `InvestmentTools.tsx` (4), `DailyResearch.tsx` (4), `CompanyTimeline.tsx` (4), `BecomePartner.tsx` (4), `MarketNews.tsx` (3), `FAQ.tsx` (3), `CompanyValues.tsx` (3), `TrustBadges.tsx` (2), `LiveChart.tsx` (2), `HowItWorks.tsx` (2), `AwardsSection.tsx` (2), `ContactForm.tsx` (1)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `revealSection`, `revealItem` from `src/lib/motion.ts`; `REVEAL_ALLOWLIST` from Task 1.
- Produces: nothing new.

`BecomePartner.tsx` and `ContactForm.tsx` are form files. Change **only** their reveal animation. Their submit logic, validation, honeypot and `_ts` timestamp belong to Plan 2 and must not be touched — see the spec's server-contract section for why that matters.

- [ ] **Step 1: Learn the substitution on one file**

Open `src/components/ContactForm.tsx`. It has exactly one reveal, at lines 100-106:

```tsx
    <motion.form
      onSubmit={handleSubmit}
      className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-lg space-y-4"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
```

Becomes:

```tsx
    <motion.form
      onSubmit={handleSubmit}
      className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-lg space-y-4"
      {...revealSection}
    >
```

with `import { revealSection } from "@/lib/motion";` added to the imports. `revealSection` already carries `initial`, `whileInView`, `viewport` and `transition`, so all four hand-written props go.

- [ ] **Step 2: Apply the same substitution across all 19 files**

Rules:
- A whole section or block arriving → spread `{...revealSection}`.
- One item in a group that animates with siblings → spread `{...revealItem(index)}`, passing the map index. This is what produces the stagger.
- If a reveal has a bespoke `transition` that the presets cannot express, keep it and add a comment saying why. Do not add such a comment for a reveal that merely differs slightly — those get the preset.
- Delete now-redundant `initial` / `whileInView` / `viewport` / `transition` props. Leaving them alongside the spread silently overrides the preset and defeats the whole change.

- [ ] **Step 3: Delete all 19 component files from `REVEAL_ALLOWLIST`**

Leave the 10 `src/pages/` entries — Task 9 handles those.

- [ ] **Step 4: Verify**

Run: `npm test -- motion-tokens` → PASS
Run: `npx tsc --noEmit` → no output

- [ ] **Step 5: Check it by eye — this is the step that catches real breakage**

Run `npm run dev` and scroll the full homepage top to bottom, slowly.

Expected: every section fades up as it enters. Grouped cards stagger left-to-right rather than all at once.

Watch specifically for a section that is **invisible** — that means `initial: { opacity: 0 }` applied but the `whileInView` never fired, usually because a leftover `viewport` or `initial` prop is overriding the spread. Check every one of the 19 components is actually visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): move component reveals onto shared presets"
```

---

### Task 9: Migrate page reveals to presets

10 pages. Empties `REVEAL_ALLOWLIST` and finishes the sweep.

**Files:**
- Modify: `src/pages/PricingPage.tsx` (7 reveals), `ContactPage.tsx` (4), `UnlistedZonePage.tsx` (3), `OpenAccountPage.tsx` (3), `HolidayCalendarPage.tsx` (2), `DepositoryServicesPage.tsx` (2), `ReportsPage.tsx` (1), `ProductsPage.tsx` (1), `BrokerageCalculatorPage.tsx` (1), `ArticlePage.tsx` (1)
- Modify: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: `revealSection`, `revealItem` from `src/lib/motion.ts`; `REVEAL_ALLOWLIST` from Task 1.
- Produces: an empty `REVEAL_ALLOWLIST`.

`OpenAccountPage.tsx` is a form page. Reveal animation only — its submit logic is Plan 2.

- [ ] **Step 1: Apply the same substitution as Task 8**

Same rules: `{...revealSection}` for blocks, `{...revealItem(index)}` for grouped items, delete the now-redundant props, comment any genuine exception.

- [ ] **Step 2: Empty the reveal allowlist**

```ts
export const REVEAL_ALLOWLIST: readonly string[] = [];
```

- [ ] **Step 3: Verify the sweep is complete**

Run: `npm test` (full suite)
Expected: all PASS, including both ratchets now asserting against empty allowlists.

Run: `npx tsc --noEmit` → no output
Run: `npm run build` → completes, prerender finishes, sitemap written

- [ ] **Step 4: Confirm prerender output did not change**

The spec forbids perturbing SEO output.

```bash
git status --porcelain public/sitemap.xml
```

Expected: no modification beyond a `lastmod` date bump. If page HTML or sitemap URLs changed, something in the sweep altered rendered markup — stop and investigate before committing.

- [ ] **Step 5: Walk every affected page**

Run `npm run dev` and visit all 10 pages above.
Expected: content is visible on every one, sections reveal on scroll, nothing stuck invisible.

Then set the OS to reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion) and reload.
Expected: content appears immediately without movement, and — critically — nothing is invisible. `MotionConfig reducedMotion="user"` handles this, but a leftover hand-written `initial` can defeat it.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ src/test/motion-allowlist.ts
git commit -m "refactor(motion): move page reveals onto shared presets"
```

---

### Task 10: Lock the ratchet shut

Both allowlists are empty. Remove the escape hatch so the sweep cannot silently regress.

**Files:**
- Modify: `src/test/motion-tokens.test.ts`
- Delete: `src/test/motion-allowlist.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a guard with no allowlist. Any future hardcoded duration or hand-rolled reveal fails CI.

- [ ] **Step 1: Inline the now-empty expectations**

Replace the four tests in `src/test/motion-tokens.test.ts` with two, and drop the import of `./motion-allowlist`:

```ts
describe("motion token ratchet", () => {
  it("has no hardcoded durations anywhere in src", () => {
    expect(violating(HARDCODED_DURATION)).toEqual([]);
  });

  it("has no hand-rolled reveals anywhere in src", () => {
    expect(violating(HAND_ROLLED_REVEAL)).toEqual([]);
  });
});
```

Add a comment above the describe block explaining that reveals go through `src/lib/motion.ts` and that a genuine exception means extending the presets, not bypassing the guard.

- [ ] **Step 2: Delete the allowlist module**

```bash
git rm src/test/motion-allowlist.ts
```

- [ ] **Step 3: Verify**

Run: `npm test` → all PASS
Run: `npx tsc --noEmit` → no output

- [ ] **Step 4: Prove the locked guard still catches a regression**

Temporarily add `duration-300` to `src/components/Header.tsx`.

Run: `npm test -- motion-tokens`
Expected: FAIL, listing `src/components/Header.tsx`.

Revert. Run again. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test/
git commit -m "test: lock motion token guard to zero tolerance"
```

---

## Definition of done

- `grep -rn "duration-[0-9]" src/` returns nothing.
- `grep -rn "whileInView={{" src/` returns nothing.
- `npm test`, `npx tsc --noEmit`, `npm run build` all green.
- Prerendered HTML and sitemap URLs unchanged.
- Homepage and all 10 migrated pages verified by eye, in normal and reduced-motion modes.
- No form submit logic touched anywhere in this plan.

## Follow-on plans

- **Plan 2 — Phases 1 + 3:** Button `loading` prop, input error styling, and the 8 form rewires onto react-hook-form + zod. Primitives land with the forms that consume them, so nothing ships unused.
- **Plan 3 — Phase 4:** per-page polish across the 33 pages.
