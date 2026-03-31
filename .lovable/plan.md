

# Updated Pass 1 — Defer Two Non-Critical Items

## What's Deferred

### 1. Homepage/Blog variant-weight change — DEFERRED
- `Index.tsx` stays `variant="strong"` (current working state)
- `Blog.tsx` stays `variant="strong"` (current working state)
- These are functional and policy-compliant — the `strong` → `banner` change was a weight/placement preference, not a technical violation
- Can be revisited in a later cosmetic/placement pass

### 2. HeroSideCards trust-line display — DEFERRED
- `CTA_TRUST_LINE` will NOT be added to HeroSideCards in this phase
- The amber card doesn't currently show a trust line — adding one is a cosmetic addition, not a technical fix
- HeroSideCards still must fix the `/email-subscribe` link (that IS a technical violation)

## What Remains in Pass 1 (Technical Only)

### Corrections (3 violations)
1. **HeroSideCards** — replace `/email-subscribe` link with inline email form (direct DB insert, shared validation). No trust-line addition, no visual changes.
2. **TodayJobsPage** — replace `/signup` link with `JobAlertCTA variant="banner"`
3. **BoardResultAlertCTA** — remove `soft` variant type, import `CTA_TRUST_LINE` (this IS technically required since the component already shows a trust line but hardcodes it)

### Variant fixes
- `PremiumResultLanding.tsx`: `soft` → `strong`
- `BoardResultStatePage.tsx`: `soft` → `compact`

### Page family migrations (18 files)
Add `JobAlertCTA` to all remaining page families per the approved list — no changes to this scope.

### Codebase-wide sweep
Grep for active `/signup` alert links, `/email-subscribe` alert links, `soft` variant usage, non-canonical WA/TG numbers. Fix any found in active code.

## Updated Plan File Change
Update `.lovable/plan.md` to note these two deferrals explicitly.

## Files Changed
- `.lovable/plan.md` — add deferral notes
- All other Pass 1 files per the existing approved technical scope (no change to file list except homepage/blog variant lines are skipped)

