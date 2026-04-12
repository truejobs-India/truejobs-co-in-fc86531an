import { analyzeQuality, analyzeSEO, type ArticleMetadata } from './blogArticleAnalyzer';

// ── Types ──────────────────────────────────────────────
export type ComplianceCheckStatus = 'pass' | 'warn' | 'fail';

export type ComplianceCategory =
  | 'google-article'
  | 'seo-quality'
  | 'adsense-safety'
  | 'content-quality'
  | 'trust-signals';

export interface ComplianceCheckItem {
  key: string;
  label: string;
  status: ComplianceCheckStatus;
  detail: string;
  recommendation?: string;
  category: ComplianceCategory;
}

export interface GoogleArticleReport {
  score: number;
  checks: ComplianceCheckItem[];
}

export interface AdsenseComplianceReport {
  score: number;
  checks: ComplianceCheckItem[];
}

export interface PublishComplianceReport {
  overallScore: number;
  checks: ComplianceCheckItem[];
  failCount: number;
  warnCount: number;
  passCount: number;
}

export type ComplianceReadinessStatus =
  | 'Blocked'
  | 'Needs Review'
  | 'Ready with Warnings'
  | 'Ready to Publish'
  | 'Published';

export const CRITICAL_BLOCK_KEYS = [
  'missing-title',
  'missing-slug',
  'missing-content',
  'extremely-thin-content',
  'dangerous-policy-risk',
  'missing-author',
  'missing-canonical',
] as const;

// ── Stopwords for keyword stuffing check ───────────────
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
  'or', 'if', 'while', 'about', 'up', 'its', 'it', 'this', 'that',
  'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my',
  'your', 'his', 'her', 'our', 'their', 'what', 'which', 'who', 'whom',
  // Hindi common
  'का', 'के', 'की', 'में', 'है', 'हैं', 'से', 'को', 'पर', 'और', 'एक',
  'यह', 'वह', 'भी', 'नहीं', 'तो', 'कर', 'या', 'कि', 'जो', 'इस',
]);

