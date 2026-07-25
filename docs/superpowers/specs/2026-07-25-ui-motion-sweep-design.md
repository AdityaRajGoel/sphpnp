# Site-wide UI & Motion Consistency Sweep

**Date:** 2026-07-25
**Status:** Approved for planning
**Branch:** `feat/ui-motion-sweep`

## Problem

The site looks assembled rather than designed. The same gesture behaves differently
from page to page because the motion vocabulary landed (commit `49b6d7e`) but was
never applied site-wide.

Measured on 2026-07-25:

| Signal | Count |
|---|---|
| Files importing `motion` | 74 |
| ...using the `@/lib/motion` presets | 23 |
| Files still hand-rolling motion | **51** |
| `whileInView` reveals, mostly ad-hoc | 164 |
| Hardcoded `duration-N` classes | 78 (49x `duration-300`) |
| Files with raw `<button>` vs `ui/button` | 38 vs 41 |
| Form surfaces | 8 |
| Forms sharing a validation schema | **0** |

Scope of the surface: 33 pages, 56 top-level components, 49 `ui/` primitives.

## Goal

A consistency sweep, not a redesign. Keep the current layout, brand and routes.
Make every page speak the motion and shape vocabulary the codebase already defines,
and give the eight forms one shared validation schema instead of eight hand-copied
copies of the same rules.

## Non-goals

- No layout or brand redesign.
- No route changes.
- No changes to the prerender or sitemap pipeline. It is SEO-critical and was
  fixed recently (`fa64158`, `df0c76d`); this work must not perturb it.
- No visual investment in the two admin pages. They get form correctness only.

## Correction to an earlier assumption

An initial read described the forms as "hand-rolled `useState` with no validation."
That was wrong and the design does not rest on it.

`ContactForm` already validates against the same regexes the server uses, caps field
lengths to match the server's `sanitize()`, clears errors on change, and carries two
anti-bot measures. The other forms are similar in spirit. The actual defect is
**duplicated validation logic with no shared schema** — client and server each
hand-maintain the same rules, and they can drift silently.

This makes Phase 3 smaller and lower-risk than first described, but it also makes
the anti-bot contract below a hard constraint rather than an incidental detail.

## The server contract (hard constraint)

`supabase/functions/submit-lead/index.ts` is the authority. Any form rewire MUST
preserve all of it:

```
isValidPhone   /^(\+?91)?[6-9]\d{9}$/   (after stripping spaces and dashes)
isValidEmail   /^[^\s@]+@[^\s@]+\.[^\s@]+$/  and length <= 255
name           required, >= 2 chars, sanitized to 100
phone          required, sanitized to 20
email          optional, sanitized to 255
message        optional, sanitized to 1000
```

Anti-bot, both of which are easy to break by accident:

- `_website` — honeypot. Non-empty means silent drop. The field must stay in the
  DOM, stay reachable by bots, and stay hidden from humans and screen readers.
- `_ts` — the form's render timestamp.
  - `elapsed < 3000ms` → server returns a **fake success**. A rewire that submits
    faster than 3s will appear to work while silently discarding the lead.
  - `elapsed > 30min` → "Form expired. Please refresh and try again."

**Consequence for implementation:** `_ts` must be captured at component mount and
must not be hoisted into a module-level constant, a `useMemo` with an empty
dependency on a persistent parent, or any store that survives navigation. A form
that keeps a stale timestamp across a client-side route change will start
spuriously expiring for real users. This is the single most likely way to break
lead capture, and it will not show up in a type check or a build.

Zod schemas are derived **from this file**, not invented. Where the server is
lenient the schema is lenient. Tightening validation beyond the server would
reject submissions that currently succeed.

## Architecture

### `src/lib/schemas/`

One module per form domain (`lead.ts`, `auth.ts`, ...), each exporting a zod schema
and its inferred type. Schemas mirror the edge-function rules above. This is the
single source of truth the client validates against.

### `src/hooks/useFormSubmit.ts`

One hook owning the submit lifecycle every form repeats: pending state, success
state, error toast, and the invoke call. Eight forms should not invent this eight
times. Keeps `_ts` capture in one reviewed place.

