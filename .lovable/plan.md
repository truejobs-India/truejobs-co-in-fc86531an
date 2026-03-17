

# Fix: Header Normalization for Board Result Excel Upload

## Problem
`BatchUploadZone.tsx` line 20 hardcodes `REQUIRED_COLUMNS = ['State/UT', 'Board Name', 'Result URL', 'Official Board URL']` and line 46 does exact string matching. Snake_case headers like `state_ut` fail.

## Solution

### 1. New utility: `src/lib/headerNormalizer.ts`
Reusable header normalization + alias resolution:

- **`normalizeHeader(raw: string): string`** — trim, lowercase, collapse whitespace, replace `_`, `-`, `/` with space, strip surrounding punctuation
- **Alias map** — maps each normalized alias to a canonical field name:
  - `state_ut` ← `state ut`, `state/ut`, `state`, etc.
  - `board_name` ← `board name`, `board-name`, etc.
  - `result_url` ← `result url`, `result link`, `official result url`, etc.
  - `official_board_url` ← `official board url`, `board official url`, `official website`, etc.
  - `seo_intro_text` ← `seo intro text`, `intro`, `seo intro`, `intro text`, etc.
- **`resolveHeaders(rawHeaders: string[]): { headerMap, matched, missing }`** — returns a mapping from original header → canonical name, plus lists of matched/missing required fields

### 2. Update `BatchUploadZone.tsx`
- Import and use `resolveHeaders` instead of exact-match validation
- **Multi-sheet support**: iterate `wb.SheetNames`, pick first sheet where all 4 required fields resolve
- **Row extraction**: use `headerMap` to read values by canonical name regardless of original header spelling
- **Better error toast**: show detected headers, which matched, which are truly missing
- Remove hardcoded `REQUIRED_COLUMNS` and `raw['State/UT']` accessors

### 3. Files changed
- **New**: `src/lib/headerNormalizer.ts`
- **Modified**: `src/components/admin/board-results/BatchUploadZone.tsx`

The user's file with `state_ut, board_name, result_url, official_board_url, seo_intro_text` will map 1:1 to canonical names and pass validation.

