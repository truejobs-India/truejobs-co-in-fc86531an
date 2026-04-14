

# Upgrade "Download Titles" from .txt to Excel with Serial Numbers

## Change

**File: `src/components/admin/BlogPostEditor.tsx`**

1. **Add `xlsx` dependency** — install the `xlsx` (SheetJS) library for client-side Excel generation.

2. **Update `handleDownloadArticleTitles`** — replace the `.txt` blob download with Excel generation:
   - Paginated fetch stays the same (already correct).
   - Build a worksheet with two columns: `S.No.` (1, 2, 3…) and `Title`.
   - Use `XLSX.utils.json_to_sheet` to create the sheet, then `XLSX.writeFile` to trigger the download as `.xlsx`.

3. **Update button label** — change `Download Titles (.txt)` to `Download Titles (.xlsx)`.

## Technical Detail

```typescript
import * as XLSX from 'xlsx';

// After fetching allTitles...
const wsData = allTitles.map((title, i) => ({ 'S.No.': i + 1, 'Title': title }));
const ws = XLSX.utils.json_to_sheet(wsData);
ws['!cols'] = [{ wch: 8 }, { wch: 80 }]; // column widths
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Blog Titles');
XLSX.writeFile(wb, `blog-article-titles-${new Date().toISOString().slice(0,10)}.xlsx`);
```

## Files Changed
- `src/components/admin/BlogPostEditor.tsx` — update function + button label
- `package.json` — add `xlsx` dependency

