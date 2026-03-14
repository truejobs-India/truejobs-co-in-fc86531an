/**
 * Shared TypeScript types for Google Vertex AI edge functions.
 * Used by both frontend API clients and edge function contracts.
 */

// ═══════════════════════════════════════════════════════════════
// Shared API envelope
// ═══════════════════════════════════════════════════════════════

export interface VertexAISuccessResponse<T = unknown> {
  success: true;
  data: T;
  model: string;
  action: string;
  elapsedMs: number;
}

export interface VertexAIErrorResponse {
  success: false;
  error: string;
  code?: string;
  model?: string;
  action?: string;
}

export type VertexAIResponse<T = unknown> = VertexAISuccessResponse<T> | VertexAIErrorResponse;

// ═══════════════════════════════════════════════════════════════
// SEO Helper (Gemini 2.5 Flash)
// ═══════════════════════════════════════════════════════════════

export const SEO_HELPER_ACTIONS = [
  'generate-outline',
  'generate-faqs',
  'generate-meta',
  'suggest-tags',
  'suggest-category',
  'suggest-internal-links',
  'cluster-keywords',
  'generate-schema-draft',
  'rewrite-short-copy',
  'generate-title-variations',
] as const;

export type SeoHelperAction = typeof SEO_HELPER_ACTIONS[number];

export interface SeoHelperRequest {
  action: SeoHelperAction;
  topic?: string;
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  slug?: string;
  targetKeywords?: string[];
  secondaryKeywords?: string[];
  tone?: string;
  locale?: string;
  wordCount?: number;
  existingMeta?: {
    meta_title?: string;
    meta_description?: string;
    excerpt?: string;
  };
  customInstructions?: string;
}

export interface SeoOutlineResult {
  outline: Array<{ heading: string; subheadings?: string[]; notes?: string }>;
  estimatedWordCount: number;
  targetKeyword: string;
}

export interface SeoFaqResult {
  faqs: Array<{ question: string; answer: string }>;
  schemaDraft?: string;
}

export interface SeoMetaResult {
  meta_title: string;
  meta_description: string;
  excerpt: string;
  title_variations?: string[];
}

export interface SeoTagResult {
  suggestedTags: string[];
  reasoning?: string;
}

export interface SeoCategoryResult {
  suggestedCategory: string;
  alternatives?: string[];
  reasoning?: string;
}

export interface SeoInternalLinksResult {
  links: Array<{ slug: string; anchorText: string; reason: string }>;
}

export interface SeoKeywordClusterResult {
  clusters: Array<{ name: string; keywords: string[]; intent: string }>;
}

export interface SeoSchemaResult {
  schemaJson: Record<string, unknown>;
  schemaType: string;
}

export interface SeoRewriteResult {
  rewrittenCopy: string;
  charCount: number;
}

export interface SeoTitleVariationsResult {
  variations: Array<{ title: string; style: string }>;
}

// ═══════════════════════════════════════════════════════════════
// Premium Article (Gemini 2.5 Pro)
// ═══════════════════════════════════════════════════════════════

export const PREMIUM_ARTICLE_ACTIONS = [
  'generate-full-article',
  'rewrite-article',
  'polish-article',
  'expand-article',
  'generate-final-seo-package',
] as const;

export type PremiumArticleAction = typeof PREMIUM_ARTICLE_ACTIONS[number];

export interface PremiumArticleRequest {
  action: PremiumArticleAction;
  topic?: string;
  title?: string;
  category?: string;
  tags?: string[];
  slug?: string;
  targetKeywords?: string[];
  secondaryKeywords?: string[];
  searchIntent?: string;
  audience?: string;
  tone?: string;
  locale?: string;
  desiredWordCount?: number;
  outline?: Array<{ heading: string; subheadings?: string[] }>;
  faqItems?: Array<{ question: string; answer: string }>;
  notes?: string;
  existingContent?: string;
  existingMeta?: {
    meta_title?: string;
    meta_description?: string;
    excerpt?: string;
  };
  customInstructions?: string;
}

export interface PremiumArticleResult {
  title: string;
  meta_title: string;
  meta_description: string;
  excerpt: string;
  content_html: string;
  faq_items: Array<{ question: string; answer: string }>;
  suggested_tags: string[];
  suggested_category: string;
  image_prompt: string;
  schema_draft: Record<string, unknown>;
  word_count: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════
// Blog Image (Imagen)
// ═══════════════════════════════════════════════════════════════

export interface BlogImageRequest {
  title?: string;
  topic?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  visualStyle?: string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:2';
  brandGuidelines?: string;
  prompt?: string;
  negativePrompt?: string;
  imageCount?: number;
  slug?: string;
}

export interface BlogImageResult {
  images: Array<{
    url: string;
    path: string;
    altText: string;
    mimeType: string;
    width: number;
    height: number;
  }>;
  promptUsed: string;
}
