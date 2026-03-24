

## Plan: Azure Based Extraction — Prompt 1 of 4

### What this builds
A completely separate "Azure Based Extraction" workspace inside the existing "Emp News" admin tab. It adds issue creation and serial-numbered image upload capabilities, with placeholder tabs for future OCR/reconstruction/publishing stages.

### Insertion strategy
The existing `EmploymentNewsManager.tsx` component will get a **minimal** change: a toggle at the top to switch between "Classic Pipeline" (existing UI, unchanged) and "Azure Based Extraction" (new component). This is the only modification to any existing file besides `AdminDashboard.tsx` (no change needed there — it already renders `EmploymentNewsManager` under the emp-news tab).

### Architecture overview

```text
EmploymentNewsManager.tsx (minimal edit — add sub-view toggle)
  ├── [Classic Pipeline] → existing code, untouched
  └── [Azure Based Extraction] → new AzureEmpNewsWorkspace component
        ├── Issues tab (functional)
        ├── Upload tab (functional)
        ├── OCR Queue tab (placeholder)
        ├── Reconstructed Notices tab (placeholder)
        ├── Draft Jobs tab (placeholder)
        └── Publish Log tab (placeholder)
```

### Files to create

| File | Purpose |
|------|---------|
| `src/types/azureEmpNews.ts` | TypeScript types for all 6 tables |
| `src/components/admin/emp-news/azure-based-extraction/AzureEmpNewsWorkspace.tsx` | Main workspace with 6 tabs |
| `src/components/admin/emp-news/azure-based-extraction/IssuesTab.tsx` | Create/list/delete issues |
| `src/components/admin/emp-news/azure-based-extraction/UploadTab.tsx` | Image upload with filename validation, page-number detection, duplicate rejection, gap warnings, progress display |
| `src/components/admin/emp-news/azure-based-extraction/PlaceholderTab.tsx` | Reusable empty-state placeholder for OCR/Reconstructed/Draft/Publish tabs |

### Files to modify (minimal)

| File | Change |
|------|--------|
| `src/components/admin/EmploymentNewsManager.tsx` | Add ~15 lines at top of render: two buttons to toggle between "Classic Pipeline" and "Azure Based Extraction", conditionally render new workspace component |

### Database migration

**6 tables** with `azure_emp_news_` prefix, matching the schema exactly as specified. All use validation triggers (not CHECK constraints) per guidelines. Indexes on `issue_id`, `page_no`, `ocr_status`, `publish_status`, `created_at`. Foreign keys with `ON DELETE CASCADE` from pages/fragments/notices/drafts/logs → issues. RLS enabled with admin-only policies using `has_role()`.

### Storage strategy

- **Bucket**: `employment-news-azure` (public, for admin image viewing)
- **Path pattern**: `{issue_id}/pages/001.jpg`, `{issue_id}/pages/002.jpg`, etc.
- **Completely separate** from existing blog-assets or any old emp news storage
- Created via SQL migration: `INSERT INTO storage.buckets`
- RLS policies: authenticated users with admin role can upload/read/delete

### Upload flow logic

1. User selects an issue from dropdown (or creates one first in Issues tab)
2. Multi-file upload accepts images (jpg, jpeg, png, webp)
3. Each filename is validated against pattern `/^\d{3}\.(jpg|jpeg|png|webp)$/i`
4. Page number extracted from filename (e.g., `003.jpg` → page 3)
5. Duplicates checked against existing `azure_emp_news_pages` for that issue
6. Missing page gaps detected and warned (e.g., "Pages 4, 7 missing between 1-10")
7. Files uploaded to `employment-news-azure/{issue_id}/pages/{page_no padded}.{ext}`
8. Records inserted into `azure_emp_news_pages`
9. `azure_emp_news_issues.uploaded_pages` and `total_pages` updated
10. "Start Azure Extraction" button shown but disabled/non-functional (placeholder)

### Test checklist

- [ ] Old Emp News "Classic Pipeline" still works identically
- [ ] Toggle between Classic and Azure views works
- [ ] Create a new issue with name and optional date
- [ ] Upload files with valid names (001.jpg, 002.jpg) — records created
- [ ] Upload file with invalid name (page1.jpg) — rejected with error
- [ ] Upload duplicate page number — rejected with warning
- [ ] Missing page gaps shown as warning
- [ ] Page list displays correctly after upload
- [ ] "Start Azure Extraction" button visible but non-functional
- [ ] Placeholder tabs show empty states
- [ ] Delete an issue removes all its pages and storage files

### Assumptions

- The storage bucket `employment-news-azure` is created as **public** so admin can view uploaded images directly via URL
- RLS on all tables is admin-only (using existing `has_role` function)
- No edge functions needed in this prompt — all operations use direct Supabase client calls
- `created_by` on issues stores `auth.uid()` of the admin who created it
- The `azure_emp_news_fragments`, `azure_emp_news_reconstructed_notices`, `azure_emp_news_draft_jobs`, and `azure_emp_news_publish_logs` tables are created now but not used until future prompts

