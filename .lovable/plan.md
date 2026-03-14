

## Plan: Overhaul Employment News Enrichment with Master Prompt

### Changes to `supabase/functions/enrich-employment-news/index.ts`

**1. Add `MASTER_ENRICH_PROMPT` constant** (after line 31)
- The full master prompt from the spec covering: language detection, enriched_title (80 chars), meta_title (60 chars), meta_description (155 chars), slug, enriched_description with 9 HTML sections (Quick Overview table, Introduction, Vacancy Details, Eligibility, Salary & Benefits, Selection Process, How to Apply, Important Dates, Important Links), FAQ schema HTML, JobPosting JSON-LD, 15-20 bilingual keywords, job_category
- Includes zero-filler rules, specific data requirements, and JSON output format

**2. Add `detectLanguage()` helper** (after the constant)
- Scans all input field values for Devanagari characters (Unicode `\u0900-\u097F`)
- Returns `"Hindi (Devanagari script)"` if >30% Devanagari, else `"English"`

**3. Update model temperatures**
- `fetchGemini`: `0.1` → `0.5`
- `callMistralRaw`: `0.1` → `0.5`
- `callClaudeRaw`: `0.1` → `0.6`
- `callLovableGeminiRaw`: `0.1` → `0.5`

**4. Replace inline `enrichPrompt`** (lines 349-392)
- Build a user prompt with just the raw input fields
- Call `detectLanguage()` and append `OUTPUT LANGUAGE: Hindi/English`
- Combine: `MASTER_ENRICH_PROMPT + "\n\n" + userDataPrompt`

**5. No changes to:**
- `callAI()` dispatcher, model function signatures, database save logic, auth checks, batch processing, slug conflict check, schema date overrides, field validation

**6. After deploy:** Test with a Hindi job (Gemini) and an English job (Claude) from the database.

