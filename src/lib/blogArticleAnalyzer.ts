import { supabase } from '@/integrations/supabase/client';

// ── Centralized Thresholds ─────────────────────────────
export const BLOG_THRESHOLDS = {
  QUALITY_EXCELLENT: 85,
  QUALITY_GOOD: 70,
  QUALITY_NEEDS_IMPROVEMENT: 50,
  SEO_GOOD: 70,
  SEO_ACCEPTABLE: 50,
  MIN_WORD_COUNT_FULL: 1200,
  MIN_WORD_COUNT_ADEQUATE: 800,
  THIN_CONTENT_THRESHOLD: 300,
  META_TITLE_MAX: 60,
  META_DESC_MIN: 100,
  META_DESC_MAX: 155,
  INTERNAL_LINKS_GOOD: 2,
  READINESS_PUBLISH_QUALITY: 70,
  READINESS_PUBLISH_SEO: 70,
  READINESS_DRAFT_QUALITY: 50,
  READINESS_DRAFT_SEO: 50,
} as const;

// ── Types ──────────────────────────────────────────────
export type QualityGrade = 'Excellent' | 'Good' | 'Needs Improvement' | 'Poor';
export type ReadinessStatus = 'Not Ready' | 'Needs Review' | 'Ready as Draft' | 'Ready to Publish' | 'Published';
export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface QualityFactor {
  name: string;
  score: number;
  maxScore: number;
  status: CheckStatus;
  explanation: string;
}

export interface QualityReport {
  totalScore: number;
  grade: QualityGrade;
  factors: QualityFactor[];
}

