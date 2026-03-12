import {
  CachePage, PageData, PageValidationReport, ValidationCheckResult,
  ValidationSeverity, ValidationCategory, SITE_URL, PAGE_TYPES,
} from './cacheTypes';
import { NOINDEX_TYPES, BREADCRUMB_EXPECTED_TYPES } from '../seo-policy/seoRoutePolicyRegistry';

const JOB_POSTING_PAGE_TYPES = [
  'govt-exam', 'employment-news',
  'city', 'state-govt', 'category', 'industry', 'department', 'qualification',
  'custom-role', 'custom-freshers', 'custom-combo', 'custom-intent',
  'combo-state-qual', 'combo-dept-qual', 'combo-cat-qual',
  'selection-state', 'deadline-today', 'deadline-week', 'deadline-month',
  'discovery-hub', 'standalone',
];

const DB_BACKED_TYPES = new Set(['blog', 'govt-exam', 'employment-news']);

const KNOWN_PAGE_TYPES = new Set(PAGE_TYPES);

// ── Helpers ─────────────────────────────────────────────────────────

export function jaccardWordSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
  const setA = normalize(a);
  const setB = normalize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function extractTitle(head: string): string {
  const m = head.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractH1(body: string): string {
  const m = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
}

function extractCanonical(head: string): string {
  const m = head.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  return m ? m[1] : '';
}

function extractRobotsContent(head: string): string {
  const m = head.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  return m ? m[1].toLowerCase() : '';
}

function extractMetaDesc(head: string): string {
  const m = head.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return m ? m[1] : '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1])); } catch { /* skip unparseable */ }
  }
  return blocks;
}

function hasSchemaType(blocks: any[], type: string): boolean {
  return blocks.some(b => {
    const t = b['@type'];
    if (t === type) return true;
    if (Array.isArray(b['@graph'])) return b['@graph'].some((g: any) => g['@type'] === type);
    return false;
  });
}

function countFaqQuestionsInSchema(blocks: any[]): number {
  for (const b of blocks) {
    if (b['@type'] === 'FAQPage' && Array.isArray(b.mainEntity)) return b.mainEntity.length;
    if (Array.isArray(b['@graph'])) {
      for (const g of b['@graph']) {
        if (g['@type'] === 'FAQPage' && Array.isArray(g.mainEntity)) return g.mainEntity.length;
      }
    }
  }
  return 0;
}

