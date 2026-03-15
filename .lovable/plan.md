

# Corrected Final Plan: Downloadable PDF Resources System

## Changes in This Revision

1. **Removed** `updated_at` trigger from `resource_events` — table is append-only
2. **Removed** public INSERT policy on `resource_events` — all inserts go through `log_resource_event` RPC (SECURITY DEFINER)
3. **Added** `review_notes text` column to `pdf_resources`

---

## 1. Database Migration

### Table: `pdf_resources`

```sql
CREATE TABLE public.pdf_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('sample_paper', 'book', 'previous_year_paper')),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  download_filename text,
  file_url text,
  file_size_bytes bigint,
  page_count integer,
  file_hash text,
  cover_image_url text,
  featured_image_alt text,
  content text NOT NULL DEFAULT '',
  excerpt text,
  meta_title text,
  meta_description text,
  faq_schema jsonb DEFAULT '[]',
  category text,
  exam_name text,
  subject text,
  language text DEFAULT 'hindi',
  exam_year integer,
  edition_year integer,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'draft' CHECK (status IN ('draft','generated','ready_for_review','published','archived')),
  is_featured boolean DEFAULT false,
  is_trending boolean DEFAULT false,
  is_published boolean DEFAULT false,
  is_noindex boolean DEFAULT false,
  duplicate_approved boolean DEFAULT false,
  review_notes text,                    -- admin notes during review workflow
  published_at timestamptz,
  download_count integer DEFAULT 0,
  cta_click_count integer DEFAULT 0,
  final_download_count integer DEFAULT 0,
  word_count integer DEFAULT 0,
  reading_time integer DEFAULT 5,
  ai_model_used text,
  ai_generated_at timestamptz,
  image_model_used text,
  content_hash text,
  author_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pdf_resources_type_status ON pdf_resources(resource_type, status);
CREATE INDEX idx_pdf_resources_category ON pdf_resources(category);
CREATE INDEX idx_pdf_resources_slug ON pdf_resources(slug);
CREATE INDEX idx_pdf_resources_file_hash ON pdf_resources(file_hash);
CREATE INDEX idx_pdf_resources_content_hash ON pdf_resources(content_hash);

ALTER TABLE public.pdf_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published resources viewable by everyone"
  ON public.pdf_resources FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage resources"
  ON public.pdf_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

### Auto `updated_at` trigger (pdf_resources ONLY)

```sql
CREATE TRIGGER set_pdf_resources_updated_at
  BEFORE UPDATE ON public.pdf_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### Table: `resource_events` (append-only, NO updated_at)

