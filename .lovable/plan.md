

## Plan: Tighten Mistral AI Writing Strategy for Blog Generation

### What changes

**1. Add the Mistral system prompt as a constant** in `supabase/functions/generate-blog-article/index.ts`

A new `MISTRAL_SYSTEM_PROMPT` constant will contain the full expert SEO writer prompt provided (structure rules, SEO optimization, content quality, tone, word count guidance, and output format instructions). The output format will be adapted to request JSON (matching the existing parsing pipeline) rather than Markdown with `---` metadata, so it integrates seamlessly with the current response parser.

**2. Update `callMistral()` to accept a system prompt**

- Add a `systemPrompt` parameter to `callMistral()`
- Change temperature from `0.5` to `0.6`
- Keep `maxTokens` at `8192`
- Send the system prompt as a separate system-role message in the Bedrock Converse payload

**3. Update `callAI()` dispatcher**

- When model is `'mistral'`, build a Mistral-specific prompt that combines the `MISTRAL_SYSTEM_PROMPT` with the topic/category/tags, then pass both to `callMistral()`

**4. Update the main handler**

- When `aiModel === 'mistral'`, construct a simpler user prompt (just topic + category + tags) since the system prompt handles all writing rules
- The existing JSON parsing and field extraction logic remains unchanged — the Mistral system prompt will instruct the model to return the same JSON structure as other models

### Files modified

- `supabase/functions/generate-blog-article/index.ts` — all changes in this single file
- Redeploy after editing

### Key design decisions

- The Mistral system prompt requests the **same JSON output format** as the default prompt (title, slug, content as HTML, metaTitle, metaDescription, excerpt, category, tags) so no downstream parsing changes are needed
- Only Mistral gets the specialized prompt; all other models continue using the existing generic prompt
- The system prompt is stored as a constant — no user input required