### Rendering

Forms render through the already-installed `ui/form.tsx` (shadcn + react-hook-form),
which supplies `aria-invalid`, `aria-describedby` and error-message wiring for free.
That wiring is currently absent from the hand-rolled forms.

## Phases

Each phase is one or more commits on `feat/ui-motion-sweep`, and each must be green
on `tsc --noEmit` and `npm run build` before it lands. The user reviews between
phases and can stop or redirect at any boundary.

### Phase 1 — Primitives (~6 files)

Everything downstream leans on these, so they land alone and first.

- `Button`: add a `loading` prop — spinner swap, `aria-busy`, auto-disable. Eight
  forms are about to need it and there is no loading state today.
- `Input` / `Textarea` / `Select`: shared focus ring and `aria-invalid` error
  styling, so validation has somewhere to render.
- `Card`: move onto `--radius-surface`.

### Phase 2 — Motion sweep (~51 files)

- Migrate the 51 hand-rolling files onto `revealSection` / `revealItem`.
- Replace the 78 hardcoded `duration-N` classes with the token scale.
- `MotionConfig reducedMotion="user"` already covers reduced motion; verify, don't
  re-implement.

Mechanical and high-volume. Reviewable as: did anything move differently than before?

### Phase 3 — Forms (8 files, one commit each)

Ordered lowest-risk first so the pattern is proven on a small form before it reaches
a 1281-line one:

1. `ContactForm` (157L) — establishes the pattern
2. `BecomePartner` (258L)
3. `OpenAccountPage` (349L)
4. `AuthPage` (285L)
5. `ResetPasswordPage` (103L)
6. `AdminPage` (819L)
7. `BannerManagerPage` (653L)
8. `AIAnalysisModal` (1281L)

The last three are large enough that the form should be extracted into its own
component rather than edited in place — consistent with the 800-line file ceiling.

Per-form verification, since neither the type checker nor the build can catch a
broken lead path:

- Submit succeeds with valid input and the lead arrives.
- Submit is blocked with invalid input, and the message matches the server's.
- Honeypot still present and still hidden.
- More than 3s elapses between mount and submit (no fake-success path).
- `_ts` is re-captured on navigating away and back.

### Phase 4 — Per-page polish (33 pages, ~5 commits)

Grouped by page family: calculators, market tools, marketing, legal.
Heading reveals, section rhythm, loading and empty states, focus order.

Admin pages are excluded here, per the non-goals. They received form correctness in
Phase 3 and get no visual pass.

## MCP usage

`21st.dev` free tier allows **2 component-code retrievals per day**; search and
metadata are unmetered. For a consistency sweep 21st is the wrong shape of tool —
it sells whole sections and this work is not replacing sections. Search will be
used for reference throughout; retrievals spent only on something genuinely more
worth importing than writing.

`shadcn` MCP is free and unmetered but only `@shadcn` is registered — primitives
and blocks, no animation. Used for primitives as needed.

Neither MCP is on the critical path. Neither quota can block the work.

## Risks

| Risk | Mitigation |
|---|---|
| **Stale `_ts` breaks lead capture silently** | Capture at mount only; explicit per-form check on navigate-away-and-back. Highest-consequence risk here. |
| Validation stricter than server rejects real users | Schemas derived from the edge function, not written fresh. |
| Sub-3s submit hits the fake-success path | Explicit per-form manual check. |
| 90+ changed files become unreviewable | Phase boundaries and per-form commits. |
| Motion sweep regresses a page visually | Phase 2 is mechanical and isolated from Phase 3. |

## Success criteria

- All 33 pages use the token motion scale; zero hardcoded `duration-N` remain.
- Files hand-rolling motion drop from 51 to zero, except where a bespoke animation
  genuinely cannot be expressed as a preset. Each exception carries a comment saying
  why. "Preset didn't quite fit" is not a reason; the presets get extended instead.
- All 8 forms validate against a shared schema derived from the server contract.
- All 8 forms preserve honeypot and timestamp behaviour, manually verified.
- `tsc --noEmit` and `npm run build` green at every phase boundary.
- No change to prerender output or sitemap.
