

## Production Hardening: `extract-employment-news`

### Files Changed
1. `supabase/functions/extract-employment-news/index.ts` — Full parsing layer rewrite
2. `src/components/admin/EmploymentNewsManager.tsx` — Frontend warning handling (lines 350-435)

---

### Edge Function Changes

**A. New `parseAIResponse(rawText, requestId)` — centralized parser**

Pipeline (in priority order):
1. Detect + strip markdown code fences (` ```json...``` `)
2. Search for `{"jobs"\s*:\s*\[` pattern block
3. Find largest balanced `{...}` block
4. Fallback: first `{` to last `}`
5. Strict `JSON.parse` on extracted text
6. If fails → existing brace-depth repair logic
7. Validate each job object
8. Return `ParseResult` with `parseMeta` (never throws)

**B. Refactor `callAI` → returns `{ rawText, finishReason }` only**

- All `JSON.parse` calls removed from provider branches
- Safe `?.` chains on all nested access
- Empty/blocked responses return `{ rawText: '', finishReason: 'blocked' }`
- Only infrastructure errors (timeout, auth, rate limit) throw

**C. Job validation (`isValidJob`)**

Accepts a job if:
- Has a non-placeholder `post` or `title` **AND** a non-placeholder `org_name` or `organization`
- **OR** has a non-placeholder `post` or `title` **AND** a valid URL in `apply_link` or `source`

Placeholder values rejected: `n/a`, `unknown`, `-`, `--`, `nil`, `none`, `not available`, `tbd`, `...`, empty strings.

Field normalization: `title` → `post`, `organization` → `org_name` before validation.

**D. Single retry on zero valid jobs**

After `parseAIResponse` returns 0 valid jobs, retry once with:
`"Return ONLY valid JSON: {\"jobs\":[...]}. No markdown, no fences, no explanation."`

If retry also yields 0 → accept 0 with `retryTriggered: true` in diagnostics.

**E. Structured response shape**

Every response:
```json
{
  "ok": true,
  "degraded": false,
  "batchId": "...",
  "newCount": 3,
  "updatedCount": 1,
  "totalInChunk": 5,
  "warnings": ["JSON repair recovered 3/5 objects"],
  "parseMeta": {
    "rawLength": 4200,
    "hadCodeFence": false,
    "hadProse": true,
    "strictParseOk": false,
    "repairAttempted": true,
    "repairSucceeded": true,
    "retryTriggered": false,
    "recoveredCount": 3,
    "rejectedCount": 1,
    "skipped": false,
    "finishReason": "stop",
    "provider": "vertex-ai",
    "model": "gemini-2.5-flash",
    "chunkIndex": 2
  }
}
```

Parse-only failures → HTTP 200 with `ok: true, degraded: true`. Never HTTP 500 for parse issues.

**F. Per-chunk structured log**

```
[reqId] CHUNK_RESULT | provider=vertex-ai | model=gemini-2.5-flash | chunk=3/10 | rawLen=4200 | finish=stop | fence=false | prose=true | strictParse=false | repair=true | retry=false | valid=3 | rejected=1
```

---

### Frontend Changes (EmploymentNewsManager.tsx)

**Lines 380-418** — Replace error handling in the chunk loop:

- Distinguish infrastructure errors (network/auth) from degraded extraction
- Collect `data?.warnings` into `chunkWarnings[]` array across the loop
- Track `degradedChunks` count
- After loop: if warnings exist, show summary toast: `"Extraction completed with warnings: 2 chunks degraded, 3 jobs rejected during validation"`
- Never throw on `data?.degraded === true`
- Guard all `data?.newCount` with `?? 0`

---

### Technical Details

- `repairTruncatedJson` logic unchanged (brace-depth recovery) — just wrapped by the centralized parser
- `resolveModel`, `sanitizeText`, date resolution, DB upsert logic — all preserved unchanged
- Error catch block for timeout/429/402 — preserved unchanged
- The retry prompt is shorter and explicitly forbids markdown/prose

