/**
 * Client-side quality scorer for custom pages.
 * Evaluates content completeness, SEO readiness, and structural quality.
 * Returns a score out of 100 with detailed breakdown.
 */

export interface QualityBreakdown {
  score: number;           // 0-100
  wordCount: number;
  headingCount: number;
  h2Count: number;
  h3Count: number;
  listCount: number;
  tableCount: number;
  faqCount: number;
  metaTitleScore: number;  // 0-15
  metaDescScore: number;   // 0-15
  contentScore: number;    // 0-30
  structureScore: number;  // 0-20
  faqScore: number;        // 0-10
  excerptScore: number;    // 0-5
  tagScore: number;        // 0-5
  issues: string[];
  grade: 'excellent' | 'good' | 'fair' | 'poor';
}

export function scoreCustomPage(page: {
  content: string;
  meta_title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  faq_schema?: any[] | null;
  tags?: string[] | null;
}): QualityBreakdown {
  const issues: string[] = [];
  const text = (page.content || '').replace(/<[^>]+>/g, ' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const html = page.content || '';

  // Count structural elements
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length;
  const headingCount = h2Count + h3Count;
  const listCount = (html.match(/<[uo]l[\s>]/gi) || []).length;
  const tableCount = (html.match(/<table[\s>]/gi) || []).length;
  const faqCount = Array.isArray(page.faq_schema) ? page.faq_schema.length : 0;

  // ── Meta Title (0-15) ──
  let metaTitleScore = 0;
  const mtLen = (page.meta_title || '').length;
  if (mtLen === 0) { issues.push('Missing meta title'); }
  else if (mtLen >= 40 && mtLen <= 60) { metaTitleScore = 15; }
  else if (mtLen >= 30 && mtLen <= 65) { metaTitleScore = 10; }
  else { metaTitleScore = 5; issues.push(`Meta title length ${mtLen} (ideal: 40-60)`); }

  // ── Meta Description (0-15) ──
  let metaDescScore = 0;
  const mdLen = (page.meta_description || '').length;
  if (mdLen === 0) { issues.push('Missing meta description'); }
  else if (mdLen >= 120 && mdLen <= 160) { metaDescScore = 15; }
  else if (mdLen >= 80 && mdLen <= 170) { metaDescScore = 10; }
  else { metaDescScore = 5; issues.push(`Meta description length ${mdLen} (ideal: 120-160)`); }

  // ── Content quality (0-30) ──
  let contentScore = 0;
  if (wordCount >= 1500 && wordCount <= 3000) { contentScore = 30; }
  else if (wordCount >= 1000 && wordCount <= 4000) { contentScore = 22; }
  else if (wordCount >= 500) { contentScore = 15; }
  else if (wordCount >= 200) { contentScore = 8; }
  else { contentScore = 3; issues.push(`Only ${wordCount} words (target: 1500-2500)`); }
  if (wordCount < 800) issues.push('Content too thin for SEO');

  // ── Structure (0-20) ──
  let structureScore = 0;
  if (h2Count >= 3) structureScore += 8; else if (h2Count >= 1) structureScore += 4; else issues.push('No H2 headings');
  if (h3Count >= 2) structureScore += 4; else if (h3Count >= 1) structureScore += 2;
  if (listCount >= 1) structureScore += 4; else issues.push('No lists (ul/ol)');
  if (tableCount >= 1) structureScore += 4; else structureScore += 1; // tables optional

  // ── FAQs (0-10) ──
  let faqScore = 0;
  if (faqCount >= 5) faqScore = 10;
  else if (faqCount >= 3) faqScore = 7;
  else if (faqCount >= 1) faqScore = 4;
  else { faqScore = 0; issues.push('No FAQ schema'); }

  // ── Excerpt (0-5) ──
  const excerptScore = (page.excerpt && page.excerpt.length >= 20) ? 5 : 0;
  if (!excerptScore) issues.push('Missing excerpt');

  // ── Tags (0-5) ──
  const tagScore = (page.tags && page.tags.length >= 2) ? 5 : (page.tags && page.tags.length >= 1) ? 3 : 0;
  if (!tagScore) issues.push('No tags');

  const score = Math.min(100, metaTitleScore + metaDescScore + contentScore + structureScore + faqScore + excerptScore + tagScore);

  let grade: QualityBreakdown['grade'];
  if (score >= 85) grade = 'excellent';
  else if (score >= 65) grade = 'good';
  else if (score >= 45) grade = 'fair';
  else grade = 'poor';

  return {
    score, wordCount, headingCount, h2Count, h3Count, listCount, tableCount, faqCount,
    metaTitleScore, metaDescScore, contentScore, structureScore, faqScore, excerptScore, tagScore,
    issues, grade,
  };
}

/** Get color class for a quality score */
export function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 65) return 'text-primary';
  if (score >= 45) return 'text-amber-600';
  return 'text-destructive';
}

export function scoreBgColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 65) return 'bg-primary';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-destructive';
}
