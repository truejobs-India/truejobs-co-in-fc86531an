

# Implementation Plan: Government Jobs Assistant Chatbot

## Overview
Replace the current private-jobs chatbot (`job-search-smart`) with a Government Jobs Assistant powered by AWS Mistral Large via Bedrock. Non-streaming request/response model. Grounded in TrueJobs site data with strict link/source rules.

## Step 1: Database Migration

Create `chatbot_analytics` table and `log_chatbot_event` RPC, plus seed `app_settings` rows.

```sql
-- chatbot_analytics table
CREATE TABLE public.chatbot_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  query_text text,
  query_language text,
  intent text,
  retrieval_status text,
  retrieval_count integer DEFAULT 0,
  was_refused boolean DEFAULT false,
  refusal_reason text,
  response_time_ms integer,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.chatbot_analytics ENABLE ROW LEVEL SECURITY;

-- Admin-only read
CREATE POLICY "Admins can read chatbot analytics"
  ON public.chatbot_analytics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Security-definer insert RPC
CREATE OR REPLACE FUNCTION public.log_chatbot_event(
  p_session_id text, p_query_text text, p_query_language text,
  p_intent text, p_retrieval_status text, p_retrieval_count integer,
  p_was_refused boolean, p_refusal_reason text, p_response_time_ms integer,
  p_ip_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO chatbot_analytics (session_id, query_text, query_language, intent,
    retrieval_status, retrieval_count, was_refused, refusal_reason, response_time_ms, ip_hash)
  VALUES (p_session_id, LEFT(p_query_text, 200), p_query_language, p_intent,
    p_retrieval_status, p_retrieval_count, p_was_refused, p_refusal_reason, p_response_time_ms, p_ip_hash);
END; $$;

-- Seed app_settings for chatbot config
INSERT INTO public.app_settings (key, value, description, is_internal) VALUES
  ('chatbot_enabled', '{"enabled": true}'::jsonb, 'Enable/disable chatbot', false),
  ('chatbot_welcome_message', '{"en": "Hi! I am TrueJobs Sarkari Jobs Assistant. Ask me about government jobs, exams, eligibility, admit cards, results, syllabus, and more!", "hi": "नमस्ते! मैं TrueJobs सरकारी नौकरी सहायक हूं। सरकारी नौकरी, परीक्षा, पात्रता, एडमिट कार्ड, रिज़ल्ट, सिलेबस के बारे में पूछें!"}'::jsonb, 'Chatbot welcome message', false),
  ('chatbot_suggested_prompts', '{"prompts": ["SSC CGL eligibility kya hai?", "UP Police admit card kab aayega?", "12th pass sarkari jobs", "Railway Group D syllabus", "Latest govt jobs in Bihar"]}'::jsonb, 'Chatbot suggestion chips', false),
  ('chatbot_fallback_message', '{"en": "Sorry, I am unable to process your request right now. Please try again shortly.", "hi": "क्षमा करें, अभी आपका अनुरोध संसाधित नहीं हो पा रहा। कृपया थोड़ी देर बाद प्रयास करें।"}'::jsonb, 'Chatbot error fallback', false),
  ('chatbot_blocked_phrases', '{"phrases": ["hack", "cheat", "bypass", "inject", "exploit"]}'::jsonb, 'Blocked phrases for chatbot', true)
ON CONFLICT (key) DO NOTHING;
```

## Step 2: Edge Function — `govt-jobs-assistant`

**File:** `supabase/functions/govt-jobs-assistant/index.ts`

Reuse the existing `awsSigV4Fetch` pattern from `improve-blog-content/index.ts` (copy the SigV4 helpers inline).