// ── Google Article Readiness ───────────────────────────
export function analyzeGoogleArticleReadiness(metadata: ArticleMetadata): GoogleArticleReport {
  const checks: ComplianceCheckItem[] = [];
  const cat: ComplianceCategory = 'google-article';

  // 1. Title
  checks.push({
    key: 'missing-title', label: 'Article title', category: cat,
    status: metadata.title ? 'pass' : 'fail',
    detail: metadata.title ? `"${metadata.title.substring(0, 50)}"` : 'No title set',
    recommendation: metadata.title ? undefined : 'Add a descriptive article title',
  });

  // 2. H1
  const h1s = (metadata.headings || []).filter(h => h.level === 1);
  checks.push({
    key: 'h1-present', label: 'Single H1 heading', category: cat,
    status: h1s.length === 1 ? 'pass' : h1s.length > 1 ? 'warn' : 'fail',
    detail: h1s.length === 1 ? 'Single H1 present' : h1s.length > 1 ? `${h1s.length} H1s found` : 'No H1 heading',
    recommendation: h1s.length !== 1 ? 'Ensure exactly one H1 heading per article' : undefined,
  });

  // 3. Meta title
  const mtLen = metadata.metaTitle?.length || 0;
  checks.push({
    key: 'meta-title', label: 'Meta title', category: cat,
    status: mtLen > 0 && mtLen <= 60 ? 'pass' : mtLen > 60 ? 'warn' : 'fail',
    detail: mtLen > 0 ? `${mtLen}/60 chars` : 'Not set',
    recommendation: mtLen === 0 ? 'Add a meta title under 60 characters' : mtLen > 60 ? 'Shorten meta title to 60 characters' : undefined,
  });

  // 4. Meta description
  const mdLen = metadata.metaDescription?.length || 0;
  checks.push({
    key: 'meta-description', label: 'Meta description', category: cat,
    status: mdLen >= 100 && mdLen <= 155 ? 'pass' : mdLen > 0 ? 'warn' : 'fail',
    detail: mdLen > 0 ? `${mdLen} chars (100-155 ideal)` : 'Not set',
    recommendation: mdLen === 0 ? 'Write a compelling meta description' : mdLen < 100 ? 'Expand meta description to 100+ chars' : mdLen > 155 ? 'Shorten to under 155 characters' : undefined,
  });

  // 5. Canonical URL
  checks.push({
    key: 'missing-canonical', label: 'Canonical URL', category: cat,
    status: metadata.canonicalUrl ? 'pass' : 'fail',
    detail: metadata.canonicalUrl || 'Not set',
    recommendation: metadata.canonicalUrl ? undefined : 'Set a canonical URL to avoid duplicate content issues',
  });

  // 6. Featured image
  checks.push({
    key: 'featured-image', label: 'Featured image', category: cat,
    status: metadata.coverImageUrl ? 'pass' : 'fail',
    detail: metadata.coverImageUrl ? 'Present' : 'Missing',
    recommendation: metadata.coverImageUrl ? undefined : 'Add a cover image (1200×630 recommended)',
  });

  // 7. Image alt text
  checks.push({
    key: 'image-alt', label: 'Image alt text', category: cat,
    status: metadata.coverImageAlt ? 'pass' : metadata.coverImageUrl ? 'warn' : 'fail',
    detail: metadata.coverImageAlt ? 'Set' : 'Missing',
    recommendation: !metadata.coverImageAlt ? 'Add descriptive alt text for accessibility and SEO' : undefined,
  });

  // 8. Author
  checks.push({
    key: 'missing-author', label: 'Author attribution', category: cat,
    status: metadata.authorName ? 'pass' : 'fail',
    detail: metadata.authorName || 'No author set',
    recommendation: metadata.authorName ? undefined : 'Add an author name for E-E-A-T signals',
  });

  // 9. Body length
  checks.push({
    key: 'body-length', label: 'Body length', category: cat,
    status: metadata.wordCount >= 800 ? 'pass' : metadata.wordCount >= 300 ? 'warn' : 'fail',
    detail: `${metadata.wordCount} words`,
    recommendation: metadata.wordCount < 800 ? 'Aim for 800+ words for comprehensive coverage' : undefined,
  });

  // 10. Extremely thin content
  checks.push({
    key: 'extremely-thin-content', label: 'Not thin content', category: cat,
    status: metadata.wordCount >= 300 ? 'pass' : 'fail',
    detail: metadata.wordCount < 300 ? `Only ${metadata.wordCount} words — extremely thin` : 'Adequate length',
    recommendation: metadata.wordCount < 300 ? 'Content needs substantially more text to be indexable' : undefined,
  });

  // 11. Article type eligibility
  checks.push({
    key: 'article-type', label: 'Article type eligible', category: cat,
    status: 'pass',
    detail: 'Blog article format',
  });

  // 12. FAQ schema eligibility
  checks.push({
    key: 'faq-schema', label: 'FAQ schema eligibility', category: cat,
    status: (metadata.faqCount || 0) > 0 ? 'pass' : 'warn',
    detail: (metadata.faqCount || 0) > 0 ? `${metadata.faqCount} FAQs — schema eligible` : 'No FAQ section',
    recommendation: (metadata.faqCount || 0) === 0 ? 'Add FAQ section for rich snippet eligibility' : undefined,
  });

  // 13. Heading hierarchy
  const headings = metadata.headings || [];
  let hasSkipped = false;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) { hasSkipped = true; break; }
  }
  checks.push({
    key: 'heading-hierarchy', label: 'Heading hierarchy', category: cat,
    status: !hasSkipped && headings.length > 2 ? 'pass' : headings.length > 0 ? 'warn' : 'fail',
    detail: hasSkipped ? 'Skipped heading levels detected' : `${headings.length} headings`,
    recommendation: hasSkipped ? 'Fix heading hierarchy — don\'t skip levels (H2→H4)' : headings.length <= 2 ? 'Add more section headings for structure' : undefined,
  });

  // 14. Excerpt
  checks.push({
    key: 'excerpt', label: 'Excerpt/summary', category: cat,
    status: metadata.excerpt ? 'pass' : 'warn',
    detail: metadata.excerpt ? 'Set' : 'Not set',
    recommendation: metadata.excerpt ? undefined : 'Add an excerpt for article listings',
  });

  // 15. Reading time
  checks.push({
    key: 'reading-time', label: 'Reading time calculable', category: cat,
    status: metadata.wordCount > 0 ? 'pass' : 'fail',
    detail: metadata.wordCount > 0 ? `~${Math.max(1, Math.ceil(metadata.wordCount / 200))} min` : 'No content',
  });

  // 16. Clean slug
  const slugClean = metadata.slug && /^[a-z0-9-]+$/.test(metadata.slug);
  checks.push({
    key: 'missing-slug', label: 'URL slug', category: cat,
    status: slugClean ? 'pass' : metadata.slug ? 'warn' : 'fail',
    detail: metadata.slug ? `/blog/${metadata.slug}` : 'Not set',
    recommendation: !slugClean ? 'Set a clean, lowercase URL slug with hyphens only' : undefined,
  });

  // 17. Missing content
  checks.push({
    key: 'missing-content', label: 'Content body', category: cat,
    status: metadata.content && metadata.content.replace(/<[^>]+>/g, '').trim().length > 0 ? 'pass' : 'fail',
    detail: metadata.content ? 'Present' : 'Empty',
    recommendation: !metadata.content ? 'Add article content' : undefined,
  });

  // 18. Intro paragraph
  checks.push({
    key: 'missing-intro', label: 'Introduction paragraph', category: cat,
    status: metadata.hasIntro ? 'pass' : 'fail',
    detail: metadata.hasIntro ? 'Intro paragraph present' : 'No intro paragraph before first heading',
    recommendation: !metadata.hasIntro ? 'Add an introductory paragraph before the first heading' : undefined,
  });

  // 19. Conclusion section
  checks.push({
    key: 'missing-conclusion', label: 'Conclusion section', category: cat,
    status: metadata.hasConclusion ? 'pass' : 'warn',
    detail: metadata.hasConclusion ? 'Conclusion detected' : 'No conclusion section found',
    recommendation: !metadata.hasConclusion ? 'Add a conclusion or summary section' : undefined,
  });

  // 20. Readability structures
  const hasReadabilityStructures = /<[uo]l|<table|<dl/i.test(metadata.content);
  checks.push({
    key: 'missing-lists', label: 'Readability structures', category: cat,
    status: hasReadabilityStructures ? 'pass' : 'warn',
    detail: hasReadabilityStructures ? 'Lists/tables present' : 'No lists, tables, or structured elements',
    recommendation: !hasReadabilityStructures ? 'Add bullet points, numbered lists, or tables' : undefined,
  });

  // 21. Heading count
  const h2Count = (metadata.headings || []).filter(h => h.level === 2).length;
  checks.push({
    key: 'low-heading-count', label: 'Sufficient section headings', category: cat,
    status: h2Count >= 3 ? 'pass' : h2Count >= 1 ? 'warn' : 'fail',
    detail: `${h2Count} H2 headings (3+ recommended)`,
    recommendation: h2Count < 3 ? 'Add more H2 section headings for better structure' : undefined,
  });

  const passCount = checks.filter(c => c.status === 'pass').length;
  const score = Math.round((passCount / checks.length) * 100);

  return { score, checks };
}

