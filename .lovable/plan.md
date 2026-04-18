
## Approved final plan (with `date` token refinement)

### 1. Parser — `chatgptAgentExcelParser.ts`

**a) Classifier with explicit priority + safer `date` handling.**

Tokenize via `/[a-z0-9]+/g` lowercased. Try `update_type` first; on no match, try `category_family`. First match in this order wins:

| # | Trigger | section_bucket | content_type | publish_target |
|---|---|---|---|---|
| 1 | `answer` token | `answer_keys` | `answer_key` | `answer_keys` |
| 2 | `admit` token | `admit_cards` | `admit_card` | `admit_cards` |
| 3 | `result` token | `results` | `result` | `results` |
| 4 | `scholarship` token | `scholarships` | `scholarship` | `scholarships` |
| 5 | `job` / `recruit` / `recruitment` / `vacancy` / `hiring` token | `job_postings` | `job` | `jobs` |
| 6 | **Exam (refined):** `exam` / `schedule` / `calendar` / `datesheet` token, OR adjacent pair `date`+`sheet`, OR adjacent pair `exam`+`date`, OR adjacent pair `exam`+`schedule`. **Standalone `date` token alone does NOT trigger this family** | `exam_dates` | `exam` | `exams` |
| 7 | `admission` token | `admissions` | `notification` | `notifications` (enum-safe — no `admission` enum exists) |
| 8 | `notification` / `notice` token | `other_updates` | `notification` | `notifications` |
| 9 | No match → retry whole table on `category_family` | — | — | — |
| 10 | Still no match | `other_updates` | `null` | `none` |

Adjacent-pair check: tokens `i` and `i+1` in the token array.

**Validation cases asserted in harness:**
- `Update` → other_updates / null / none (proves substring bug dead)
- `Recruitment Update` → job_postings
- `Exam Update` → exam_dates
- `Notification Update` → other_updates / notification / notifications
- `Vacancy Notice` → job_postings (job > notice)
- `Result Notification` → results (result > notification)
- `Admit Card Notice` → admit_cards
- `Answer Key Notice` → answer_keys
- `Date Sheet` → exam_dates (paired)
- `Exam Date` → exam_dates (paired)
- `Last Date Notification` → other_updates / notification / notifications (standalone `date` does NOT route to exam)
- `Due Date Notice` → other_updates / notification / notifications
- `Admission Notice` → admissions / notification / notifications
- `Scholarship` → scholarships

**b) Inline Excel-serial date conversion (no `XLSX.SSF`).**
```ts
function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
```
Accept numbers and numeric strings. Always preserve original raw text in `source_verified_on`. Populate `source_verified_on_date` when serial-parseable OR when text matches a recognizable date format (`YYYY-MM-DD`, `DD-MMM-YYYY`, `DD/MM/YYYY`); unparseable text → date column null, original text preserved.

### 2. Importer — `ChatGptAgentManager.tsx`

- **Search input** — verify a visible `<Input>` exists above the listing; if missing, add one. Predicate is case-insensitive `includes` across: `publish_title`, `normalized_title`, `organization_authority`, `organisation_name`, `record_id`, `official_source_used`, `production_notes`, `official_website_url`, `official_reference_url`, `primary_cta_url`.
- **Filter row** — 5 `Select` dropdowns (Publish Status, Category Family, Update Type, Verification Status, Verification Confidence). Options from distinct non-null values in current `drafts`. Each has "All" reset option. Combined with search in single memoized pipeline.
- **Listing columns** — audit current table; add any missing of: Publish Title, Category Family, Update Type, Org/Authority, Verification Status, Verification Confidence, Source Verified On, Primary CTA (label + clickable URL `target="_blank" rel="noopener"`).
- **Count math fix** — `total = inserted_new + updated_existing + skipped_empty + failed`. Pre-classify each attempted row as insert/update against pre-fetched identity Set; subtract its failure from the bucket it was classified into.

### 3. Verification

- **Parser harness** in `/tmp/verify_parser.mjs`: assert all 14 classifier cases above, date conversion (`45000`→`2023-03-15`, `1`→valid ISO, text preserved, null safe), URL sanitation, identity rules, empty-row skip, legacy mirror, sheet detection.
- **DB-level proof** via `supabase--read_query`: column existence, identity uniqueness, sample row inspection.
- **UI upload (clarification #4)** — I cannot click the upload button. Final report will explicitly state:
  > Code + parser + DB are directly verified. The browser upload-button flow was NOT exercised by the AI. **Verdict: code/parser/DB verified — fully production ready only after one real upload-button-based workbook test by the user.**

### Files
- `src/components/admin/chatgpt-agent/chatgptAgentExcelParser.ts` — new `classifyRow()` + refined exam pairing + `excelSerialToISO()`
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — search input verify/add, 5 filter selects, columns audit, count math fix
- `/tmp/verify_parser.mjs` — verification harness (not committed)