### Core flow:
1. CORS handling
2. Parse `{ message, sessionId, conversationHistory }` from request body
3. **Input validation**: 500 char max, content safety regex filter, prompt injection stripping
4. **Best-effort rate limiting** via in-memory Maps (5/min, 30/session, 60/hour/IP-hash). Acknowledged as best-effort in serverless — instances may restart, multiple instances don't share state.
5. **Load admin config** from `app_settings` (cached 60s in-memory): `chatbot_enabled`, `chatbot_blocked_phrases`
6. **Smart retrieval pipeline**:
   - Normalize keywords: lowercase, strip diacritics, remove stop words
   - Expand via alias map (~100 entries: `cgl→ssc cgl`, `एसएससी→ssc`, etc.)
   - Hindi-English term map: `आयु सीमा→age limit`, `सिलेबस→syllabus`, `एडमिट कार्ड→admit card`, etc.
   - Intent detection: classify query into `eligibility|age_limit|admit_card|result|syllabus|salary|dates|how_to_apply|job_search|site_navigation|general_info`
   - Query language detection: `en|hi|hinglish`
   - Query tables with `or()`+`ilike` using normalized English keywords:
     - `govt_exams` (exam_name, conducting_body, states, qualification_required, seo_keywords)
     - `govt_results` (result_title via join)
     - `govt_answer_keys` (title)
     - `employment_news_jobs` (org_name, post, qualification, state, keywords, enriched_title) — status='published'
     - `blog_posts` (title, category, tags) — is_published=true
     - `pdf_resources` (title, exam_name, category, subject, tags) — is_published=true
   - Score each result 0-100 (exact name +40, keyword in title +25, keyword in tags +15, intent-field alignment +20)
   - **Tie-break**: equal scores ordered by table priority: govt_exams > govt_results > govt_answer_keys > employment_news_jobs > blog_posts > pdf_resources
   - Take top 10 overall
   - Fallback: if all scores <20 or 0 results, retry with individual keywords; if still empty, `retrieval_status='no_match'`
7. **Build system prompt** with:
   - Strict govt jobs persona
   - Source-priority rules (exact site data → partial → cautious general → refuse)
   - `RETRIEVED_PAGES` block with exact URLs from retrieval (max 10)
   - Instruction: max 3 links per response, only from RETRIEVED_PAGES
   - Link grounding: never fabricate URLs
   - Incomplete data behavior: answer only what's known, explicitly state what's missing, never fill gaps with invented specifics
   - Private jobs redirection
   - Anti-hallucination rules
   - Disclaimer rules (language-aware, context-dependent, not on every message)
   - Source-trust language ("Based on TrueJobs exam pages...")
   - Structured answer format (short answer → details → resources → disclaimer)
8. **Call Mistral Large** via Bedrock Converse API (`mistral.mistral-large-2407-v1:0`, region `us-west-2`)
   - Non-streaming, full response
   - 60s timeout via AbortController
   - 1 retry on 429/5xx with 2s backoff
   - On failure: return admin-configured fallback message
9. **Log analytics** via `log_chatbot_event` RPC (sanitized query text: truncated 200 chars, PII stripped)
10. **Return** `{ response: string }` as JSON

### Config update:
Add to `supabase/config.toml`:
```toml
[functions.govt-jobs-assistant]
verify_jwt = false
```

## Step 3: Rewrite `JobSearchBot.tsx`

**File:** `src/components/chat/JobSearchBot.tsx`

### UI changes:
- Header: "TrueJobs सरकारी सहायक" / "Government Jobs Assistant"
- Suggestion chips loaded from `app_settings.chatbot_suggested_prompts` on mount (fallback hardcoded govt-focused chips)
- Welcome message loaded from `app_settings.chatbot_welcome_message`
- Input placeholder: "सरकारी नौकरी के बारे में पूछें..."
- Bottom hint: `Try: "SSC CGL eligibility kya hai?"`
- Tooltip: "Sarkari Jobs AI Assistant"
- All calls changed from `job-search-smart` to `govt-jobs-assistant`
- Pass `{ message, sessionId, conversationHistory }` in body
- Generate `sessionId` (uuid) on mount
- Client-side message counter: warning at 25, disable at 30

