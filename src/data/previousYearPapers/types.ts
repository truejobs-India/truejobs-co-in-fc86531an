export interface PreviousYearPaperConfig {
  slug: string;
  examName: string;
  departmentSlug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  lastUpdated: string;
  overview: string;
  papers: {
    year: number;
    tier?: string;
    downloadLabel: string;
    downloadUrl: string;
    answerKeyUrl?: string;
  }[];
  faqs: { question: string; answer: string }[];
  relatedExams: { label: string; href: string }[];
  hubSlug: string;
}

const PYP_REGISTRY = new Map<string, PreviousYearPaperConfig>();

export function registerPYP(config: PreviousYearPaperConfig): void {
  PYP_REGISTRY.set(config.slug, config);
}

export function getPYPConfig(slug: string): PreviousYearPaperConfig | undefined {
  return PYP_REGISTRY.get(slug);
}

export function getAllPYPSlugs(): string[] {
  return Array.from(PYP_REGISTRY.keys());
}
