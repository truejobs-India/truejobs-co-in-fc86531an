/**
 * ════════════════════════════════════════════════════════════════
 * FLUX.2-pro Dedicated Prompt Policy — TrueJobs Article Images
 * ════════════════════════════════════════════════════════════════
 *
 * This module exists ONLY for FLUX.2-pro.
 * It is NOT used by any other image model (FLUX.1-Kontext, Gemini,
 * Imagen, MAI-Image-2, Nova Canvas, Stable Image, gpt-image, etc.).
 *
 * WHY a separate policy?
 *   FLUX.2-pro tends to render text (Hindi, English, typography,
 *   watermarks, labels) into images when given generic prompts.
 *   It also adds unwanted facial adornments (bindi, tilak, nose pins).
 *   This policy enforces strict anti-text and anti-adornment rules
 *   and constructs scene-specific prompts optimized for TrueJobs
 *   articles about government jobs, exams, admit cards, results,
 *   colleges, and student guidance in an Indian context.
 *
 * DO NOT modify other model prompt builders. They remain untouched.
 * ════════════════════════════════════════════════════════════════
 */

// ─── Anti-text enforcement block ────────────────────────────────
const ANTI_TEXT_BLOCK = [
  'Absolutely no text anywhere in the image.',
  'No words, no letters, no numbers, no Hindi text, no English text.',
  'No typography, no captions, no labels, no watermarks, no logos.',
  'No signage, no poster text, no newspaper text, no book-cover text.',
  'No UI text, no handwritten text, no printed text, no exam-paper text.',
  'No banner text, no badge text, no stamp text.',
  'No visible alphanumeric characters of any kind.',
  'No title cards, no infographic elements, no meme-style compositions.',
  'No ad-creative style, no thumbnail-with-text style.',
  'No document-like visuals containing readable text.',
  'No text on clothing, no text on signs, no text on screens.',
  'All books, papers, and screens must show blank or blurred pages — never legible text.',
].join(' ');

// ─── Anti-adornment enforcement block ───────────────────────────
// Suppresses unwanted facial adornments that FLUX.2-pro tends to add
const ANTI_ADORNMENT_BLOCK = [
  'No bindi. No tilak. No teeka. No sindoor. No forehead marks of any kind.',
  'No nose pin. No nose stud. No nose ring.',
  'No visible facial adornment unless the article explicitly requires it.',
  'No culturally stylized forehead decoration. No devotional-poster styling.',
  'No ethnic bridal styling. No festive or ceremonial appearance.',
  'No ornate facial accessories. Clean, unadorned faces only.',
  'No heavy jewellery. No mangalsutra. No maang tikka. No jhumka earrings.',
  'No mehndi or henna on hands. No bangles stacking.',
  'Faces must be completely clean and undecorated — bare forehead, bare nose, minimal or no earrings.',
].join(' ');

// ─── Aesthetic enforcement block ────────────────────────────────
const AESTHETIC_BLOCK = [
  'Photorealistic photograph, shot on a professional DSLR camera.',
  'Realistic Indian context with natural lighting.',
  'If people are shown: fair young Indian women and men, ordinary exam aspirants or college-going students aged 18–21.',
  'Clean natural face with no facial adornments — no bindi, no tilak, no teeka, no sindoor, no forehead marks, no nose pin, no nose stud, no nose ring.',
  'Simple grooming, not glamorized, not ceremonial, not festive, not bridal, not devotional-poster style.',
  'Simple natural clothing appropriate for students — casual kurta, shirt, salwar-kameez, or jeans.',
  'No fashion models, no corporate professionals, no office workers unless the topic explicitly requires it.',
  'No heavy jewellery, no glamorous styling, no unnecessary makeup-heavy beauty look.',
  'No exaggerated makeup, no ornate facial accessories.',
  'No fantasy, surreal, horror, abstract, or cinematic drift.',
  'Natural skin textures, realistic expressions, no airbrushed perfection.',
  'Clean natural backgrounds — libraries, classrooms, corridors, parks, study desks.',
  'Documentary-style authenticity. No stock-photo posing.',
].join(' ');

