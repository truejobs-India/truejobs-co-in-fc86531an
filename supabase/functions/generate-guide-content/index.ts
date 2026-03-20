import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Admin-only auth check
async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized — invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const userId = data.claims.sub as string;
  // Check admin role
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return { userId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH — Guide metadata, prompts, tags, internal links
// ═══════════════════════════════════════════════════════════════════════════════

interface GuideConfig {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  tags: string[];
  internalLinks: { anchor: string; href: string }[];
  prompt: string;
}

const GUIDES: GuideConfig[] = [
  {
    slug: 'ssc-cgl-preparation-guide',
    title: 'How to Prepare for SSC CGL in 6 Months — Complete Strategy Guide',
    metaTitle: 'SSC CGL Preparation in 6 Months – Strategy 2026',
    metaDescription: 'Complete 6-month SSC CGL preparation strategy for 2026. Subject-wise plan, booklist, mock test schedule, and expert tips for Tier 1 & Tier 2.',
    category: 'Career Advice',
    tags: ['SSC CGL', 'Exam Preparation', 'Government Jobs', 'SSC', 'Study Plan'],
    internalLinks: [
      { anchor: 'SSC CGL 2026 notification details', href: '/ssc-cgl-2026-notification' },
      { anchor: 'SSC CGL exam pattern', href: '/ssc-cgl-2026-exam-pattern' },
      { anchor: 'SSC CGL syllabus', href: '/ssc-cgl-2026-syllabus' },
      { anchor: 'SSC CGL salary details', href: '/ssc-cgl-2026-salary' },
      { anchor: 'SSC CGL previous year papers', href: '/ssc-cgl-previous-year-paper' },
      { anchor: 'check your eligibility', href: '/ssc-cgl-2026-eligibility' },
    ],
    prompt: `Write a comprehensive 2,200+ word guide titled "How to Prepare for SSC CGL in 6 Months — Complete Strategy Guide" for Indian government job aspirants in 2026.

Structure:
- Introduction (why SSC CGL is worth preparing for, brief overview of the exam)
- Month-wise preparation plan (Month 1-2: Foundation, Month 3-4: Practice, Month 5-6: Revision & Mocks)
- Subject-wise strategy for Quantitative Aptitude, English Language, General Intelligence, General Awareness
- Best books and resources for each subject
- Mock test strategy and how to analyze mocks
- Common mistakes to avoid
- Tips from toppers
- FAQ section with 5-7 Q&As about SSC CGL preparation

Use H2 for main sections, H3 for subsections. Write in practical, actionable tone. Include specific book names, apps, and strategies used by successful candidates. Reference cut-off trends.`,
  },
  {
    slug: 'govt-jobs-after-12th-guide',
    title: 'Government Jobs After 12th Pass — Complete Roadmap 2026',
    metaTitle: 'Govt Jobs After 12th Pass – Complete Guide 2026',
    metaDescription: 'Explore top government jobs after 12th pass in 2026. SSC CHSL, Railway Group D, defence, police, and more with eligibility, salary, and how to apply.',
    category: 'Career Advice',
    tags: ['12th Pass', 'Government Jobs', 'Career Guide', 'SSC CHSL', 'Railway'],
    internalLinks: [
      { anchor: '12th pass government jobs', href: '/12th-pass-govt-jobs' },
      { anchor: 'SSC CHSL notification', href: '/ssc-chsl-2026-notification' },
      { anchor: 'Railway Group D vacancy', href: '/railway-group-d-2026-notification' },
      { anchor: 'SSC MTS recruitment', href: '/ssc-mts-2026-notification' },
      { anchor: 'government salary calculator', href: '/govt-salary-calculator' },
      { anchor: 'age eligibility calculator', href: '/govt-job-age-calculator' },
    ],
    prompt: `Write a 2,200+ word guide titled "Government Jobs After 12th Pass — Complete Roadmap 2026" for Indian students who have completed 12th class.

Structure:
- Introduction (why govt jobs are attractive after 12th, number of opportunities available)
- Top 10 government jobs for 12th pass candidates (SSC CHSL, SSC MTS, Railway Group D, SSC GD Constable, Indian Army, Navy, Air Force, State Police, India Post GDS, CISF/CRPF)
- For each job: brief description, eligibility, salary range, selection process
- Stream-wise opportunities (Science, Commerce, Arts)
- How to start preparing right after 12th
- Important exams calendar for 12th pass candidates
- FAQ section with 5-7 Q&As

Write in encouraging, practical tone. Include salary ranges in INR. Reference official conducting bodies.`,
  },
  {
    slug: 'upsc-vs-ssc-guide',
    title: 'UPSC vs SSC — Which is Right for You? A Complete Comparison',
    metaTitle: 'UPSC vs SSC – Which Exam is Right for You?',
    metaDescription: 'UPSC vs SSC detailed comparison for 2026. Difficulty, salary, preparation time, career growth, and which government exam suits your profile best.',
    category: 'Career Advice',
    tags: ['UPSC', 'SSC', 'Comparison', 'Government Jobs', 'Career Planning'],
    internalLinks: [
      { anchor: 'UPSC CSE notification', href: '/upsc-cse-2026-notification' },
      { anchor: 'SSC CGL notification', href: '/ssc-cgl-2026-notification' },
      { anchor: 'UPSC eligibility criteria', href: '/upsc-cse-2026-eligibility' },
      { anchor: 'SSC CGL salary structure', href: '/ssc-cgl-2026-salary' },
      { anchor: 'UPSC CSE salary details', href: '/upsc-cse-2026-salary' },
    ],
    prompt: `Write a 2,200+ word comparison guide titled "UPSC vs SSC — Which is Right for You?" for Indian government job aspirants.

Structure:
- Introduction (why this comparison matters)
- Quick comparison table (eligibility, attempts, difficulty, preparation time, salary, job profile, career growth)
- Detailed comparison sections: Eligibility, Exam Pattern, Difficulty Level, Preparation Time, Salary & Perks, Career Growth, Job Satisfaction, Work-Life Balance
- Who should choose UPSC? (personality traits, background, goals)
- Who should choose SSC? (personality traits, background, goals)
- Can you prepare for both simultaneously?
- Switching strategies (SSC to UPSC or vice versa)
- FAQ section with 5-7 Q&As

Include real salary figures in INR. Be balanced and objective. Help readers self-assess.`,
  },
  {
    slug: 'railway-jobs-guide',
    title: 'Railway Jobs in India — Complete Career Guide 2026',
    metaTitle: 'Railway Jobs India – Complete Career Guide 2026',
    metaDescription: 'Complete guide to Railway jobs in India 2026. RRB NTPC, Group D, ALP, JE vacancies with eligibility, salary, preparation tips, and application process.',
    category: 'Career Advice',
    tags: ['Railway Jobs', 'RRB', 'Indian Railways', 'Government Jobs', 'Career Guide'],
    internalLinks: [
      { anchor: 'RRB NTPC 2026 notification', href: '/rrb-ntpc-2026-notification' },
      { anchor: 'Railway Group D recruitment', href: '/railway-group-d-2026-notification' },
      { anchor: 'RRB ALP vacancy details', href: '/rrb-alp-2026-notification' },
      { anchor: 'RRB JE recruitment', href: '/rrb-je-2026-notification' },
      { anchor: 'Railway salary calculator', href: '/govt-salary-calculator' },
      { anchor: 'railway jobs listings', href: '/railway-jobs' },
    ],
    prompt: `Write a 2,200+ word career guide titled "Railway Jobs in India — Complete Career Guide 2026" for aspiring Indian Railway employees.

Structure:
- Introduction (Indian Railways as an employer, scale of recruitment)
- Types of Railway jobs (Group A, B, C, D) with examples
- Major Railway recruitment exams (RRB NTPC, Group D, ALP, JE, RPF)
- For each exam type: posts covered, eligibility, salary, selection process
- Railway zones and their recruitment patterns
- Perks and benefits of Railway jobs (quarters, medical, passes, pension)
- How to apply for Railway jobs (step-by-step)
- Preparation strategy for Railway exams
- FAQ section with 5-7 Q&As

Include specific salary figures. Mention all 18 railway zones. Reference RRB official websites.`,
  },
  {
    slug: 'govt-salary-calculation-guide',
    title: 'How to Calculate In-Hand Salary for Government Jobs — Complete Guide',
    metaTitle: 'Govt In-Hand Salary Calculation – Complete Guide',
    metaDescription: 'Learn how to calculate in-hand salary for government jobs using the 7th CPC pay matrix. DA, HRA, TA, NPS deductions explained with examples.',
    category: 'Career Advice',
    tags: ['Government Salary', '7th CPC', 'Pay Matrix', 'In-Hand Salary', 'DA HRA'],
    internalLinks: [
      { anchor: 'government salary calculator tool', href: '/govt-salary-calculator' },
      { anchor: 'SSC CGL salary breakdown', href: '/ssc-cgl-2026-salary' },
      { anchor: 'IBPS PO salary details', href: '/ibps-po-2026-salary' },
      { anchor: 'Railway salary structure', href: '/rrb-ntpc-2026-salary' },
      { anchor: 'UPSC salary and perks', href: '/upsc-cse-2026-salary' },
    ],
    prompt: `Write a 2,200+ word guide titled "How to Calculate In-Hand Salary for Government Jobs — Complete Guide" for Indian government job aspirants.

Structure:
- Introduction (why understanding salary structure matters before choosing an exam)
- 7th CPC Pay Matrix explained (18 pay levels, how to read the matrix)
- Components of government salary: Basic Pay, Dearness Allowance (current DA rate 53%), HRA (X/Y/Z city categories), Transport Allowance, Other allowances
- Deductions: NPS (10% employee + 14% employer), Income Tax, Professional Tax, CGHS
- Step-by-step calculation with a real example (e.g., Pay Level 4 in Delhi)
- Comparison table: gross vs in-hand for different pay levels
- Special allowances for specific departments (defence, police, railways)
- Annual increments and promotion pay fixation
- FAQ section with 6 Q&As

Use actual INR figures. Include the current DA rate. Reference the 7th CPC notification.`,
  },
  {
    slug: 'govt-jobs-by-stream-guide',
    title: 'Best Government Jobs for Graduates by Stream — Complete Guide 2026',
    metaTitle: 'Best Govt Jobs by Stream – Graduate Guide 2026',
    metaDescription: 'Find the best government jobs for graduates in 2026 by stream — Science, Commerce, Arts, Engineering, MBA. Eligibility, exams, salary, and career paths.',
    category: 'Career Advice',
    tags: ['Graduate Jobs', 'Government Jobs', 'Career Guide', 'Stream-wise', 'BSc BCom BA'],
    internalLinks: [
      { anchor: 'graduate government jobs', href: '/graduate-govt-jobs' },
      { anchor: 'SSC CGL for graduates', href: '/ssc-cgl-2026-notification' },
      { anchor: 'IBPS PO banking career', href: '/ibps-po-2026-notification' },
      { anchor: 'UPSC Civil Services', href: '/upsc-cse-2026-notification' },
      { anchor: 'engineering government jobs', href: '/engineering-govt-jobs' },
    ],
    prompt: `Write a 2,200+ word guide titled "Best Government Jobs for Graduates by Stream — Complete Guide 2026" for Indian graduates.

Structure:
- Introduction (government jobs landscape for graduates in 2026)
- Arts/Humanities stream: top 8 govt jobs (IAS, SSC CGL, State PCS, Teaching, etc.)
- Commerce stream: top 8 govt jobs (Banking PO/Clerk, SSC CGL, RBI, Insurance, etc.)
- Science stream: top 8 govt jobs (ISRO, DRDO, Forest Officer, Scientific Officer, etc.)
- Engineering stream: top 8 govt jobs (ESE, SSC JE, Railway JE, PSU, etc.)
- MBA graduates: top 5 govt opportunities
- Common exams open to all streams
- How to choose the right exam for your profile
- FAQ section with 5-7 Q&As

Include salary ranges. Be specific about which degree qualifies for which exam.`,
  },
  {
    slug: 'nda-preparation-guide',
    title: 'NDA Preparation Strategy for Beginners — Complete Guide 2026',
    metaTitle: 'NDA Preparation for Beginners – Strategy 2026',
    metaDescription: 'Complete NDA preparation guide for beginners 2026. Exam pattern, subject-wise strategy, physical fitness tips, SSB interview prep, and study plan.',
    category: 'Career Advice',
    tags: ['NDA', 'Defence', 'Military', 'Exam Preparation', 'SSB Interview'],
    internalLinks: [
      { anchor: 'NDA 2026 notification', href: '/nda-2026-notification' },
      { anchor: 'NDA exam pattern', href: '/nda-2026-exam-pattern' },
      { anchor: 'NDA syllabus', href: '/nda-2026-syllabus' },
      { anchor: 'NDA eligibility criteria', href: '/nda-2026-eligibility' },
      { anchor: 'NDA salary and perks', href: '/nda-2026-salary' },
      { anchor: 'Agniveer recruitment', href: '/agniveer-2026-notification' },
    ],
    prompt: `Write a 2,200+ word guide titled "NDA Preparation Strategy for Beginners — Complete Guide 2026" for students aspiring to join the Indian Armed Forces.

Structure:
- Introduction (what NDA is, why it's prestigious, career after NDA)
- NDA exam overview (conducted by UPSC, twice a year, eligibility)
- Exam pattern: Mathematics (300 marks) + General Ability Test (600 marks)
- Subject-wise preparation strategy with recommended books
- 6-month study plan for NDA
- Physical fitness preparation (running, push-ups, sit-ups standards)
- SSB interview preparation (5-day process, OIR, PPDT, TAT, WAT, SRT, GD, PI)
- Common mistakes and how to avoid them
- Life at NDA Khadakwasla
- FAQ section with 5-7 Q&As

Write with enthusiasm. Include physical fitness standards. Reference UPSC official guidelines.`,
  },
  {
    slug: 'sbi-po-vs-ibps-po-guide',
    title: 'SBI PO vs IBPS PO — Which Should You Choose? Complete Comparison',
    metaTitle: 'SBI PO vs IBPS PO – Which to Choose in 2026?',
    metaDescription: 'SBI PO vs IBPS PO detailed comparison 2026. Salary, career growth, exam difficulty, preparation strategy, and which banking exam is better for you.',
    category: 'Career Advice',
    tags: ['SBI PO', 'IBPS PO', 'Banking', 'Comparison', 'Government Jobs'],
    internalLinks: [
      { anchor: 'SBI PO 2026 notification', href: '/sbi-po-2026-notification' },
      { anchor: 'IBPS PO 2026 notification', href: '/ibps-po-2026-notification' },
      { anchor: 'SBI PO salary structure', href: '/sbi-po-2026-salary' },
      { anchor: 'IBPS PO salary details', href: '/ibps-po-2026-salary' },
      { anchor: 'banking jobs', href: '/banking-jobs' },
    ],
    prompt: `Write a 2,200+ word comparison guide titled "SBI PO vs IBPS PO — Which Should You Choose?" for banking aspirants in India.

Structure:
- Introduction (banking career in India, PO role overview)
- Quick comparison table (conducting body, frequency, vacancies, salary, exam pattern)
- Detailed comparison: Eligibility, Exam Pattern (Prelims + Mains + Interview), Difficulty Level, Cut-offs, Salary & Perks, Career Growth, Posting & Transfer Policy, Work Culture
- SBI PO advantages and disadvantages
- IBPS PO advantages and disadvantages
- Can you prepare for both simultaneously? (common syllabus overlap)
- Which should you attempt first?
- Preparation strategy for combined banking preparation
- FAQ section with 5-7 Q&As

Include actual salary figures. Compare in-hand salaries. Reference recent cut-off data.`,
  },
  {
    slug: 'govt-jobs-bihar-guide',
    title: 'Government Jobs in Bihar — Complete Guide 2026',
    metaTitle: 'Govt Jobs in Bihar 2026 – Complete Guide',
    metaDescription: 'Complete guide to government jobs in Bihar 2026. BPSC, BSSC, Bihar Police, Railway, Banking, and central govt opportunities with eligibility and salary.',
    category: 'Career Advice',
    tags: ['Bihar', 'Government Jobs', 'BPSC', 'State Jobs', 'Career Guide'],
    internalLinks: [
      { anchor: 'Bihar government job listings', href: '/govt-jobs-bihar' },
      { anchor: 'SSC CGL exam details', href: '/ssc-cgl-2026-notification' },
      { anchor: 'Railway recruitment', href: '/railway-jobs' },
      { anchor: 'banking jobs in Bihar', href: '/banking-jobs' },
      { anchor: 'age eligibility calculator', href: '/govt-job-age-calculator' },
    ],
    prompt: `Write a 2,200+ word guide titled "Government Jobs in Bihar — Complete Guide 2026" for job seekers in Bihar.

Structure:
- Introduction (employment landscape in Bihar, why govt jobs are preferred)
- State-level opportunities: BPSC (Bihar Public Service Commission), BSSC (Bihar Staff Selection Commission), Bihar Police, Bihar Education Department, Bihar Health Department
- Central government opportunities available in Bihar: SSC, Railway (ECR zone), Banking (SBI/IBPS branches), Defence, Postal
- Top 15 government jobs in Bihar with salary ranges
- How to prepare for BPSC (Bihar's most prestigious state exam)
- Important recruitment websites and notification sources
- District-wise government office locations
- Tips for Hindi-medium aspirants
- FAQ section with 5-7 Q&As

Reference BPSC and BSSC official websites. Include salary in INR. Mention local coaching centres.`,
  },
  {
    slug: 'agniveer-complete-guide',
    title: 'Agniveer Recruitment — Complete Guide 2026',
    metaTitle: 'Agniveer Recruitment 2026 – Complete Guide',
    metaDescription: 'Complete Agniveer recruitment guide 2026. Army, Navy, Air Force eligibility, physical standards, salary, Seva Nidhi package, and preparation strategy.',
    category: 'Career Advice',
    tags: ['Agniveer', 'Defence', 'Indian Army', 'Navy', 'Air Force', 'Military'],
    internalLinks: [
      { anchor: 'Agniveer 2026 notification', href: '/agniveer-2026-notification' },
      { anchor: 'Agniveer eligibility criteria', href: '/agniveer-2026-eligibility' },
      { anchor: 'Agniveer exam pattern', href: '/agniveer-2026-exam-pattern' },
      { anchor: 'Agniveer salary and Seva Nidhi', href: '/agniveer-2026-salary' },
      { anchor: 'NDA alternative career path', href: '/nda-2026-notification' },
      { anchor: 'defence jobs', href: '/defence-jobs' },
    ],
    prompt: `Write a 2,200+ word guide titled "Agniveer Recruitment — Complete Guide 2026" for young Indians aspiring to serve in the Armed Forces.

Structure:
- Introduction (what is Agnipath scheme, why it was introduced, current status)
- Agniveer for Army, Navy, and Air Force (differences in recruitment)
- Eligibility criteria: age, education, physical standards, medical standards
- Selection process: online exam, physical fitness test, medical examination
- Physical fitness standards (1.6km run, pull-ups, beam balance, etc.)
- Salary and benefits during 4-year service (monthly stipend + risk allowance)
- Seva Nidhi package (₹11.71 lakhs after 4 years)
- Career after Agniveer: 25% permanent absorption, other opportunities
- Preparation strategy for Agniveer written exam
- FAQ section with 6-7 Q&As

Include exact salary figures. Reference Indian Army, Navy, and Air Force official recruitment portals.`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_ROUTE_PREFIXES = [
  '/ssc-', '/rrb-', '/railway-', '/ibps-', '/sbi-', '/upsc-', '/nda-', '/agniveer-',
  '/govt-salary-calculator', '/govt-job-age-calculator', '/govt-exam-',
  '/sarkari-', '/latest-govt-jobs', '/banking-jobs', '/railway-jobs', '/defence-jobs',
  '/10th-pass-', '/12th-pass-', '/graduate-', '/engineering-', '/post-graduate-',
  '/govt-jobs-', '/blog/', '/tools',
];

function validateMetaTitle(title: string): string {
  if (title.length <= 60) return title;
  const truncated = title.substring(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

function validateMetaDescription(desc: string): string {
  if (desc.length >= 140 && desc.length <= 155) return desc;
  if (desc.length < 140) {
    const padded = desc.endsWith('.') ? desc.slice(0, -1) + ' | TrueJobs.' : desc + ' | TrueJobs';
    return padded.length <= 155 ? padded : desc;
  }
  // Over 155
  const truncated = desc.substring(0, 152);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 100 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

interface ParsedFAQ { question: string; answer: string }

function validateFAQs(faqs: ParsedFAQ[]): ParsedFAQ[] {
  if (faqs.length >= 5 && faqs.length <= 7) return faqs;
  if (faqs.length > 7) return faqs.slice(0, 7);
  // Fewer than 5 — return what we have (logged as warning)
  return faqs;
}

function validateInternalLinks(links: { anchor: string; href: string }[]): { valid: { anchor: string; href: string }[]; warnings: string[] } {
  const warnings: string[] = [];
  const valid: { anchor: string; href: string }[] = [];
  for (const link of links) {
    if (!link.href.startsWith('/')) {
      warnings.push(`Rejected absolute URL: ${link.href}`);
      continue;
    }
    const recognized = VALID_ROUTE_PREFIXES.some(p => link.href.startsWith(p));
    if (!recognized) {
      warnings.push(`Unrecognized route: ${link.href} — included anyway`);
    }
    valid.push(link);
  }
  return { valid, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERTEX AI GEMINI
// ═══════════════════════════════════════════════════════════════════════════════

async function callGeminiVertex(prompt: string): Promise<string> {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-2.5-flash', prompt, 90_000, {
    maxOutputTokens: 8192,
    temperature: 0.7,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function extractFAQs(content: string): ParsedFAQ[] {
  const faqs: ParsedFAQ[] = [];
  // Match patterns like **Q: ...** or ### Q. ...  followed by answer text
  const faqSection = content.match(/(?:##\s*FAQ|##\s*Frequently Asked Questions)([\s\S]*?)(?:##[^#]|$)/i);
  if (!faqSection) return faqs;

  const block = faqSection[1];
  // Match Q&A pairs - various formats
  const qaPairs = block.split(/(?:\n\s*\*\*Q[.\d]*[:.]?\s*|\n\s*###?\s*Q[.\d]*[:.]?\s*|\n\s*\d+\.\s*\*\*)/i).filter(Boolean);

  for (const pair of qaPairs) {
    const lines = pair.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) continue;
    const question = lines[0].replace(/\*\*/g, '').replace(/\??\s*$/, '?').trim();
    const answer = lines.slice(1).join(' ').replace(/\*\*/g, '').replace(/^\s*A[:.]?\s*/i, '').trim();
    if (question.length > 10 && answer.length > 20) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countH2s(content: string): number {
  return (content.match(/^##\s+/gm) || []).length;
}

function injectInternalLinks(content: string, links: { anchor: string; href: string }[]): string {
  let result = content;
  for (const link of links) {
    // Only inject if not already present as a markdown link
    if (result.includes(`](${link.href})`)) continue;
    // Find first natural mention of keywords from anchor and wrap it
    const keywords = link.anchor.split(' ').filter(w => w.length > 3).slice(0, 2);
    if (keywords.length === 0) continue;
    const pattern = new RegExp(`(?<![\\[\\(])\\b(${keywords.join('\\s+\\S*\\s*')})\\b(?![\\]\\)])`, 'i');
    result = result.replace(pattern, `[$1](${link.href})`);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN → HTML
// ═══════════════════════════════════════════════════════════════════════════════

function markdownToHtml(md: string): string {
  return md
    .replace(/^#### (.*$)/gim, '<h4 class="text-lg font-semibold mt-6 mb-3">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-10 mb-5">$1</h2>')
    .replace(/^# (.*$)/gim, '<h2 class="text-2xl font-bold mt-10 mb-5">$1</h2>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>')
    .replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ml-6 mb-2">$1</li>')
    .replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ml-6 mb-2 list-decimal">$2</li>')
    .replace(/^(?!<[hlu])([^<\n].+)$/gim, '<p class="mb-4 text-muted-foreground leading-relaxed">$1</p>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="mb-6 list-disc">$&</ul>')
    .replace(/\n\n+/g, '\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin-only authentication
  const authResult = await verifyAdmin(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { slug: requestedSlug } = await req.json();
    // No GEMINI_API_KEY needed — uses Vertex AI via shared helper

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const guidesToGenerate = requestedSlug === 'all'
      ? GUIDES
      : GUIDES.filter(g => g.slug === requestedSlug);

    if (guidesToGenerate.length === 0) {
      return new Response(JSON.stringify({ error: `Unknown slug: ${requestedSlug}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const report = { generated: [] as string[], skipped: [] as string[], validation_warnings: [] as string[], errors: [] as string[] };

    for (const guide of guidesToGenerate) {
      try {
        // Check if slug already exists
        const { data: existing } = await supabase
          .from('blog_posts')
          .select('id')
          .eq('slug', guide.slug)
          .limit(1);

        if (existing && existing.length > 0) {
          report.skipped.push(guide.slug);
          continue;
        }

        // Generate content via Gemini
        const systemPrompt = `You are a senior content writer for TrueJobs, India's leading government job portal. Write comprehensive, practical, SEO-optimized articles in English for Indian government job aspirants. Use markdown formatting with H2 (##) and H3 (###) headings. Include a FAQ section at the end with the heading "## Frequently Asked Questions" containing 5-7 Q&A pairs formatted as "**Q1. Question?**\nAnswer text."

IMPORTANT: Include these internal links naturally in the content as markdown links:
${guide.internalLinks.map(l => `- [${l.anchor}](${l.href})`).join('\n')}

${guide.prompt}`;

        console.log(`Generating guide: ${guide.slug}`);
        const rawContent = await callGeminiVertex(systemPrompt);

        if (!rawContent || rawContent.length < 500) {
          report.errors.push(`${guide.slug}: Generated content too short (${rawContent?.length || 0} chars)`);
          continue;
        }

        // Parse and validate
        const wordCount = countWords(rawContent);
        const h2Count = countH2s(rawContent);
        const rawFaqs = extractFAQs(rawContent);
        const validatedFaqs = validateFAQs(rawFaqs);
        const { valid: validLinks, warnings: linkWarnings } = validateInternalLinks(guide.internalLinks);

        // Log validation warnings
        if (wordCount < 1800) {
          report.validation_warnings.push(`${guide.slug}: Word count ${wordCount} < 1800`);
        }
        if (h2Count < 3) {
          report.validation_warnings.push(`${guide.slug}: Only ${h2Count} H2 headings (minimum 3)`);
        }
        if (rawFaqs.length < 5) {
          report.validation_warnings.push(`${guide.slug}: Only ${rawFaqs.length} FAQs extracted (target 5-7)`);
        }
        for (const w of linkWarnings) {
          report.validation_warnings.push(`${guide.slug}: ${w}`);
        }

        // Inject internal links and convert to HTML
        const contentWithLinks = injectInternalLinks(rawContent, validLinks);
        const htmlContent = markdownToHtml(contentWithLinks);

        // Validate meta fields
        const validatedMetaTitle = validateMetaTitle(guide.metaTitle);
        const validatedMetaDesc = validateMetaDescription(guide.metaDescription);

        // Build FAQ schema
        const faqSchema = validatedFaqs.length > 0 ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: validatedFaqs.map(f => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        } : null;

        // Generate excerpt
        const cleanText = rawContent.replace(/#{1,6}\s+/g, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        const excerpt = cleanText.substring(0, 155).replace(/\s+/g, ' ').trim();
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        // Insert into blog_posts as draft
        const { error: insertError } = await supabase
          .from('blog_posts')
          .insert({
            slug: guide.slug,
            title: guide.title,
            content: htmlContent,
            excerpt: excerpt.length > 150 ? excerpt.substring(0, excerpt.lastIndexOf(' ', 150)) + '...' : excerpt,
            meta_title: validatedMetaTitle,
            meta_description: validatedMetaDesc,
            category: guide.category,
            tags: guide.tags,
            author_name: 'TrueJobs Editorial Team',
            author_id: '00000000-0000-0000-0000-000000000000',
            status: 'draft',
            is_published: false,
            language: 'en',
            word_count: wordCount,
            reading_time: readingTime,
            faq_schema: faqSchema,
            faq_count: validatedFaqs.length,
            has_faq_schema: validatedFaqs.length > 0,
            internal_links: validLinks,
            featured_image_alt: `${guide.title} - TrueJobs Guide`,
          });

        if (insertError) {
          report.errors.push(`${guide.slug}: DB insert failed — ${insertError.message}`);
        } else {
          report.generated.push(guide.slug);
        }

        // Rate limiting: wait 2s between guides
        if (guidesToGenerate.indexOf(guide) < guidesToGenerate.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (guideError) {
        report.errors.push(`${guide.slug}: ${guideError instanceof Error ? guideError.message : String(guideError)}`);
      }
    }

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-guide-content error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
