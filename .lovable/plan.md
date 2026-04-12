

# Revised Plan: Strengthen Fix All by AI Pipeline

Two corrections applied to the previously approved plan. Everything else unchanged.

---

## Correction 1: `h1WasInserted` scope fix

Declare the flag **before** the conditional block so it is accessible later.

**File**: `src/hooks/useBulkAutoFix.ts` — after faq_count sync (~line 565), before compliance check (~line 567)

```typescript
// Pre-fix: deterministic H1 insertion (in-memory only, persisted via main update)
let h1WasInserted = false;
if (post.content && !/<h1[^>]*>/i.test(post.content)) {
  const escapedTitle = post.title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const h1Tag = `<h1>${escapedTitle}</h1>`;
  post.content = insertBeforeFirstHeadingRaw(post.content, h1Tag);
  h1WasInserted = true;
  console.log(`[BULK_AUTO_FIX] Deterministic H1 fix for "${post.slug}"`);
}
```

Then after the fix loop, before the main DB write:

```typescript
if (h1WasInserted && !contentChanged) {
  modifiedContent = post.content;
  contentChanged = true;
}
```

---

## Correction 2: `failed` article re-eligibility — already handled

The current code at line 181-183 already makes `failed` articles re-eligible in smart scope:

```typescript
if (post.last_bulk_fix_status === 'failed') {
  return { eligible: true, reason: 'failed' };
}
```

And `isEligibleForFailedPartialScope` at line 197 also includes them. **No code change needed for `failed` articles.** The only gap was `no_action_taken` with remaining issues, which is addressed by adding (at line 190-191):

```typescript
if (post.last_bulk_fix_status === 'no_action_taken' && (post.remaining_auto_fixable_count ?? 0) > 0) {
  return { eligible: true, reason: 'partial' };
}
```

---

## Full change list (carried forward, unchanged except corrections above)

| # | Change | File |
|---|--------|------|
| 1 | Deterministic H1 fix — in-memory, HTML-escaped, `h1WasInserted` declared at outer scope | `src/hooks/useBulkAutoFix.ts` |
| 2 | Separate H1 handler from intro handler (line ~794) | `src/hooks/useBulkAutoFix.ts` |
| 3 | FAQ fallback brace scoping bug fix (lines ~721-736) | `src/hooks/useBulkAutoFix.ts` |
| 4 | Functional second pass — extract fix loop, apply from second pass | `src/hooks/useBulkAutoFix.ts` |
| 5 | `no_action_taken` re-eligibility in smart scope (line ~190) | `src/hooks/useBulkAutoFix.ts` |
| 6 | `h1-present` normalization rescue + applyMode guard | `supabase/functions/analyze-blog-compliance-fixes/index.ts` |

No analyzer changes. No threshold/weight/gate/scoring changes.