// ─── Negative prompt block ──────────────────────────────────────
const NEGATIVE_BLOCK = [
  'Strictly avoid:',
  'text overlay, written content, letters, numbers, watermark, title card,',
  'label, logo, poster, newspaper page, magazine page, document with readable text,',
  'meme composition, infographic, ad creative, thumbnail with text,',
  'fantasy elements, surreal lighting, horror atmosphere, abstract shapes,',
  'heavy makeup, glamorous styling, fashion model appearance,',
  'bindi, tilak, teeka, sindoor, forehead marks, nose pin, nose stud, nose ring,',
  'facial adornments, bridal styling, ceremonial appearance, festive styling,',
  'devotional-poster style, ornate facial accessories, maang tikka, mangalsutra,',
  'corporate office setting, boardroom, suit and tie (unless topic requires),',
  'generic decorative objects, random symbolic items,',
  'malformed anatomy, fused fingers, broken wrists, extra limbs.',
].join(' ');

// ─── Scene mapping ──────────────────────────────────────────────
interface SceneMapping {
  keywords: string[];
  scene: string;
}

const SCENE_MAPPINGS: SceneMapping[] = [
  {
    keywords: ['upsc', 'ias', 'ips', 'civil services', 'upsc preparation'],
    scene: 'A focused fair young Indian student aged 18–21 with a clean unadorned face sitting at a wooden study desk in a quiet room, surrounded by stacked books and handwritten notes, reading intently with a desk lamp casting warm light',
  },
  {
    keywords: ['ssc', 'ssc cgl', 'ssc chsl', 'ssc mts', 'staff selection'],
    scene: 'A group of fair young Indian aspirants aged 18–21 with clean unadorned faces sitting in a coaching center classroom, writing practice papers at their desks with notebooks and pens, natural daylight from windows',
  },
  {
    keywords: ['admit card', 'hall ticket', 'exam hall ticket'],
    scene: 'A fair young Indian student aged 18–21 with a clean unadorned face standing at the entrance of an exam center building, holding a folder confidently, with other students walking in the background on a clear morning',
  },
  {
    keywords: ['railway', 'rrb', 'railway recruitment', 'indian railways'],
    scene: 'Fair young Indian candidates aged 18–21 with clean unadorned faces walking near a railway station platform with preparation materials in hand, a train visible in the soft background, morning sunlight',
  },
  {
    keywords: ['result', 'exam result', 'merit list', 'scorecard', 'marksheet'],
    scene: 'A happy fair young Indian student aged 18–21 with a clean unadorned face looking at a laptop screen with a relieved smile, sitting in a home study area with books nearby, natural window light',
  },
  {
    keywords: ['answer key', 'solution key', 'answer sheet'],
    scene: 'A studious fair young Indian student aged 18–21 with a clean unadorned face comparing notes at a library table, with open notebooks and a pen in hand, bookshelves visible in the soft background',
  },
  {
    keywords: ['college', 'admission', 'university', 'enrollment', 'counselling'],
    scene: 'Fair young Indian students aged 18–21 with clean unadorned faces walking through a college campus with trees and a building facade, carrying backpacks, bright daylight and casual conversation',
  },
  {
    keywords: ['scholarship', 'fellowship', 'financial aid'],
    scene: 'A hopeful fair young Indian student aged 18–21 with a clean unadorned face sitting in a campus garden reading a book, with a backpack beside them, dappled sunlight through trees',
  },
  {
    keywords: ['bank', 'ibps', 'sbi', 'rbi', 'banking exam'],
    scene: 'Fair young Indian aspirants aged 18–21 with clean unadorned faces studying together at a library table with financial textbooks and notebooks, focused expressions, warm indoor lighting',
  },
  {
    keywords: ['teaching', 'tet', 'ctet', 'teacher recruitment'],
    scene: 'A fair young Indian teacher-aspirant aged 18–21 with a clean unadorned face standing near a classroom whiteboard with books in hand, empty desks visible, soft morning light from windows',
  },
  {
    keywords: ['defence', 'army', 'navy', 'air force', 'nda', 'cds', 'military'],
    scene: 'Fair young Indian aspirants aged 18–21 with clean unadorned faces jogging on a sports ground in athletic wear, early morning mist, a running track and open field in the background',
  },
  {
    keywords: ['police', 'constable', 'si recruitment', 'police recruitment'],
    scene: 'Fair young Indian candidates aged 18–21 with clean unadorned faces doing physical exercises on a ground, simple athletic clothing, morning light, an open field with a few trees',
  },
  {
    keywords: ['state psc', 'bpsc', 'uppsc', 'mppsc', 'rpsc', 'public service commission'],
    scene: 'A determined fair young Indian student aged 18–21 with a clean unadorned face studying at a simple desk in a modest room, a table lamp illuminating open books and notes, a wall clock in the background',
  },
  {
    keywords: ['form', 'application', 'apply online', 'registration', 'application mistake'],
    scene: 'A fair young Indian student aged 18–21 with a clean unadorned face sitting at a desk using a laptop carefully, one hand on the keyboard and the other holding a pen, a notebook open beside the laptop',
  },
  {
    keywords: ['syllabus', 'exam pattern', 'preparation tips', 'study plan'],
    scene: 'A fair young Indian student aged 18–21 with a clean unadorned face organizing study notes and books on a clean desk, highlighters and sticky notes visible, a calm study environment with soft natural light',
  },
  {
    keywords: ['notification', 'vacancy', 'recruitment', 'government job', 'sarkari'],
    scene: 'A fair young Indian job aspirant aged 18–21 with a clean unadorned face reading a notice board at a government office building, other aspirants standing nearby, afternoon daylight on the building facade',
  },
];

