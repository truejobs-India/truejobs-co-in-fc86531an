

## Plan: Fix Root Causes of Vertex 429 in Employment News Extraction

### Root Cause Analysis

**Finding 1 — No text cleaning.** Raw DOCX text (extracted via mammoth) is sent directly to the edge function without removing whitespace noise, empty lines, repeated spaces, or OCR artifacts. A 60-page Employment News issue could produce 80K+ chars of raw text, but 15-25% is typically whitespace noise. No cleaning = more chunks = more Vertex calls.

**Finding 2 — No inter-chunk delay.** The frontend (`EmploymentNewsManager.tsx`) sends chunks sequentially via a `for` loop, but fires the next request immediately after the previous one completes. For a document with 8+ chunks, this creates sustained burst load against the same Vertex AI quota.

**Finding 3 — No partial-success handling.** If chunk 1-4 succeed and chunk 5 hits a 429, the frontend throws an error and discards all progress. The batch was already partially saved to the database, but the user sees "Extraction Failed" with no record of partial success.

**Finding 4 — Default maxOutputTokens (8192) is unnecessarily high.** Each chunk is ~10K chars which typically yields 3-8 job listings. The JSON output for 8 jobs is ~3K tokens. Setting maxOutputTokens lower reduces Vertex resource consumption per request.

**Finding 5 — No server-side observability.** The function logs nothing about text size, chunk context, or processing stage, making future diagnosis impossible.

### Changes

#### File 1: `supabase/functions/extract-employment-news/index.ts`

**A. Add text sanitization function** (before AI call)
- Collapse runs of whitespace/tabs to single space
- Remove blank lines (3+ newlines → 2)
- Strip common OCR noise patterns (e.g., runs of underscores, pipe characters used as column separators)
- Trim each line
- Log original vs cleaned text length

**B. Add structured logging** with requestId
- Generate a `requestId` (crypto.randomUUID)
- Log at entry: requestId, filename, raw text length, cleaned text length
- Log before AI call: prompt length
- Log after AI call: jobs extracted count
- Log on error: error category (parsing/ai/db), requestId

**C. Reduce maxOutputTokens to 4096**
- Sufficient for the structured JSON output from a 10K char chunk
- Reduces Vertex resource pressure per call

**D. Keep model as `gemini-2.5-flash`**
- Already the lightest suitable model for structured extraction
- Flash-lite would risk quality degradation on OCR text

**E. Keep existing 429 error handling** (already correct from previous fix)

#### File 2: `src/components/admin/EmploymentNewsManager.tsx`

**A. Add inter-chunk throttle delay**
- After each successful chunk response, wait 2 seconds before sending the next
- Prevents burst patterns against Vertex quota

**B. Handle partial success on 429**
- If a chunk returns a 429 or error, stop processing remaining chunks
- Show a toast with partial results: "Extracted X jobs from Y/Z chunks. Remaining chunks can be retried."
- Don't throw away the batchId — the user can re-upload and it will continue accumulating

**C. Increase CHUNK_SIZE from 10,000 to 15,000 chars**
- After text cleaning removes ~20% noise, effective content per chunk stays similar
- Fewer total chunks = fewer Vertex calls = less 429 risk
- 15K chars + 1.5K system prompt ≈ 4K tokens input — well within Flash limits

### Files Changed
1. `supabase/functions/extract-employment-news/index.ts` — text cleaning, logging, reduced maxOutputTokens
2. `src/components/admin/EmploymentNewsManager.tsx` — throttle delay, partial success handling, chunk size increase

### What is NOT changing
- No changes to `_shared/vertex-ai.ts` (retry logic there is already correct)
- No new edge functions
- No architecture changes
- No model switch
- No changes to database schema