### Draggable floating icon:
- Track `position: {x, y}` in state, persist in `sessionStorage('chatbot-position')`
- `onPointerDown` records start position; `onPointerMove` updates position
- Drag vs click: total movement <5px = click (toggle chat), otherwise drag
- Viewport clamping: `[16, innerWidth-80]` × `[16, innerHeight-80]`
- Mobile: bottom margin ≥80px (above StickyMobileCTA)
- Double-click: reset to default position (bottom-right)
- Chat window anchored relative to button position, constrained within viewport

### Link rendering:
- Updated `renderMessageContent` to handle multiple patterns:
  - `[text](/sarkari-exam/slug)`, `[text](/employment-news/slug)`, `[text](/blog/slug)`, `[text](/sample-papers/slug)`, `[text](/books/slug)`, `[text](/previous-year-papers/slug)`, `[text](/sarkari-result/slug)`, `[text](/answer-key/slug)`
- Unknown URL patterns rendered as plain text (not clickable)
- Use `react-markdown` for rendering AI responses with markdown support

### Check chatbot_enabled:
- On mount, fetch `chatbot_enabled` from `app_settings`; if disabled, don't render the floating button

## Step 4: Update Language Translations

**File:** `src/contexts/LanguageContext.tsx`

Update all `chat.*` keys:
- `chat.title` → "TrueJobs सरकारी सहायक"
- `chat.subtitle` → "Government Jobs Assistant"
- `chat.placeholder` → "सरकारी नौकरी के बारे में पूछें..."
- `chat.hint` → `Try: "SSC CGL eligibility kya hai?"`
- `chat.tooltipTitle` → "Sarkari Jobs AI Assistant"
- `chat.tooltipDesc` → "सरकारी नौकरी, परीक्षा, एडमिट कार्ड, रिज़ल्ट की जानकारी पाएं"
- `chat.greeting` → govt-focused welcome in en/hi/bn

## Step 5: Admin Components

### `src/components/admin/ChatbotSettingsManager.tsx` (CREATE)
Simple form editing `app_settings` keys: `chatbot_enabled`, `chatbot_welcome_message`, `chatbot_suggested_prompts`, `chatbot_fallback_message`, `chatbot_blocked_phrases`.

### `src/components/admin/ChatbotAnalytics.tsx` (CREATE)
Dashboard card querying `chatbot_analytics`:
- Total queries (today/week/month)
- Refusal count & reasons
- Average response time
- Top intents
- Retrieval hit rate (strong/partial/no_match)
- Top unanswered queries

## Step 6: Admin Dashboard Integration

**File:** `src/pages/admin/AdminDashboard.tsx`

Add a "Chatbot" tab with `MessageSquare` icon containing both `ChatbotSettingsManager` and `ChatbotAnalytics`.

## Files Summary

| File | Action |
|------|--------|
| DB migration | CREATE table + RPC + seed |
| `supabase/functions/govt-jobs-assistant/index.ts` | CREATE |
| `supabase/config.toml` | ADD function entry |
| `src/components/chat/JobSearchBot.tsx` | REWRITE |
| `src/contexts/LanguageContext.tsx` | UPDATE chat.* keys |
| `src/components/admin/ChatbotSettingsManager.tsx` | CREATE |
| `src/components/admin/ChatbotAnalytics.tsx` | CREATE |
| `src/pages/admin/AdminDashboard.tsx` | ADD chatbot tab |

## Implementation Sequence

1. Database migration (chatbot_analytics + RPC + app_settings seed)
2. Create `govt-jobs-assistant` edge function with SigV4 Mistral + retrieval pipeline + guardrails + analytics logging
3. Add config.toml entry + deploy
4. Rewrite `JobSearchBot.tsx` (govt UI + draggable + new endpoint + markdown rendering)
5. Update language translations
6. Create admin ChatbotSettingsManager + ChatbotAnalytics
7. Add chatbot tab to AdminDashboard

