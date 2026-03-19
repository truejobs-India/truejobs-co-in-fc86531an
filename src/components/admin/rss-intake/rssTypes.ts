export interface RssSource {
  id: string;
  source_name: string;
  official_site: string | null;
  feed_url: string;
  source_type: string;
  focus: string | null;
  priority: string;
  status: string;
  language: string | null;
  category: string | null;
  state_or_scope: string | null;
  fetch_enabled: boolean;
  check_interval_hours: number;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  etag: string | null;
  last_modified: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RssFetchRun {
  id: string;
  rss_source_id: string;
  run_mode: string;
  status: string;
  http_status: number | null;
  content_type: string | null;
  started_at: string;
  finished_at: string | null;
  items_seen: number;
  items_new: number;
  items_updated: number;
  items_skipped: number;
  error_log: string | null;
  response_meta: Record<string, unknown>;
  created_at: string;
}

export interface RssItem {
  id: string;
  rss_source_id: string;
  item_guid: string | null;
  item_title: string;
  item_link: string | null;
  canonical_link: string | null;
  published_at: string | null;
  author: string | null;
  item_summary: string | null;
  item_content: string | null;
  categories: string[];
  item_type: string;
  primary_domain: string;
  display_group: string;
  relevance_level: string;
  detection_reason: string | null;
  first_pdf_url: string | null;
  linked_pdf_urls: string[];
  normalized_hash: string;
  raw_payload: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  current_status: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueEntry {
  id: string;
  channel: string;
  source_id: string | null;
  source_item_id: string | null;
  title: string;
  source_url: string | null;
  pdf_url: string | null;
  published_at: string | null;
  item_type: string | null;
  primary_domain: string | null;
  display_group: string | null;
  review_status: string;
  action_decision: string | null;
  qa_notes: string | null;
  raw_payload: Record<string, unknown>;
  parsed_payload: Record<string, unknown>;
  created_at: string;
  reviewed_at: string | null;
  updated_at: string;
}

export const RSS_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const RSS_STATUSES = ['Live now', 'Needs verification', 'Not useful for jobs', 'Testing', 'Paused', 'Broken'] as const;
export const ITEM_TYPES = [
  'recruitment', 'vacancy', 'exam', 'admit_card', 'result', 'answer_key', 'syllabus',
  'scholarship', 'certificate', 'marksheet', 'school_service', 'university_service', 'document_service',
  'policy', 'circular', 'notification', 'signal', 'unknown',
] as const;
export const RELEVANCE_LEVELS = ['High', 'Medium', 'Low'] as const;
export const ITEM_STATUSES = ['new', 'updated', 'queued', 'reviewed', 'ignored', 'duplicate'] as const;
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'duplicate', 'ignored', 'on_hold'] as const;

export const PRIMARY_DOMAINS = ['jobs', 'education_services', 'exam_updates', 'public_services', 'policy_updates', 'general_alerts'] as const;
export const DISPLAY_GROUPS = ['Government Jobs', 'Education Services', 'Exam Updates', 'Public Services', 'Policy Updates', 'General Alerts'] as const;

export const DOMAIN_LABELS: Record<string, string> = {
  jobs: 'Government Jobs',
  education_services: 'Education Services',
  exam_updates: 'Exam Updates',
  public_services: 'Public Services',
  policy_updates: 'Policy Updates',
  general_alerts: 'General Alerts',
};

// ── AI Processing types ──

export type AiProcessingStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type AiAction = 'analyse' | 'enrich' | 'generate-image' | 'seo-check';

export interface RssAiProcessing {
  id: string;
  rss_item_id: string;
  analysis_status: AiProcessingStatus;
  analysis_model: string | null;
  analysis_output: AnalysisOutput | null;
  analysis_run_at: string | null;
  analysis_error: string | null;
  enrichment_status: AiProcessingStatus;
  enrichment_model: string | null;
  enrichment_word_limit: number | null;
  enrichment_output: EnrichmentOutput | null;
  enrichment_run_at: string | null;
  enrichment_error: string | null;
  image_status: AiProcessingStatus;
  image_model: string | null;
  cover_image_url: string | null;
  image_prompt_used: string | null;
  image_run_at: string | null;
  image_error: string | null;
  seo_check_status: AiProcessingStatus;
  seo_model: string | null;
  seo_output: SeoCheckOutput | null;
  seo_score: number | null;
  seo_run_at: string | null;
  seo_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisOutput {
  publish_recommended: boolean;
  confidence_level: 'high' | 'medium' | 'low';
  content_type: string;
  suggested_primary_domain: string;
  suggested_item_type: string;
  suggested_category: string;
  suggested_title: string;
  suggested_slug: string;
  key_entities: string[];
  important_dates: { label: string; date: string }[];
  important_links: { label: string; url: string }[];
  missing_information: string[];
  ambiguity_flags: string[];
  needs_manual_review: boolean;
  suggested_next_action: string;
  analysis_notes: string;
}

export interface EnrichmentOutput {
  cleaned_title: string;
  short_intro: string;
  article_body: string;
  summary_points: string[];
  important_dates: { label: string; date: string }[];
  eligibility_summary: string | null;
  how_to_apply: string | null;
  important_links: { label: string; url: string }[];
  faq_block: { question: string; answer: string }[];
  seo_title: string;
  meta_description: string;
  canonical_suggestion: string | null;
  tags: string[];
  excerpt: string;
  internal_linking_suggestions: string[];
  schema_suggestion: string;
}

export interface SeoCheckOutput {
  seo_passed: boolean;
  seo_score: number;
  seo_title_status: 'good' | 'warning' | 'error';
  seo_title_note: string;
  meta_description_status: 'good' | 'warning' | 'error';
  meta_description_note: string;
  canonical_status: 'good' | 'warning' | 'missing';
  slug_status: 'good' | 'warning' | 'error';
  slug_note: string;
  heading_status: 'good' | 'warning' | 'error';
  image_status: 'good' | 'missing';
  image_alt_suggestion: string | null;
  internal_linking_status: 'good' | 'needs_improvement';
  schema_status: 'ready' | 'needs_work' | 'not_applicable';
  seo_issues: string[];
  seo_fixes: string[];
  thin_content_risk: boolean;
  duplication_risk: 'low' | 'medium' | 'high';
  over_optimization_risk: 'low' | 'medium' | 'high';
  adsense_safe: boolean;
  recommended_final_actions: string[];
}

export const AI_PROCESSING_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
