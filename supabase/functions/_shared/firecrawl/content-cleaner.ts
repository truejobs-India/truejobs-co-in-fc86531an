/**
 * Source 3: Content cleaner for scraped pages.
 * Rule-based removal of branding, CTAs, nav/footer, social blocks.
 * Extracts links before cleaning text. Preserves raw evidence.
 */

export interface CleaningResult {
  cleanedText: string;
  extractedLinks: ExtractedLink[];
  cleaningLog: string[];
  rawText: string;
}

export interface ExtractedLink {
  text: string;
  url: string;
  context: 'official' | 'apply' | 'notification' | 'pdf' | 'social' | 'navigation' | 'unknown';
}

// ============ Junk patterns to remove ============

/** Lines/blocks to strip entirely */
const JUNK_LINE_PATTERNS: RegExp[] = [
  // Social/promo CTAs
  /join\s+(our\s+)?(telegram|whatsapp|facebook|twitter|instagram)/i,
  /follow\s+us\s+(on|at)/i,
  /subscribe\s+(to\s+)?(our|for|now)/i,
  /download\s+(our\s+)?app/i,
  /like\s+us\s+on\s+facebook/i,
  /share\s+(this|on|with)/i,
  /click\s+here\s+to\s+(join|subscribe|follow|download)/i,
  /join\s+(here|now|today)/i,
  /get\s+instant\s+(updates|notifications|alerts)/i,
  // Navigation/related
  /read\s+more\s*[:.]?\s*$/i,
  /check\s+now\s*[:.]?\s*$/i,
  /click\s+here\s*$/i,
  /also\s+(read|check|see)\s*:/i,
  /related\s+(posts?|articles?|jobs?)\s*:/i,
  /you\s+may\s+also\s+(like|read|check)/i,
  /recommended\s+(for you|posts?|reading)/i,
  /popular\s+(posts?|articles?)/i,
  /recent\s+(posts?|articles?)/i,
  /previous\s+(post|article|next)\s*:/i,
  /next\s+(post|article)\s*:/i,
  // Source branding / attribution
  /appeared\s+first\s+on/i,
  /originally\s+published\s+(on|at|in)/i,
  /source\s*:\s*(www\.|https?:\/\/)/i,
  /courtesy\s*:\s*/i,
  /credit\s*:\s*/i,
  /disclaimer\s*:/i,
  /note\s*:\s*we\s+(are\s+not|do\s+not)/i,
  // Ad/widget placeholders
  /\[ad[s]?\]/i,
  /\[widget\]/i,
  /\[banner\]/i,
  /advertisement/i,
  /sponsored\s+(content|post|link)/i,
  // Footer patterns
  /©\s*\d{4}/i,
  /all\s+rights\s+reserved/i,
  /privacy\s+policy\s*\|/i,
  /terms\s+(of\s+use|and\s+conditions|of\s+service)/i,
];

/** Markdown link/image patterns to strip from text (but extract URLs first) */
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** Source site branding tokens to strip from titles and headings */
const BRANDING_TOKENS = [
  'sarkari naukri blog', 'sarkarinaukriblog', 'sarkari exam',
  'sarkariexam', 'ind govt jobs', 'indgovtjobs',
  'all government jobs', 'allgovernmentjobs',
  'my sarkari naukri', 'mysarkarinaukri',
  'govt job guru', 'govtjobguru',
  'freshers now', 'freshersnow',
  'career power', 'careerpower',
  'sharma jobs', 'sharmajobs',
  'sarkarinaukri.com', 'naukri day', 'rojgar result',
  'freejobalert', 'free job alert', 'employment news',
  // Source-specific shortforms and branding
  'snb', 'gjg', 'agj', 'msn govt jobs', 'sj govt jobs',
  'adda247', 'bankersadda', 'bankers adda',
  'government jobs india freshersnow',
  'govt jobs alert freshersnow',
  'sarkari disha', 'sarkaridisha',
  'recruitment guru', 'recruitment.guru',
  'testbook', 'gradeup', 'prepp.in', 'safalta',
];

/** URLs to social/non-official sites */
const SOCIAL_DOMAINS = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'linkedin.com', 'pinterest.com',
  'whatsapp.com', 't.me', 'telegram.me', 'telegram.org',
  'play.google.com', 'apps.apple.com',
];

// ============ Link extraction ============

function classifyLink(text: string, url: string): ExtractedLink['context'] {
  const lowerUrl = url.toLowerCase();
  const lowerText = text.toLowerCase();

  if (SOCIAL_DOMAINS.some(d => lowerUrl.includes(d))) return 'social';

  if (lowerUrl.endsWith('.pdf') || lowerText.includes('pdf')) return 'pdf';

  if (
    lowerText.includes('apply') || lowerText.includes('registration') ||
    lowerUrl.includes('apply') || lowerUrl.includes('registration') ||
    lowerUrl.includes('application')
  ) return 'apply';

  if (
    lowerText.includes('notification') || lowerText.includes('advt') ||
    lowerText.includes('advertisement') || lowerUrl.includes('notification') ||
    lowerUrl.includes('advt')
  ) return 'notification';

  if (
    lowerText.includes('official') || lowerUrl.includes('.gov.') ||
    lowerUrl.includes('.nic.') || lowerUrl.includes('.org.in')
  ) return 'official';

  // Nav-like: very short text, generic words
  if (text.length < 3 || /^(home|about|contact|menu|back|next|prev)/i.test(lowerText)) return 'navigation';

  return 'unknown';
}

