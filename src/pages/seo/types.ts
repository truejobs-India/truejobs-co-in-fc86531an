export interface FAQItem {
  question: string;
  answer: string;
}

export interface CityJobPageConfig {
  city: string;
  slug: string; // e.g. "jobs-in-delhi"
  state: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string; // 1000+ word unique SEO text (HTML)
  hiringTrends: string[];
  salaryInsights: { role: string; range: string }[];
  skillsDemand: string[];
  faqItems: FAQItem[];
  nearbyCities: string[]; // slugs referencing other city configs
  relatedCategories: string[]; // slugs referencing category configs
}

export interface CategoryJobPageConfig {
  category: string;
  slug: string; // e.g. "it-jobs"
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  skillsRequired: string[];
  salaryRange: { level: string; range: string }[];
  growthTrends: string[];
  faqItems: FAQItem[];
  topCities: string[]; // city slugs
  relatedIndustries: string[]; // industry slugs
  filterKeywords: string[]; // used for DB queries
}

export interface IndustryJobPageConfig {
  industry: string;
  slug: string; // e.g. "healthcare-jobs"
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  keyRoles: string[];
  salaryRange: { role: string; range: string }[];
  growthTrends: string[];
  faqItems: FAQItem[];
  topCities: string[];
  relatedCategories: string[];
  filterKeywords: string[];
}

export interface GovtJobPageConfig {
  title: string;
  slug: string; // e.g. "government-jobs"
  aliases?: string[]; // e.g. ["sarkari-naukri"]
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  examCalendar?: { exam: string; month: string; organization: string }[];
  eligibility?: string[];
  faqItems: FAQItem[];
  relatedPages: string[]; // other govt sub-page slugs
  filterKeywords: string[];
  datePublished: string; // ISO 8601 e.g. "2026-01-15"
  lastUpdated: string;   // ISO 8601 e.g. "2026-02-21"
}