function extractInternalSlugs(body: string): Set<string> {
  const slugs = new Set<string>();
  const re = /href=["'](\/[^"'#]*|https?:\/\/truejobs\.co\.in\/[^"'#]*)/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    let href = m[1];
    href = href.replace(/^https?:\/\/truejobs\.co\.in/, '');
    href = href.replace(/^\//, '').replace(/\/$/, '');
    if (href) slugs.add(href);
  }
  return slugs;
}

// ── Check builder ───────────────────────────────────────────────────

function check(
  id: string, label: string, severity: ValidationSeverity,
  detail: string, fix: string, category: ValidationCategory
): ValidationCheckResult {
  return { id, label, severity, detail, fix, category };
}

// ── Main validate function ──────────────────────────────────────────

export function validatePage(page: CachePage): PageValidationReport {
  const { slug, pageType, title, headHtml, bodyHtml, inventoryEntry, cacheUpdatedAt } = page;
  const checks: ValidationCheckResult[] = [];

  // ── Missing cache early-exit ──
  if (page.status === 'missing' || (!headHtml && !bodyHtml)) {
    checks.push(check(
      'not-cached', 'Page not cached', 'fail',
      'No cached HTML exists for this page — validation checks cannot run.',
      'Rebuild this page to generate cached HTML.', 'seo-basics'
    ));
    return buildReport(slug, pageType, title, checks);
  }

  const head = headHtml || '';
  const body = bodyHtml || '';
  const fullHtml = head + body;
  const jsonLd = extractJsonLdBlocks(fullHtml);
  const isKnownType = KNOWN_PAGE_TYPES.has(pageType);

  // ── SEO Basics ──
  const cachedTitle = extractTitle(head);
  checks.push(check('title-present', 'Title tag present', cachedTitle ? 'pass' : 'fail',
    cachedTitle ? `"${cachedTitle.substring(0, 70)}"` : 'No <title> tag found',
    'Rebuild this page to generate a title tag.', 'seo-basics'));

  const metaDesc = extractMetaDesc(head);
  checks.push(check('meta-desc-present', 'Meta description present', metaDesc ? 'pass' : 'fail',
    metaDesc ? `${metaDesc.length} chars` : 'No meta description found',
    'Rebuild this page to generate a meta description.', 'seo-basics'));

  const canonical = extractCanonical(head);
  checks.push(check('canonical-present', 'Canonical tag present', canonical ? 'pass' : 'fail',
    canonical || 'No canonical tag found',
    'Rebuild this page to add a canonical tag.', 'seo-basics'));

  if (canonical) {
    const expected = slug ? `${SITE_URL}/${slug}` : SITE_URL;
    const match = canonical === expected || canonical === `${expected}/`;
    checks.push(check('self-canonical-correct', 'Self-canonical correct', match ? 'pass' : 'fail',
      match ? `Matches ${expected}` : `Expected "${expected}", got "${canonical}"`,
      'Fix the canonical URL in the page template or rebuild.', 'seo-basics'));
  }

  // Robots / indexability
  const robots = extractRobotsContent(head);
  const expectedNoindex = NOINDEX_TYPES.has(pageType);
  const hasNoindex = robots.includes('noindex');
  if (!isKnownType) {
    checks.push(check('robots-indexability', 'Robots indexability', 'pass',
      `Unknown page type "${pageType}" — defaulting to index expectation. Currently ${hasNoindex ? 'noindex' : 'index'}.`,
      'Verify this page type should be indexed.', 'seo-basics'));
    // Also surface info warning
    checks.push(check('unknown-page-type', 'Unknown page type', 'warning',
      `Page type "${pageType}" is not in the known types list. Falling back to default indexability.`,
      'Add this page type to PAGE_TYPES if it should be tracked.', 'seo-basics'));
  } else if (expectedNoindex && !hasNoindex) {
    checks.push(check('robots-indexability', 'Robots indexability', 'fail',
      `Expected noindex for ${pageType} but page is indexable.`,
      'Add noindex meta tag to this page type.', 'seo-basics'));
  } else if (!expectedNoindex && hasNoindex) {
    checks.push(check('robots-indexability', 'Robots indexability', 'fail',
      `Page is noindex but ${pageType} should be indexable.`,
      'Remove noindex meta tag — this page type should be indexed.', 'seo-basics'));
  } else {
    checks.push(check('robots-indexability', 'Robots indexability', 'pass',
      expectedNoindex ? 'Correctly noindex' : 'Correctly indexable', '', 'seo-basics'));
  }

  // Crawlable links
  const internalSlugs = extractInternalSlugs(body);
  checks.push(check('crawlable-links', 'Crawlable internal links present',
    internalSlugs.size > 0 ? 'pass' : 'warning',
    `${internalSlugs.size} internal links found`,
    'Add internal links to improve crawlability.', 'seo-basics'));

  // ── Schema ──
  const breadcrumbExpected = BREADCRUMB_EXPECTED_TYPES.has(pageType);
  const hasBreadcrumb = hasSchemaType(jsonLd, 'BreadcrumbList');
  if (breadcrumbExpected) {
    checks.push(check('breadcrumb-schema', 'BreadcrumbList schema', hasBreadcrumb ? 'pass' : 'warning',
      hasBreadcrumb ? 'BreadcrumbList found' : `Expected for page type "${pageType}"`,
      'Add BreadcrumbList JSON-LD schema.', 'schema'));
  }

  const inv = inventoryEntry;
  const hasFaqItems = inv && inv.faqItems && inv.faqItems.length > 0;
  const hasFaqSchema = hasSchemaType(jsonLd, 'FAQPage');
  if (hasFaqItems) {
    checks.push(check('faq-schema-expected', 'FAQPage schema', hasFaqSchema ? 'pass' : 'warning',
      hasFaqSchema ? 'FAQPage schema found' : `Inventory has ${inv!.faqItems.length} FAQ items but no FAQPage schema`,
      'Add FAQPage JSON-LD schema or rebuild this page.', 'schema'));
  }

  // JobPosting validity
  const hasJobPosting = hasSchemaType(jsonLd, 'JobPosting');
  if (hasJobPosting) {
    const allowed = JOB_POSTING_PAGE_TYPES.includes(pageType);
    checks.push(check('job-posting-valid', 'JobPosting on appropriate type',
      allowed ? 'pass' : 'warning',
      allowed ? `Allowed on ${pageType}` : `Unexpected on "${pageType}"`,
      'Remove JobPosting schema from this page type.', 'schema'));
  }

  // Schema parseable (check for unparseable blocks)
  const rawScripts = fullHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const unparseableCount = rawScripts.length - jsonLd.length;
  if (unparseableCount > 0) {
    checks.push(check('schema-parseable', 'All JSON-LD parseable', 'fail',
      `${unparseableCount} JSON-LD block(s) failed to parse`,
      'Fix JSON syntax in JSON-LD schema blocks.', 'schema'));
  }

  // ── Content Quality ──
  const bodyText = stripHtml(body);
  const wc = wordCount(bodyText);
  const wcSev: ValidationSeverity = wc > 100 ? 'pass' : wc >= 50 ? 'warning' : 'fail';
  checks.push(check('content-word-count', 'Content word count', wcSev,
    `${wc} words${wcSev === 'pass' ? '' : wcSev === 'warning' ? ' (thin content)' : ' (very thin content)'}`,
    'Add more substantive content to this page.', 'content-quality'));

  if (inv && inv.crossLinks && inv.crossLinks.length > 0 && internalSlugs.size === 0) {
    checks.push(check('internal-links-present', 'Internal links present', 'warning',
      `Inventory has ${inv.crossLinks.length} cross-links but body has 0 internal links`,
      'Rebuild to include cross-links in the page body.', 'content-quality'));
  }

  // Staleness
  if (cacheUpdatedAt) {
    const ageMs = Date.now() - new Date(cacheUpdatedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const isDbBacked = DB_BACKED_TYPES.has(pageType);
    let staleSev: ValidationSeverity = 'pass';
    let staleDetail = `${Math.round(ageDays)}d old`;
    if (isDbBacked) {
      if (ageDays > 30) { staleSev = 'fail'; staleDetail += ' (DB-backed, >30d)'; }
      else if (ageDays > 7) { staleSev = 'warning'; staleDetail += ' (DB-backed, >7d)'; }
    } else {
      if (ageDays > 90) { staleSev = 'fail'; staleDetail += ' (programmatic, >90d)'; }
      else if (ageDays > 30) { staleSev = 'warning'; staleDetail += ' (programmatic, >30d)'; }
    }
    checks.push(check('stale-threshold', 'Cache freshness', staleSev, staleDetail,
      'Rebuild this page to refresh the cache.', 'content-quality'));
  }

  // ── Consistency (only with inventory) ──
  if (inv) {
    // Title intent
    const titleSim = jaccardWordSimilarity(cachedTitle, inv.title);
    const titleSev: ValidationSeverity = titleSim >= 0.6 ? 'pass' : titleSim >= 0.3 ? 'warning' : 'fail';
    checks.push(check('title-intent', 'Title intent match', titleSev,
      `Similarity: ${titleSim.toFixed(2)} (${titleSev === 'pass' ? 'pass' : titleSev === 'warning' ? 'warning' : 'fail'} >= ${titleSev === 'fail' ? '0.30' : '0.60'})`,
      'Rebuild to align cached title with inventory title.', 'consistency'));

    // H1 match
    const cachedH1 = extractH1(body);
    const h1Sim = jaccardWordSimilarity(cachedH1, inv.h1);
    const h1Sev: ValidationSeverity = h1Sim >= 0.5 ? 'pass' : h1Sim >= 0.25 ? 'warning' : 'fail';
    checks.push(check('h1-match', 'H1 consistency', h1Sev,
      `Similarity: ${h1Sim.toFixed(2)} (${h1Sev === 'pass' ? 'pass' : h1Sev === 'warning' ? 'warning' : 'fail'} >= ${h1Sev === 'fail' ? '0.25' : '0.50'})`,
      'Rebuild to align cached H1 with inventory H1.', 'consistency'));

    // FAQ count
    if (hasFaqItems) {
      const cachedFaqCount = countFaqQuestionsInSchema(jsonLd);
      const expectedFaqCount = inv.faqItems.length;
      const diff = Math.abs(cachedFaqCount - expectedFaqCount);
      const faqSev: ValidationSeverity = diff === 0 ? 'pass' : diff === 1 ? 'warning' : 'fail';
      checks.push(check('faq-count-match', 'FAQ count match', faqSev,
        `Cached: ${cachedFaqCount}, Expected: ${expectedFaqCount}${diff > 0 ? ` (off by ${diff})` : ''}`,
        'Rebuild to sync FAQ count with inventory.', 'consistency'));
    }

    // Internal links overlap
    if (inv.crossLinks && inv.crossLinks.length > 0) {
      const invSlugs = new Set(inv.crossLinks.map(l => l.slug.replace(/^\//, '').replace(/\/$/, '')));
      const overlapCount = [...invSlugs].filter(s => internalSlugs.has(s)).length;
      const unionSize = new Set([...invSlugs, ...internalSlugs]).size;
      const linkJaccard = unionSize > 0 ? overlapCount / unionSize : 1;
      const linkSev: ValidationSeverity = linkJaccard >= 0.5 ? 'pass' : linkJaccard >= 0.25 ? 'warning' : 'pass';
      // Use info-like pass for low overlap since links may legitimately differ
      checks.push(check('internal-links-overlap', 'Internal links overlap', linkSev,
        `Jaccard: ${linkJaccard.toFixed(2)} (${overlapCount} shared of ${unionSize} unique)`,
        'Rebuild to include more inventory cross-links.', 'consistency'));
    }

    // Canonical consistency
    if (canonical) {
      const expected = slug ? `${SITE_URL}/${slug}` : SITE_URL;
      const match = canonical === expected || canonical === `${expected}/`;
      checks.push(check('canonical-consistency', 'Canonical consistency', match ? 'pass' : 'fail',
        match ? 'Matches expected' : `Expected "${expected}", got "${canonical}"`,
        'Fix canonical URL.', 'consistency'));
    }

    // ── Major mismatch composite ──
    const applicableChecks: ValidationSeverity[] = [];
    const titleCheck = checks.find(c => c.id === 'title-intent');
    const h1Check = checks.find(c => c.id === 'h1-match');
    if (titleCheck) applicableChecks.push(titleCheck.severity);
    if (h1Check) applicableChecks.push(h1Check.severity);
    if (hasFaqItems) {
      const faqCheck = checks.find(c => c.id === 'faq-count-match');
      if (faqCheck) applicableChecks.push(faqCheck.severity);
    }
    if (breadcrumbExpected) {
      const bcCheck = checks.find(c => c.id === 'breadcrumb-schema');
      if (bcCheck) applicableChecks.push(bcCheck.severity);
    }

    const failCount = applicableChecks.filter(s => s === 'fail').length;
    const majorSev: ValidationSeverity = failCount >= 3 ? 'fail' : failCount >= 2 ? 'warning' : 'pass';
    if (majorSev !== 'pass') {
      checks.push(check('major-mismatch', 'Major content mismatch', majorSev,
        `${failCount} of ${applicableChecks.length} applicable checks failed — cached page significantly diverges from expected content.`,
        'Full rebuild recommended to re-sync cached HTML with inventory.', 'consistency'));
    }
  }

  return buildReport(slug, pageType, title, checks);
}

function buildReport(slug: string, pageType: string, title: string, checks: ValidationCheckResult[]): PageValidationReport {
  let failCount = 0, warnCount = 0, passCount = 0;
  let worstSeverity: ValidationSeverity = 'pass';
  for (const c of checks) {
    if (c.severity === 'fail') { failCount++; worstSeverity = 'fail'; }
    else if (c.severity === 'warning') { warnCount++; if (worstSeverity === 'pass') worstSeverity = 'warning'; }
    else passCount++;
  }
  return { slug, pageType, title, checks, worstSeverity, failCount, warnCount, passCount };
}

// ── Batched validation runner ───────────────────────────────────────

export async function validateAllPages(
  pages: CachePage[],
  loadHtmlFn: (slug: string) => Promise<{ head_html: string | null; body_html: string | null }>,
  onProgress: (done: number, total: number) => void
): Promise<PageValidationReport[]> {
  const reports: PageValidationReport[] = [];
  const total = pages.length;
  const BATCH_SIZE = 10;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);

    const batchReports = await Promise.all(batch.map(async (page) => {
      // Missing pages — skip HTML load
      if (page.status === 'missing') {
        return validatePage(page);
      }
      // Load HTML if not already present
      let enrichedPage = page;
      if (!page.headHtml && !page.bodyHtml) {
        const { head_html, body_html } = await loadHtmlFn(page.slug);
        enrichedPage = { ...page, headHtml: head_html, bodyHtml: body_html };
      }
      return validatePage(enrichedPage);
    }));

    reports.push(...batchReports);
    onProgress(Math.min(i + BATCH_SIZE, total), total);

    // Yield to UI thread
    await new Promise(r => setTimeout(r, 0));
  }

  return reports;
}
