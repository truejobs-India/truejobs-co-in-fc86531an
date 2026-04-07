/**
 * Keyword normalization and structured similarity for long-tail SEO duplicate detection.
 */

const STOP_WORDS = new Set([
  'for', 'in', 'of', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to',
  'and', 'or', 'with', 'after', 'before', 'at', 'by', 'from', 'on', 'about',
  'how', 'what', 'which', 'who', 'when', 'where', 'why', 'can', 'do', 'does',
  'will', 'shall', 'should', 'could', 'would', 'may', 'might', 'has', 'have',
  'had', 'not', 'no', 'but', 'if', 'than', 'then', 'so', 'very', 'just',
  'also', 'its', 'it', 'this', 'that', 'these', 'those', 'my', 'your',
  'ke', 'ki', 'ka', 'ko', 'se', 'me', 'hai', 'hain', 'kya',
]);

/** Normalize keyword: lowercase, strip stop words, strip years, sort tokens */
export function normalizeKeyword(kw: string): string {
  return kw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))
    .filter(w => !/^20\d{2}$/.test(w)) // strip year tokens
    .sort()
    .join(' ')
    .trim();
}

export interface TopicInput {
  keyword: string;
  template?: string;
  exam?: string;
  state?: string;
  department?: string;
  year?: string;
}

export interface ExistingPage {
  id: string;
  title: string;
  slug: string;
  primary_keyword?: string | null;
  page_template?: string | null;
  target_exam?: string | null;
  target_state?: string | null;
  target_department?: string | null;
  content_mode?: string | null;
}

export interface DuplicateMatch {
  existingPage: ExistingPage;
  similarity: number;
  reason: string;
}

/** Compute structured similarity between a topic input and an existing page */
export function structuredSimilarity(topic: TopicInput, existing: ExistingPage): number {
  const normTopic = normalizeKeyword(topic.keyword);
  const normExisting = normalizeKeyword(existing.primary_keyword || existing.title);

  if (!normTopic || !normExisting) return 0;

  // Token overlap (Jaccard-like)
  const tokensA = normTopic.split(' ');
  const tokensB = normExisting.split(' ');
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  const tokenSimilarity = union > 0 ? intersection / union : 0;

  // Structural bonuses/penalties
  let structuralBonus = 0;

  // Same template type = higher risk
  if (topic.template && existing.page_template && topic.template === existing.page_template) {
    structuralBonus += 0.15;
  }

  // Same exam = higher risk
  if (topic.exam && existing.target_exam) {
    const normExam1 = topic.exam.toLowerCase().trim();
    const normExam2 = existing.target_exam.toLowerCase().trim();
    if (normExam1 === normExam2 || normExam1.includes(normExam2) || normExam2.includes(normExam1)) {
      structuralBonus += 0.1;
    }
  }

  // Same state = slight bonus
  if (topic.state && existing.target_state) {
    if (topic.state.toLowerCase().trim() === existing.target_state.toLowerCase().trim()) {
      structuralBonus += 0.05;
    }
  }

  // Slug overlap check
  const slugFromTopic = normalizeKeyword(topic.keyword).replace(/\s+/g, '-');
  if (existing.slug && existing.slug.includes(slugFromTopic.substring(0, 20))) {
    structuralBonus += 0.05;
  }

  return Math.min(1, tokenSimilarity + structuralBonus);
}

/** Find duplicates for a topic among existing pages */
export function findDuplicates(
  topic: TopicInput,
  existingPages: ExistingPage[],
  threshold = 0.65
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const page of existingPages) {
    const sim = structuredSimilarity(topic, page);
    if (sim >= threshold) {
      const reasons: string[] = [];
      if (sim >= 0.85) reasons.push('Very high keyword overlap');
      else if (sim >= 0.75) reasons.push('High keyword overlap');
      else reasons.push('Moderate keyword overlap');

      if (topic.template && page.page_template && topic.template === page.page_template) {
        reasons.push('Same template type');
      }
      if (topic.exam && page.target_exam) {
        const e1 = topic.exam.toLowerCase(), e2 = page.target_exam.toLowerCase();
        if (e1 === e2 || e1.includes(e2) || e2.includes(e1)) reasons.push('Same exam');
      }

      matches.push({
        existingPage: page,
        similarity: Math.round(sim * 100),
        reason: reasons.join(', '),
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/** Find cross-duplicates within a batch of topics */
export function findBatchDuplicates(topics: TopicInput[]): { index1: number; index2: number; reason: string }[] {
  const dupes: { index1: number; index2: number; reason: string }[] = [];
  const normalized = topics.map(t => normalizeKeyword(t.keyword));

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalized[i] === normalized[j] && normalized[i].length > 0) {
        dupes.push({ index1: i, index2: j, reason: 'Identical normalized keyword' });
      }
    }
  }

  return dupes;
}
