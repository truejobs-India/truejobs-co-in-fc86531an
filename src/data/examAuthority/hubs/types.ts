export interface ExamHubConfig {
  slug: string;
  examName: string;
  departmentSlug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  lastUpdated: string;
  intro: string;
  subtopicPages: {
    label: string;
    href: string;
    description: string;
  }[];
  faqs: { question: string; answer: string }[];
  relatedHubs: { label: string; href: string }[];
}

const HUB_REGISTRY = new Map<string, ExamHubConfig>();

export function registerHub(config: ExamHubConfig): void {
  HUB_REGISTRY.set(config.slug, config);
}

export function getHubConfig(slug: string): ExamHubConfig | undefined {
  return HUB_REGISTRY.get(slug);
}

export function getAllHubSlugs(): string[] {
  return Array.from(HUB_REGISTRY.keys());
}
