

## Phase 5: AI Features + Current Affairs — Implementation Plan

### Architecture

```
Frontend (React)
    ↓ supabase.functions.invoke() with auth token
Edge Function (Deno)
    ↓ JWT validated via getClaims()
    ↓ DB queries via Supabase client
AWS Bedrock (SigV4 signing)
    ↓
Mistral Models
    ├─ mistral.mixtral-8x7b-instruct-v0:1  → Question generation
    └─ mistral.mistral-large-2402-v1:0      → Answer evaluation + Reports
```

Reuses existing `callBedrockConverse()` + SigV4 signing from `enrich-job-descriptions/index.ts`.

---

### Batch 1: Database + Current Affairs (5B)

**Migration — 5 tables:**

1. `current_affairs`: id, date, slug, title, content, category, tags (text[]), source_url, created_at
2. `daily_quiz_questions`: id, date, question_text, options (jsonb), correct_option_id, explanation, category, difficulty_level, created_at
   - RLS: public SELECT, admin ALL via `has_role()`
3. `ai_interview_sessions`: id, user_id, exam_type, interview_mode, subject_area, candidate_profile (jsonb), questions_count, overall_score, timer_seconds (nullable), status (default 'in_progress'), created_at, updated_at
4. `ai_interview_messages`: id, session_id (FK), board_member, question, answer, score, knowledge_score, communication_score, confidence_score, structure_score, relevance_score, feedback, question_order, created_at
5. `ai_interview_reports`: id, session_id (FK), user_id, exam_type, mode, report_json (jsonb), overall_score, knowledge_score, communication_score, confidence_score, structure_score, presence_score, strengths (text[]), improvements (text[]), recommended_topics (text[]), created_at
   - RLS on 3-5: users CRUD own rows, admin SELECT all

**Frontend — `/current-affairs`:** Date picker, category tabs, CA cards, 10-question daily quiz, monthly PDF download, JSON-LD.

**Admin — `CurrentAffairsManager`:** CRUD + bulk add in AdminDashboard.

---

### Batch 2: AI Interview Edge Function (5A — Backend)

**Edge function: `ai-interview`**
- `verify_jwt = false` in config.toml but validates JWT in code via `getClaims()` — returns 401 if unauthenticated
- Models: Mixtral 8x7B for questions, Mistral Large for evaluation + reports
- Actions: `start_interview`, `next_question`, `evaluate_answer`, `generate_report`
- Queries `current_affairs` for question context
- DB filtering before any AI call

---

### Batch 3: AI Interview Frontend (5A — UI)

**`/ai-interview`:** Step 1 exam type → Step 2 mode → Step 3 profile → Timer config (60/90/120s/unlimited) → Chat interface with board member labels → Post-interview report with recharts + PDF download + save.

**`/dashboard/interview-history`:**
- Paginated table (20/page) with next/previous
- Progress tracking: score trend, skill radar, subject-wise bar charts
- Interview comparison: side-by-side skill table
- **AI progress analysis:** Button that sends **max 5** most recent session summaries (scores + metadata only, not full Q&A) to Bedrock (Mistral Large) for textual insights. Hard cap enforced server-side in the edge function — reject requests exceeding 5 sessions.

Voice-ready architecture: input via `onSubmit(text: string)` for future speech-to-text.

---

### Batch 4: AI Exam Matcher (5C)

**Edge function: `ai-exam-matcher`** (public, no auth)
- Step 1: DB filter `govt_exams` by age/qualification/category (SQL WHERE)
- Step 2: Send filtered list (max ~30) to Mixtral 8x7B for ranking

**`/ai-exam-matcher`:** Multi-step form → loading animation → sorted result cards with match %, reasons, "View Details" link.

---

### Batch 5: Tools Page + Polish

- Add "AI-Powered Tools" and "Exam Preparation" sections to Tools.tsx
- Cross-links from Sarkari Jobs and Govt Exam Detail pages

---

## Phase 6 Addendum — SEO & Feature Enhancements

### 1. Telegram Bot (Replaces Widget)

- **Edge function: `telegram-bot-webhook`** — handles `/start`, `/subscribe`, `/unsubscribe`, `/categories`, `/state`, `/qualification`
- **Edge function: `send-telegram-alerts`** — triggered on new job/admit card/result/deadline
- **Database:** `telegram_subscribers` table (`id`, `telegram_user_id` bigint unique, `categories` jsonb, `qualification` text, `state` text, `is_active` boolean default true, `created_at`). RLS: service_role ALL.
- **Frontend:** Update `TelegramAlertWidget.tsx` to link to bot URL (stored in `app_settings`)
- **Secret required:** `TELEGRAM_BOT_TOKEN`

---

### 2. Programmatic SEO — Complete Combinations

New `GovtProgrammaticPage.tsx` (lazy-loaded). Slug patterns resolved via DB queries:

