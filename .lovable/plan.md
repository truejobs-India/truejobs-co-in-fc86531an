

# Verification Report: ChatGPT Agent — Models, Edge Functions, Publish Routing

## 1. AI Model Routing Verification

### ALLOWED_MODELS list (ChatGptAgentManager.tsx line 34-40)
19 models listed. Every one has explicit routing in `intake-ai-classify/index.ts`:

| UI Model Key | Route in Edge Function | Status |
|---|---|---|
| `gemini-flash` | GATEWAY_MODEL_MAP → `google/gemini-2.5-flash` | Correct |
| `gemini-pro` | GATEWAY_MODEL_MAP → `google/gemini-2.5-pro` | Correct |
| `gpt5` | GATEWAY_MODEL_MAP → `openai/gpt-5` | Correct |
| `gpt5-mini` | GATEWAY_MODEL_MAP → `openai/gpt-5-mini` | Correct |
| `lovable-gemini` | GATEWAY_MODEL_MAP → `google/gemini-3-flash-preview` | Correct |
| `vertex-flash` | VERTEX_MODEL_MAP → `gemini-2.5-flash` via Direct API | Correct |
| `vertex-pro` | VERTEX_MODEL_MAP → `gemini-2.5-pro` via Direct API | Correct |
| `vertex-3.1-pro` | VERTEX_MODEL_MAP → `gemini-3.1-pro-preview` via Direct API | Correct |
| `vertex-3-flash` | VERTEX_MODEL_MAP → `gemini-3-flash-preview` via Direct API | Correct |
| `vertex-3.1-flash-lite` | VERTEX_MODEL_MAP → `gemini-3.1-flash-lite-preview` via Direct API | Correct |
| `nova-pro` | BEDROCK_MODELS set → `callBedrockNova` | Correct |
| `nova-premier` | BEDROCK_MODELS set → `callBedrockNova` | Correct |
| `nemotron-120b` | BEDROCK_MODELS set → `callBedrockNova` | Correct |
| `mistral` | BEDROCK_MODELS set → special Mistral Converse API | Correct |
| `azure-gpt4o-mini` | AZURE_OPENAI_MODELS → `callAzureOpenAI` (default gpt-4o-mini) | Correct |
| `azure-gpt41-mini` | AZURE_OPENAI_MODELS → `callAzureGPT41Mini` | Correct |
| `azure-gpt5-mini` | AZURE_OPENAI_MODELS → `callAzureGPT5Mini` | Correct |
| `azure-deepseek-v3` | AZURE_DEEPSEEK_MODELS → `callAzureDeepSeek('DeepSeek-V3.1')` | Correct |
| `azure-deepseek-r1` | AZURE_DEEPSEEK_MODELS → `callAzureDeepSeek('DeepSeek-R1')` | Correct |

**No silent fallbacks possible.** Any model not in these maps falls through to the Lovable Gateway with `DEFAULT_MODEL`, but since the `allowedValues` prop on `AiModelSelector` restricts selection to only these 19 models, no unroutable model can be selected.

**Verdict: All models correctly routed. No issues.**

---

## 2. Edge Function Verification

### intake-ai-classify (lines 505-937)

**Action routing (line 529-637):**
- `action` is read from body (line 529)
- `enrich` → sets `fillEmptyOnly = true` (line 531), triggers fill-empty-only mode (line 640)
- `seo_fix`, `improve_title`, `improve_summary`, `generate_slug`, `normalize_fields` → handled by `TARGETED_ACTIONS` switch (lines 543-637) with focused prompts and minimal tool schemas
- `fix` / empty string → falls through to normal classification mode (line 772+)

**All 7 AI actions from the dropdown are properly handled.**

**Auth:** Checks `Authorization` header, validates user via `getUser`, checks admin role. Correct.

**Batching:** Frontend sends `draft_ids` array in single call (line 228-230 of Manager). Edge function processes up to 20 (line 536-537). Correct.

### intake-publish (lines 283-640)

**Auth:** Same pattern — header check, `getUser`, admin role check. Correct.

