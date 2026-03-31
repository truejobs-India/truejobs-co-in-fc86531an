
# CTA Standardization — Implementation Plan

## 3-Pass Structure (Non-Negotiable)

### Pass 1 — Migration ✅ COMPLETED
- Created `src/lib/ctaConfig.ts` (canonical URLs, labels, logos)
- Created shared `JobAlertCTA` component with 3 variants: `strong`, `compact`, `banner`
- Migrated all page families to `JobAlertCTA` + `ctaConfig.ts`
- `HeroSideCards` uses shared config + inline email form (direct DB insert)
- `BoardResultAlertCTA` uses `CTA_TRUST_LINE` from shared config, `soft` variant removed
- All old components remain untouched — no deletions, no renames, no dead-code removal
- Codebase-wide sweep confirmed zero active violations

### Pass 2 — Full Verification (NEXT)
- Verify every migrated page family on desktop and mobile
- Confirm canonical WhatsApp, Telegram, Email flows work on all pages
- Confirm no page still renders an old component
- Confirm no "Email Alerts" → `/signup` flow remains
- Confirm no placeholder URLs remain (e.g. `919876543210`)
- Grep codebase: confirm zero active imports of old components

### Pass 3 — Cleanup (single phase, after full verification)
- Only after Pass 2 is fully complete
- Delete all 5 old components in one cleanup pass:
  - `AlertSignupBanner.tsx`
  - `ResourceSubscribeCTA.tsx`
  - `TelegramAlertWidget.tsx`
  - `EmailDigestCapture.tsx`
  - `DistributionSidebar.tsx`
- Final grep to confirm zero broken imports
- Spot-check routes after deletion

## Deferred Items (Not Part of Pass 1-3)
1. Homepage/Blog variant-weight change (`strong` → `banner`) — cosmetic, revisit later
2. HeroSideCards trust-line display — cosmetic addition, not required for technical correctness
3. All visual polish, logo beautification, spacing/styling refinements

## Non-Negotiable Rules
1. Pass 1 = migration only. No deletions until Pass 3.
2. No old component is deleted while any page family is still mid-migration.
3. "Email Alerts" = direct `email_subscribers` insert. Never `/signup`.
4. All CTA surfaces use `ctaConfig.ts`. Zero inline URLs.
5. 3 variants only: `strong`, `compact`, `banner`.
6. No CTA on empty-state or thin pages.
7. `BoardResultAlertCTA` imports from shared config.

## Owner Confirmations (Received)
1. WhatsApp: `+917982306492` ✅
2. Telegram: `@truejobs_alerts` ✅
3. Email Alerts = direct subscribe only ✅
4. StickyMobileCTA: removed ✅
