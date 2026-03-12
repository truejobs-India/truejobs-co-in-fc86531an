import type { FAQItem } from './types';

export type CustomLongTailSubtype = 'opportunity' | 'constraint' | 'decision' | 'exam-support';

export interface CustomLongTailConfig {
  slug: string;
  subtype: CustomLongTailSubtype;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  faqItems: FAQItem[];
  quickLinks: { label: string; href: string }[];
  filterConfig?: {
    state?: string;
    department?: string;
    qualification?: string;
    keyword?: string;
    jobSector?: 'government' | 'private';
  };
  authorityLinks: { label: string; href: string }[];
  guideLinks?: { label: string; href: string }[];
  lastUpdated?: string;
  datePublished?: string;
}

/**
 * WEEKLY LONG-TAIL PAGE WORKFLOW
 *
 * To add a new page:
 * 1. Determine the best subtype (opportunity | constraint | decision | exam-support)
 * 2. Append a config entry to CUSTOM_LONG_TAIL_PAGES below
 * 3. Ensure introContent is 500+ words of unique, intent-specific HTML
 * 4. Include 4-5 FAQs addressing the specific user intent
 * 5. Add 3-5 authorityLinks pointing to relevant exam/dept/state pages
 * 6. Rebuild SEO cache from admin panel
 *
 * IMPORTANT:
 * - Do NOT create pages that overlap with existing state/dept/qual/category pages
 * - Each page must provide genuinely differentiated content and utility
 * - Avoid keyword-swapped clones — each page must feel like a real resource
 */