**Invocation from Manager (line 186-188):** Uses `supabase.functions.invoke('intake-publish', { body: { draft_id: id } })`. The edge function reads `body.draft_id` (line 305). Correct.

**Gate checks (lines 319-331):** Requires `publish_ready` or `manual_check` + `approved` review_status. Checks blockers array. Correct.

**Issue found:** The Manager's `handlePublish` (line 181) sets `review_status: 'approved'` right before calling the edge function, but it does NOT pass an `Authorization` header explicitly. However, `supabase.functions.invoke` automatically includes the auth token from the client session, so this works correctly.

---

## 3. Publish Routing Verification

### Section bucket → publish_target mapping (chatgptAgentExcelParser.ts lines 40-49)

| section_bucket | publish_target | content_type |
|---|---|---|
| `job_postings` | `jobs` | `job` |
| `admit_cards` | `admit_cards` | `admit_card` |
| `results` | `results` | `result` |
| `answer_keys` | `answer_keys` | `answer_key` |
| `exam_dates` | `exams` | `exam` |
| `admissions` | `notifications` | `notification` |
| `scholarships` | `scholarships` | `scholarship` |
| `other_updates` | `notifications` | `notification` |

### intake-publish destination table mapping (lines 380-599)

| publish_target | Destination Table | Correct? |
|---|---|---|
| `jobs` | `employment_news_jobs` (status='published', source='intake_pipeline') | Correct |
| `notifications` | `employment_news_jobs` (job_category='Notification') | Correct |
| `exams` | `govt_exams` (status='upcoming') | Correct |
| `results` | `govt_results` (with exam linking via `findOrCreateExam`) | Correct |
| `admit_cards` | `govt_admit_cards` (with exam linking) | Correct |
| `answer_keys` | `govt_answer_keys` (with exam linking) | Correct |
| `scholarships` | `employment_news_jobs` (job_category='Scholarship') | Correct |

### CRITICAL ISSUE FOUND: `certificates` and `marksheets` publish targets are BLOCKED

In `intake-publish/index.ts` lines 115-117:
```typescript
case 'certificates':
case 'marksheets':
  return `Publish target "${target}" has no safe live destination — keep in manual review`;
```

This means if the AI classifier sets `publish_target = 'certificates'` or `'marksheets'`, publishing will **always fail** with an error. This is consistent with the v1 design where certificates route to `scholarships` section_bucket — the parser (line 161) routes certificate subcategories to `scholarships` bucket which maps to `publish_target = 'scholarships'`.

However, there's a gap: the AI classifier's tool schema (line 326) allows `publish_target = 'certificates'` and `'marksheets'` as valid enum values. If the AI selects these values during classification, the draft becomes unpublishable.

**This is the only real issue.** The AI can set `publish_target` to `certificates` or `marksheets` during classification, which then blocks publishing permanently unless manually corrected.

### Fix needed

In `intake-ai-classify/index.ts`, after the AI returns `publish_target`, add a safety remap:

```typescript
// After line 885 (where update.publish_target is set)
if (update.publish_target === 'certificates' || update.publish_target === 'marksheets') {
  update.publish_target = 'scholarships';
}
```

This is a 2-line fix in one file. It ensures AI-classified certificate/marksheet drafts get the same `scholarships` publish target that the Excel parser assigns, making them publishable.

## Summary

| Item | Status |
|---|---|
| 19 allowed models all have explicit routing | Already correct |
| No silent model fallbacks possible | Already correct |
| All 7 AI actions properly routed | Already correct |
| Batch invocation working | Already correct |
| Auth on both edge functions | Already correct |
| Section → publish_target mapping | Already correct |
| Publish target → destination table mapping | Already correct |
| `certificates`/`marksheets` publish_target from AI classifier | **Needs 2-line fix** — remap to `scholarships` |

## Files to change

| File | Change |
|---|---|
| `supabase/functions/intake-ai-classify/index.ts` | Add 2-line safety remap after AI sets `publish_target` to prevent unpublishable `certificates`/`marksheets` values |

