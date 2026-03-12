export function normalizeFaqKey(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

export interface FAQItem {
  question: string;
  answer: string;
}

export function deduplicateFaqs(staticFaqs: FAQItem[], enrichmentFaqs: FAQItem[]): FAQItem[] {
  const seen = new Set<string>();
  const result: FAQItem[] = [];
  for (const faq of staticFaqs) {
    const key = normalizeFaqKey(faq.question);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(faq);
    }
  }
  for (const faq of enrichmentFaqs) {
    const key = normalizeFaqKey(faq.question);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(faq);
    }
  }
  return result;
}
