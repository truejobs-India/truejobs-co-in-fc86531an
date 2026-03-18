-- One-time fix: replace incorrect "index, follow" robots meta with "noindex, follow"
-- for all ephemeral page types in seo_page_cache
UPDATE seo_page_cache
SET head_html = replace(
  head_html,
  '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
  '<meta name="robots" content="noindex, follow">'
),
full_html = replace(
  full_html,
  '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
  '<meta name="robots" content="noindex, follow">'
),
updated_at = now()
WHERE page_type IN ('combo-closing-soon','deadline-today','deadline-week','deadline-month','deadline-this-week')
AND head_html LIKE '%content="index, follow%';