export interface SEOCheckItem {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface SEOReport {
  totalScore: number;
  checks: SEOCheckItem[];
}

export interface ArticleMetadata {
  title: string;
  slug: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  wordCount: number;
  category?: string;
  tags?: string[];
  faqCount?: number;
  hasFaqSchema?: boolean;
  internalLinks?: { path: string; anchorText: string }[];
  canonicalUrl?: string;
  isPublished?: boolean;
  headings?: { level: number; text: string }[];
  hasIntro?: boolean;
  hasConclusion?: boolean;
  authorName?: string;
}

// ── Quality Analysis ───────────────────────────────────
export function analyzeQuality(metadata: ArticleMetadata): QualityReport {
  const factors: QualityFactor[] = [];

  // 1. Word count (0-20)
  const wc = metadata.wordCount;
  let wcScore = 0;
  let wcExplanation = '';
  if (wc >= BLOG_THRESHOLDS.MIN_WORD_COUNT_FULL) {
    wcScore = 20;
    wcExplanation = `${wc} words — excellent length`;
  } else if (wc >= BLOG_THRESHOLDS.MIN_WORD_COUNT_ADEQUATE) {
    wcScore = 14;
    wcExplanation = `${wc} words — adequate, consider expanding`;
  } else if (wc >= 500) {
    wcScore = 8;
    wcExplanation = `${wc} words — short article`;
  } else if (wc >= BLOG_THRESHOLDS.THIN_CONTENT_THRESHOLD) {
    wcScore = 4;
    wcExplanation = `${wc} words — thin content`;
  } else {
    wcScore = 0;
    wcExplanation = `${wc} words — very thin, needs more content`;
  }
  factors.push({ name: 'Word Count', score: wcScore, maxScore: 20, status: wcScore >= 14 ? 'pass' : wcScore >= 8 ? 'warn' : 'fail', explanation: wcExplanation });

  // 2. Heading structure (0-15)
  const headings = metadata.headings || [];
  const h2Count = headings.filter(h => h.level === 2).length;
  const hasSkippedLevels = checkSkippedHeadingLevels(headings);
  let headingScore = 0;
  let headingExplanation = '';
  if (h2Count >= 3 && !hasSkippedLevels) {
    headingScore = 15;
    headingExplanation = `${h2Count} H2s, clean hierarchy`;
  } else if (h2Count >= 2) {
    headingScore = 10;
    headingExplanation = `${h2Count} H2s${hasSkippedLevels ? ', has skipped levels' : ''}`;
  } else if (h2Count >= 1) {
    headingScore = 6;
    headingExplanation = 'Only 1 H2 — add more sections';
  } else {
    headingScore = 0;
    headingExplanation = 'No H2 headings found';
  }
  factors.push({ name: 'Heading Structure', score: headingScore, maxScore: 15, status: headingScore >= 10 ? 'pass' : headingScore >= 6 ? 'warn' : 'fail', explanation: headingExplanation });

  // 3. Intro paragraph (0-10)
  const hasIntro = metadata.hasIntro ?? detectIntro(metadata.content);
  factors.push({
    name: 'Introduction',
    score: hasIntro ? 10 : 0,
    maxScore: 10,
    status: hasIntro ? 'pass' : 'fail',
    explanation: hasIntro ? 'Intro paragraph detected' : 'No intro paragraph before first heading',
  });

  // 4. Conclusion (0-10)
  const hasConclusion = metadata.hasConclusion ?? detectConclusion(headings);
  factors.push({
    name: 'Conclusion',
    score: hasConclusion ? 10 : 0,
    maxScore: 10,
    status: hasConclusion ? 'pass' : 'warn',
    explanation: hasConclusion ? 'Conclusion section detected' : 'No conclusion section found',
  });

  // 5. FAQ presence (0-10)
  const faqCount = metadata.faqCount || 0;
  const faqScore = faqCount >= 3 ? 10 : faqCount > 0 ? 6 : 0;
  factors.push({
    name: 'FAQ Section',
    score: faqScore,
    maxScore: 10,
    status: faqScore >= 6 ? 'pass' : 'warn',
    explanation: faqCount > 0 ? `${faqCount} FAQ items detected` : 'No FAQ section — recommended for SEO',
  });

  // 6. Internal links (0-10)
  const linkCount = metadata.internalLinks?.length || 0;
  const linkScore = linkCount >= BLOG_THRESHOLDS.INTERNAL_LINKS_GOOD ? 10 : linkCount >= 1 ? 6 : 0;
  factors.push({
    name: 'Internal Links',
    score: linkScore,
    maxScore: 10,
    status: linkScore >= 6 ? 'pass' : 'warn',
    explanation: linkCount > 0 ? `${linkCount} internal links` : 'No internal links — add related page links',
  });

  // 7. Metadata completeness (0-10)
  let metaScore = 0;
  const metaParts: string[] = [];
  if (metadata.title) { metaScore += 2.5; } else { metaParts.push('title'); }
  if (metadata.metaTitle) { metaScore += 2.5; } else { metaParts.push('meta title'); }
  if (metadata.metaDescription) { metaScore += 2.5; } else { metaParts.push('meta desc'); }
  if (metadata.excerpt) { metaScore += 2.5; } else { metaParts.push('excerpt'); }
  factors.push({
    name: 'Metadata',
    score: Math.round(metaScore),
    maxScore: 10,
    status: metaScore >= 7.5 ? 'pass' : metaScore >= 5 ? 'warn' : 'fail',
    explanation: metaParts.length === 0 ? 'All metadata present' : `Missing: ${metaParts.join(', ')}`,
  });

  // 8. Image readiness (0-10)
  const hasImage = !!metadata.coverImageUrl;
  const hasAlt = !!metadata.coverImageAlt;
  const imgScore = hasImage && hasAlt ? 10 : hasImage ? 6 : 0;
  factors.push({
    name: 'Cover Image',
    score: imgScore,
    maxScore: 10,
    status: imgScore >= 6 ? 'pass' : 'fail',
    explanation: hasImage ? (hasAlt ? 'Cover image with alt text' : 'Cover image present, missing alt text') : 'No cover image',
  });

  // 9. Readability (0-5)
  const hasLists = /<[uo]l/i.test(metadata.content);
  const readScore = hasLists ? 5 : 2;
  factors.push({
    name: 'Readability',
    score: readScore,
    maxScore: 5,
    status: readScore >= 5 ? 'pass' : 'warn',
    explanation: hasLists ? 'Lists detected for scanability' : 'Consider adding lists for better readability',
  });

  const totalScore = Math.min(100, factors.reduce((sum, f) => sum + f.score, 0));
  const grade = getGrade(totalScore);

  return { totalScore, grade, factors };
}

// ── SEO Analysis ───────────────────────────────────────
export function analyzeSEO(metadata: ArticleMetadata, duplicateSlugConflict = false): SEOReport {
  const checks: SEOCheckItem[] = [];

  // Title
  checks.push({
    name: 'Title exists',
    status: metadata.title ? 'pass' : 'fail',
    detail: metadata.title ? `"${metadata.title.substring(0, 40)}..."` : 'Missing title',
  });

  // Meta title
  const mtLen = metadata.metaTitle?.length || 0;
  checks.push({
    name: 'Meta title',
    status: mtLen > 0 && mtLen <= BLOG_THRESHOLDS.META_TITLE_MAX ? 'pass' : mtLen > BLOG_THRESHOLDS.META_TITLE_MAX ? 'warn' : 'fail',
    detail: mtLen > 0 ? `${mtLen}/${BLOG_THRESHOLDS.META_TITLE_MAX} chars` : 'Missing meta title',
  });

  // Meta description
  const mdLen = metadata.metaDescription?.length || 0;
  checks.push({
    name: 'Meta description',
    status: mdLen >= BLOG_THRESHOLDS.META_DESC_MIN && mdLen <= BLOG_THRESHOLDS.META_DESC_MAX ? 'pass' : mdLen > 0 ? 'warn' : 'fail',
    detail: mdLen > 0 ? `${mdLen} chars (${BLOG_THRESHOLDS.META_DESC_MIN}-${BLOG_THRESHOLDS.META_DESC_MAX} ideal)` : 'Missing meta description',
  });

  // Slug
  const slugClean = metadata.slug && /^[a-z0-9-]+$/.test(metadata.slug);
  checks.push({
    name: 'Clean slug',
    status: slugClean ? 'pass' : metadata.slug ? 'warn' : 'fail',
    detail: slugClean ? `/blog/${metadata.slug}` : 'Slug has special characters or is missing',
  });

  // Canonical
  const expectedCanonical = `https://truejobs.co.in/blog/${metadata.slug}`;
  checks.push({
    name: 'Canonical URL',
    status: metadata.canonicalUrl === expectedCanonical ? 'pass' : metadata.canonicalUrl ? 'warn' : 'fail',
    detail: metadata.canonicalUrl === expectedCanonical ? 'Correct' : metadata.canonicalUrl || 'Not set',
  });

  // Content length
  checks.push({
    name: 'Content length',
    status: metadata.wordCount >= BLOG_THRESHOLDS.MIN_WORD_COUNT_ADEQUATE ? 'pass' : metadata.wordCount >= 500 ? 'warn' : 'fail',
    detail: `${metadata.wordCount} words (${BLOG_THRESHOLDS.MIN_WORD_COUNT_ADEQUATE}+ recommended)`,
  });

  // H1
  const h1s = (metadata.headings || []).filter(h => h.level === 1);
  checks.push({
    name: 'H1 exists',
    status: h1s.length === 1 ? 'pass' : h1s.length > 1 ? 'warn' : 'fail',
    detail: h1s.length === 1 ? 'Single H1 present' : h1s.length > 1 ? `${h1s.length} H1s — should be 1` : 'No H1 found',
  });

  // Heading hierarchy
  const headings = metadata.headings || [];
  const hasSkipped = checkSkippedHeadingLevels(headings);
  checks.push({
    name: 'Heading hierarchy',
    status: !hasSkipped && headings.length > 2 ? 'pass' : headings.length > 0 ? 'warn' : 'fail',
    detail: hasSkipped ? 'Skipped heading levels detected' : `${headings.length} headings`,
  });

  // FAQ schema eligibility
  checks.push({
    name: 'FAQ schema',
    status: (metadata.faqCount || 0) > 0 ? 'pass' : 'warn',
    detail: (metadata.faqCount || 0) > 0 ? `${metadata.faqCount} FAQs — schema eligible` : 'No FAQs detected',
  });

  // Featured image
  checks.push({
    name: 'Featured image',
    status: metadata.coverImageUrl ? 'pass' : 'fail',
    detail: metadata.coverImageUrl ? 'Present' : 'Missing cover image',
  });

  // Alt text
  checks.push({
    name: 'Image alt text',
    status: metadata.coverImageAlt ? 'pass' : metadata.coverImageUrl ? 'warn' : 'fail',
    detail: metadata.coverImageAlt ? 'Alt text set' : 'Missing alt text',
  });

  // Internal links
  const iLinks = metadata.internalLinks?.length || 0;
  checks.push({
    name: 'Internal links',
    status: iLinks >= 1 ? 'pass' : 'warn',
    detail: `${iLinks} internal links`,
  });

  // Duplicate slug
  checks.push({
    name: 'No duplicate slug',
    status: duplicateSlugConflict ? 'fail' : 'pass',
    detail: duplicateSlugConflict ? 'Slug already exists in database' : 'Slug is unique',
  });

  // Keyword overlap
  const overlap = computeKeywordOverlap(metadata.title, metadata.content);
  checks.push({
    name: 'Keyword relevance',
    status: overlap >= 0.3 ? 'pass' : overlap >= 0.15 ? 'warn' : 'fail',
    detail: `${Math.round(overlap * 100)}% title-body keyword overlap`,
  });

  // Publish URL readiness
  checks.push({
    name: 'Publish URL ready',
    status: metadata.slug && metadata.slug.length > 5 && metadata.slug.length <= 70 ? 'pass' : 'warn',
    detail: metadata.slug ? `${metadata.slug.length} chars` : 'No slug',
  });

  const passCount = checks.filter(c => c.status === 'pass').length;
  const totalScore = Math.round((passCount / checks.length) * 100);

  return { totalScore, checks };
}

// ── Duplicate slug check (excludes current post) ───────
export async function checkDuplicateSlug(slug: string, excludePostId?: string): Promise<boolean> {
  let query = supabase.from('blog_posts').select('id').eq('slug', slug);
  if (excludePostId) {
    query = query.neq('id', excludePostId);
  }
  const { data } = await query.maybeSingle();
  return !!data;
}

// ── Readiness Status ───────────────────────────────────
export function getReadinessStatus(
  quality: QualityReport,
  seo: SEOReport,
  metadata: ArticleMetadata
): ReadinessStatus {
  if (metadata.isPublished) return 'Published';
  if (!metadata.title || !metadata.slug || !metadata.content) return 'Not Ready';

  const qualityOk = quality.totalScore >= BLOG_THRESHOLDS.READINESS_DRAFT_QUALITY;
  const seoOk = seo.totalScore >= BLOG_THRESHOLDS.READINESS_DRAFT_SEO;
  const hasCover = !!metadata.coverImageUrl;

  if (!qualityOk || !seoOk || !hasCover) return 'Needs Review';

  const qualityGood = quality.totalScore >= BLOG_THRESHOLDS.READINESS_PUBLISH_QUALITY;
  const seoGood = seo.totalScore >= BLOG_THRESHOLDS.READINESS_PUBLISH_SEO;
  const metaComplete = !!metadata.metaTitle && !!metadata.metaDescription;

  if (qualityGood && seoGood && hasCover && metaComplete) return 'Ready to Publish';
  return 'Ready as Draft';
}

// ── Helper functions ───────────────────────────────────
function getGrade(score: number): QualityGrade {
  if (score >= BLOG_THRESHOLDS.QUALITY_EXCELLENT) return 'Excellent';
  if (score >= BLOG_THRESHOLDS.QUALITY_GOOD) return 'Good';
  if (score >= BLOG_THRESHOLDS.QUALITY_NEEDS_IMPROVEMENT) return 'Needs Improvement';
  return 'Poor';
}

function checkSkippedHeadingLevels(headings: { level: number; text: string }[]): boolean {
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) return true;
  }
  return false;
}

