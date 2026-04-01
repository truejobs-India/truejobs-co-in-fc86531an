

# JSON + CSV Intake Upgrade — Final Corrected Plan

## Two Safeguards Added

### 1. `structured_data_json` — store as plain object, not stringified
The `intake_drafts.structured_data_json` column is `jsonb` typed as `Json | null` in the Supabase types. The Supabase JS client serializes plain JS objects to jsonb automatically. During JSON import, the original item object will be assigned directly:
```typescript
mapped.structured_data_json = originalItem; // plain object, not JSON.stringify
```
No stringification needed or used.

### 2. Zero-valid-rows hard-fail
After filtering out non-object items from the JSON array, if zero usable object rows remain, hard-fail with a destructive toast ("No valid objects found in JSON array") and clear `parsedData`. Do not show preview or allow import with an empty row set.

```typescript
const validItems = parsed.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));
const skippedNonObjects = parsed.length - validItems.length;

if (validItems.length === 0) {
  toast({ title: 'Invalid JSON', description: 'No valid object rows found.', variant: 'destructive' });
  setParsedData(null);
  return;
}
// If some were skipped, set parseWarnings count
```

## Full Plan (unchanged except for these two safeguards)

**Single file changed:** `src/components/admin/intake/IntakeCsvUploader.tsx`

1. Extend file input: `accept=".csv,.json"`, update labels
2. Add `fileType` state (`'csv' | 'json' | null`)
3. Route by extension + parse validation (PapaParse for CSV, `JSON.parse` for JSON)
4. JSON parse: validate array, filter non-objects, hard-fail if zero valid rows, extract headers from key union, flatten nested values for preview only
5. JSON field mapping: `url→source_url`, `sourceName→source_name`, `host→source_domain`, `title→raw_title`, `isFile+url→raw_file_url`, `fileType→raw_file_type`, `source_type='crawler'`
6. `structured_data_json = originalItem` (plain object, no stringify)
7. `sourceUrl` preserved only inside `structured_data_json`
8. Same duplicate detection, same tag logic, same batch insert
9. Error handling: malformed JSON, not-array, empty array, zero-valid-objects after filtering, extension/parse mismatch

**No other files changed. No database changes. No edge function changes.**

