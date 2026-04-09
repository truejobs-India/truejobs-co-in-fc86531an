

# Fix: Hindi Safeguard Triggers on English Articles

## Problem
`applyNovaHindiSafeguard()` in `bedrock-nova.ts` matches English words like `"hindi"` that appear in instructional prompt text (e.g., "Keep the same language (Hindi/English)"). This causes ALL enrichment calls — even for English articles — to get a strong "write in Devanagari" instruction prepended, producing Hindi/garbage output.

## Fix — 1 file only: `supabase/functions/_shared/bedrock-nova.ts`

Rewrite the `applyNovaHindiSafeguard()` function (lines 125-138) to use **Devanagari character ratio detection** instead of keyword matching:

1. **Remove all English keyword markers** (`'hindi'`, `'in hindi'`, `'hindi mein'`, `'devanagari'`, etc.) — these cause false positives on instructional text
2. **Keep only Devanagari script markers** (`'हिंदी'`, `'हिन्दी'`, `'भाषा'`)
3. **Add a Devanagari character ratio check**: count characters in the `\u0900-\u097F` range. Only trigger the safeguard if either a Devanagari marker is found **AND** >5% of the prompt's non-whitespace characters are Devanagari. This ensures the article content itself is actually Hindi, not just mentioned in passing.

```typescript
export function applyNovaHindiSafeguard(prompt: string): string {
  // Only trigger on actual Devanagari content, not English mentions of "hindi"
  const devanagariChars = (prompt.match(/[\u0900-\u097F]/g) || []).length;
  const totalChars = prompt.replace(/\s/g, '').length || 1;
  const devanagariRatio = devanagariChars / totalChars;

  // Need meaningful Devanagari presence (>5%) to trigger
  if (devanagariRatio < 0.05) return prompt;

  const hindiInstruction = `\n\n[IMPORTANT — Hindi Output Requirement]...`;
  return hindiInstruction + prompt;
}
```

## What is NOT changed
- No other file is touched
- No model prompts in `improve-blog-content`, `generate-blog-article`, `enrich-authority-pages`, or `rss-ai-process` are modified
- No routing logic changed
- The `callBedrockNova` and `callBedrockNovaWithMeta` functions remain identical except they now call the corrected safeguard

## Deployment
Redeploy all edge functions that import from `_shared/bedrock-nova.ts`: `improve-blog-content`, `generate-blog-article`, `enrich-authority-pages`, `rss-ai-process`.

## Verification
Test enrichment of an English article with Nemotron — confirm output is entirely English with no Hindi contamination.