const FALLBACK_SCENE =
  'A fair young Indian student aged 18–21 with a clean unadorned face studying at a clean wooden desk with open books and notes, in a bright naturally-lit room with bookshelves in the soft background, focused and determined expression';

// ─── Helpers ────────────────────────────────────────────────────

function extractArticleContext(body: any): {
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
  topic: string;
  allText: string;
} {
  const title = (body.title || body.topic || '').toLowerCase().trim();
  const category = (body.category || '').toLowerCase().trim();
  const tags = Array.isArray(body.tags) ? body.tags.map((t: string) => t.toLowerCase()) : [];
  const excerpt = (body.excerpt || body.summary || '').toLowerCase().trim();
  const topic = (body.topic || '').toLowerCase().trim();
  const allText = [title, category, topic, excerpt, ...tags].join(' ');
  return { title, category, tags, excerpt, topic, allText };
}

function findBestScene(allText: string): string {
  let bestScene = FALLBACK_SCENE;
  let bestScore = 0;
  for (const mapping of SCENE_MAPPINGS) {
    let score = 0;
    for (const kw of mapping.keywords) {
      if (allText.includes(kw)) {
        score += kw.split(' ').length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestScene = mapping.scene;
    }
  }
  return bestScene;
}

// ─── Public API ─────────────────────────────────────────────────

export function buildFlux2CoverPrompt(body: any): string {
  const ctx = extractArticleContext(body);
  const scene = findBestScene(ctx.allText);
  const parts = [
    scene + '.',
    AESTHETIC_BLOCK,
    ANTI_TEXT_BLOCK,
    ANTI_ADORNMENT_BLOCK,
    NEGATIVE_BLOCK,
  ];
  const prompt = parts.join('\n\n');
  console.log(`[flux2-policy] Cover prompt built for: "${ctx.title.substring(0, 60)}..." scene-match: ${scene === FALLBACK_SCENE ? 'fallback' : 'matched'}`);
  return prompt;
}

export function buildFlux2InlinePrompt(body: any): string {
  const ctx = extractArticleContext(body);
  const sectionHint = (body.sectionContext || body.prompt || '').toLowerCase().trim();
  const combinedText = sectionHint ? `${sectionHint} ${ctx.allText}` : ctx.allText;
  const scene = findBestScene(combinedText);
  const parts = [
    scene + '.',
    'Close-up or medium shot suitable for an inline article image.',
    AESTHETIC_BLOCK,
    ANTI_TEXT_BLOCK,
    ANTI_ADORNMENT_BLOCK,
    NEGATIVE_BLOCK,
  ];
  const prompt = parts.join('\n\n');
  console.log(`[flux2-policy] Inline prompt built for: "${ctx.title.substring(0, 60)}..." section: "${sectionHint.substring(0, 40)}..."`);
  return prompt;
}
