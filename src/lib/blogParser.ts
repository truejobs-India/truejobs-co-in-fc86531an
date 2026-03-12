import mammoth from 'mammoth';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────
export interface ParsedArticle {
  id: string;
  fileName: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl: string;
  category: string;
  tags: string[];
  authorName: string;
  language: string;
  wordCount: number;
  readingTime: number;
  faqCount: number;
  hasFaqSchema: boolean;
  faqSchema: { question: string; answer: string }[] | null;
  internalLinks: { path: string; anchorText: string }[];
  content: string; // HTML
  coverImageUrl: string;
  coverImageAlt: string;
  articleImages: { url: string; alt: string; insertAfterSection: string }[];
  status: 'draft' | 'scheduled' | 'published';
  scheduledAt: string | null;
  // extraction quality
  extraction: Record<string, 'green' | 'yellow' | 'red'>;
  selected: boolean;
  // Extended fields for quality/SEO analysis
  headings: { level: number; text: string }[];
  tables: number;
  externalLinks: { url: string; anchorText: string }[];
  hasIntro: boolean;
  hasConclusion: boolean;
  disclaimer: string | null;
  keyHighlights: string[];
  excerpt: string;
}

// ── Hindi → English transliteration map ────────────────
const HINDI_MAP: Record<string, string> = {
  'रिजल्ट': 'result', 'सरकारी': 'sarkari', 'नौकरी': 'naukri',
  'परीक्षा': 'pariksha', 'तैयारी': 'taiyari', 'भर्ती': 'bharti',
  'कब': 'kab', 'आएगा': 'aayega', 'कैसे': 'kaise', 'करें': 'kare',
  'जानकारी': 'jaankari', 'पूरी': 'puri', 'गाइड': 'guide',
  'भत्ते': 'bhatte', 'महिला': 'mahila', 'योजना': 'yojana',
  'आवेदन': 'aavedan', 'फॉर्म': 'form', 'ऑनलाइन': 'online',
  'नोटिफिकेशन': 'notification', 'सिलेबस': 'syllabus',
  'एडमिट': 'admit', 'कार्ड': 'card', 'पैटर्न': 'pattern',
  'उत्तर': 'uttar', 'प्रदेश': 'pradesh', 'बिहार': 'bihar',
  'राजस्थान': 'rajasthan', 'मध्य': 'madhya', 'दिल्ली': 'delhi',
  'मुंबई': 'mumbai', 'के': 'ke', 'लिए': 'liye', 'में': 'me',
  'और': 'aur', 'से': 'se', 'है': 'hai', 'पर': 'par',
  'क्या': 'kya', 'यह': 'yah', 'बाद': 'baad', 'पहले': 'pahle',
  'साल': 'saal', 'नई': 'nai', 'पूर्ण': 'purna',
  'वेतन': 'vetan', 'पात्रता': 'patrata', 'उम्र': 'umr',
  'सीमा': 'seema', 'चयन': 'chayan', 'प्रक्रिया': 'prakriya',
};

// ── Category detection keywords ──────────────────────
const CATEGORY_KEYWORDS: [string[], string][] = [
  [['result', 'रिजल्ट', 'marksheet', 'admit card', 'एडमिट कार्ड'], 'Results & Admit Cards'],
  [['ssc', 'upsc', 'rrb', 'exam', 'परीक्षा', 'syllabus', 'taiyari', 'तैयारी', 'pariksha'], 'Exam Preparation'],
  [['sarkari naukri', 'govt job', 'भर्ती', 'vacancy', 'bharti', 'सरकारी नौकरी'], 'Sarkari Naukri Basics'],
  [['salary', 'allowance', 'भत्ते', 'hra', 'da', 'nps', 'pension', 'वेतन'], 'Career Guides & Tips'],
  [['army', 'police', 'railway', 'bank', 'teacher', 'patwari', 'रेलवे', 'पुलिस'], 'Job Information'],
];