function detectIntro(content: string): boolean {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const children = Array.from(doc.body.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return false; // heading before any paragraph
    if (tag === 'p' && (child.textContent?.trim().length || 0) > 20) return true;
  }
  return false;
}

function detectConclusion(headings: { level: number; text: string }[]): boolean {
  if (headings.length === 0) return false;
  const conclusionPattern = /conclusion|summary|final\s*thoughts|key\s*takeaway|wrap\s*up|in\s*short|to\s*sum|summing|closing|last\s*word|निष्कर्ष|सारांश|अंतिम|महत्वपूर्ण\s*बातें/i;
  // Check last 2 headings (FAQ section may come after conclusion)
  const lastTwo = headings.slice(-2);
  for (const h of lastTwo) {
    if (conclusionPattern.test(h.text)) return true;
  }
  return false;
}

/** Detect conclusion by checking for a substantive closing paragraph after the last heading */
export function detectConclusionFromContent(content: string): boolean {
  if (!content) return false;
  // First check heading-based detection
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const headings: { level: number; text: string }[] = [];
  doc.querySelectorAll('h1, h2, h3, h4').forEach(el => {
    headings.push({ level: parseInt(el.tagName.substring(1)), text: el.textContent?.trim() || '' });
  });
  if (detectConclusion(headings)) return true;

  // Paragraph-based fallback: check if there's a substantial <p> after the last heading
  const allElements = Array.from(doc.body.children);
  let lastHeadingIdx = -1;
  for (let i = allElements.length - 1; i >= 0; i--) {
    if (/^H[1-6]$/i.test(allElements[i].tagName)) {
      lastHeadingIdx = i;
      break;
    }
  }
  if (lastHeadingIdx >= 0) {
    // Look for a paragraph after the last heading that's at least 50 chars
    for (let i = lastHeadingIdx + 1; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.tagName === 'P' && (el.textContent?.trim().length || 0) >= 50) {
        return true;
      }
    }
  }
  return false;
}