// ── AdSense Compliance (Heuristic) ─────────────────────
export function analyzeAdsenseCompliance(metadata: ArticleMetadata): AdsenseComplianceReport {
  const checks: ComplianceCheckItem[] = [];
  const plainText = metadata.content.replace(/<[^>]+>/g, '').trim();
  const words = plainText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Temporary debug helper — log matched snippets for failed checks only
  const _debugSlug = metadata.slug || metadata.title?.substring(0, 40) || 'unknown';
  const _storedWC = metadata.wordCount ?? -1;
  function _logFail(key: string, matchSnippet: string | null) {
    console.warn(`[COMPLIANCE-DEBUG] slug="${_debugSlug}" rule="${key}" match="${matchSnippet?.substring(0, 80) || 'N/A'}" storedWC=${_storedWC} liveWC=${wordCount}`);
  }

  // 1. Thin/doorway content
  const thinStatus = wordCount >= 300 ? 'pass' : 'fail';
  checks.push({
    key: 'thin-doorway', label: 'Not thin/doorway content', category: 'adsense-safety',
    status: thinStatus,
    detail: wordCount < 300 ? `Only ${wordCount} words — may be flagged as thin` : `${wordCount} words`,
    recommendation: wordCount < 300 ? 'Expand content to 300+ words minimum' : undefined,
  });
  if (thinStatus === 'fail') _logFail('thin-doorway', `${wordCount} words`);

  // 2. Repeated sentence ratio
  const sentences = plainText.split(/[.!?।]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 10);
  const uniqueSentences = new Set(sentences);
  const repeatRatio = sentences.length > 0 ? 1 - (uniqueSentences.size / sentences.length) : 0;
  checks.push({
    key: 'repeated-content', label: 'No excessive repetition', category: 'content-quality',
    status: repeatRatio < 0.15 ? 'pass' : repeatRatio < 0.3 ? 'warn' : 'fail',
    detail: `${Math.round(repeatRatio * 100)}% repeated sentences`,
    recommendation: repeatRatio >= 0.15 ? 'Reduce duplicate sentences and paraphrasing loops' : undefined,
  });

  // 3. Placeholder text
  const hasPlaceholder = /lorem ipsum|TODO|FIXME|placeholder|insert text here|TBD/i.test(plainText);
  checks.push({
    key: 'placeholder-text', label: 'No placeholder text', category: 'content-quality',
    status: hasPlaceholder ? 'fail' : 'pass',
    detail: hasPlaceholder ? 'Placeholder/TODO text detected' : 'Clean',
    recommendation: hasPlaceholder ? 'Remove all placeholder and TODO text before publishing' : undefined,
  });

  // 4. Keyword stuffing
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    const lower = w.toLowerCase().replace(/[^\w\u0900-\u097F]/g, '');
    if (lower.length > 2 && !STOPWORDS.has(lower)) {
      wordFreq[lower] = (wordFreq[lower] || 0) + 1;
    }
  });
  const maxFreqRatio = wordCount > 0
    ? Math.max(0, ...Object.values(wordFreq).map(f => f / wordCount))
    : 0;
  checks.push({
    key: 'keyword-stuffing', label: 'No keyword stuffing', category: 'adsense-safety',
    status: maxFreqRatio <= 0.03 ? 'pass' : maxFreqRatio <= 0.05 ? 'warn' : 'fail',
    detail: `Max keyword density: ${(maxFreqRatio * 100).toFixed(1)}%`,
    recommendation: maxFreqRatio > 0.03 ? 'Diversify vocabulary — no single keyword should exceed 3% density' : undefined,
  });

  // 5. Short-paragraph-only structure
  const paragraphs = metadata.content.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const shortParas = paragraphs.filter(p => p.replace(/<[^>]+>/g, '').trim().split(/\s+/).length < 10);
  const shortRatio = paragraphs.length > 0 ? shortParas.length / paragraphs.length : 0;
  checks.push({
    key: 'short-para-only', label: 'Substantive paragraphs', category: 'content-quality',
    status: shortRatio < 0.6 ? 'pass' : shortRatio < 0.8 ? 'warn' : 'fail',
    detail: `${Math.round(shortRatio * 100)}% short paragraphs`,
    recommendation: shortRatio >= 0.6 ? 'Add more detailed, substantive paragraphs' : undefined,
  });

  // 6. Clickbait patterns
  const clickbait = /you won'?t believe|shocking|this one trick|doctors hate|secret revealed|click here to|number \d+ will shock/i.test(plainText);
  checks.push({
    key: 'clickbait', label: 'No clickbait patterns', category: 'adsense-safety',
    status: clickbait ? 'warn' : 'pass',
    detail: clickbait ? 'Clickbait-style phrases detected' : 'Clean',
    recommendation: clickbait ? 'Remove sensationalized clickbait phrasing' : undefined,
  });

  // 7. Adult/explicit keywords (refined to avoid HR/legal false positives)
  const adultRegex = /\b(porn(?:ography)?|xxx|nude|naked|sexting|escort\s*service|erotic(?:a|ism)?|adult\s*content|adult\s*entertainment)\b/i;
  const adultMatch = plainText.match(adultRegex);
  const adultContent = !!adultMatch;
  checks.push({
    key: 'adult-content', label: 'No adult content signals', category: 'adsense-safety',
    status: adultContent ? 'fail' : 'pass',
    detail: adultContent ? 'Adult content keywords detected' : 'Clean',
    recommendation: adultContent ? 'Remove adult/explicit content — violates AdSense policies' : undefined,
  });
  if (adultContent) _logFail('adult-content', adultMatch?.[0] ?? null);

  // 8. Hate/violence/extremist
  const hateViolence = /\b(kill|murder|terrorist|extremist|hate (?:speech|crime)|genocide|ethnic cleansing)\b/i.test(plainText);

  checks.push({
    key: 'hate-violence', label: 'No hate/violence signals', category: 'adsense-safety',
    status: hateViolence ? 'warn' : 'pass',
    detail: hateViolence ? 'Violence/hate-related keywords found — review context' : 'Clean',
    recommendation: hateViolence ? 'Review flagged content for policy compliance' : undefined,
  });

  // 9. Illegal/drug/gambling
  const illegalRegex = /\b(buy drugs|illegal download|pirated|gambling tips|bet(?:ting)? tips|casino hack|weed delivery)\b/i;
  const illegalMatch = plainText.match(illegalRegex);
  const illegalContent = !!illegalMatch;
  checks.push({
    key: 'illegal-content', label: 'No prohibited content signals', category: 'adsense-safety',
    status: illegalContent ? 'fail' : 'pass',
    detail: illegalContent ? 'Prohibited content keywords detected' : 'Clean',
    recommendation: illegalContent ? 'Remove content related to illegal activities' : undefined,
  });
  if (illegalContent) _logFail('illegal-content', illegalMatch?.[0] ?? null);

  // 10. Dangerous policy risk (composite)
  const dangerousRisk = adultContent || illegalContent;
  checks.push({
    key: 'dangerous-policy-risk', label: 'No dangerous policy violations', category: 'adsense-safety',
    status: dangerousRisk ? 'fail' : 'pass',
    detail: dangerousRisk ? 'High-risk policy violations detected' : 'No dangerous violations',
    recommendation: dangerousRisk ? 'Address all policy violations before publishing' : undefined,
  });
  if (dangerousRisk) _logFail('dangerous-policy-risk', adultMatch?.[0] ?? illegalMatch?.[0] ?? null);

  // 11. YMYL certainty claims
  const ymylClaims = /\b(guaranteed (?:cure|results?|income)|100% (?:safe|effective|proven)|miracle (?:cure|drug|solution))\b/i.test(plainText);
  checks.push({
    key: 'ymyl-claims', label: 'No unsupported YMYL claims', category: 'trust-signals',
    status: ymylClaims ? 'warn' : 'pass',
    detail: ymylClaims ? 'Potentially misleading health/financial claims found' : 'Clean',
    recommendation: ymylClaims ? 'Add disclaimers or cite sources for health/financial claims' : undefined,
  });

  // 12. Scraped content patterns
  const scraped = /\b(source:|originally published|copied from|all rights reserved by|©\s*\d{4}\s*(?:by)?)/i.test(plainText);
  checks.push({
    key: 'scraped-content', label: 'No scraped content signals', category: 'content-quality',
    status: scraped ? 'warn' : 'pass',
    detail: scraped ? 'Possible scraped content attribution detected' : 'Appears original',
    recommendation: scraped ? 'Ensure content is original — remove copy attribution markers' : undefined,
  });

  // 13. Manipulative urgency
  const urgency = /\b(act now|limited time|hurry|last chance|don'?t miss|expires today|only \d+ left)\b/i.test(plainText);
  checks.push({
    key: 'manipulative-urgency', label: 'No manipulative urgency', category: 'adsense-safety',
    status: urgency ? 'warn' : 'pass',
    detail: urgency ? 'Urgency manipulation phrases detected' : 'Clean',
    recommendation: urgency ? 'Tone down aggressive urgency language' : undefined,
  });

  // 14. Excessive affiliate links (ref= removed — too generic)
  const affiliateMatches = (metadata.content.match(/(?:utm_|affiliate|partner=|aff_id)/gi) || []).length;
  const affiliateStatus = affiliateMatches <= 3 ? 'pass' : affiliateMatches <= 5 ? 'warn' : 'fail';
  checks.push({
    key: 'excessive-affiliates', label: 'Reasonable affiliate link count', category: 'adsense-safety',
    status: affiliateStatus,
    detail: `${affiliateMatches} affiliate-pattern links`,
    recommendation: affiliateMatches > 3 ? 'Reduce affiliate links — high density may trigger AdSense flags' : undefined,
  });
  if (affiliateStatus === 'fail') _logFail('excessive-affiliates', `${affiliateMatches} matches`);

  // 15. Link density
  const linkCount = (metadata.content.match(/<a\s/gi) || []).length;
  const linkDensity = wordCount > 0 ? linkCount / wordCount : 0;
  const linkDensityStatus = linkDensity <= 0.02 ? 'pass' : linkDensity <= 0.04 ? 'warn' : 'fail';
  checks.push({
    key: 'link-density', label: 'Reasonable link density', category: 'content-quality',
    status: linkDensityStatus,
    detail: `${linkCount} links in ${wordCount} words (${(linkDensity * 100).toFixed(2)}%)`,
    recommendation: linkDensity > 0.02 ? 'Reduce link count — excessive linking may be penalized' : undefined,
  });
  if (linkDensityStatus === 'fail') _logFail('link-density', `${linkCount} links / ${wordCount} words`);

  // 16. Trust signals — author + no deceptive official claims
  const hasAuthor = !!metadata.authorName;
  const deceptiveOfficial = /\b(official (?:government|website)|endorsed by (?:government|ministry))\b/i.test(plainText);
  checks.push({
    key: 'trust-author', label: 'Trust signals present', category: 'trust-signals',
    status: hasAuthor && !deceptiveOfficial ? 'pass' : !hasAuthor ? 'warn' : 'fail',
    detail: deceptiveOfficial ? 'Potentially deceptive official claims' : hasAuthor ? 'Author attributed' : 'No author attribution',
    recommendation: deceptiveOfficial ? 'Remove unsupported claims of official endorsement' : !hasAuthor ? 'Add author name for trust' : undefined,
  });

  const passCount = checks.filter(c => c.status === 'pass').length;
  const score = Math.round((passCount / checks.length) * 100);

  return { score, checks };
}

