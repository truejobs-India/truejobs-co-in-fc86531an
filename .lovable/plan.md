

# Update: Tighten Old Component Deletion Policy

## Change
Replace the two-phase cleanup (Phase A after homepage, Phase B after remaining pages) with a single cleanup pass that runs only after **all** page families are migrated and verified site-wide.

## Updated 3-Pass Structure

### Pass 1 — Migration
- Migrate all 15+ page families to `JobAlertCTA` + `ctaConfig.ts`
- All old components (`AlertSignupBanner`, `ResourceSubscribeCTA`, `TelegramAlertWidget`, `EmailDigestCapture`, `DistributionSidebar`) remain untouched in the codebase throughout this entire pass
- No deletions, no renames, no dead-code removal

### Pass 2 — Full Verification
- Verify every migrated page family on desktop and mobile
- Confirm canonical WhatsApp, Telegram, Email flows work on all pages
- Confirm no page still renders an old component
- Confirm no "Email Alerts" → `/signup` flow remains
- Confirm no placeholder URLs remain
- Grep codebase: confirm zero active imports of old components

### Pass 3 — Cleanup (single phase)
- Only after Pass 2 is fully complete
- Delete all 5 old components in one cleanup pass:
  - `AlertSignupBanner.tsx`
  - `ResourceSubscribeCTA.tsx`
  - `TelegramAlertWidget.tsx`
  - `EmailDigestCapture.tsx`
  - `DistributionSidebar.tsx`
- Final grep to confirm zero broken imports
- Spot-check routes after deletion

## What Changes From Current Plan
- **Remove "Cleanup Phase A"** — `AlertSignupBanner` is no longer deleted early after homepage verification
- **Remove "Cleanup Phase B"** — all deletions consolidated into one pass
- **No old component is deleted while any page family is still mid-migration**
- The `.lovable/plan.md` file will be updated to reflect these 3 passes

## File Changed
`.lovable/plan.md` — update to reflect the tightened 3-pass policy

