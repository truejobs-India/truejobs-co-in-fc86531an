

# CSV Parser Upgrade — PapaParse Integration

## Current State
- Hand-rolled `parseCSV` function (lines 73-106) with character-by-character parsing
- **Critical flaw:** Cannot handle multiline quoted fields (splits on `\n` first, then parses each line independently)
- **Flaw:** Rows with fewer columns than headers silently get empty strings; rows with MORE columns silently lose trailing values
- PapaParse is NOT in `package.json` or `bun.lock` — must be added

## Changes

### File: `package.json`
Add `papaparse` and `@types/papaparse` as dependencies.

### File: `src/components/admin/intake/IntakeCsvUploader.tsx`

**1. Replace `parseCSV` with PapaParse:**
- `Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() })`
- Map PapaParse's `{ data, meta.fields, errors }` output to the existing `{ headers, rows }` shape
- Light trim on cell values only (no aggressive normalization — preserve raw evidence)

**2. Add `parseWarnings` state:**
- If PapaParse returns row-level errors (e.g., `TooFewFields`, `TooManyFields`), collect them into a warning count shown in the UI — but still allow preview and import
- Hard-fail only when: no headers detected (`meta.fields` empty/undefined), zero usable rows, or file is unreadable

**3. Handle inconsistent column counts safely:**
- PapaParse with `header: true` automatically maps values to the correct header key regardless of row length — short rows get missing keys as `undefined` (rendered as empty), extra columns are ignored
- This prevents the column-shifting bug that the hand-rolled parser is vulnerable to

**4. Add parse error/warning UI:**
- If hard-fail: show a destructive toast and clear `parsedData` (no preview)
- If soft warnings: show an amber warning banner above the preview table with the count (e.g., "3 rows had formatting issues — review preview carefully")

**5. Everything else unchanged:**
- Column mapping UI, AUTO_MAP, COLUMN_MAP_OPTIONS — no changes
- `handleImport`, duplicate detection, tag detection, batch insert — no changes
- Import summary — no changes

## Technical Detail

```typescript
import Papa from 'papaparse';

// In handleFileSelect:
const result = Papa.parse<ParsedRow>(text, {
  header: true,
  skipEmptyLines: 'greedy',
  transformHeader: (h: string) => h.trim(),
});

const headers = result.meta.fields || [];
const rows = result.data;
const warnings = result.errors.filter(e => e.type !== 'Abort');

if (headers.length === 0 || rows.length === 0) {
  toast({ title: 'Invalid CSV', description: '...', variant: 'destructive' });
  return;
}

setParsedData({ headers, rows });
setParseWarnings(warnings.length);
```

## Edge Cases Now Handled
- Multiline quoted fields (e.g., `"line1\nline2"`)
- Commas inside quoted fields
- Escaped quotes (`""`)
- UTF-8 BOM markers
- Mixed line endings (`\r\n`, `\n`, `\r`)
- Extra whitespace in headers (trimmed)
- Blank/empty rows (skipped)
- Rows with too few or too many columns (soft warning, no column shift)

## Files Changed
1. `package.json` — add `papaparse`, `@types/papaparse`
2. `src/components/admin/intake/IntakeCsvUploader.tsx` — replace parser, add warning state + UI

## Unchanged
- All import logic (duplicate detection, stale tagging, batch insert)
- All other intake components (IntakeDraftsManager, IntakeDraftDetailDialog)
- Edge functions (intake-ai-classify, intake-publish)
- Database schema
- Admin dashboard integration