| Pattern | Example | DB Query |
|---------|---------|----------|
| `{dept}-jobs` | `/ssc-jobs` | `WHERE exam_category ILIKE '%ssc%'` |
| `govt-jobs-{state}` | `/govt-jobs-bihar` | `WHERE states @> '{bihar}'` |
| `govt-jobs-{city}` | `/govt-jobs-patna` | Predefined city-to-state map |
| `{qual}-govt-jobs` | `/graduate-govt-jobs` | `WHERE qualification_tags @> '{graduate}'` |
| `{dept}-jobs-{state}` | `/ssc-jobs-bihar` | Combined filters |
| `{dept}-{qual}-jobs` | `/ssc-graduate-jobs` | Combined filters |
| `govt-jobs-{state}-{qual}` | `/govt-jobs-up-graduate` | Combined filters |
| `{dept}-jobs-{city}` | `/ssc-jobs-delhi` | Combined filters |

Page only renders if >= 1 matching exam exists. Falls through to NotFound otherwise.

---

### 3. Auto-Generated SEO Intro Content

Template-driven `generateSEOIntro(filters)` utility producing 300+ word HTML intros + 3-5 FAQs + FAQ JSON-LD + internal links per programmatic page.

---

### 4. Deadline-Based SEO Pages

New `GovtDeadlinePage.tsx` (lazy-loaded). Slug patterns:

- `govt-jobs-last-date-today` / `tomorrow` / `this-week` / `this-month`
- `govt-jobs-last-date-{month}-{year}` (e.g., `govt-jobs-last-date-july-2026`)

Queries `govt_exams.application_end` relative to current date. Badges: "Closing Today", "Closing Tomorrow", "Closing This Week".

---

### 5. Search Query Capture

Wire existing `upsert_search_query` RPC into `Jobs.tsx`, `SarkariJobs.tsx`. Add "Search Insights" (top 50 queries) to admin panel.

---

### 6. Internal Linking Enforcement

- **`QuickLinksBlock.tsx`** — standardized links grid on all govt exam detail pages
- **`ContextualLinks.tsx`** — "More {department} Jobs", "More Jobs in {state}", "More {qualification} Jobs"
- **`RelatedExams.tsx`** — 4-6 similar exams by `exam_category` or `qualification_tags`

All integrated into `GovtExamDetail.tsx`.

---

### 7. Discovery Page — `/all-sarkari-jobs`

Sections: A-Z index, department grouping, year grouping, qualification grouping, latest jobs, closing soon, upcoming exams, latest results, latest admit cards. Auto-updates on new entries.

---

### 8. Job Freshness Signals

In `GovtExamDetail.tsx`: "Last Updated" display, badges (Updated Today, Recently Updated, Closing Soon, Closing Tomorrow), `datePublished`/`dateModified` in JSON-LD schema.

---

### 9. Prerender Verification

Add `GovtProgrammaticPage` and `GovtDeadlinePage` to `SEOCacheBuilder` for static HTML generation. Verify structured data in cached HTML.

---

### 10. Execution Order

| Batch | Additions |
|-------|-----------|
| Batch 3 (Alerts) | Telegram bot, `telegram_subscribers` table |
| Batch 4 (Programmatic SEO) | Complete combinations, auto-generated intros, deadline pages |
| Batch 5 (Discovery) | `/all-sarkari-jobs`, freshness badges |
| Batch 6 (Internal Linking) | QuickLinksBlock, ContextualLinks, RelatedExams |
| Batch 7 (Sitemap) | Deadline pages + programmatic slugs in sitemaps, prerender cache |
| Any batch | Search query capture wiring |

---

## Selection-Based SEO Pages (Without Exam)

### Database
- `selection_type` text column added to `govt_exams` (values: `written_exam`, `interview`, `merit`, `direct_recruitment`, `skill_test`)
- Index: `idx_govt_exams_selection_type`

### Components
- **`GovtSelectionPage.tsx`** — renders selection-based programmatic pages with DB-driven listings, 300+ word intro, FAQ schema, internal links
- **`selectionPageData.ts`** — slug parser (`parseSelectionSlug`) + config builder (`buildSelectionPageConfig`) + SEO intro generator + FAQ generator

### Slug Patterns (in SEOLandingResolver)
| Pattern | Example |
|---------|---------|
| `govt-jobs-without-exam` | Main page |
| `{qual}-govt-jobs-without-exam` | `/10th-pass-govt-jobs-without-exam` |
| `{dept}-jobs-without-exam` | `/railway-jobs-without-exam` |
| `govt-jobs-without-exam-{state}` | `/govt-jobs-without-exam-bihar` |

### Query Logic
All pages filter `govt_exams WHERE selection_type IN ('interview','merit','direct_recruitment')` + optional dept/qual/state filters. Page only renders if >= 1 result.

### Sitemap & Prerender
Add to `sitemap-combinations.xml` and `seo_page_cache` in future batches.

---

## Phase C: Exam Authority Pages (SEO Content Hub)

### Architecture
- `src/data/examAuthority/` — typed config registry with `Map<string, ExamAuthorityConfig>` for O(1) slug lookup
- `src/pages/govt/ExamAuthorityPage.tsx` — renders all authority page types (notification, syllabus, exam-pattern, eligibility, salary)
- Resolved via `SEOLandingResolver.tsx` Step 0 (before all other SEO pages)