// ── Main parse function ──────────────────────────────
export async function parseDocxFile(file: File, existingSlugs: string[] = []): Promise<ParsedArticle> {
  const arrayBuffer = await file.arrayBuffer();
  const id = crypto.randomUUID();

  // Convert with mammoth — upload embedded images to storage
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const uint8 = new Uint8Array(buffer as unknown as ArrayBuffer);
        const blob = new Blob([uint8], { type: image.contentType });
        const ext = image.contentType.split('/')[1] || 'png';
        const filePath = `articles/temp-${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error } = await supabase.storage
          .from('blog-assets')
          .upload(filePath, blob, { contentType: image.contentType });
        if (error) return { src: '' };
        const { data: urlData } = supabase.storage.from('blog-assets').getPublicUrl(filePath);
        return { src: urlData.publicUrl };
      }),
    }
  );

  const html = result.value;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract fields
  const title = extractTitle(doc, file.name);
  const metaTitle = extractMetaField(doc, 'meta title') || title.substring(0, 60);
  const metaDescription = extractMetaField(doc, 'meta description') || extractFirstText(doc, 155);
  const slug = generateSlug(title, existingSlugs);
  const canonicalUrl = `https://truejobs.co.in/blog/${slug}`;
  const wordCount = countWords(doc);
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const category = detectCategory(doc);
  const tags = extractTags(doc);
  const internalLinks = extractInternalLinks(doc);
  const { faqCount, faqSchema } = extractFAQs(doc);
  const hasFaqSchema = faqCount > 0;

  // Extended extraction
  const headings = extractHeadings(doc);
  const tables = doc.querySelectorAll('table').length;
  const externalLinks = extractExternalLinks(doc);
  const hasIntro = detectHasIntro(doc);
  const hasConclusion = detectHasConclusion(headings);
  const disclaimer = extractSection(doc, /disclaimer|अस्वीकरण/i);
  const keyHighlights = extractKeyHighlights(doc);
  const excerpt = extractFirstText(doc, 200);

  // Extraction quality
  const extraction: Record<string, 'green' | 'yellow' | 'red'> = {
    title: title ? 'green' : 'red',
    metaTitle: metaTitle.length > 0 && metaTitle.length <= 60 ? 'green' : metaTitle.length > 60 ? 'yellow' : 'red',
    metaDescription: metaDescription.length >= 100 && metaDescription.length <= 155 ? 'green' : metaDescription.length > 0 ? 'yellow' : 'red',
    slug: slug ? 'green' : 'red',
    category: category !== 'Uncategorized' ? 'green' : 'yellow',
    coverImage: 'red', // always red until uploaded
    faq: faqCount > 0 ? 'green' : 'yellow',
  };

  return {
    id,
    fileName: file.name,
    title,
    metaTitle,
    metaDescription,
    slug,
    canonicalUrl,
    category,
    tags,
    authorName: 'TrueJobs Team',
    language: 'hi',
    wordCount,
    readingTime,
    faqCount,
    hasFaqSchema,
    faqSchema: faqSchema.length > 0 ? faqSchema : null,
    internalLinks,
    content: html,
    coverImageUrl: '',
    coverImageAlt: title,
    articleImages: [],
    status: 'draft',
    scheduledAt: null,
    extraction,
    selected: false,
    headings,
    tables,
    externalLinks,
    hasIntro,
    hasConclusion,
    disclaimer,
    keyHighlights,
    excerpt,
  };
}

// ── Helper functions ─────────────────────────────────

function extractTitle(doc: Document, fileName: string): string {
  const h1 = doc.querySelector('h1');
  if (h1?.textContent?.trim()) return h1.textContent.trim();
  // Fallback: first strong or paragraph
  const strong = doc.querySelector('strong');
  if (strong?.textContent?.trim()) return strong.textContent.trim();
  return fileName.replace(/\.(docx?|pdf|txt)$/i, '').replace(/[-_]/g, ' ');
}

