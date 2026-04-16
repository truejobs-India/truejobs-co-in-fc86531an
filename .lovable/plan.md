

## Plan: Preview + Edit per draft row in ChatGpt Agent

### What
Add per-row **Preview** and **Edit** capability in `ChatGptAgentManager.tsx` so admins can:
1. View each draft exactly as users will see it (Jobs / Exam / Fallback layout)
2. Manually edit fields and content, save changes back to `intake_drafts`

### Reuse existing components
- **Preview**: `IntakeDraftPreviewDialog` (already at `src/components/admin/intake/IntakeDraftPreviewDialog.tsx`) renders the WYSIWYG view based on `publish_target`. Zero new code.
- **Edit**: Check if an existing intake draft editor exists (e.g. `IntakeDraftEditor` / `IntakeDraftEditDialog`). If yes — reuse. If not — build a new lean dialog `ChatGptAgentEditDialog.tsx` with form fields for the editable columns and a rich text area for `draft_content_html`.

### Changes

**1. `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`**
- Add imports: `IntakeDraftPreviewDialog`, edit dialog component, `Eye` + `Pencil` icons
- Add state:
  ```ts
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  ```
- In each row's actions cell, add two ghost icon buttons:
  ```tsx
  <Button size="sm" variant="ghost" onClick={() => setPreviewDraftId(d.id)} title="Preview">
    <Eye className="h-4 w-4" />
  </Button>
  <Button size="sm" variant="ghost" onClick={() => setEditDraftId(d.id)} title="Edit">
    <Pencil className="h-4 w-4" />
  </Button>
  ```
- Render both dialogs at the bottom; on edit save → refresh the row via existing `fetchDrafts()`.

**2. `src/components/admin/chatgpt-agent/ChatGptAgentEditDialog.tsx`** (new, only if no editor exists to reuse)
- Loads draft by id.
- Editable fields: `normalized_title`, `summary`, `seo_title`, `meta_description`, `slug`, `organisation_name`, `post_name`, `vacancy_count`, `salary_text`, `qualification_text`, `age_limit_text`, `application_mode`, `job_location`, `opening_date`, `closing_date`, `exam_name`, `official_apply_link`, `official_notification_link`, and `draft_content_html` (textarea — same trust model as existing intake admin).
- Save → `supabase.from('intake_drafts').update({...}).eq('id', draftId)` then close + call parent `onSaved()`.
- Includes a "Preview" button inside edit dialog that opens `IntakeDraftPreviewDialog` for live verification.

### Exploration step (during implementation, before writing edit dialog)
Search `src/components/admin/intake/` for any existing edit dialog to avoid duplication. Build new only if none exists.

### Deliberately not changed
- `IntakeDraftPreviewDialog` — used as-is.
- Pipeline logic, edge functions, DB schema — untouched.
- Row layout — only two icon buttons added to existing actions cell.

### Risk
None. Read + scoped update on `intake_drafts` (already permitted by existing admin RLS).

