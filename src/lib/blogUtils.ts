/**
 * Blog utility functions for content processing, SEO, and schema generation
 */

export interface BlogCategory {
  slug: string;
  name: string;
  description: string;
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  { slug: 'job-search', name: 'Job Search', description: 'Tips and strategies for finding your dream job in India' },
  { slug: 'career-advice', name: 'Career Advice', description: 'Expert guidance on career development and growth' },
  { slug: 'resume', name: 'Resume', description: 'Resume writing tips, templates, and optimization' },
  { slug: 'interview', name: 'Interview', description: 'Interview preparation, questions, and success strategies' },
  { slug: 'hr-recruitment', name: 'HR & Recruitment', description: 'Insights for HR professionals and recruiters' },
  { slug: 'hiring-trends', name: 'Hiring Trends', description: 'Latest trends in the Indian job market' },
  { slug: 'ai-in-recruitment', name: 'AI in Recruitment', description: 'How AI is transforming the hiring landscape' },
  { slug: 'results-admit-cards', name: 'Results & Admit Cards', description: 'Government exam results and admit card updates' },
  { slug: 'exam-preparation', name: 'Exam Preparation', description: 'Study tips and strategies for competitive exams' },
  { slug: 'sarkari-naukri-basics', name: 'Sarkari Naukri Basics', description: 'Fundamentals of government job preparation' },
  { slug: 'career-guides-tips', name: 'Career Guides & Tips', description: 'Comprehensive career guidance and practical tips' },
  { slug: 'job-information', name: 'Job Information', description: 'Detailed job notifications and vacancy information' },
  { slug: 'government-jobs', name: 'Government Jobs', description: 'Latest government job notifications and updates' },
  { slug: 'syllabus', name: 'Syllabus', description: 'Exam syllabus and preparation material' },
  { slug: 'current-affairs', name: 'Current Affairs', description: 'Current affairs for competitive exam preparation' },
  { slug: 'admit-cards', name: 'Admit Cards', description: 'Admit card download links and instructions' },
];

/**
 * Convert category name to URL-friendly slug
 */
export function categoryToSlug(category: string): string {
  return category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
}

/**
 * Convert URL slug to category name
 */
export function slugToCategory(slug: string): string {
  const mapping: Record<string, string> = {
    'job-search': 'Job Search',
    'career-advice': 'Career Advice',
    'resume': 'Resume',
    'interview': 'Interview',
    'hr-recruitment': 'HR & Recruitment',
    'hiring-trends': 'Hiring Trends',
    'ai-in-recruitment': 'AI in Recruitment',
    'results-admit-cards': 'Results & Admit Cards',
    'exam-preparation': 'Exam Preparation',
    'sarkari-naukri-basics': 'Sarkari Naukri Basics',
    'career-guides-tips': 'Career Guides & Tips',
    'job-information': 'Job Information',
    'government-jobs': 'Government Jobs',
    'syllabus': 'Syllabus',
    'current-affairs': 'Current Affairs',
    'admit-cards': 'Admit Cards',
  };
  return mapping[slug] || slug;
}

/**
 * Calculate reading time based on content word count
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

/**
 * Generate excerpt from content (150-160 characters)
 */
export function generateExcerpt(content: string, maxLength: number = 155): string {
  // Remove markdown/HTML formatting
  const cleanContent = content
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  // Truncate at word boundary
  const truncated = cleanContent.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength) + '...';
}

/**
 * Generate meta title (≤60 characters)
 */
export function generateMetaTitle(title: string): string {
  const maxLength = 55; // Leave room for " | TrueJobs"
  if (title.length <= maxLength) {
    return title;
  }
  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength) + '...';
}

/**
 * Generate URL slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extract primary keyword from title, slug, and first 150 words of content
 */