function extractMetaField(doc: Document, fieldName: string): string {
  const allText = doc.body.innerHTML;
  // Look for "Meta title:" or "Meta Description:" pattern
  const patterns = [
    new RegExp(`${fieldName}\\s*[:：]\\s*(.+?)(?:<|$)`, 'i'),
    new RegExp(`${fieldName}\\s*[:：]\\s*(.+?)(?:\\n|$)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/<[^>]+>/g, '').trim();
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function extractFirstText(doc: Document, maxLen: number): string {
  const paras = doc.querySelectorAll('p');
  let text = '';
  for (const p of paras) {
    const t = p.textContent?.trim();
    if (t && t.length > 20) {
      text = t;
      break;
    }
  }
  return text.substring(0, maxLen);
}

// Hindi stop words to filter from slugs (prevents garbled URLs)
const HINDI_STOP_WORDS = new Set([
  'me', 'se', 'ke', 'ka', 'ki', 'ko',
  'hai', 'hain', 'tha', 'thi', 'the',
  'aur', 'yah', 'yeh', 'woh',
  'nai', 'nayi', 'puri', 'poori',
  'kya', 'kaise', 'kab', 'kahan',
  'in', 'par', 'tak', 'bhi',
  'wale', 'wali', 'hoga', 'hogi',
  'karo', 'karna', 'karein',
  'liye', 'baad', 'pahle', 'sath',
]);

export function generateSlug(title: string, existingSlugs: string[] = []): string {
  let slug = title.toLowerCase().trim();

  // Transliterate Hindi characters
  for (const [hindi, english] of Object.entries(HINDI_MAP)) {
    slug = slug.split(hindi).join(english);
  }

  // Remove remaining non-ASCII, normalize separators
  slug = slug
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Filter out stop words and single-char segments
  const parts = slug.split('-').filter(part =>
    part.length > 1 && !HINDI_STOP_WORDS.has(part)
  );
  slug = parts.join('-');

  // Add year if not present
  if (!/20\d{2}/.test(slug)) slug += '-2026';

  // Cap at 65 chars, trim at word boundary
  if (slug.length > 65) {
    slug = slug.substring(0, 65).replace(/-[^-]*$/, '');
  }

  // Deduplicate against existing slugs in the batch
  if (existingSlugs.includes(slug)) {
    let counter = 2;
    while (existingSlugs.includes(`${slug}-${counter}`)) counter++;
    slug = `${slug}-${counter}`;
  }
  return slug;
}

function countWords(doc: Document): number {
  const text = doc.body.textContent || '';
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function detectCategory(doc: Document): string {
  const text = (doc.body.textContent || '').toLowerCase();
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) return category;
    }
  }
  return 'Uncategorized';
}

function extractTags(doc: Document): string[] {
  const text = (doc.body.textContent || '').toLowerCase();
  const tags: string[] = [];
  const examNames = ['ssc', 'upsc', 'rrb', 'cbse', 'ibps', 'nda', 'cds', 'ntpc', 'cgl', 'chsl', 'mts', 'jee', 'neet'];
  for (const exam of examNames) {
    if (text.includes(exam)) tags.push(exam.toUpperCase());
  }
  const yearMatch = text.match(/(202[4-9])/);
  if (yearMatch) tags.push(yearMatch[1]);
  const jobTypes = ['sarkari', 'govt', 'railway', 'bank', 'police', 'army', 'teacher'];
  for (const jt of jobTypes) {
    if (text.includes(jt) && !tags.includes(jt)) tags.push(jt.charAt(0).toUpperCase() + jt.slice(1));
  }
  return tags.slice(0, 8);
}

function extractInternalLinks(doc: Document): { path: string; anchorText: string }[] {
  const links: { path: string; anchorText: string }[] = [];
  const anchors = doc.querySelectorAll('a[href]');
  anchors.forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.includes('truejobs.co.in/') || href.startsWith('/')) {
      const path = href.replace(/https?:\/\/(?:www\.)?truejobs\.co\.in/, '');
      links.push({ path, anchorText: a.textContent?.trim() || path });
    }
  });
  return links;
}

function extractFAQs(doc: Document): { faqCount: number; faqSchema: { question: string; answer: string }[] } {
  const faqs: { question: string; answer: string }[] = [];
  const text = doc.body.textContent || '';
  
  // Pattern 1: Q: ... A: ...
  const qaPattern = /(?:Q|प्रश्न|सवाल)\s*[:\d.)\-]\s*(.+?)(?:\n|\r)(?:A|उत्तर|जवाब)\s*[:\-]\s*(.+?)(?=(?:Q|प्रश्न|सवाल)\s*[:\d.)\-]|$)/gis;
  let match;
  while ((match = qaPattern.exec(text)) !== null) {
    if (match[1]?.trim() && match[2]?.trim()) {
      faqs.push({ question: match[1].trim(), answer: match[2].trim() });
    }
  }

  // Pattern 2: Look for FAQ heading then list items
  if (faqs.length === 0) {
    const elements = Array.from(doc.body.children);
    let inFaq = false;
    let currentQ = '';
    for (const el of elements) {
      const tagName = el.tagName.toLowerCase();
      const elText = el.textContent?.trim() || '';
      if ((tagName === 'h2' || tagName === 'h3') && /faq|frequently|सवाल|प्रश्न/i.test(elText)) {
        inFaq = true;
        continue;
      }
      if (inFaq) {
        if ((tagName === 'h2' || tagName === 'h3') && !/faq/i.test(elText)) break;
        if (elText.endsWith('?') || elText.endsWith('？')) {
          if (currentQ && faqs.length > 0) {
            // previous Q had no answer
          }
          currentQ = elText;
        } else if (currentQ && elText.length > 10) {
          faqs.push({ question: currentQ, answer: elText });
          currentQ = '';
        }
      }
    }
  }

  return { faqCount: faqs.length, faqSchema: faqs };
}

// ── Readiness check ──────────────────────────────────
export function getArticleReadiness(article: ParsedArticle): 'green' | 'yellow' | 'red' {
  if (!article.title || !article.slug || !article.content) return 'red';
  if (!article.coverImageUrl) return 'red';
  if (!article.metaTitle || !article.metaDescription) return 'yellow';
  if (article.category === 'Uncategorized') return 'yellow';
  return 'green';
}

// ── Extended extraction helpers ──────────────────────

function extractHeadings(doc: Document): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  doc.querySelectorAll('h1, h2, h3, h4').forEach(el => {
    const level = parseInt(el.tagName.substring(1));
    const text = el.textContent?.trim() || '';
    if (text) headings.push({ level, text });
  });
  return headings;
}

function extractExternalLinks(doc: Document): { url: string; anchorText: string }[] {
  const links: { url: string; anchorText: string }[] = [];
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http') && !href.includes('truejobs.co.in')) {
      links.push({ url: href, anchorText: a.textContent?.trim() || href });
    }
  });
  return links;
}

function detectHasIntro(doc: Document): boolean {
  const children = Array.from(doc.body.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return false;
    if (tag === 'p' && (child.textContent?.trim().length || 0) > 20) return true;
  }
  return false;
}

function detectHasConclusion(headings: { level: number; text: string }[]): boolean {
  if (headings.length === 0) return false;
  const last = headings[headings.length - 1].text.toLowerCase();
  return /conclusion|summary|निष्कर्ष|सारांश|final|wrap/i.test(last);
}

function extractSection(doc: Document, pattern: RegExp): string | null {
  const elements = Array.from(doc.body.children);
  let found = false;
  const parts: string[] = [];
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim() || '';
    if ((tag === 'h2' || tag === 'h3') && pattern.test(text)) {
      found = true;
      continue;
    }
    if (found) {
      if (tag === 'h2' || tag === 'h3') break;
      if (text) parts.push(text);
    }
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

function extractKeyHighlights(doc: Document): string[] {
  const elements = Array.from(doc.body.children);
  let inSection = false;
  const highlights: string[] = [];
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim() || '';
    if ((tag === 'h2' || tag === 'h3') && /key highlight|key point|मुख्य बिंदु/i.test(text)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (tag === 'h2' || tag === 'h3') break;
      if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll('li').forEach(li => {
          const t = li.textContent?.trim();
          if (t) highlights.push(t);
        });
      }
    }
  }
  return highlights;
}
