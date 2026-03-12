

# Refinement: BlogPostEditor Submit Flow & BulkPublishModal Fail Reasons

Two targeted changes to the approved plan.

## 1. BlogPostEditor — Split handleSubmit into precheck + executeSubmit

**Current:** Single `handleSubmit` function (line 204) does validation and save.

**New pattern:**

```
executeSubmit = async () => {
  // existing lines 205-227 logic (title/content check, buildPostData, supabase insert/update, toast, close)
}

handleSubmit = () => {
  // basic validation (title/content required)
  if (!formData.title.trim() || !formData.content.trim()) { toast error; return; }

  // compliance gating (only when publishing)
  if (formData.is_published) {
    if (complianceStatus === 'Blocked' && !publishOverride) { toast error; return; }
    if (complianceStatus === 'Needs Review') { setShowNeedsReviewConfirm(true); return; }
  }

  executeSubmit();
}
```

**AlertDialog wiring:**
- `open={showNeedsReviewConfirm}` / `onOpenChange={setShowNeedsReviewConfirm}`
- Cancel → closes dialog (no action)
- Confirm → calls `executeSubmit()` then `setShowNeedsReviewConfirm(false)`

**Key:** `showNeedsReviewConfirm` is only dialog visibility state — never used as a guard flag or resubmission trigger. No `useEffect` watching it. The confirm button directly calls `executeSubmit()`.

## 2. BulkPublishModal — Blocked article fail reasons display

In the validation stage, when rendering blocked articles, show top fail reasons from:

```tsx
const topFails = compliance.checks
  .filter(c => c.status === 'fail')
  .slice(0, 3);
```

Each rendered as:
```tsx
{topFails.map(f => (
  <p key={f.key} className="text-xs text-destructive flex items-start gap-1">
    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
    <span>
      {f.label}
      {f.recommendation && <span className="text-muted-foreground"> — {f.recommendation}</span>}
    </span>
  </p>
))}
```

This replaces the previous vague "top 2-3 fail reasons" spec with an explicit implementation path using `c.label` and `c.recommendation`.

No other changes to the approved plan.