const CUSTOM_LONG_TAIL_PAGES: CustomLongTailConfig[] = [
  {
    slug: 'govt-job-age-calculator-guide',
    subtype: 'exam-support',
    h1: 'Government Job Age Calculator — Check Your Eligibility Instantly',
    metaTitle: 'Govt Job Age Calculator Guide 2026',
    metaDescription: 'Use the TrueJobs age calculator to check your eligibility for SSC, Railway, Banking, UPSC & state government jobs. Category-wise relaxation included.',
    introContent: `<h2>How to Use the Government Job Age Calculator</h2>
<p>Age eligibility is one of the most common reasons candidates are rejected from government job applications. Each exam — SSC CGL, RRB NTPC, IBPS PO, UPSC CSE — has its own age limits, cut-off dates, and category-wise relaxation rules. Our <strong>Government Job Age Calculator</strong> eliminates the confusion by instantly checking your eligibility against any exam's specific requirements.</p>

<h2>Why Age Calculation Matters for Government Jobs</h2>
<p>Unlike private sector jobs, government recruitment has strict, non-negotiable age limits enforced by conducting bodies. The age cut-off date varies: SSC uses 1st January of the exam year, Railways uses the date specified in the notification, and UPSC uses 1st August. Miscalculating your age against these dates can lead to wasted application fees and preparation time.</p>

<h3>Category-Wise Age Relaxation Rules</h3>
<p>The Government of India provides age relaxation for reserved categories:</p>
<ul>
<li><strong>SC/ST:</strong> 5 years on upper age limit</li>
<li><strong>OBC (Non-Creamy Layer):</strong> 3 years on upper age limit</li>
<li><strong>PwBD:</strong> 10 years (General), 13 years (OBC), 15 years (SC/ST)</li>
<li><strong>Ex-Servicemen:</strong> 3 years after deducting military service</li>
</ul>

<h3>Common Age Limits by Exam</h3>
<table><tr><th>Exam</th><th>Min Age</th><th>Max Age (Gen)</th><th>Cut-off Date</th></tr>
<tr><td>SSC CGL</td><td>18/20</td><td>27/30/32</td><td>1 January</td></tr>
<tr><td>RRB NTPC</td><td>18</td><td>30/33</td><td>As per notification</td></tr>
<tr><td>IBPS PO</td><td>20</td><td>30</td><td>As per notification</td></tr>
<tr><td>UPSC CSE</td><td>21</td><td>32</td><td>1 August</td></tr>
<tr><td>SSC GD</td><td>18</td><td>23</td><td>As per notification</td></tr>
</table>

<h3>How Our Calculator Works</h3>
<p>Simply enter your date of birth, select the exam you are targeting, and choose your category. The calculator automatically applies the correct cut-off date and relaxation rules, showing you a clear YES/NO eligibility result along with detailed age breakdown. You can check multiple exams simultaneously to identify all opportunities available to you.</p>

<h3>Tips for Candidates Near the Age Limit</h3>
<p>If you are close to the upper age limit, consider these strategies:</p>
<ul>
<li>Apply for exams with higher age limits first (UPSC allows up to 32 for General)</li>
<li>Check if your category qualifies for additional relaxation</li>
<li>Monitor notifications carefully — sometimes SSC and Railways increase age limits for specific recruitments</li>
<li>For railway exams, age relaxation for departmental candidates may apply if you are already a railway employee</li>
</ul>`,
    faqItems: [
      { question: 'How do I calculate my age for government jobs?', answer: 'Calculate your age on the specific cut-off date mentioned in the exam notification. SSC uses 1st January, UPSC uses 1st August. Use our age calculator for instant results.' },
      { question: 'Is there age relaxation for OBC in government jobs?', answer: 'Yes, OBC (Non-Creamy Layer) candidates get 3 years relaxation on the upper age limit for central government exams.' },
      { question: 'Can I apply for SSC CGL if I am 28 years old?', answer: 'General category: depends on the post — Inspector posts allow up to 30 years, but LDC/DEO posts have a 27-year limit. OBC candidates get 3 additional years.' },
      { question: 'What document is used for age verification?', answer: 'The date of birth mentioned in your 10th class (matriculation) certificate is the official DOB used by all government recruiting agencies.' },
    ],
    quickLinks: [
      { label: 'Age Calculator Tool', href: '/govt-job-age-calculator' },
      { label: 'SSC CGL Age Limit', href: '/ssc-cgl-age-limit' },
      { label: 'SSC CGL Eligibility', href: '/ssc-cgl-2026-eligibility' },
    ],
    filterConfig: { jobSector: 'government' },
    authorityLinks: [
      { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
      { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
      { label: 'IBPS PO 2026', href: '/ibps-po-2026-notification' },
    ],
    guideLinks: [
      { label: 'SSC CGL Age Limit Details', href: '/ssc-cgl-age-limit' },
    ],
    lastUpdated: '2026-03-08',
    datePublished: '2026-03-08',
  },
  {
    slug: 'govt-salary-calculator-guide',
    subtype: 'exam-support',
    h1: 'Government Job Salary Calculator — 7th CPC Pay & Allowances',
    metaTitle: 'Govt Salary Calculator Guide — 7th CPC 2026',
    metaDescription: 'Calculate your government job salary using the 7th CPC pay matrix. Gross salary, DA, HRA, and in-hand pay for all pay levels 1-18.',
    introContent: `<h2>How to Calculate Your Government Job Salary</h2>
<p>Understanding government salary structure is essential for aspirants deciding which exams to prioritize. The <strong>7th Central Pay Commission (CPC)</strong> governs the salary of all central government employees in India, with a structured pay matrix spanning 18 levels. Our salary calculator helps you compute exact gross and in-hand salary for any pay level.</p>

<h2>Understanding the 7th CPC Pay Matrix</h2>
<p>The 7th CPC pay matrix replaced the old Grade Pay system with a simplified Pay Level structure. Each level has a defined entry-level basic pay and annual increments of 3%. Here's a quick overview of key pay levels:</p>
<table><tr><th>Pay Level</th><th>Basic Pay Range</th><th>Typical Posts</th></tr>
<tr><td>Level 1</td><td>₹18,000 – ₹56,900</td><td>Railway Group D, MTS</td></tr>
<tr><td>Level 2</td><td>₹19,900 – ₹63,200</td><td>ALP, Constable</td></tr>
<tr><td>Level 4</td><td>₹25,500 – ₹81,100</td><td>SSC CGL UDC, Tax Assistant</td></tr>
<tr><td>Level 6</td><td>₹35,400 – ₹1,12,400</td><td>Sub Inspector, Station Master</td></tr>
<tr><td>Level 7</td><td>₹44,900 – ₹1,42,400</td><td>Inspector, Junior Engineer</td></tr>
<tr><td>Level 10</td><td>₹56,100 – ₹1,77,500</td><td>IAS (Entry), IPS (Entry)</td></tr>
</table>

<h3>Components of Government Salary</h3>
<p>Your total government salary consists of:</p>
<ul>
<li><strong>Basic Pay:</strong> The foundation amount from the pay matrix</li>
<li><strong>Dearness Allowance (DA):</strong> Currently 53% of basic pay, revised biannually</li>
<li><strong>House Rent Allowance (HRA):</strong> 8%, 16%, or 24% of basic pay depending on city classification (X, Y, Z)</li>
<li><strong>Transport Allowance (TPTA):</strong> ₹1,350-₹3,600 based on pay level and city</li>
<li><strong>Children Education Allowance:</strong> ₹2,250 per child per month (max 2 children)</li>
</ul>

<h3>Deductions from Gross Salary</h3>
<p>Common deductions include NPS contribution (10% of basic+DA), Professional Tax, Income Tax (as per slab), and CGHS contribution. The in-hand salary is typically 70-80% of the gross salary for most pay levels.</p>

<h3>How Our Calculator Works</h3>
<p>Select the pay level and city type. The calculator instantly computes basic pay, DA (at current 53% rate), HRA, transport allowance, and shows both gross and estimated in-hand salary. You can compare across pay levels to understand the salary difference between various government posts.</p>`,
    faqItems: [
      { question: 'What is the current DA rate for central government employees?', answer: 'The current DA rate is 53% of basic pay (as of January 2026). DA is revised every 6 months based on the AICPI (All India Consumer Price Index).' },
      { question: 'How is HRA calculated in government jobs?', answer: 'HRA depends on city classification: 24% of basic pay for X-class cities (Delhi, Mumbai), 16% for Y-class, and 8% for Z-class cities.' },
      { question: 'What is the in-hand salary for Level 4?', answer: 'For Level 4 (₹25,500 basic) in an X-class city, the gross salary is approximately ₹52,000 and in-hand is around ₹42,000 after NPS and tax deductions.' },
      { question: 'When is the 8th Pay Commission expected?', answer: 'The 8th CPC is expected to be constituted around 2026 and implemented by 2028-2029, with a fitment factor expected to significantly increase all pay levels.' },
    ],
    quickLinks: [
      { label: 'Salary Calculator Tool', href: '/salary-calculator' },
      { label: 'SSC CGL Salary', href: '/ssc-cgl-2026-salary' },
      { label: 'RRB NTPC Salary', href: '/rrb-ntpc-2026-salary' },
    ],
    filterConfig: { jobSector: 'government' },
    authorityLinks: [
      { label: 'SSC CGL Salary Details', href: '/ssc-cgl-2026-salary' },
      { label: 'RRB NTPC Salary Details', href: '/rrb-ntpc-2026-salary' },
      { label: 'Railway Group D Salary', href: '/railway-group-d-2026-salary' },
    ],
    lastUpdated: '2026-03-08',
    datePublished: '2026-03-08',
  },
  {
    slug: 'percentage-calculator-guide',
    subtype: 'exam-support',
    h1: 'Percentage Calculator for Exam Marks & Cutoff Analysis',
    metaTitle: 'Percentage Calculator Guide for Exam Marks 2026',
    metaDescription: 'Free percentage calculator for exam marks, cutoff analysis, and score comparison. Calculate your marks percentage for SSC, Railway, Banking exams.',
    introContent: `<h2>How to Use the Percentage Calculator for Exam Preparation</h2>
<p>Percentage calculation is fundamental to government exam preparation — from understanding cutoff scores to calculating your marks against total, to comparing normalised scores across shifts. Our <strong>Percentage Calculator</strong> provides instant, accurate calculations for all your exam-related needs.</p>

<h2>Why Percentage Matters in Government Exams</h2>
<p>Government exam results and cutoffs are often expressed as percentages or scores out of total marks. Understanding how to convert between these formats helps you:</p>
<ul>
<li><strong>Set realistic targets:</strong> If SSC CGL cutoff is 87.72% (175.44/200), you know you need ~88% accuracy to clear</li>
<li><strong>Compare across exams:</strong> RRB NTPC cutoff of 62.5/100 (62.5%) vs SSC CGL cutoff of 175.44/200 (87.72%) — different exams, different standards</li>
<li><strong>Track your preparation:</strong> Calculate your accuracy percentage in mock tests to measure improvement</li>
</ul>

<h3>Common Percentage Calculations for Exam Aspirants</h3>
<table><tr><th>Scenario</th><th>Formula</th><th>Example</th></tr>
<tr><td>Marks Percentage</td><td>(Obtained ÷ Total) × 100</td><td>165/200 = 82.5%</td></tr>
<tr><td>Cutoff as Percentage</td><td>(Cutoff Score ÷ Total Marks) × 100</td><td>175.44/200 = 87.72%</td></tr>
<tr><td>Accuracy Rate</td><td>(Correct ÷ Attempted) × 100</td><td>85/95 = 89.47%</td></tr>
<tr><td>Attempt Ratio</td><td>(Attempted ÷ Total Questions) × 100</td><td>95/100 = 95%</td></tr>
<tr><td>Negative Marking Impact</td><td>(Wrong × Penalty ÷ Total) × 100</td><td>(10 × 0.5 ÷ 200) = 2.5%</td></tr>
</table>

<h3>Percentage in Educational Qualification</h3>
<p>Many government exams require a minimum percentage in graduation for eligibility. For example:</p>
<ul>
<li>IBPS PO/Clerk: 60% in graduation (55% for SC/ST)</li>
<li>SSC CGL: No minimum percentage, only degree required</li>
<li>RBI Grade B: 60% in graduation</li>
</ul>

<h3>How Normalisation Affects Your Percentage</h3>
<p>Both SSC and Railway exams apply normalisation when the exam is conducted across multiple shifts. Your raw score is converted to a normalised score using a formula that accounts for the average and standard deviation of each shift. The cutoff percentage is applied to normalised scores, not raw marks. This means your actual paper percentage may differ from your normalised score percentage.</p>

<h3>Tips for Improving Your Exam Percentage</h3>
<p>Based on analysis of previous year cutoff trends:</p>
<ul>
<li>Focus on accuracy over speed — 90% accuracy with 80% attempts is better than 70% accuracy with 100% attempts</li>
<li>Calculate the negative marking impact before deciding to guess — in SSC (0.25 penalty), guess only when you can eliminate 2+ options</li>
<li>Track your section-wise percentage in mock tests to identify weak areas</li>
</ul>`,
    faqItems: [
      { question: 'How do I calculate my percentage from exam marks?', answer: 'Divide your obtained marks by total marks and multiply by 100. For example, 165 out of 200 = (165/200) × 100 = 82.5%.' },
      { question: 'What percentage is needed to clear SSC CGL?', answer: 'SSC CGL 2024 Tier 1 cutoff for General was 87.72% (175.44/200). Aim for 88%+ to be safe.' },
      { question: 'Does normalisation change my percentage?', answer: 'Yes, normalisation can increase or decrease your effective score based on your shift difficulty relative to the average. The percentage of normalised score may differ from raw marks percentage.' },
      { question: 'What is a good accuracy percentage in mock tests?', answer: 'Aim for 85%+ accuracy. With 90% accuracy and 85% attempts, your score will be approximately 76% — well above most cutoffs.' },
    ],
    quickLinks: [
      { label: 'Percentage Calculator Tool', href: '/percentage-calculator' },
      { label: 'SSC CGL Cutoff', href: '/ssc-cgl-cutoff' },
      { label: 'RRB NTPC Cutoff', href: '/rrb-ntpc-cutoff' },
    ],
    filterConfig: { jobSector: 'government' },
    authorityLinks: [
      { label: 'SSC CGL Cutoff Analysis', href: '/ssc-cgl-cutoff' },
      { label: 'RRB NTPC Cutoff Analysis', href: '/rrb-ntpc-cutoff' },
      { label: 'SSC CGL Exam Pattern', href: '/ssc-cgl-2026-exam-pattern' },
    ],
    lastUpdated: '2026-03-08',
    datePublished: '2026-03-08',
  },
  {
    slug: 'how-to-use-truejobs-tools',
    subtype: 'exam-support',
    h1: 'How to Use TrueJobs Free Tools for Government Exam Preparation',
    metaTitle: 'TrueJobs Tools Guide — Free Exam Prep Tools',
    metaDescription: 'Complete guide to using TrueJobs free tools: age calculator, salary calculator, percentage calculator, typing test, photo resizer, and eligibility checker.',
    introContent: `<h2>TrueJobs Free Tools for Government Exam Aspirants</h2>
<p>TrueJobs provides a comprehensive suite of <strong>free tools</strong> designed specifically for government job aspirants. These tools save hours of manual calculation and help you make informed decisions about which exams to target and how to prepare effectively.</p>

<h2>Available Tools on TrueJobs</h2>

<h3>1. Age Calculator for Government Jobs</h3>
<p>The <a href="/govt-job-age-calculator">Age Calculator</a> instantly checks your eligibility for any government exam. Enter your date of birth, select the exam, and choose your category — the tool automatically applies the correct cut-off date and category-wise relaxation. It supports all major exams including SSC CGL, RRB NTPC, IBPS PO, UPSC CSE, and state-level exams.</p>

<h3>2. 7th CPC Salary Calculator</h3>
<p>The <a href="/salary-calculator">Salary Calculator</a> computes the exact salary for any government pay level (1-18). Select the pay level and city type to see basic pay, DA, HRA, transport allowance, and estimated in-hand salary. Compare salaries across different posts to help decide which exams to prioritize based on compensation.</p>

<h3>3. Percentage Calculator</h3>
<p>The <a href="/percentage-calculator">Percentage Calculator</a> handles all exam-related percentage needs — marks percentage, cutoff analysis, accuracy rate calculation, and score comparison across different exams with different total marks.</p>

<h3>4. Typing Speed Test</h3>
<p>The <a href="/typing-test">Typing Test</a> simulates the actual typing test conducted in SSC CHSL, CRPF, and other government exams. Practice with exam-specific WPM targets and track your speed improvement over time. Supports both Hindi and English typing with INSCRIPT keyboard layout.</p>

<h3>5. Eligibility Checker</h3>
<p>The <a href="/eligibility-checker">Eligibility Checker</a> matches your educational qualification, age, and category against all available government exams. It shows a comprehensive list of exams you are eligible for, helping you discover opportunities you might have missed.</p>

<h3>6. Photo & Image Resizer</h3>
<p>The <a href="/photo-resizer">Photo Resizer</a> formats your photograph to the exact specifications required for government exam applications — passport size (3.5×4.5 cm), with specific file size limits (20-50 KB for SSC, 20-200 KB for Railways). Upload once, get the correct format instantly.</p>

<h3>7. Fee Calculator</h3>
<p>The <a href="/fee-calculator">Fee Calculator</a> helps you plan your exam application budget by listing the exact fees for each exam by category, with details on exemptions and payment modes available.</p>

<h2>How These Tools Work Together</h2>
<p>For the best experience, start with the <strong>Eligibility Checker</strong> to identify all exams you qualify for. Then use the <strong>Age Calculator</strong> to verify age limits, the <strong>Salary Calculator</strong> to compare compensation, and finally the <strong>Typing Test</strong> and <strong>Photo Resizer</strong> when preparing your application.</p>`,
    faqItems: [
      { question: 'Are TrueJobs tools free to use?', answer: 'Yes, all tools on TrueJobs are completely free. No registration or login is required to use any of the calculators or tools.' },
      { question: 'Which tool should I use first?', answer: 'Start with the Eligibility Checker to identify exams you qualify for, then use the Age Calculator to verify age limits, and the Salary Calculator to compare compensation.' },
      { question: 'Does the typing test match actual exam conditions?', answer: 'Yes, the typing test simulates real exam conditions with exam-specific WPM targets (SSC CHSL: 35 WPM English, 30 WPM Hindi) and standard keyboard layouts.' },
      { question: 'Can I use these tools on mobile?', answer: 'Yes, all TrueJobs tools are fully responsive and work on mobile phones, tablets, and desktop browsers.' },
    ],
    quickLinks: [
      { label: 'Age Calculator', href: '/govt-job-age-calculator' },
      { label: 'Salary Calculator', href: '/salary-calculator' },
      { label: 'Typing Test', href: '/typing-test' },
      { label: 'Eligibility Checker', href: '/eligibility-checker' },
    ],
    filterConfig: { jobSector: 'government' },
    authorityLinks: [
      { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
      { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
      { label: 'All Government Exams', href: '/latest-govt-jobs' },
    ],
    guideLinks: [
      { label: 'Age Calculator Guide', href: '/govt-job-age-calculator-guide' },
      { label: 'Salary Calculator Guide', href: '/govt-salary-calculator-guide' },
    ],
    lastUpdated: '2026-03-08',
    datePublished: '2026-03-08',
  },
];

const longTailMap = new Map<string, CustomLongTailConfig>();
CUSTOM_LONG_TAIL_PAGES.forEach((p) => longTailMap.set(p.slug, p));

export function getCustomLongTailConfig(slug: string): CustomLongTailConfig | undefined {
  return longTailMap.get(slug);
}

export function getAllCustomLongTailSlugs(): string[] {
  return CUSTOM_LONG_TAIL_PAGES.map((p) => p.slug);
}

export function isCustomLongTailSlug(slug: string): boolean {
  return longTailMap.has(slug);
}