// ── Publish Compliance (merged) ────────────────────────
export function analyzePublishCompliance(metadata: ArticleMetadata): PublishComplianceReport {
  const google = analyzeGoogleArticleReadiness(metadata);
  const adsense = analyzeAdsenseCompliance(metadata);
  const seo = analyzeSEO(metadata);

  // Convert SEO checks to ComplianceCheckItem
  const seoChecks: ComplianceCheckItem[] = seo.checks.map(c => ({
    key: `seo-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
    label: c.name,
    status: c.status,
    detail: c.detail,
    category: 'seo-quality' as ComplianceCategory,
  }));

  const allChecks = [...google.checks, ...seoChecks, ...adsense.checks];
  const failCount = allChecks.filter(c => c.status === 'fail').length;
  const warnCount = allChecks.filter(c => c.status === 'warn').length;
  const passCount = allChecks.filter(c => c.status === 'pass').length;

  const overallScore = Math.round(
    0.4 * google.score + 0.3 * seo.totalScore + 0.3 * adsense.score
  );

  return { overallScore, checks: allChecks, failCount, warnCount, passCount };
}

// ── Compliance Readiness Status ────────────────────────
export function getComplianceReadinessStatus(
  compliance: PublishComplianceReport,
  metadata: ArticleMetadata
): ComplianceReadinessStatus {
  if (metadata.isPublished) return 'Published';

  // Check for critical blocks
  const hasCriticalBlock = compliance.checks.some(
    c => c.status === 'fail' && (CRITICAL_BLOCK_KEYS as readonly string[]).includes(c.key)
  );
  if (hasCriticalBlock) return 'Blocked';

  if (compliance.failCount > 0) return 'Needs Review';
  if (compliance.warnCount > 0) return 'Ready with Warnings';
  return 'Ready to Publish';
}
