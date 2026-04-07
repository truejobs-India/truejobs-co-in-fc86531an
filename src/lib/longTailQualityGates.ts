/**
 * Quality gate checks for long-tail SEO pages.
 * Verifies generated content meets template-specific requirements.
 */

import { LONG_TAIL_TEMPLATES } from './longTailTemplates';

export interface QualityCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface QualityGateResult {
  passed: boolean;
  score: number; // 0-100
  checks: QualityCheck[];
  reason: string | null;
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(/\s+/).length : 0;
}

export function runQualityGates(
  content: string,
  templateKey: string,
  metadata: {
    officialSourceUrl?: string;
    wordCount?: number;
  }
): QualityGateResult {
  const template = LONG_TAIL_TEMPLATES[templateKey];
  if (!template) {
    return { passed: true, score: 50, checks: [], reason: 'Unknown template — basic checks only' };
  }

  const checks: QualityCheck[] = [];
  const wc = metadata.wordCount || countWords(content);
  const contentLower = content.toLowerCase();

  // 1. Quick answer check — first 300 chars should contain substantive content
  const firstChunk = content.substring(0, 500);
  const hasQuickAnswer = /<(p|strong|b)\b/i.test(firstChunk) && firstChunk.replace(/<[^>]+>/g, '').trim().length > 50;
  checks.push({
    name: 'Quick answer present',
    passed: hasQuickAnswer,
    detail: hasQuickAnswer ? 'Content starts with substantive answer' : 'First section may lack a direct answer',
  });

  // 2. Table check (if required)
  if (template.requiresTable) {
    const hasTable = /<table\b/i.test(content);
    checks.push({
      name: 'Summary table',
      passed: hasTable,
      detail: hasTable ? 'Contains data table' : 'Missing required data table',
    });
  }

  // 3. FAQ check
  const hasFaq = /faq|frequently\s*asked|सामान्य\s*प्रश्न/i.test(content);
  checks.push({
    name: 'FAQ section',
    passed: hasFaq,
    detail: hasFaq ? 'FAQ section found' : 'Missing FAQ section',
  });

  // 4. Template-specific section patterns
  let patternsPassed = 0;
  for (const pattern of template.sectionPatterns) {
    if (pattern.test(content)) patternsPassed++;
  }
  const patternsRatio = template.sectionPatterns.length > 0
    ? patternsPassed / template.sectionPatterns.length
    : 1;
  checks.push({
    name: 'Template sections',
    passed: patternsRatio >= 0.5,
    detail: `${patternsPassed}/${template.sectionPatterns.length} expected patterns found`,
  });

  // 5. Word count check
  const meetsWordCount = wc >= template.minWordCount;
  checks.push({
    name: 'Word count',
    passed: meetsWordCount,
    detail: `${wc} words (minimum: ${template.minWordCount})`,
  });

  // 6. H2 heading count
  const h2Count = (content.match(/<h2\b/gi) || []).length;
  const hasEnoughSections = h2Count >= 3;
  checks.push({
    name: 'Section structure',
    passed: hasEnoughSections,
    detail: `${h2Count} H2 headings found (minimum: 3)`,
  });

  // 7. Internal links / link suggestions
  const linkCount = (content.match(/<a\b/gi) || []).length;
  const hasLinks = linkCount >= 1;
  checks.push({
    name: 'Internal links',
    passed: hasLinks,
    detail: hasLinks ? `${linkCount} links found` : 'No internal links found',
  });

  // 8. Source grounding (for factual templates)
  const factualTemplates = ['age-limit', 'salary', 'eligibility', 'dates', 'application-fee', 'result', 'admit-card', 'syllabus', 'exam-pattern'];
  if (factualTemplates.includes(templateKey)) {
    const hasSource = Boolean(metadata.officialSourceUrl);
    checks.push({
      name: 'Source grounding',
      passed: hasSource,
      detail: hasSource ? 'Official source URL provided' : 'No official source URL — content is AI-inferred',
    });
  }

  // 9. Repetition check (simple: look for 3+ identical sentences)
  const sentences = content.replace(/<[^>]+>/g, '').split(/[.!?।]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20);
  const sentenceSet = new Set<string>();
  let duplicateSentences = 0;
  for (const s of sentences) {
    if (sentenceSet.has(s)) duplicateSentences++;
    sentenceSet.add(s);
  }
  const isRepetitive = duplicateSentences > 3;
  checks.push({
    name: 'Content originality',
    passed: !isRepetitive,
    detail: isRepetitive ? `${duplicateSentences} repeated sentences detected` : 'No excessive repetition',
  });

  // Calculate score
  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const passed = score >= 60; // At least 60% of checks must pass

  const failedChecks = checks.filter(c => !c.passed);
  const reason = passed ? null : failedChecks.map(c => c.name).join(', ');

  return { passed, score, checks, reason };
}

/** Compute stale_after date based on template and year */
export function computeStaleAfter(templateKey: string, targetYear?: string): string | null {
  const template = LONG_TAIL_TEMPLATES[templateKey];
  if (!template) return null;

  if (targetYear && /^20\d{2}$/.test(targetYear)) {
    // Set stale at end of that year
    return `${targetYear}-12-31T23:59:59Z`;
  }

  if (template.timeSensitive) {
    // 90 days from now
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString();
  }

  return null;
}