function extractLinksFromMarkdown(markdown: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  let match;
  const linkRe = new RegExp(MARKDOWN_LINK_RE.source, 'g');
  while ((match = linkRe.exec(markdown)) !== null) {
    const [, text, url] = match;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ text: text.trim(), url, context: classifyLink(text, url) });
  }

  return links;
}

// ============ Text cleaning pipeline ============

function removeMarkdownImages(text: string): string {
  return text.replace(MARKDOWN_IMAGE_RE, '');
}

function removeJunkLines(text: string, log: string[]): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];
  let removedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { cleaned.push(''); continue; }

    const isJunk = JUNK_LINE_PATTERNS.some(p => p.test(trimmed));
    if (isJunk) {
      removedCount++;
      continue;
    }

    cleaned.push(line);
  }

  if (removedCount > 0) log.push(`Removed ${removedCount} junk lines (CTAs, nav, social, disclaimers)`);
  return cleaned.join('\n');
}

function removeBranding(text: string, log: string[]): string {
  let cleaned = text;
  let count = 0;

  for (const token of BRANDING_TOKENS) {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (re.test(cleaned)) {
      cleaned = cleaned.replace(re, '');
      count++;
    }
  }

  if (count > 0) log.push(`Removed ${count} source branding tokens`);
  return cleaned;
}

function removeSourceUrls(text: string, log: string[]): string {
  // Remove bare URLs that aren't official (.gov.in, .nic.in, .org.in)
  const urlRe = /https?:\/\/[^\s)>\]]+/g;
  let count = 0;

  const cleaned = text.replace(urlRe, (url) => {
    const lower = url.toLowerCase();
    // Keep official URLs
    if (lower.includes('.gov.') || lower.includes('.nic.') || lower.includes('.org.in')) {
      return url;
    }
    count++;
    return '';
  });

  if (count > 0) log.push(`Removed ${count} non-official source URLs from text`);
  return cleaned;
}

function normalizeWhitespace(text: string, log: string[]): string {
  let cleaned = text;

  // Collapse 3+ newlines to 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove trailing spaces on lines
  cleaned = cleaned.replace(/[ \t]+$/gm, '');

  // Remove duplicate headings (same heading appearing consecutively)
  const lines = cleaned.split('\n');
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('#') && i > 0 && lines[i - 1].trim() === trimmed) {
      continue; // skip duplicate heading
    }
    deduped.push(lines[i]);
  }
  if (deduped.length < lines.length) {
    log.push(`Removed ${lines.length - deduped.length} duplicate heading lines`);
  }
  cleaned = deduped.join('\n');

  // Collapse duplicate lines (3+ identical consecutive non-empty lines)
  const finalLines: string[] = [];
  let lastLine = '';
  let repeatCount = 0;
  for (const line of cleaned.split('\n')) {
    const t = line.trim();
    if (t === lastLine && t !== '') {
      repeatCount++;
      if (repeatCount < 2) finalLines.push(line); // keep first 2
    } else {
      repeatCount = 0;
      finalLines.push(line);
    }
    lastLine = t;
  }
  cleaned = finalLines.join('\n');

  // Fix broken bullets: lines starting with * or - without space
  cleaned = cleaned.replace(/^([*-])([^\s*-])/gm, '$1 $2');

  return cleaned.trim();
}

// ============ Main cleaning function ============

/**
 * Clean scraped markdown content:
 * 1. Extract all links before cleaning
 * 2. Remove images
 * 3. Remove junk lines (CTAs, nav, social, disclaimers)
 * 4. Remove source branding
 * 5. Remove non-official source URLs from text body
 * 6. Normalize whitespace
 * Returns cleaned text + extracted links + cleaning log
 */
export function cleanScrapedContent(rawMarkdown: string): CleaningResult {
  const log: string[] = [];

  // Step 1: Extract links
  const extractedLinks = extractLinksFromMarkdown(rawMarkdown);
  log.push(`Extracted ${extractedLinks.length} links (${extractedLinks.filter(l => l.context === 'official').length} official, ${extractedLinks.filter(l => l.context === 'apply').length} apply, ${extractedLinks.filter(l => l.context === 'social').length} social)`);

  // Step 2: Remove images
  let text = removeMarkdownImages(rawMarkdown);

  // Step 3: Strip markdown link syntax (keep text, remove URL)
  text = text.replace(MARKDOWN_LINK_RE, '$1');

  // Step 4: Remove junk lines
  text = removeJunkLines(text, log);

  // Step 5: Remove branding
  text = removeBranding(text, log);

  // Step 6: Remove source URLs from text
  text = removeSourceUrls(text, log);

  // Step 7: Normalize whitespace
  text = normalizeWhitespace(text, log);

  return {
    cleanedText: text,
    extractedLinks,
    cleaningLog: log,
    rawText: rawMarkdown,
  };
}