### Batch 1 (Complete): SSC CGL — 5 pages
| Slug | Type | Meta Title |
|------|------|-----------|
| `ssc-cgl-2026-notification` | notification | SSC CGL 2026 Notification – Dates, Eligibility, Apply |
| `ssc-cgl-2026-syllabus` | syllabus | SSC CGL Syllabus 2026 – Complete Topic-wise Guide |
| `ssc-cgl-2026-exam-pattern` | exam-pattern | SSC CGL Exam Pattern 2026 – Tier 1 & 2 Details |
| `ssc-cgl-2026-eligibility` | eligibility | SSC CGL Eligibility 2026 – Age, Qualification |
| `ssc-cgl-2026-salary` | salary | SSC CGL Salary 2026 – Pay Scale, In-Hand, Perks |

### Phase C Complete ✅
- 80 authority pages across 16 exam clusters (SSC, Railway, Banking, Defence/UPSC)
- 16 Exam Cluster Hub pages (`/{exam}-hub`) with subtopic cards + FAQs
- 16 Previous Year Paper pages (`/{exam}-previous-year-paper`) with year-wise tables
- 3 enrichment sections on notification pages: Admit Card, Cutoff Table, Result
- PopularExamsBlock on SarkariJobs, LatestGovtJobs, GovtExamDetail
- SEOCacheBuilder updated with hub + PYP loops (sections 13, 14)
- Dynamic sitemap includes all 32 new slugs

---

## Phase D: Programmatic Pages (Planned)

### Objective
Generate programmatic SEO pages from database fields for long-tail traffic capture.

### Planned Page Types
1. **State + Qualification combos** — `/govt-jobs-{state}-{qualification}` (e.g. `/govt-jobs-uttar-pradesh-graduation`)
2. **Department landing pages** — `/{dept}-jobs` with live listings from DB
3. **Monthly deadline pages** — `/govt-jobs-last-date-{month}-{year}`
4. **Exam calendar pages** — `/govt-exam-calendar-{month}-{year}`

### Prerequisites
- Phase C complete ✅
- Minimum 50 active govt_exams rows in database
- State/qualification taxonomy finalized

### Implementation Notes
- Reuse SEOLandingResolver pattern with new step priorities
- Each page type needs 300+ word intro + FAQ schema
- Thin-content guard: only render if ≥1 matching listing exists

---

## Phase E: Calculator Tie-ins, Guide System, Internal Linking, Outreach Assets

### E-3: Long-Form Guide Generation via External Gemini API

#### Architecture
- **Single source of truth**: Guide metadata (slugs, prompts, tags, internal links) lives ONLY in the edge function `generate-guide-content/index.ts`. No separate `src/data/guidesMetadata.ts` file. The edge function owns the config array and uses it directly for generation + insertion.
- **Storage**: Existing `blog_posts` table + `/blog/:slug` route. No new tables or routes.
- **Model**: External Gemini API (`gemini-2.5-flash`) via `GEMINI_API_KEY` secret.
- **Category**: `'Career Advice'` (already allowed by DB).

#### Validation Rules (enforced before DB insert)
Before inserting into `blog_posts`, the edge function MUST validate Gemini output:

1. **meta_title**: ≤60 characters. If over, truncate at last word boundary + "…"
2. **meta_description**: 140–155 characters. If under 140, pad with " | TrueJobs". If over 155, truncate at last word boundary + "…"
3. **FAQ count**: Must contain 5–7 FAQs. If fewer than 5 or more than 7, re-extract or trim to exactly 5.
4. **Internal link URLs**: Each `href` must start with `/` and match a known route pattern (e.g., `/ssc-cgl-2026-notification`, `/govt-salary-calculator`, `/sarkari-jobs`). Reject any absolute URLs or broken paths. Log warnings for unrecognized paths but still insert.
5. **Word count**: Must be ≥1,800 words. If under, log warning but still insert as draft for manual expansion.
6. **Content structure**: Must contain at least 3 H2 headings. If not, log warning.

#### 10 Guide Slugs
All published under `/blog/`:
1. `ssc-cgl-preparation-guide`
2. `govt-jobs-after-12th-guide`
3. `upsc-vs-ssc-guide`
4. `railway-jobs-guide`
5. `govt-salary-calculation-guide`
6. `govt-jobs-by-stream-guide`
7. `nda-preparation-guide`
8. `sbi-po-vs-ibps-po-guide`
9. `govt-jobs-bihar-guide`
10. `agniveer-complete-guide`

#### Flow
```
POST /functions/v1/generate-guide-content { slug: "all" | "<specific-slug>" }
  → Loop guide configs (single source array in edge function)
  → Call Gemini API with detailed prompt per guide
  → Parse + validate response (meta title, meta desc, FAQs, links, word count)
  → Fix/truncate fields that fail validation
  → Insert into blog_posts as draft (status: 'draft', is_published: false)
  → Return report: { generated: [...], skipped: [...], validation_warnings: [...], errors: [...] }
```

#### Files
| Action | File |
|--------|------|
| CREATE | `supabase/functions/generate-guide-content/index.ts` |
| MODIFY | `supabase/config.toml` — add `[functions.generate-guide-content]` |
