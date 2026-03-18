

# RSS Taxonomy Upgrade — Implementation Plan

## Summary
Upgrade the RSS Intake module from a narrow jobs-only model to a two-level taxonomy (`primary_domain` + expanded `item_type`) covering 6 domains and 18 item types. Safe upgrade of schema, classifier, edge functions, and admin UI with content-based backfill of existing data.

---

## Layer 1: Database Migration

**Single migration file** that:

### Schema Changes
- Add `primary_domain text NOT NULL DEFAULT 'general_alerts'` to `rss_items`
- Add `display_group text NOT NULL DEFAULT 'General Alerts'` to `rss_items`
- Add `primary_domain text` and `display_group text` to `monitoring_review_queue` (nullable, for non-RSS channels)
- Add indexes on `rss_items(primary_domain)`, `rss_items(display_group)`, `monitoring_review_queue(primary_domain)`

### Validation Trigger Update
Replace `validate_rss_items_fields()` to:
- Expand `item_type` to include: `scholarship`, `certificate`, `marksheet`, `school_service`, `university_service`, `document_service`, `circular`, `notification`
- Validate `primary_domain` in: `jobs`, `education_services`, `exam_updates`, `public_services`, `policy_updates`, `general_alerts`
- Validate `display_group` in: `Government Jobs`, `Education Services`, `Exam Updates`, `Public Services`, `Policy Updates`, `General Alerts`

### Data Backfill (in-migration)
Two-pass approach per user requirement:

**Pass 1**: Baseline mapping from old `item_type` (for all existing rows):
- `recruitment/vacancy` → `jobs` / `Government Jobs`
- `exam/admit_card/result/answer_key/syllabus` → `exam_updates` / `Exam Updates`
- `policy` → `policy_updates` / `Policy Updates`
- `signal/unknown` → `general_alerts` / `General Alerts`

**Pass 2**: Content-based reclassification overrides using `item_title + item_summary + categories`:
- Scholarship keywords → `education_services` / `scholarship`
- Certificate keywords → `education_services` / `certificate` (skip if already result/admit_card/recruitment)
- Marksheet keywords → `education_services` / `marksheet`
- School service keywords → `education_services` / `school_service`
- University service keywords → `education_services` / `university_service`
- Document service keywords → `education_services` / `document_service`
- Circular keywords → reclassify `item_type` from `policy` to `circular`
- Public service keywords → `public_services` / `notification`

**Pass 3**: Backfill `monitoring_review_queue` from linked `rss_items`

---

## Layer 2: Classifier Upgrade

**File**: `supabase/functions/_shared/rss/classifier.ts`

Complete rewrite with specificity-first rule ordering:

1. Education Services rules first (scholarship, marksheet, certificate, school_service, university_service, document_service)
2. Exam Updates rules next (admit_card, answer_key, result, syllabus, exam)
3. Jobs rules after (recruitment, vacancy)
4. Policy Updates (circular, policy)
5. Public Services (notification)
6. General Alerts catch-all (signal)

Return expanded interface:
```typescript
interface ClassificationResult {
  itemType: string;
  primaryDomain: string;
  displayGroup: string;
  relevanceLevel: 'High' | 'Medium' | 'Low';
  detectionReason: string;
}
```

Hindi keywords included throughout. Detection reason format: `Matched "keyword" → domain/type`.

---

## Layer 3: Edge Function Updates

### `supabase/functions/_shared/rss/queue-router.ts`
- Add `primaryDomain` and `displayGroup` to `QueueableItem` interface
- Write `primary_domain` and `display_group` as dedicated columns on insert/update to `monitoring_review_queue`

### `supabase/functions/rss-ingest/index.ts`
- Update all `classifyItem()` call sites to destructure `primaryDomain` and `displayGroup`
- Store `primary_domain` and `display_group` on `rss_items` insert
- Include `primaryDomain` and `displayGroup` in `QueueableItem` passed to `upsertReviewEntry`
- Update `handleExistingItem` to sync `primary_domain` and `display_group` on content changes
- Update `handleRequeueItem` to pass `primaryDomain` and `displayGroup`
- Update `handleTestSource` preview to include `primaryDomain` and `displayGroup`

---

## Layer 4: Admin UI Updates

### `src/components/admin/rss-intake/rssTypes.ts`
- Add `primary_domain` and `display_group` to `RssItem` interface
- Add `primary_domain` and `display_group` to `ReviewQueueEntry` interface
- Add `PRIMARY_DOMAINS`, `DISPLAY_GROUPS` constants
- Add `DOMAIN_LABELS` map for human-readable labels
- Expand `ITEM_TYPES` with new values

### `src/components/admin/rss-intake/RssFetchedItemsTab.tsx`
- Add `primary_domain` filter dropdown using `PRIMARY_DOMAINS` constant
- Add Domain and Display Group columns to table
- Add domain badge with distinct colors per domain:
  - `jobs` → emerald
  - `education_services` → blue
  - `exam_updates` → purple
  - `public_services` → cyan
  - `policy_updates` → pink
  - `general_alerts` → gray
- Show `primary_domain`, `display_group`, detection reason in expanded detail row

### `src/components/admin/rss-intake/RssReviewQueueTab.tsx`
- Add `primary_domain` filter dropdown
- Show domain badge in table rows
- Show `primary_domain` and `display_group` in detail dialog

### `src/components/admin/rss-intake/RssDashboardCards.tsx`
- Add domain-specific count cards:
  - Government Jobs items count
  - Education Services items count
  - Exam Updates items count
  - Policy/Public Alerts items count

---

## Layer 5: Review Workflow

- `monitoring_review_queue` now carries `primary_domain` and `display_group` as dedicated columns (not buried in `parsed_payload`)
- Filtering in review queue uses stable internal values (`jobs`, `education_services`, etc.)
- `sync_rss_review_status` RPC continues working unchanged (no modification needed)
- All existing review actions (approve/reject/ignore/duplicate/hold) remain intact

---

## Files Modified

| File | Change |
|------|--------|
| New migration SQL | Schema + trigger + backfill |
| `supabase/functions/_shared/rss/classifier.ts` | Complete rewrite with expanded taxonomy |
| `supabase/functions/_shared/rss/queue-router.ts` | Add primaryDomain/displayGroup to interface + writes |
| `supabase/functions/rss-ingest/index.ts` | Use new classifier fields everywhere |
| `src/components/admin/rss-intake/rssTypes.ts` | New fields + constants |
| `src/components/admin/rss-intake/RssFetchedItemsTab.tsx` | Domain filter + columns + badges |
| `src/components/admin/rss-intake/RssReviewQueueTab.tsx` | Domain filter + badge + detail |
| `src/components/admin/rss-intake/RssDashboardCards.tsx` | Domain count cards |

No new files. All changes are upgrades to existing files.

---

## Key Design Decisions

1. **Specificity-first matching**: Education rules (scholarship, marksheet) are checked before generic recruitment/notification rules to prevent misclassification
2. **Dedicated columns over parsed_payload**: `primary_domain` and `display_group` are stored as proper columns on `monitoring_review_queue` for reliable SQL filtering
3. **Content-based backfill first**: Existing rows are reclassified from title+summary+categories content, falling back to old `item_type` mapping only when content doesn't match specific education/service patterns
4. **Safe conflict avoidance**: Content-based reclassification skips items already classified as high-value types (result, admit_card, recruitment) to avoid demoting them

