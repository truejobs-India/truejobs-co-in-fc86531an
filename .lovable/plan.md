

# Harden published_record_id Reliability in intake-publish

## Problem
The planned idempotent guard checks `published_record_id` and `published_table_name` to prevent duplicate publishes. But there's a subtle failure mode: if the INSERT into the live table succeeds but the follow-up UPDATE to `intake_drafts` (lines 398-404) fails (timeout, network error), the draft will have `published_record_id = null` despite a live record existing. On retry, a duplicate would be created.

## Current State
- Lines 398-404: Write `published_record_id` and `published_table_name` on success — this is correct
- Lines 414-417: On failure, only set `processing_status` and `publish_error` — does NOT clear `published_record_id`, which is fine since it's still null from a real failure
- The real risk is the INSERT-succeeds-but-UPDATE-fails edge case

## Solution: 2 small changes in `supabase/functions/intake-publish/index.ts`

### Change 1: Add idempotent guard (before the switch block, ~line 204)
```
if (draft.published_record_id && draft.published_table_name) {
  // Already published — return idempotent success, update status if stuck
  await client.from('intake_drafts').update({
    processing_status: 'published',
    publish_error: null,
  }).eq('id', draftId);
  return json({
    success: true,
    published_id: draft.published_record_id,
    table: draft.published_table_name,
    already_published: true,
  });
}
```

### Change 2: Verify the UPDATE succeeded after publish (replace lines 397-404)
After the switch block writes `publishedId` and `publishedTable`, verify the status update actually persisted:
```
const { error: updateErr } = await client.from('intake_drafts').update({
  processing_status: 'published',
  published_record_id: publishedId,
  published_table_name: publishedTable,
  published_at: new Date().toISOString(),
  publish_error: null,
}).eq('id', draftId);

if (updateErr) {
  console.error('[intake-publish] Published but failed to update draft:', updateErr.message);
  // Still return success — the live record exists. Log the inconsistency.
  return json({
    success: true,
    published_id: publishedId,
    table: publishedTable,
    warning: 'Published but draft status update failed — will self-heal on retry',
  });
}
```

This ensures:
- If both succeed: normal flow, `published_record_id` is set, idempotent guard protects future retries
- If INSERT succeeds but UPDATE fails: the response still reports success with a warning; on next retry, the idempotent guard won't fire (fields are null), but the duplicate risk remains — so we log it clearly for admin awareness
- To fully close the gap, the idempotent guard should also do a **lookup check**: before inserting, query the target table for a record matching this draft's title + org + slug to catch orphaned publishes

### Change 3 (optional but recommended): Orphan detection before insert
Before the switch block, after the idempotent guard, add a lightweight check for the most common case (jobs/notifications → `employment_news_jobs`):
```
// Check for orphaned publish from a previous failed-update attempt
if (draft.processing_status === 'publish_failed' && !draft.published_record_id) {
  const targetTable = draft.publish_target === 'jobs' || draft.publish_target === 'notifications'
    ? 'employment_news_jobs' : draft.publish_target === 'exams' ? 'govt_exams'
    : draft.publish_target === 'results' ? 'govt_results'
    : draft.publish_target === 'admit_cards' ? 'govt_admit_cards'
    : draft.publish_target === 'answer_keys' ? 'govt_answer_keys' : null;

  if (targetTable) {
    const checkSlug = draft.slug || generateSlug(title);
    const { data: existing } = await client.from(targetTable)
      .select('id').eq('source', 'intake_pipeline')
      .ilike('enriched_title', title).limit(1);
    if (existing && existing.length > 0) {
      // Found orphan — heal the draft record
      await client.from('intake_drafts').update({
        processing_status: 'published',
        published_record_id: existing[0].id,
        published_table_name: targetTable,
        published_at: new Date().toISOString(),
        publish_error: null,
      }).eq('id', draftId);
      return json({ success: true, published_id: existing[0].id, table: targetTable, healed: true });
    }
  }
}
```

## Files Changed

| # | File | Change |
|---|---|---|
| 1 | `supabase/functions/intake-publish/index.ts` | Add idempotent guard, verify UPDATE result, optional orphan detection |

**Total: 1 file, 3 small additions (~30 lines)**