function computeKeywordOverlap(title: string, content: string): number {
  if (!title || !content) return 0;
  const titleWords = new Set(
    title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  );
  if (titleWords.size === 0) return 0;
  const contentText = content.replace(/<[^>]+>/g, '').toLowerCase();
  let matchCount = 0;
  for (const word of titleWords) {
    if (contentText.includes(word)) matchCount++;
  }
  return matchCount / titleWords.size;
}

// ── Convert blog_posts row to ArticleMetadata ──────────
export function blogPostToMetadata(post: {
  title: string;
  slug: string;
  content: string;
  meta_title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  featured_image_alt?: string | null;
  word_count?: number | null;
  category?: string | null;
  tags?: string[] | null;
  faq_count?: number | null;
  has_faq_schema?: boolean | null;
  internal_links?: any;
  canonical_url?: string | null;
  is_published?: boolean;
  author_name?: string | null;
}): ArticleMetadata {
  // Parse headings from content
  const parser = new DOMParser();
  const doc = parser.parseFromString(post.content || '', 'text/html');
  const headings: { level: number; text: string }[] = [];
  doc.querySelectorAll('h1, h2, h3, h4').forEach(el => {
    const level = parseInt(el.tagName.substring(1));
    headings.push({ level, text: el.textContent?.trim() || '' });
  });

  const internalLinks = Array.isArray(post.internal_links) ? post.internal_links : [];

  return {
    title: post.title,
    slug: post.slug,
    content: post.content,
    metaTitle: post.meta_title || undefined,
    metaDescription: post.meta_description || undefined,
    excerpt: post.excerpt || undefined,
    coverImageUrl: post.cover_image_url || undefined,
    coverImageAlt: post.featured_image_alt || undefined,
    wordCount: post.word_count || 0,
    category: post.category || undefined,
    tags: post.tags || undefined,
    faqCount: post.faq_count || 0,
    hasFaqSchema: post.has_faq_schema || false,
    internalLinks,
    canonicalUrl: post.canonical_url || undefined,
    isPublished: post.is_published,
    authorName: post.author_name || undefined,
    headings,
    hasIntro: detectIntro(post.content || ''),
    hasConclusion: detectConclusionFromContent(post.content || ''),
  };
}
