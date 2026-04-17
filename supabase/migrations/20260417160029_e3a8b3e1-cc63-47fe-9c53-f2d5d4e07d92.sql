UPDATE employment_news_jobs en
SET apply_link = COALESCE(d.official_apply_link, d.official_notification_link, d.official_website_link)
FROM intake_drafts d
WHERE d.published_record_id::uuid = en.id
  AND d.published_table_name = 'employment_news_jobs'
  AND en.apply_link IS NULL
  AND COALESCE(d.official_apply_link, d.official_notification_link, d.official_website_link) IS NOT NULL;