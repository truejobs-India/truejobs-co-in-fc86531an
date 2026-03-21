/**
 * Site-wide SEO audit engine.
 * Scans blog_posts, pdf_resources, custom_pages for common SEO issues.
 * Returns structured issue records suitable for later AI fixing.
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ContentSource = 'blog_posts' | 'pdf_resources' | 'custom_pages';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IssueCategory =
  | 'meta_title'
  | 'meta_description'
  | 'canonical_url'
  | 'excerpt'
  | 'featured_image_alt'
  | 'slug'
  | 'h1'
  | 'heading_structure'
  | 'internal_links'
  | 'faq_opportunity'
  | 'faq_schema'
  | 'content_thin'
  | 'intro_missing'
  | 'compliance';

export interface SeoAuditIssue {
  id: string; // stable: `${source}:${recordId}:${category}`
  source: ContentSource;
  recordId: string;
  slug: string;
  title: string;
  isPublished: boolean;
  category: IssueCategory;
  severity: IssueSeverity;
  message: string;
  currentValue: string;
  autoFixable: boolean;
  fixHint?: string; // brief guidance for AI
}

export interface SeoAuditReport {
  scannedAt: string;
  totalScanned: Record<ContentSource, number>;
  issues: SeoAuditIssue[];
  summary: {
    bySource: Record<ContentSource, number>;
    byCategory: Record<string, number>;
    bySeverity: Record<IssueSeverity, number>;
    autoFixable: number;
    reviewRequired: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

const SITE_DOMAIN = 'truejobs.co.in';

function isValidCanonical(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== SITE_DOMAIN && !u.hostname.endsWith('.' + SITE_DOMAIN)) return false;
    return true;
  } catch {
    return false;
  }
}

function countH1s(html: string): number {
  return (html.match(/<h1[\s>]/gi) || []).length;
}

function countH2s(html: string): number {
  return (html.match(/<h2[\s>]/gi) || []).length;
}

function hasIntro(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes('introduction') || lower.includes('overview') || lower.includes('<p') && html.indexOf('<h2') > 100;
}

function countInternalLinks(html: string): number {
  const matches = html.match(/href=["'][^"']*truejobs\.co\.in[^"']*/gi) || [];
  const relativeMatches = html.match(/href=["']\/[^"']+/gi) || [];
  return matches.length + relativeMatches.length;
}

function makeId(source: ContentSource, recordId: string, category: IssueCategory): string {
  return `${source}:${recordId}:${category}`;
}

// ═══════════════════════════════════════════════════════════════
// Common field auditors
// ═══════════════════════════════════════════════════════════════

function auditCommonFields(
  source: ContentSource,
  record: {
    id: string;
    slug: string;
    title: string;
    is_published: boolean;
    meta_title?: string | null;
    meta_description?: string | null;
    canonical_url?: string | null;
    excerpt?: string | null;
    featured_image_alt?: string | null;
    content?: string | null;
    word_count?: number | null;
    faq_schema?: any;
    has_faq_schema?: boolean | null;
  },
  urlPrefix: string,
): SeoAuditIssue[] {
  const issues: SeoAuditIssue[] = [];
  const base = { source, recordId: record.id, slug: record.slug, title: record.title, isPublished: record.is_published };

  // ── Meta title ──
  const mt = record.meta_title;
  if (!mt || mt.trim().length === 0) {
    issues.push({ ...base, id: makeId(source, record.id, 'meta_title'), category: 'meta_title', severity: 'critical', message: 'Meta title is missing', currentValue: '', autoFixable: true, fixHint: 'Generate SEO meta title from article title and content' });
  } else if (mt.length < 20) {
    issues.push({ ...base, id: makeId(source, record.id, 'meta_title'), category: 'meta_title', severity: 'high', message: `Meta title too short (${mt.length} chars, min 30)`, currentValue: mt, autoFixable: true });
  } else if (mt.length > 60) {
    issues.push({ ...base, id: makeId(source, record.id, 'meta_title'), category: 'meta_title', severity: 'medium', message: `Meta title too long (${mt.length} chars, max 60)`, currentValue: mt, autoFixable: true });
  }

  // ── Meta description ──
  const md = record.meta_description;
  if (!md || md.trim().length === 0) {
    issues.push({ ...base, id: makeId(source, record.id, 'meta_description'), category: 'meta_description', severity: 'critical', message: 'Meta description is missing', currentValue: '', autoFixable: true, fixHint: 'Generate 130-155 char meta description' });
  } else if (md.length < 80) {
    issues.push({ ...base, id: makeId(source, record.id, 'meta_description'), category: 'meta_description', severity: 'high', message: `Meta description too short (${md.length} chars, target 130-155)`, currentValue: md, autoFixable: true });
  } else if (md.length > 155) {
    issues.push({ ...base, id: makeId(source, record.id, 'meta_description'), category: 'meta_description', severity: 'medium', message: `Meta description too long (${md.length} chars, max 155)`, currentValue: md, autoFixable: true });
  }

  // ── Canonical URL ──
  const cu = record.canonical_url;
  const expectedCanonical = `https://${SITE_DOMAIN}/${urlPrefix}/${record.slug}`;
  if (!cu) {
    issues.push({ ...base, id: makeId(source, record.id, 'canonical_url'), category: 'canonical_url', severity: 'high', message: 'Canonical URL missing', currentValue: '', autoFixable: true, fixHint: `Set to ${expectedCanonical}` });
  } else if (!isValidCanonical(cu)) {
    issues.push({ ...base, id: makeId(source, record.id, 'canonical_url'), category: 'canonical_url', severity: 'high', message: 'Canonical URL invalid or wrong domain', currentValue: cu, autoFixable: true, fixHint: `Replace with ${expectedCanonical}` });
  }

  // ── Excerpt ──
  const exc = record.excerpt;
  if (!exc || exc.trim().length < 10) {
    issues.push({ ...base, id: makeId(source, record.id, 'excerpt'), category: 'excerpt', severity: 'medium', message: 'Excerpt/summary is missing or too short', currentValue: exc || '', autoFixable: true });
  }

  // ── Featured image alt ──
  if (record.featured_image_alt !== undefined) {
    const alt = record.featured_image_alt;
    if (!alt || alt.trim().length < 5) {
      issues.push({ ...base, id: makeId(source, record.id, 'featured_image_alt'), category: 'featured_image_alt', severity: 'low', message: 'Featured image alt text missing or weak', currentValue: alt || '', autoFixable: true });
    }
  }

  // ── Content checks ──
  const content = record.content;
  if (content && content.length > 50) {
    const wc = record.word_count || 0;

    // Thin content
    if (wc > 0 && wc < 300) {
      issues.push({ ...base, id: makeId(source, record.id, 'content_thin'), category: 'content_thin', severity: 'high', message: `Thin content: ${wc} words (min 300)`, currentValue: `${wc} words`, autoFixable: false });
    }

    // H1 check
    const h1Count = countH1s(content);
    if (h1Count === 0) {
      issues.push({ ...base, id: makeId(source, record.id, 'h1'), category: 'h1', severity: 'high', message: 'No H1 heading found', currentValue: '0 H1s', autoFixable: true, fixHint: 'Insert a single H1 at the top of the article' });
    } else if (h1Count > 1) {
      issues.push({ ...base, id: makeId(source, record.id, 'h1'), category: 'h1', severity: 'medium', message: `Multiple H1 headings (${h1Count})`, currentValue: `${h1Count} H1s`, autoFixable: true, fixHint: 'Keep best H1, downgrade others to H2' });
    }

    // Heading structure
    const h2Count = countH2s(content);
    if (wc > 500 && h2Count < 2) {
      issues.push({ ...base, id: makeId(source, record.id, 'heading_structure'), category: 'heading_structure', severity: 'low', message: `Weak heading structure: only ${h2Count} H2s for ${wc} words`, currentValue: `${h2Count} H2s`, autoFixable: false });
    }

    // Internal links
    const linkCount = countInternalLinks(content);
    if (linkCount < 2 && wc > 300) {
      issues.push({ ...base, id: makeId(source, record.id, 'internal_links'), category: 'internal_links', severity: 'medium', message: `Only ${linkCount} internal links`, currentValue: `${linkCount} links`, autoFixable: true, fixHint: 'Add relevant internal links to other site pages' });
    }

    // Intro
    if (!hasIntro(content) && wc > 300) {
      issues.push({ ...base, id: makeId(source, record.id, 'intro_missing'), category: 'intro_missing', severity: 'low', message: 'No clear introduction section detected', currentValue: '', autoFixable: true });
    }

    // FAQ opportunity
    const hasFaq = record.has_faq_schema || (record.faq_schema && Array.isArray(record.faq_schema) && record.faq_schema.length > 0);
    if (!hasFaq && wc > 400) {
      issues.push({ ...base, id: makeId(source, record.id, 'faq_opportunity'), category: 'faq_opportunity', severity: 'medium', message: 'Article is eligible for FAQ schema but has none', currentValue: 'No FAQ', autoFixable: true, fixHint: 'Generate FAQ questions and structured schema' });
    }

    // FAQ schema validation
    if (record.faq_schema && Array.isArray(record.faq_schema)) {
      const invalidItems = record.faq_schema.filter((f: any) => !f.question || !f.answer);
      if (invalidItems.length > 0) {
        issues.push({ ...base, id: makeId(source, record.id, 'faq_schema'), category: 'faq_schema', severity: 'medium', message: `${invalidItems.length} FAQ items have missing question/answer`, currentValue: `${record.faq_schema.length} total FAQs`, autoFixable: true });
      }
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════════
// Fetchers (paginated)
// ═══════════════════════════════════════════════════════════════

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const results: T[] = [];
  const PAGE = 1000;
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from(table as any)
      .select(select)
      .range(offset, offset + PAGE - 1);
    if (error) { console.error(`[SEO-AUDIT] Error fetching ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    results.push(...(data as T[]));
    hasMore = data.length === PAGE;
    offset += PAGE;
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// Main scan
// ═══════════════════════════════════════════════════════════════

export async function runSitewideSeoAudit(
  onProgress?: (msg: string) => void,
): Promise<SeoAuditReport> {
  const allIssues: SeoAuditIssue[] = [];
  const totalScanned: Record<ContentSource, number> = { blog_posts: 0, pdf_resources: 0, custom_pages: 0 };

  // ── Blog posts ──
  onProgress?.('Scanning blog articles…');
  const blogs = await fetchAll<any>('blog_posts', 'id,slug,title,is_published,meta_title,meta_description,canonical_url,excerpt,featured_image_alt,content,word_count,faq_schema,has_faq_schema');
  totalScanned.blog_posts = blogs.length;
  for (const b of blogs) {
    allIssues.push(...auditCommonFields('blog_posts', b, 'blog'));
  }

  // ── PDF resources ──
  onProgress?.('Scanning PDF resources…');
  const pdfs = await fetchAll<any>('pdf_resources', 'id,slug,title,is_published,meta_title,meta_description,excerpt,featured_image_alt,content,word_count,faq_schema');
  totalScanned.pdf_resources = pdfs.length;
  for (const p of pdfs) {
    allIssues.push(...auditCommonFields('pdf_resources', { ...p, is_published: p.is_published ?? false }, 'resources'));
  }

  // ── Custom pages ──
  onProgress?.('Scanning custom pages…');
  const pages = await fetchAll<any>('custom_pages', 'id,slug,title,is_published,meta_title,meta_description,canonical_url,excerpt,featured_image_alt,content,word_count,faq_schema');
  totalScanned.custom_pages = pages.length;
  for (const p of pages) {
    const urlPrefix = p.page_type === 'result-landing' ? 'results' : 'pages';
    allIssues.push(...auditCommonFields('custom_pages', { ...p, is_published: p.is_published ?? false }, urlPrefix));
  }

  // ── Build summary ──
  const bySource: Record<ContentSource, number> = { blog_posts: 0, pdf_resources: 0, custom_pages: 0 };
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<IssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let autoFixable = 0;
  let reviewRequired = 0;

  for (const issue of allIssues) {
    bySource[issue.source]++;
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    bySeverity[issue.severity]++;
    if (issue.autoFixable) autoFixable++;
    else reviewRequired++;
  }

  onProgress?.(`Scan complete — ${allIssues.length} issues found`);

  return {
    scannedAt: new Date().toISOString(),
    totalScanned,
    issues: allIssues,
    summary: { bySource, byCategory, bySeverity, autoFixable, reviewRequired },
  };
}
