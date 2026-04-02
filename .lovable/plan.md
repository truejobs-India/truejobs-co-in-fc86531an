

# Add Output Language Selector to Bulk Article Generator

## Overview
Add an explicit "Output Language" control to the bulk article writing UI, pass it to the backend, and enforce it strictly in all prompt paths with validation and one-retry logic.

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/BlogPostEditor.tsx` | Add `outputLanguage` state (localStorage-backed), render selector UI, pass value in all generation request bodies |
| `supabase/functions/generate-blog-article/index.ts` | Accept `outputLanguage` param, resolve language, inject strict language instructions into all 3 prompt branches, validate output, auto-retry once on mismatch |

## UI Changes (BlogPostEditor.tsx)

1. **New state** (localStorage-backed, like `blogTextModel`):
```typescript
const [outputLanguage, setOutputLanguage] = useState<'auto' | 'english' | 'hindi'>(() => {
  try { return (localStorage.getItem('blog_output_language') as any) || 'auto'; } catch { return 'auto'; }
});
```

2. **Selector control** — placed in the bulk generator controls row (around line 1798, after the "Target Words" control, before the model badge). A simple `Select` dropdown matching the existing UI style:
```
Output Language: [Auto ▼]  (options: Auto, English, Hindi)
```

3. **Pass in request body** — all 3 invocation sites (handleBulkGenerate ~line 1248, handleRetryFailedArticles ~line 1309, and any single-generation path):
```typescript
body: { topic, category, targetWordCount, aiModel, outputLanguage }
```

## Backend Changes (generate-blog-article/index.ts)

### 1. Language Resolution (after parsing request body ~line 711)

```typescript
const outputLanguage = body.outputLanguage || 'auto';
let resolvedLang: 'english' | 'hindi';

if (outputLanguage === 'english' || outputLanguage === 'hindi') {
  resolvedLang = outputLanguage;
} else {
  // Auto: detect from topic using Devanagari character count
  const devCount = (topic.match(/[\u0900-\u097F]/g) || []).length;
  resolvedLang = devCount >= 3 ? 'hindi' : 'english';
}
```

### 2. Language Instruction Strings

```typescript
const langInstruction = resolvedLang === 'english'
  ? 'LANGUAGE RULE: Write the entire output in English only. Do not write in Hindi or Devanagari. Do not switch languages.'
  : 'LANGUAGE RULE: पूरी सामग्री हिन्दी (देवनागरी) में लिखें। लेख को अंग्रेज़ी में न लिखें। केवल आवश्यक technical terms जैसे SSC, UPSC, salary, notification आदि स्वाभाविक रूप में रखे जा सकते हैं।';
```

### 3. Inject into All 3 Prompt Branches

- **Gemini/Mistral** (~line 725): Prepend `langInstruction + '\n\n'` before the prompt
- **Claude** (~line 741): Add `langInstruction` after "Important instructions:"
- **Default** (~line 764): Replace line "Write in Hindi or English — match the language of the topic" with `langInstruction`

### 4. Output Validation + One Retry

After parsing the AI response (~line 831), before returning:

```typescript
function checkLanguageMismatch(content: string, expected: 'english' | 'hindi'): boolean {
  const devChars = (content.match(/[\u0900-\u097F]/g) || []).length;
  const totalChars = content.replace(/\s|<[^>]*>/g, '').length;
  const devRatio = totalChars > 0 ? devChars / totalChars : 0;
  if (expected === 'english') return devRatio > 0.15;
  if (expected === 'hindi') return devRatio < 0.40;
  return false;
}
```

If mismatch detected on first attempt:
- Log: `[generate-blog-article] Language mismatch detected, retrying once`
- Re-call `callAI()` with a stricter correction prepended: `"CRITICAL: Your previous output was in the WRONG language. You MUST write in [English/Hindi] ONLY. This is your final attempt."`
- If second attempt also mismatches, return the result anyway with `languageValidation: { requested, detected, mismatch: true, retried: true }`

### 5. Logging

Add console.log at resolution point:
```
[generate-blog-article] outputLanguage=hindi resolvedLang=hindi topicPreview="SSC CGL 2026..." autoDetected=false
```

And after validation:
```
[generate-blog-article] languageCheck: expected=hindi devRatio=0.72 mismatch=false retried=false
```

### 6. Response Payload Addition

Add to the response JSON:
```typescript
languageValidation: {
  requested: outputLanguage,
  resolved: resolvedLang,
  mismatch: boolean,
  retried: boolean,
}
```

## What Is NOT Changed
- Single article editor flow (not bulk) — only affected if it calls the same edge function
- Existing writing logic, word count enforcement, model selection, JSON parsing
- System prompts content (only the per-request user prompt gets the language instruction injected)

## Remaining Limitation
- Language validation is heuristic (Devanagari ratio). Mixed-script content (e.g., technical English terms in Hindi articles) may cause false positives, but the thresholds (15% / 40%) are conservative enough to avoid this in practice.

