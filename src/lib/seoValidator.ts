/**
 * seoValidator.ts — Deterministic SEO validation for board result batch rows.
 * Frontend UX guidance only. Backend publish RPC is the authoritative safety net.
 */

export interface SeoIssue {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface SeoAuditResult {
  valid: boolean;
  issues: SeoIssue[];
  score: number; // 0-100
}

// ═══════════════════════════════════════════════════════════════
// Individual validators
// ═══════════════════════════════════════════════════════════════

export function validateSlug(slug: string, existingSlugs: string[] = []): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (!slug) {
    issues.push({ field: 'slug', severity: 'error', message: 'Slug is required' });
    return issues;
  }
  if (slug.length < 3) issues.push({ field: 'slug', severity: 'error', message: 'Slug too short (min 3 chars)' });
  if (slug.length > 70) issues.push({ field: 'slug', severity: 'error', message: 'Slug too long (max 70 chars)' });
  if (slug !== slug.toLowerCase()) issues.push({ field: 'slug', severity: 'error', message: 'Slug must be lowercase' });
  if (/--/.test(slug)) issues.push({ field: 'slug', severity: 'warning', message: 'Slug has double hyphens' });
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) issues.push({ field: 'slug', severity: 'error', message: 'Slug must start/end with alphanumeric' });
  if (existingSlugs.includes(slug)) issues.push({ field: 'slug', severity: 'error', message: 'Slug duplicated within batch' });
  return issues;
}

export function validateMetaTitle(title: string | null | undefined): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (!title) { issues.push({ field: 'meta_title', severity: 'error', message: 'Meta title is required' }); return issues; }
  if (title.length < 30) issues.push({ field: 'meta_title', severity: 'warning', message: `Meta title short (${title.length}/30-60 chars)` });
  if (title.length > 60) issues.push({ field: 'meta_title', severity: 'warning', message: `Meta title long (${title.length}/60 chars max)` });
  return issues;
}

export function validateMetaDescription(desc: string | null | undefined): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (!desc) { issues.push({ field: 'meta_description', severity: 'error', message: 'Meta description is required' }); return issues; }
  if (desc.length < 120) issues.push({ field: 'meta_description', severity: 'warning', message: `Meta description short (${desc.length}/120-160 chars)` });
  if (desc.length > 160) issues.push({ field: 'meta_description', severity: 'warning', message: `Meta description long (${desc.length}/160 chars max)` });
  return issues;
}

export function validateContent(content: string | null | undefined, wordCount: number): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (!content || content.trim().length < 50) {
    issues.push({ field: 'content', severity: 'error', message: 'Content is empty or too short' });
    return issues;
  }
  if (wordCount < 300) issues.push({ field: 'content', severity: 'error', message: `Thin content: ${wordCount} words (min 300 backend / 800 recommended)` });
  else if (wordCount < 800) issues.push({ field: 'content', severity: 'warning', message: `Content below recommended: ${wordCount}/800 words` });

  // Heading structure
  const h2Count = (content.match(/<h2[\s>]/gi) || []).length;
  if (h2Count < 3) issues.push({ field: 'content', severity: 'warning', message: `Only ${h2Count} H2 headings (recommend 3+)` });

  const h1Count = (content.match(/<h1[\s>]/gi) || []).length;
  if (h1Count > 1) issues.push({ field: 'content', severity: 'warning', message: 'Multiple H1 tags detected' });

  return issues;
}

export function validateFaq(faqSchema: any): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const faqs = Array.isArray(faqSchema) ? faqSchema : [];
  if (faqs.length === 0) issues.push({ field: 'faq_schema', severity: 'warning', message: 'No FAQ schema present' });
  else if (faqs.length < 5) issues.push({ field: 'faq_schema', severity: 'info', message: `${faqs.length} FAQs (recommend 5+)` });
  return issues;
}

export function checkMissingSections(content: string): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const lower = content.toLowerCase();
  const checks: [string, string][] = [
    ['introduction', 'Introduction/overview section'],
    ['how to check', 'How to check results section'],
    ['important dates', 'Important dates section'],
    ['faq', 'FAQ section'],
  ];
  for (const [keyword, label] of checks) {
    if (!lower.includes(keyword)) {
      issues.push({ field: 'content', severity: 'info', message: `Missing: ${label}` });
    }
  }
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// Full audit
// ═══════════════════════════════════════════════════════════════

export function runFullSeoAudit(row: {
  slug: string;
  meta_title?: string | null;
  meta_description?: string | null;
  content?: string | null;
  word_count?: number;
  faq_schema?: any;
}, existingSlugs: string[] = []): SeoAuditResult {
  const all: SeoIssue[] = [
    ...validateSlug(row.slug, existingSlugs),
    ...validateMetaTitle(row.meta_title),
    ...validateMetaDescription(row.meta_description),
    ...validateContent(row.content, row.word_count ?? 0),
    ...validateFaq(row.faq_schema),
    ...(row.content ? checkMissingSections(row.content) : []),
  ];

  const errors = all.filter(i => i.severity === 'error').length;
  const warnings = all.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 15 - warnings * 5);

  return { valid: errors === 0, issues: all, score };
}