```sql
CREATE TABLE public.resource_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES public.pdf_resources(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'page_view','cta_click','whatsapp_click','telegram_click','email_submit','final_download'
  )),
  user_agent text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.resource_events ENABLE ROW LEVEL SECURITY;

-- NO public INSERT policy. All inserts go through log_resource_event RPC.
-- Only admins can read events for analytics.
CREATE POLICY "Admins can read events"
  ON public.resource_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

**No trigger on `resource_events`**. This table is append-only event logging — rows are never updated.

### Secure RPC for event logging

```sql
CREATE OR REPLACE FUNCTION public.log_resource_event(
  p_resource_id uuid,
  p_event_type text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Validate event_type server-side
  IF p_event_type NOT IN ('page_view','cta_click','whatsapp_click','telegram_click','email_submit','final_download') THEN
    RAISE EXCEPTION 'Invalid event type: %', p_event_type;
  END IF;

  -- Validate resource exists
  IF NOT EXISTS (SELECT 1 FROM pdf_resources WHERE id = p_resource_id AND is_published = true) THEN
    RETURN; -- silently ignore events for non-existent/unpublished resources
  END IF;

  -- Insert event
  INSERT INTO resource_events (resource_id, event_type, user_agent, referrer)
  VALUES (p_resource_id, p_event_type, LEFT(p_user_agent, 500), LEFT(p_referrer, 500));

  -- Update aggregate counters
  IF p_event_type = 'cta_click' THEN
    UPDATE pdf_resources SET cta_click_count = cta_click_count + 1 WHERE id = p_resource_id;
  ELSIF p_event_type = 'final_download' THEN
    UPDATE pdf_resources SET final_download_count = final_download_count + 1, download_count = download_count + 1 WHERE id = p_resource_id;
  END IF;
END; $$;
```

**Security improvements over previous plan:**
- No public INSERT policy on `resource_events` — the RPC function uses SECURITY DEFINER to bypass RLS
- Server-side validation of `event_type` against allowlist
- Server-side validation that resource exists and is published
- Input truncation (`LEFT(…, 500)`) to prevent oversized payloads
- Silent ignore for invalid resource IDs (no error leak)

**Client-side usage**: `supabase.rpc('log_resource_event', { p_resource_id, p_event_type, p_user_agent, p_referrer })`

This works for anonymous/unauthenticated users because `log_resource_event` is SECURITY DEFINER — it executes with the function owner's privileges, bypassing RLS. The anon key is sufficient to call RPCs.

### Storage paths

```
pdfs/sample-papers/{slug}.pdf
pdfs/books/{slug}.pdf
pdfs/previous-year-papers/{slug}.pdf
resource-covers/sample-papers/{slug}.webp
resource-covers/books/{slug}.webp
resource-covers/previous-year-papers/{slug}.webp
```

Use existing `blog-assets` bucket (public).

---

## 2. Route Strategy (hub prefix, collision-safe)

```
/sample-papers                              → SamplePapers listing
/sample-papers/hub/:hubSlug                 → ResourceHub
/sample-papers/:slug                        → ResourceDetail
/sample-papers/:slug/download               → ResourceDownload

/books                                      → Books listing
/books/hub/:hubSlug                         → ResourceHub
/books/:slug                                → ResourceDetail
/books/:slug/download                       → ResourceDownload

/previous-year-papers                       → PreviousYearPapers listing
/previous-year-papers/hub/:hubSlug          → ResourceHub
/previous-year-papers/:slug                 → ResourceDetail
/previous-year-papers/:slug/download        → ResourceDownload
```

Reserved slug validation and hub registry in `src/lib/resourceHubs.ts`.

---

## 3. Status Workflow — No Auto-Publish

```
draft → generated → ready_for_review → published → archived
```

AI generation sets status to `generated` only. Publishing requires explicit admin action after quality checks. Admin can use `review_notes` to annotate resources during any status.

---

## 4. Publish Quality Checks

Blocking: word_count >= 1000, title, file_url, slug unique + not reserved, no unresolved file_hash duplicate.
Warning: meta_title <= 60 chars, meta_description 120-160 chars, cover_image_url present, category set, faq_schema >= 3 items, no content_hash similarity.

---

## 5. Duplicate Detection

- File hash (SHA-256 client-side) stored in `file_hash`
- Content hash (first 500 chars normalized) stored in `content_hash`
- Title/metadata overlap check on save
- `duplicate_approved` field for admin override

---

## 6. Noindex Rules

`noindex` if ANY: `is_published = false`, `is_noindex = true`, `status != 'published'`, `word_count < 500`, `meta_title` empty, `file_url` empty, unresolved file_hash duplicate without `duplicate_approved`.

---

## 7. Canonical Strategy

- Detail pages: self-canonical
- Hub pages: self-canonical
- Listing with query params matching a hub: canonical to hub URL
- Download interstitial: `noindex, nofollow`

---

## 8. Download Flow (unchanged)

Step 1: Detail page "Download PDF" button → navigates to `/:type/:slug/download`, logs `cta_click` via RPC.
Step 2: Interstitial with TrueJobs branding, subscription CTAs, benefits, trust content (~300 words).
Step 3: Final "Download PDF Now" button → triggers download with clean filename (`download_filename || slug.pdf`), logs `final_download` via RPC.

Error handling: redirect to listing if resource not found/unpublished, show "File unavailable" if `file_url` missing, fallback filename from slug.

---

## 9. Image Fallback

If AI image generation fails: toast error, `cover_image_url = null`, public pages show category-based default from static map. Admin can always manually upload.

---

## 10. AI Content Similarity Safeguards

Prompt includes slug, year, subject, language for variation. Content hash compared post-generation. Admin warned if similar. No auto-publish ensures review.

---

## 11. Edge Function: `generate-resource-content`

Same `callAI` dispatcher as `generate-custom-page`. Input includes all metadata fields + slug for variation. Output: content, excerpt, meta fields, FAQs, content_hash. Sets `status = 'generated'` only.

---

## 12. Admin: `PdfResourcesManager.tsx`

Follows `CustomPagesManager.tsx` pattern. All fields manually editable including `review_notes`. Tab toggle for 3 resource types. PDF upload with auto-extraction (size, pages, hash). AI model selectors. Status workflow buttons. Quality checklist. Duplicate warnings. Analytics summary per resource.

---

## 13. Sitemap

Add `resources` type to `dynamic-sitemap`. Include only published, non-noindex, word_count >= 500 resources + listing pages + hub pages. Exclude download interstitials.

---

## 14. Internal Linking

Detail pages: related resources (same category+type), related exam pages, related blog guides, related tools.
Hub/listing pages: top downloads, latest uploads, trending, exam/subject nav chips, cross-type links.

---

## 15. Files Summary

| File | Action |
|------|--------|
| **DB migration** | CREATE `pdf_resources` + `resource_events` + RLS + trigger (pdf_resources only) + `log_resource_event` RPC + indexes |
| `supabase/functions/generate-resource-content/index.ts` | CREATE |
| `supabase/functions/dynamic-sitemap/index.ts` | MODIFY — add `resources` sitemap type |
| `src/lib/resourceHubs.ts` | CREATE — hub registry + reserved slugs |
| `src/components/admin/PdfResourcesManager.tsx` | CREATE |
| `src/pages/admin/AdminDashboard.tsx` | MODIFY — add Resources tab |
| `src/pages/resources/SamplePapers.tsx` | CREATE |
| `src/pages/resources/Books.tsx` | CREATE |
| `src/pages/resources/PreviousYearPapers.tsx` | CREATE |
| `src/pages/resources/ResourceHub.tsx` | CREATE |
| `src/pages/resources/ResourceDetail.tsx` | CREATE |
| `src/pages/resources/ResourceDownload.tsx` | CREATE |
| `src/components/resources/ResourceCard.tsx` | CREATE |
| `src/components/resources/RelatedResources.tsx` | CREATE |
| `src/components/resources/ResourceSubscribeCTA.tsx` | CREATE |
| `src/components/resources/ResourceSEO.tsx` | CREATE |
| `src/App.tsx` | MODIFY — add 12 routes before `/:slug` catch-all |
| `public/images/defaults/` | CREATE — default cover images |

### Implementation Sequence

1. Database migration (table + RLS + trigger on pdf_resources only + RPC function)
2. Edge function `generate-resource-content`
3. Hub registry + reserved slugs
4. Admin `PdfResourcesManager` + dashboard tab
5. Shared components
6. Public pages (listings, hub, detail, download)
7. Routes in App.tsx
8. Sitemap integration
9. Default cover images

