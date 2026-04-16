

# ChatGPT Agent — Audit Fixes + Persistent Messages (Combined)

## 4 items, 2 files to change

### 1. Wire `action` parameter in edge function (Critical)

**File:** `supabase/functions/intake-ai-classify/index.ts`

Read `action` from the request body. Route to targeted behavior:

- `fix` / `classify` / empty → existing full classification (no change)
- `enrich` → set `fill_empty_only = true`, fall through to existing fill logic
- `seo_fix` → targeted prompt updating only `seo_title`, `slug`, `meta_description`, `summary`
- `improve_title` → targeted prompt for `normalized_title` and `seo_title` only
- `improve_summary` → targeted prompt for `summary` and `meta_description` only
- `generate_slug` → targeted prompt for `slug` only
- `normalize_fields` → targeted prompt to clean `organisation_name`, `post_name`, `exam_name`, `qualification_text`, `age_limit_text`, `salary_text`

~80 lines added via a switch block before the existing classification logic.

### 2. Restrict model selector to routable models (Critical)

**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

Add an `allowedValues` array of only the models the edge function can actually route, and pass it to `AiModelSelector`. This prevents silent fallback for `groq`, `claude-sonnet`, `sarvam-30b`, `sarvam-105b`.

```typescript
const ALLOWED_MODELS = [
  'gemini-flash', 'gemini-pro', 'gpt5', 'gpt5-mini', 'lovable-gemini',
  'vertex-flash', 'vertex-pro', 'vertex-3.1-pro', 'vertex-3-flash', 'vertex-3.1-flash-lite',
  'nova-pro', 'nova-premier', 'mistral', 'nemotron-120b',
  'azure-gpt4o-mini', 'azure-gpt41-mini', 'azure-gpt5-mini',
  'azure-deepseek-v3', 'azure-deepseek-r1',
];
```

### 3. Batch AI action calls (Minor)

**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

Replace the per-ID loop with a single `supabase.functions.invoke` call sending all selected IDs in one `draft_ids` array.

### 4. Replace toasts with persistent admin messages

**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

- Replace `useToast` with `useAdminMessages('chatgpt-agent')`
- Convert all ~12 `toast()` calls to `addMessage(type, title, description)`
- Render `<AdminMessageLog>` at the top of the card content
- Messages persist until manually dismissed or cleared via "Clear All Messages" button

## Files changed

| File | Changes |
|---|---|
| `supabase/functions/intake-ai-classify/index.ts` | Read `action`, add switch block with targeted prompts per action type |
| `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` | Allowed models filter, batch calls, replace toasts with `AdminMessageLog` |

