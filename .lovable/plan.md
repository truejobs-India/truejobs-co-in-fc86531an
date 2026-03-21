

# Phase 1: Backend Reliability Fixes

## Files to Change

1. `supabase/functions/generate-blog-faq/index.ts`
2. `supabase/functions/analyze-blog-compliance-fixes/index.ts`

No frontend changes in this phase.

---

## Change 1: Fix `generate-blog-faq` syntax error

**File**: `generate-blog-faq/index.ts`, line 164

**Problem**: `function callAI` uses `await` inside (line 168) but is not declared `async`. This crashes on deploy.

**Fix**: Change `function callAI` → `async function callAI`

---

## Change 2: `analyze-blog-compliance-fixes` — increase token budget

**File**: line 184

Change `maxOutputTokens: 4000` → `maxOutputTokens: 8192`

---

## Change 3: Compact and improve the prompt

**File**: lines 138-180 — rewrite the prompt to be shorter and add new instructions.

Key prompt changes:
- Shorten the fix-object field descriptions into a compact list instead of verbose bullets
- Change meta_description target from "140-155" to "130-155 characters strictly, never above 155"
- Add canonical_url instruction: "value must be exactly `https://truejobs.co.in/blog/{slug}`"
- Add FAQ schema eligibility instruction: "For FAQ fixes, include `faqSchemaEligible` (boolean). If true, include `faqSchema` as a JSON array of `{question, answer}` objects. If not eligible, set false and explain why in `explanation`."
- Tell AI to keep `explanation` ≤ 15 words to reduce output size
- Keep all existing internal_links, intro, conclusion instructions (already good)

---

## Change 4: Expand `VALID_FIX_TYPES`

**File**: lines 33-38

Add `'h1'`, `'heading_structure'`, `'excerpt'` to the set.

---

## Change 5: Expand `normalizeFix` to pass through FAQ schema fields

**File**: lines 60-95

Add to return type and extraction:
- `faqSchemaEligible?: boolean` — pass through if present
- `faqSchema?: Array<{question: string, answer: string}>` — pass through if valid array

Also add slug safety: if `field === 'slug'` and `confidence !== 'high'`, downgrade `applyMode` to `'advisory'`.

---

## Change 6: Truncation detection + parse-failure handling

**File**: lines 187-200 — replace the current silent parse logic.

New logic after receiving `raw`:

```text
1. Strip markdown code fences (existing)
2. Check if raw ends with ']' — if not, log "[COMPLIANCE] Truncation detected"
3. Attempt bounded recovery:
   - Find last complete object via lastIndexOf('},')
   - If found, trim and close array: raw.substring(0, pos+1) + ']'
   - Log "[COMPLIANCE] Recovery attempted — salvaged N chars"
   - Set truncated=true, recoveryAttempted=true
   - If not found, set parseError=true
4. JSON.parse — if fails, set parseError=true, fixes=[]
5. Log: "[COMPLIANCE] Result: N fixes, truncated=X, parseError=X"
6. Return: { fixes, truncated, parseError, recoveryAttempted }
```

**Before**: Parse failure → silent `[]` → frontend thinks "no issues found"
**After**: Parse failure → `{ fixes: [], parseError: true }` → frontend can show warning

---

## Sample response shape after changes

```json
{
  "fixes": [
    {
      "issueKey": "missing-meta-desc",
      "issueLabel": "Meta description missing",
      "priority": "high",
      "fixType": "metadata",
      "field": "meta_description",
      "suggestedValue": "Check latest government job updates...",
      "explanation": "Empty meta description hurts SEO",
      "applyMode": "apply_field",
      "confidence": "high"
    },
    {
      "issueKey": "missing-faq",
      "issueLabel": "No FAQ section",
      "priority": "medium",
      "fixType": "faq",
      "field": "",
      "suggestedValue": "<h2>FAQ</h2><h3>Q1?</h3><p>A1</p>...",
      "explanation": "FAQ improves rich snippets",
      "applyMode": "append_content",
      "confidence": "high",
      "faqSchemaEligible": true,
      "faqSchema": [
        {"question": "Q1?", "answer": "A1"},
        {"question": "Q2?", "answer": "A2"}
      ]
    }
  ],
  "truncated": false,
  "parseError": false,
  "recoveryAttempted": false
}
```

---

## Remaining for Phase 2 (frontend)

- Expanded `shouldAutoOverwriteField` logic in `BlogAITools.tsx`
- `validateFieldValue` pre-save checks
- Strict canonical URL validator (`isValidCanonicalUrl`)
- FAQ schema DB write on auto-apply
- Truncation/parseError toast feedback in UI
- `h1` and `heading_structure` in frontend allowlists