export function extractPrimaryKeyword(title: string, slug?: string, content?: string): string {
  const knownKeywords = [
    'SSC CGL', 'SSC CHSL', 'SSC MTS', 'SSC GD', 'SSC JE', 'SSC CPO', 'SSC',
    'UPSC', 'IBPS PO', 'IBPS Clerk', 'IBPS', 'RRB NTPC', 'RRB', 'Railway',
    'Banking', 'Govt Jobs', 'Government Jobs', 'Sarkari', 'NEET', 'JEE',
    'Resume', 'Interview', 'Job Search', 'Career', 'Freshers', 'Internship',
    'Work From Home', 'Remote Jobs', 'Salary', 'Hiring',
  ];
  const combined = `${title} ${slug?.replace(/-/g, ' ') || ''} ${(content || '').split(/\s+/).slice(0, 150).join(' ')}`.toLowerCase();
  for (const kw of knownKeywords) {
    if (combined.includes(kw.toLowerCase())) return kw;
  }
  const words = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  return words.slice(0, 3).join(' ') || title.split(' ').slice(0, 3).join(' ');
}

/**
 * Generate featured image alt text from title and keyword (max 125 chars)
 */
export function generateImageAlt(title: string, category?: string): string {
  const keyword = extractPrimaryKeyword(title);
  const base = `${keyword} - ${title}`.substring(0, 120);
  const lastSpace = base.lastIndexOf(' ');
  return lastSpace > 80 ? base.substring(0, lastSpace) : base;
}

/**
 * Auto-generate alt text for in-content images lacking descriptive alt
 */
export function enhanceContentImageAlts(content: string, primaryKeyword: string): string {
  let imgIndex = 0;
  return content.replace(/<img([^>]*)alt="([^"]*)"([^>]*)>/g, (match, before, alt, after) => {
    if (alt && alt.trim().length > 5) return match;
    imgIndex++;
    const autoAlt = `${primaryKeyword} illustration ${imgIndex} for Indian job seekers`.substring(0, 125);
    return `<img${before}alt="${autoAlt}"${after}>`;
  });
}

/**
 * Generate Article structured data for SEO
 */
export function generateArticleSchema(post: {
  title: string;
  excerpt: string | null;
  content: string;
  slug: string;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
  category: string | null;
  updated_at?: string;
  tags?: string[] | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || generateExcerpt(post.content),
    image: post.cover_image_url || 'https://truejobs.co.in/og-image.png',
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: {
      '@type': 'Organization',
      name: post.author_name || 'TrueJobs Editorial Team',
      url: 'https://truejobs.co.in/about',
    },
    publisher: {
      '@type': 'Organization',
      name: 'TrueJobs',
      logo: {
        '@type': 'ImageObject',
        url: 'https://truejobs.co.in/favicon.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://truejobs.co.in/blog/${post.slug}`,
    },
    articleSection: post.category || 'Career Advice',
    keywords: post.tags?.join(', ') || extractPrimaryKeyword(post.title),
    inLanguage: 'en-IN',
  };
}

/**
 * Generate FAQ structured data if post has FAQs
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  if (!faqs || faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate BreadcrumbList structured data
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Parse markdown content to HTML (basic implementation)
 */
export function parseMarkdown(content: string): string {
  return content
    // Headings
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-10 mb-5">$1</h2>')
    .replace(/^# (.*$)/gim, '<h2 class="text-2xl font-bold mt-10 mb-5">$1</h2>')
    // Bold and italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ml-6 mb-2">$1</li>')
    .replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ml-6 mb-2 list-decimal">$2</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Paragraphs (wrap loose text)
    .replace(/^(?!<[hl])([^<\n].+)$/gim, '<p class="mb-4 text-muted-foreground leading-relaxed">$1</p>')
    // Clean up double newlines
    .replace(/\n\n+/g, '\n')
    // Wrap lists
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="mb-6 list-disc">$&</ul>');
}

/**
 * Extract headings from content for table of contents
 */
export function extractHeadings(content: string): Array<{ level: number; text: string; id: string }> {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings: Array<{ level: number; text: string; id: string }> = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2],
      id: generateSlug(match[2]),
    });
  }

  return headings;
}
