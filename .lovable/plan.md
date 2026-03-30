

# Fix 3 Correction — Precise STATE_LIST Audit and Fix

## Current STATE_LIST Reality (36 entries)

- **28 States**: Correct and complete (AP through West Bengal)
- **8 UT-region entries**: Chandigarh, Dadra & Nagar Haveli, Daman & Diu, Delhi, Jammu & Kashmir, Ladakh, Lakshadweep, Puducherry
- **Ladakh**: Included. Confirmed as a UT entry. ✓

## The Two Issues

**Issue A — Andaman & Nicobar Islands is missing.**
India officially has 8 UTs. The `indianCities.ts` file (the canonical reference) correctly lists all 8 including "Andaman and Nicobar Islands." But `STATE_LIST` in `stateGovtJobsData.ts` omits it entirely. This means no `/govt-jobs-andaman-nicobar` page exists.

**Issue B — Dadra & Nagar Haveli and Daman & Diu are split into two entries.**
Post-2020, India merged these into one UT: "Dadra and Nagar Haveli and Daman and Diu." The `indianCities.ts` file correctly lists this as one UT. But `STATE_LIST` keeps them as two separate entries, creating two separate SEO pages.

## Decision

- **Add** Andaman & Nicobar Islands as `['andaman-nicobar', 'Andaman & Nicobar Islands']`
- **Keep** Dadra & Nagar Haveli and Daman & Diu as two separate entries — for practical SEO value, two distinct regional pages are more useful than one combined page for a merged UT that people still search for separately
- **Add** `'andaman-nicobar'` to `STATE_DB_NAME_MAP` since title-casing won't produce the correct DB value

## Final Counts After Fix

| Metric | Value |
|---|---|
| Total STATE_LIST entries | **37** |
| Entries representing States | **28** |
| Entries representing Union Territories | **9** (8 official UTs, with the merged D&NH+DD UT kept as 2 separate pages for SEO) |
| Ladakh included under UTs | **Yes** |
| Andaman & Nicobar included | **Yes (added)** |
| Why 37 not 36 | One merged UT (D&NH + Daman & Diu) is intentionally kept as 2 pages |

## Exact Changes

### File: `src/pages/seo/stateGovtJobsData.ts`

**Change 1** — Add Andaman & Nicobar to STATE_LIST (insert after line 91, before `andhra-pradesh`):
```typescript
['andaman-nicobar', 'Andaman & Nicobar Islands'],
```

**Change 2** — Add to STATE_DB_NAME_MAP (around line 28):
```typescript
'andaman-nicobar': 'Andaman & Nicobar Islands',
```

### File: `src/pages/tools/OutreachAssets.tsx`

**Change 3** — Line 105: change `'across 36 states.'` to `'across all states & UTs.'`

### Files NOT changed
- `src/data/indianCities.ts` — already correct (lists all 8 UTs properly with Ladakh under UTs)
- `src/lib/deptMapping.ts` — no state/UT logic
- `src/components/home/StateQuickFilter.tsx` — curated grid, intentionally 15 tiles, no change needed

## All 3 Fixes Summary

| Fix | File | Change |
|---|---|---|
| Fix 1: Canonical | `SarkariJobs.tsx` line 119 | Add `url` prop to `<SEO>` |
| Fix 2: Noindex bridge | `GovtExamDetail.tsx` ~line 130 | Add `<SEO noindex={true}>` to bridge branch |
| Fix 3a: Add A&N Islands | `stateGovtJobsData.ts` | Add entry to STATE_LIST + STATE_DB_NAME_MAP |
| Fix 3b: Wording | `OutreachAssets.tsx` line 105 | "across all states & UTs" |

Total: 3 files changed, 4 small edits. Zero-risk, additive only.

