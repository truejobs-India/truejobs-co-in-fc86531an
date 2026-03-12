import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'ssc-jobs' as const,
  examName: 'SSC CHSL',
  examYear: 2026,
  conductingBody: 'Staff Selection Commission (SSC)',
  officialWebsite: 'https://ssc.gov.in',
};

export const sscChslNotification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-notification',
  pageType: 'notification',
  metaTitle: 'SSC CHSL 2026 Notification – Dates, Apply Online',
  metaDescription: 'SSC CHSL 2026 notification out. Check exam dates, eligibility criteria, application fee, vacancy details and apply online at ssc.gov.in.',
  lastUpdated: '2026-03-07',
  datePublished: '2026-01-15',
  applicationEndDate: '2026-05-15',
  applyLink: 'https://ssc.gov.in',
  notificationPdfUrl: 'https://ssc.gov.in/api/Notices',

  h1: 'SSC CHSL 2026 Notification – Combined Higher Secondary Level Examination',

  overview: `<p>The Staff Selection Commission (SSC) has released the <strong>SSC CHSL 2026 Notification</strong> for the Combined Higher Secondary Level Examination. SSC CHSL is one of India's most popular government recruitment exams, offering opportunities for 12th-pass candidates to secure permanent central government positions with job security, pension benefits, and attractive pay scales.</p>

<p>SSC CHSL 2026 recruits candidates for three categories of posts: <strong>Lower Division Clerk (LDC) / Junior Secretariat Assistant (JSA)</strong> at Pay Level 2 (₹19,900–₹63,200), <strong>Postal Assistant (PA) / Sorting Assistant (SA)</strong> at Pay Level 4 (₹25,500–₹81,100), and <strong>Data Entry Operator (DEO)</strong> at Pay Level 4 (₹25,500–₹81,100). These posts are spread across various central government ministries, departments, and attached/subordinate offices.</p>

<p>The exact number of SSC CHSL 2026 vacancies will be announced with the official notification. SSC CHSL typically recruits 3,000–5,000 candidates annually across all posts. The recruitment covers ministries including Ministry of Home Affairs, Ministry of Defence, Ministry of Finance, Department of Posts, Comptroller & Auditor General (C&AG), and numerous other central government organisations.</p>

<p>The examination follows a two-tier pattern. <strong>Tier 1</strong> is a Computer Based Examination consisting of 100 objective-type multiple-choice questions carrying 200 marks, to be completed in 60 minutes. The four sections tested are General Intelligence, English Language, Quantitative Aptitude, and General Awareness. <strong>Tier 2</strong> comprises a Typing Test for LDC/JSA posts (English typing at 35 wpm or Hindi typing at 30 wpm) and a Skill Test for DEO posts (data entry speed of 8,000 key depressions per hour).</p>

<p>Candidates must have passed the 12th Standard (Higher Secondary) or equivalent examination from a recognised board. The age limit is 18–27 years for LDC/JSA and PA/SA posts, and 18–25 years for DEO posts, with standard relaxations for reserved categories as per government norms — SC/ST (5 years), OBC (3 years), and PwD (up to 10 years).</p>

<p>The application process is entirely online through the SSC portal at ssc.gov.in. Candidates must complete one-time registration, fill in personal and educational details, upload photographs and signatures, and pay the application fee of ₹100 (exempted for female, SC, ST, PwD, and Ex-Servicemen candidates). The application correction window opens after the submission deadline.</p>

<p>This page provides complete details about SSC CHSL 2026 including important dates, eligibility criteria, exam pattern, syllabus, selection process, salary structure, and step-by-step application guide. Bookmark this page for the latest official updates from SSC.</p>`,

  dates: [
    { label: 'Notification Release Date', date: '2026-01-15' },
    { label: 'Online Application Start Date', date: '2026-02-15' },
    { label: 'Last Date to Apply Online', date: '2026-05-15' },
    { label: 'Last Date for Fee Payment', date: '2026-05-17' },
    { label: 'Application Correction Window', date: '2026-05-20 to 2026-05-25' },
    { label: 'Tier 1 Exam Date', date: '2026-08-01 to 2026-08-25' },
    { label: 'Tier 1 Result Date', date: 'To Be Announced' },
    { label: 'Tier 2 (Typing/Skill Test) Date', date: 'To Be Announced' },
    { label: 'Final Result Date', date: 'To Be Announced' },
  ],

  eligibility: `<p>To be eligible for SSC CHSL 2026, candidates must meet the following criteria:</p>
<h3>Educational Qualification</h3>
<ul>
<li><strong>LDC/JSA, PA/SA, DEO:</strong> Must have passed 12th Standard or equivalent examination from a recognised Board or University.</li>
<li><strong>DEO (Grade A):</strong> 12th Standard pass in Science stream with Mathematics as a subject.</li>
</ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul>
<li><strong>LDC/JSA & PA/SA:</strong> 18–27 years</li>
<li><strong>DEO:</strong> 18–25 years</li>
</ul>
<h3>Age Relaxation</h3>
<ul>
<li>SC/ST: 5 years</li>
<li>OBC (Non-Creamy Layer): 3 years</li>
<li>PwD (General): 10 years | PwD (OBC): 13 years | PwD (SC/ST): 15 years</li>
<li>Ex-Servicemen: 3 years after deduction of military service rendered</li>
</ul>
<p>Candidates appearing in their 12th board examination can also apply provisionally, subject to producing the pass certificate at the time of document verification.</p>`,

  feeStructure: {
    general: 100,
    obc: 100,
    scSt: 0,
    female: 0,
    ph: 0,
    paymentModes: ['Net Banking', 'Credit Card', 'Debit Card', 'UPI', 'SBI Challan'],
  },

  selectionProcess: [
    'Tier 1 – Computer Based Examination (Objective MCQs)',
    'Tier 2 – Typing Test (for LDC/JSA) / Skill Test (for DEO)',
    'Document Verification',
    'Medical Examination',
    'Final Merit List based on Tier 1 normalised score',
  ],

  examPattern: [
    {
      stageName: 'Tier 1 – Computer Based Examination',
      rows: [
        { subject: 'General Intelligence', questions: 25, marks: 50, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English Language', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Typing / Skill Test (Qualifying)',
      rows: [
        { subject: 'English Typing Test (LDC/JSA)', questions: 0, marks: 0, duration: '10 min', negativeMarking: 'Qualifying – 35 wpm' },
        { subject: 'Hindi Typing Test (LDC/JSA)', questions: 0, marks: 0, duration: '10 min', negativeMarking: 'Qualifying – 30 wpm' },
        { subject: 'Data Entry Skill Test (DEO)', questions: 0, marks: 0, duration: '15 min', negativeMarking: 'Qualifying – 8000 KDPH' },
      ],
    },
  ],

  syllabusSummary: `<p>The SSC CHSL Tier 1 syllabus covers General Intelligence (analogies, coding-decoding, series, Venn diagrams), English Language (reading comprehension, error spotting, synonyms/antonyms, idioms, one-word substitution), Quantitative Aptitude (number systems, percentage, ratio, profit & loss, time & work, geometry, trigonometry, data interpretation), and General Awareness (current affairs, history, geography, polity, economics, science).</p>
<p>Tier 2 is a skill-based test — for LDC/JSA, candidates must demonstrate typing proficiency; for DEO, data entry speed is tested. For detailed syllabus, see our <a href="/ssc-chsl-2026-syllabus">SSC CHSL 2026 Syllabus</a> page.</p>`,

  salary: {
    salaryMin: 19900,
    salaryMax: 81100,
    payLevels: 'Pay Level 2 to Pay Level 4',
    grossRange: '₹28,000 – ₹65,000 per month',
    netRange: '₹24,000 – ₹55,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – revised biannually',
      'House Rent Allowance (HRA) – 8% to 24% based on city',
      'Transport Allowance (TPTA)',
      'Children Education Allowance',
      'Leave Travel Concession (LTC)',
      'National Pension System (NPS) – 14% employer contribution',
      'Medical Benefits under CGHS',
    ],
    postWiseSalary: [
      { post: 'Lower Division Clerk (LDC) / JSA', payLevel: 'Level 2', basicPay: '₹19,900 – ₹63,200' },
      { post: 'Postal Assistant (PA) / Sorting Assistant', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Data Entry Operator (DEO)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Data Entry Operator (DEO Grade A)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
    ],
  },

  howToApply: [
    'Visit the official SSC website at ssc.gov.in and navigate to the "Register/Login" section.',
    'If you are a new user, click "New User? Register Now" and complete one-time registration with your name, email, mobile number, and create a password.',
    'After registration, log in to the SSC portal and click on "Apply" next to the CHSL 2026 notification.',
    'Fill in the application form with personal details (name, date of birth, category), educational qualifications (12th pass board, percentage), and examination centre preferences.',
    'Upload scanned copies of your recent passport-size photograph (20–50 KB, JPEG), signature (10–20 KB, JPEG), and a valid photo ID proof (100–300 KB, PDF).',
    'Pay the application fee of ₹100 via Net Banking, Credit/Debit Card, UPI, or SBI Challan. Female, SC, ST, PwD, and Ex-Servicemen candidates are exempted from fee payment.',
    'Review all details carefully, submit the application, and download/print the confirmation page with your Registration ID for future reference.',
  ],

  faqs: [
    { question: 'When is the SSC CHSL 2026 exam date?', answer: 'SSC CHSL 2026 Tier 1 exam is scheduled from August 1 to August 25, 2026. Tier 2 (Typing/Skill Test) date will be announced after Tier 1 results.' },
    { question: 'What is the last date to apply for SSC CHSL 2026?', answer: 'The last date to apply online for SSC CHSL 2026 is May 15, 2026. Fee payment deadline is May 17, 2026.' },
    { question: 'What is the minimum qualification for SSC CHSL?', answer: 'Candidates must have passed the 12th Standard (Higher Secondary) or equivalent from a recognised board. No graduation is required.' },
    { question: 'How many vacancies are expected in SSC CHSL 2026?', answer: 'The exact number of SSC CHSL 2026 vacancies will be announced with the official notification. SSC CHSL typically recruits 3,000–5,000 candidates annually across LDC, PA/SA, and DEO posts.' },
    { question: 'Is there negative marking in SSC CHSL Tier 1?', answer: 'Yes, there is a negative marking of 0.50 marks for every wrong answer in Tier 1. Tier 2 is a qualifying typing/skill test with no negative marking.' },
    { question: 'What is the salary of SSC CHSL LDC?', answer: 'SSC CHSL LDC/JSA posts carry Pay Level 2 with basic pay of ₹19,900. The gross monthly salary including allowances is approximately ₹28,000–₹32,000 depending on the posting city.' },
  ],

  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ssc.gov.in',
    instructions: [
      'Visit ssc.gov.in and click on "Status/Download Admit Card" under the Candidate\'s Corner',
      'Select "Combined Higher Secondary Level Examination 2026" from the exam list',
      'Log in with your Registration ID and Date of Birth',
      'Download and print the admit card on A4 paper',
      'Carry the printed admit card to the examination hall',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://ssc.gov.in',
    meritListUrl: 'https://ssc.gov.in',
    nextSteps: [
      'Check the result PDF on ssc.gov.in — qualified candidates\' roll numbers are listed category-wise',
      'SSC applies normalisation across multiple shifts to ensure fair scoring — your raw score is converted to a normalised score',
      'Download your individual score card from the candidate login portal after result declaration',
      'Tier 1 qualified candidates will be called for Tier 2 Typing/Skill Test',
      'Final merit list is prepared based on normalised Tier 1 scores and uploaded to the official website',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '202.34', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '186.55', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '171.48', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '158.34', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '197.56', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '181.20', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '166.02', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '153.45', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '192.78', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '177.10', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '162.15', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '148.92', totalMarks: '200' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC MTS 2026', href: '/ssc-mts-2026-notification' },
    { label: 'SSC GD Constable 2026', href: '/ssc-gd-2026-notification' },
    { label: 'SSC CPO 2026', href: '/ssc-cpo-2026-notification' },
  ],
};

export const sscChslSyllabus: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-syllabus',
  pageType: 'syllabus',
  metaTitle: 'SSC CHSL Syllabus 2026 – Topic-wise Guide & PDF',
  metaDescription: 'Complete SSC CHSL 2026 syllabus for Tier 1 and Tier 2. Topic-wise breakdown, weightage analysis, and preparation strategy for all sections.',
  lastUpdated: '2026-03-05',
  datePublished: '2026-01-20',

  h1: 'SSC CHSL Syllabus 2026 – Complete Subject-Wise Syllabus for Tier 1 & Tier 2',

  overview: `<p>A thorough understanding of the <strong>SSC CHSL 2026 syllabus</strong> is the foundation of any successful preparation strategy. The Combined Higher Secondary Level Examination tests candidates across four key areas in Tier 1, followed by a skill-based Tier 2. Knowing exactly what topics to cover helps candidates focus their preparation and avoid wasting time on irrelevant material.</p>

<p>The <strong>Tier 1 syllabus</strong> covers four sections, each carrying 50 marks with 25 questions, totalling 200 marks in 60 minutes. <strong>General Intelligence</strong> tests reasoning and analytical abilities through topics like Analogies, Classification, Coding-Decoding, Number Series, Alphabet Series, Venn Diagrams, Blood Relations, Direction Sense, Paper Folding & Cutting, Pattern Completion, Mirror/Water Image, and Embedded Figures. This section rewards practice — most questions follow predictable patterns.</p>

<p><strong>English Language</strong> covers Reading Comprehension (1–2 passages), Cloze Test, Error Spotting (in sentences), Sentence Improvement, Fill in the Blanks, Synonyms & Antonyms, Idioms & Phrases, One-word Substitution, Spelling Errors, Active/Passive Voice, and Direct/Indirect Speech. Vocabulary-based questions carry significant weightage, making daily word-learning essential. Previous year analysis shows 8–10 questions come from vocabulary and 6–8 from grammar.</p>

<p><strong>Quantitative Aptitude</strong> includes Arithmetic topics (Number Systems, Percentage, Ratio & Proportion, Averages, Profit & Loss, Discount, Simple & Compound Interest, Time & Work, Time Speed & Distance, Mixture & Alligation), Algebra (basic equations, surds & indices), Geometry (triangles, circles, quadrilaterals, coordinate geometry), Mensuration (area, volume, surface area of 2D and 3D shapes), Trigonometry (ratios, height & distance), and Data Interpretation (tables, bar graphs, pie charts, line graphs). Arithmetic carries 60–70% weightage in this section.</p>

<p><strong>General Awareness</strong> is the most dynamic section covering Current Affairs (last 6–8 months), Indian History (Ancient, Medieval, Modern), Geography (Indian physical, economic, world geography), Indian Polity & Constitution, Economics (basic concepts, budget, banking, monetary policy), General Science (Physics, Chemistry, Biology at 10th standard level), and Static GK (national parks, awards, books & authors, sports, important dates, first in India/world). Candidates should allocate 30 minutes daily to current affairs reading.</p>

<p>The <strong>Tier 2</strong> is a qualifying stage — not a written exam. For <strong>LDC/JSA posts</strong>, candidates must pass a Typing Test: 35 words per minute in English or 30 words per minute in Hindi on computer. The passage is approximately 2000 key depressions for English (10 minutes) and 2000 key depressions for Hindi (10 minutes). For <strong>DEO posts</strong>, candidates must demonstrate data entry speed of 8,000 key depressions per hour on a computer. Candidates who do not meet the required speed are disqualified regardless of their Tier 1 score.</p>

<p>For effective preparation, complete the Arithmetic portion first as it forms the largest scoring block, then move to Reasoning and English. General Awareness should be built gradually through daily reading over 4–6 months. Practice with SSC CHSL previous year papers from 2019–2025 to understand the exact difficulty level and question distribution.</p>`,

  examPattern: [
    {
      stageName: 'Tier 1 – Computer Based Examination',
      rows: [
        { subject: 'General Intelligence', questions: 25, marks: 50, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English Language', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC CHSL 2026 Tier 1 syllabus?', answer: 'SSC CHSL Tier 1 covers General Intelligence, English Language, Quantitative Aptitude, and General Awareness. Each section has 25 questions carrying 50 marks, totalling 200 marks in 60 minutes.' },
    { question: 'Is SSC CHSL syllabus same as SSC CGL?', answer: 'The subjects are similar but SSC CHSL difficulty level is lower than CGL. CHSL tests 12th-level aptitude while CGL tests graduate-level. CHSL has no Tier 2 written exam — only typing/skill test.' },
    { question: 'Which topics are most important for SSC CHSL?', answer: 'Arithmetic (percentage, ratio, profit & loss, time & work) in Quantitative Aptitude, vocabulary and grammar in English, and current affairs in General Awareness carry the highest weightage.' },
    { question: 'How to prepare for SSC CHSL typing test?', answer: 'Practice daily on a computer keyboard for at least 30 minutes. Target 35 wpm in English or 30 wpm in Hindi. Use free online typing tools like TypingClub or Ratatype for structured practice.' },
    { question: 'How many months are needed to prepare for SSC CHSL?', answer: 'Most successful candidates spend 3–5 months in focused preparation for Tier 1. Start typing practice simultaneously to ensure you clear the Tier 2 qualifying test.' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC CHSL Exam Pattern 2026', href: '/ssc-chsl-2026-exam-pattern' },
    { label: 'SSC CHSL Salary 2026', href: '/ssc-chsl-2026-salary' },
    { label: 'SSC CGL 2026 Syllabus', href: '/ssc-cgl-2026-syllabus' },
  ],
};

export const sscChslExamPattern: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-exam-pattern',
  pageType: 'exam-pattern',
  metaTitle: 'SSC CHSL Exam Pattern 2026 – Tier 1 & 2 Details',
  metaDescription: 'SSC CHSL 2026 exam pattern for Tier 1 and Tier 2 typing test. Check marking scheme, number of questions, duration, and negative marking details.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC CHSL Exam Pattern 2026 – Complete Structure & Marking Scheme',

  overview: `<p>The <strong>SSC CHSL 2026 exam pattern</strong> consists of two distinct tiers. Tier 1 is a Computer Based Examination (CBE) that determines merit, while Tier 2 is a qualifying skill test. Understanding this structure is essential because your entire rank depends solely on Tier 1 performance — Tier 2 only tests whether you possess the required typing or data entry skills for the post.</p>

<p><strong>Tier 1</strong> consists of 100 objective-type MCQs carrying 200 marks, to be completed in 60 minutes. The exam is divided into four sections: General Intelligence (25 questions, 50 marks), English Language (25 questions, 50 marks), Quantitative Aptitude (25 questions, 50 marks), and General Awareness (25 questions, 50 marks). There is negative marking of 0.50 marks for every incorrect answer. PwD candidates with certain disabilities receive 20 minutes of compensatory time.</p>

<p>The key difference from SSC CGL is that <strong>CHSL Tier 1 marks are final</strong> — there is no separate Tier 2 written examination. This means every single mark in Tier 1 matters for final post allocation. The normalisation formula is applied across different shifts to ensure fairness. Candidates should aim for maximum accuracy rather than attempting all 100 questions, as the negative marking penalty (0.50 per wrong answer) can significantly reduce scores.</p>

<p><strong>Tier 2</strong> is a qualifying skill test and varies by post. For <strong>LDC/JSA posts</strong>, the Typing Test requires candidates to type a passage at 35 words per minute in English or 30 words per minute in Hindi. The test duration is 10 minutes, and the passage is approximately 2000 key depressions. Candidates who opted for Hindi medium can take the Hindi typing test. For <strong>DEO posts</strong>, the Skill Test requires data entry speed of 8,000 key depressions per hour on a computer. The test duration is 15 minutes with numeric data entry. Candidates must clear this test — failure means disqualification regardless of Tier 1 score.</p>

<p>Strategic exam-day tips: (1) Start with your strongest section to build confidence and secure guaranteed marks; (2) Allocate 12–13 minutes per section as a rough guide, but adjust based on difficulty; (3) In Quantitative Aptitude, solve Arithmetic questions first (easier and less time-consuming) before attempting Geometry/Trigonometry; (4) In English, attempt vocabulary questions first as they take 20–30 seconds each, then move to comprehension; (5) For General Awareness, either you know the answer or you don't — don't spend more than 30 seconds per question; (6) Leave questions you're unsure about — the 0.50 negative marking makes random guessing unprofitable.</p>

<p>The selection process after Tier 1 is straightforward: candidates who clear the cut-off are called for Tier 2 typing/skill test, followed by document verification and medical examination. The final merit list is prepared based on Tier 1 normalised scores only. Post allocation follows the preference order given by candidates in their application form, subject to merit position and category-wise vacancies.</p>`,

  examPattern: [
    {
      stageName: 'Tier 1 – Computer Based Examination',
      rows: [
        { subject: 'General Intelligence', questions: 25, marks: 50, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English Language', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Typing / Skill Test (Qualifying)',
      rows: [
        { subject: 'English Typing Test (LDC/JSA)', questions: 0, marks: 0, duration: '10 min', negativeMarking: 'Qualifying – 35 wpm' },
        { subject: 'Hindi Typing Test (LDC/JSA)', questions: 0, marks: 0, duration: '10 min', negativeMarking: 'Qualifying – 30 wpm' },
        { subject: 'Data Entry Skill Test (DEO)', questions: 0, marks: 0, duration: '15 min', negativeMarking: 'Qualifying – 8000 KDPH' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC CHSL 2026 exam pattern?', answer: 'SSC CHSL 2026 has two tiers. Tier 1 is a computer-based exam with 100 MCQs (200 marks, 60 minutes). Tier 2 is a qualifying typing/skill test — no written exam in Tier 2.' },
    { question: 'Is there negative marking in SSC CHSL?', answer: 'Yes, there is 0.50 marks negative marking for every wrong answer in Tier 1. Tier 2 typing/skill test has no negative marking — it is purely qualifying.' },
    { question: 'How is the SSC CHSL merit list prepared?', answer: 'The final merit list is based solely on Tier 1 normalised scores. Tier 2 is only qualifying. Post allocation depends on merit position and candidate preferences.' },
    { question: 'What is the typing speed required for SSC CHSL?', answer: 'For LDC/JSA posts: 35 wpm in English typing or 30 wpm in Hindi typing. For DEO posts: 8,000 key depressions per hour in data entry.' },
    { question: 'How many questions should I attempt in SSC CHSL Tier 1?', answer: 'Focus on accuracy over attempts. Aim for 85–90 questions with 85%+ accuracy. Random guessing is unprofitable due to 0.50 negative marking per wrong answer.' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC CHSL Syllabus 2026', href: '/ssc-chsl-2026-syllabus' },
    { label: 'SSC CHSL Salary 2026', href: '/ssc-chsl-2026-salary' },
    { label: 'SSC CGL Exam Pattern 2026', href: '/ssc-cgl-2026-exam-pattern' },
  ],
};

export const sscChslEligibility: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-eligibility',
  pageType: 'eligibility',
  metaTitle: 'SSC CHSL Eligibility 2026 – Age, Qualification',
  metaDescription: 'Check SSC CHSL 2026 eligibility criteria including age limit, educational qualification, age relaxation for SC/ST/OBC/PwD, and nationality requirements.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC CHSL Eligibility 2026 – Age Limit, Qualification & Relaxation Details',

  overview: `<p>Understanding the <strong>SSC CHSL 2026 eligibility criteria</strong> in detail is crucial before applying. Candidates who do not meet the eligibility requirements will have their candidature cancelled at any stage of the recruitment process, even after appointment. This page covers all eligibility parameters including educational qualification, age limit, age relaxation, nationality, and post-specific requirements.</p>

<p>The basic educational qualification for all SSC CHSL posts is passing the <strong>12th Standard (Higher Secondary) or equivalent</strong> from a recognised Board or University. Unlike SSC CGL, no graduation is required, making this exam accessible to a larger pool of candidates. However, candidates who have completed graduation or higher education are also eligible — there is no upper qualification bar. For DEO Grade A posts specifically, candidates must have passed 12th Standard in the Science stream with Mathematics as a subject.</p>

<p>The <strong>age limit</strong> varies by post category. For LDC/JSA (Lower Division Clerk / Junior Secretariat Assistant) and PA/SA (Postal Assistant / Sorting Assistant) posts, the age range is <strong>18–27 years</strong>. For DEO (Data Entry Operator) posts, the age range is <strong>18–25 years</strong>. The crucial date for age calculation is 1st January of the year of examination, i.e., 01-01-2026 for SSC CHSL 2026.</p>

<p><strong>Age relaxation</strong> is provided to candidates from reserved categories as per Government of India rules: SC/ST candidates receive 5 years relaxation, OBC (Non-Creamy Layer) candidates receive 3 years, PwD candidates receive 10 years (General), 13 years (OBC), or 15 years (SC/ST), and Ex-Servicemen receive relaxation of 3 years after deduction of military service rendered from actual age. Widows, divorced women, and women who are judicially separated (and have not remarried) are eligible for age relaxation of up to 35 years for General, 38 years for OBC, and 40 years for SC/ST.</p>

<p><strong>Nationality requirements:</strong> Candidates must be (a) a citizen of India, or (b) a subject of Nepal, or (c) a subject of Bhutan, or (d) a Tibetan refugee who came to India before 1st January 1962 with the intention of permanently settling, or (e) a person of Indian origin who has migrated from Pakistan, Myanmar, Sri Lanka, East African countries of Kenya, Uganda, Tanzania, Zambia, Malawi, Zaire, Ethiopia, or Vietnam with the intention of permanently settling in India. Candidates belonging to categories (b), (c), (d), and (e) must have a certificate of eligibility issued by the Government of India.</p>

<p><strong>Physical standards:</strong> There are no specific physical requirements for SSC CHSL posts as these are desk-based administrative positions. However, candidates must be in good mental and bodily health and free from any physical defect likely to interfere with the discharge of duties. Medical examination is conducted before final appointment.</p>

<p>Candidates currently serving in government positions can also apply but must submit their application through the proper channel and produce a No Objection Certificate (NOC) at the time of document verification. Use our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a> to check your exact eligibility based on your date of birth and category.</p>`,

  eligibility: `<p>Summary of SSC CHSL 2026 eligibility:</p>
<h3>Educational Qualification</h3>
<ul>
<li><strong>All Posts:</strong> 12th Standard (Higher Secondary) or equivalent from a recognised Board</li>
<li><strong>DEO Grade A:</strong> 12th Standard in Science stream with Mathematics</li>
</ul>
<h3>Age Limit</h3>
<ul>
<li><strong>LDC/JSA & PA/SA:</strong> 18–27 years (as on 01-01-2026)</li>
<li><strong>DEO:</strong> 18–25 years (as on 01-01-2026)</li>
</ul>
<h3>Age Relaxation</h3>
<ul>
<li>SC/ST: 5 years</li>
<li>OBC (NCL): 3 years</li>
<li>PwD: 10 years (Gen) / 13 years (OBC) / 15 years (SC/ST)</li>
<li>Ex-Servicemen: 3 years after deduction of military service</li>
</ul>`,

  faqs: [
    { question: 'What is the minimum qualification for SSC CHSL 2026?', answer: 'The minimum qualification is 12th Standard (Higher Secondary) pass or equivalent from a recognised Board. No graduation required.' },
    { question: 'What is the age limit for SSC CHSL LDC post?', answer: 'The age limit for LDC/JSA posts is 18–27 years as on 01-01-2026. Age relaxation applies for reserved categories (SC/ST +5, OBC +3, PwD +10 years).' },
    { question: 'Can final year 12th students apply for SSC CHSL?', answer: 'Yes, candidates appearing in their 12th board exam can apply provisionally. They must produce the pass certificate at the time of document verification.' },
    { question: 'Is there any upper educational limit for SSC CHSL?', answer: 'No, there is no upper qualification bar. Graduates, post-graduates, and PhD holders can also apply for SSC CHSL posts.' },
    { question: 'What is the age relaxation for OBC in SSC CHSL?', answer: 'OBC (Non-Creamy Layer) candidates get 3 years age relaxation. So the upper age limit becomes 30 years for LDC/JSA posts and 28 years for DEO posts.' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC CHSL Syllabus 2026', href: '/ssc-chsl-2026-syllabus' },
    { label: 'SSC CHSL Exam Pattern 2026', href: '/ssc-chsl-2026-exam-pattern' },
    { label: 'SSC CGL Eligibility 2026', href: '/ssc-cgl-2026-eligibility' },
  ],
};

export const sscChslSalary: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-salary',
  pageType: 'salary',
  metaTitle: 'SSC CHSL Salary 2026 – Pay Scale & Allowances',
  metaDescription: 'SSC CHSL 2026 salary structure for LDC, PA/SA, and DEO posts. Check pay level, basic pay, gross salary, allowances, and in-hand salary details.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC CHSL Salary 2026 – Complete Pay Scale, Allowances & In-Hand Salary',

  overview: `<p>Understanding the <strong>SSC CHSL 2026 salary structure</strong> helps candidates make informed career decisions and set realistic expectations. SSC CHSL posts are central government positions under the 7th Central Pay Commission (7th CPC), offering not just a competitive basic salary but a comprehensive package of allowances, benefits, and job security that private sector roles at similar qualification levels rarely match.</p>

<p>SSC CHSL recruits for three post categories, each at different pay levels. <strong>Lower Division Clerk (LDC) / Junior Secretariat Assistant (JSA)</strong> posts are at <strong>Pay Level 2</strong> with basic pay of ₹19,900–₹63,200 per month. <strong>Postal Assistant (PA) / Sorting Assistant (SA)</strong> and <strong>Data Entry Operator (DEO)</strong> posts are at <strong>Pay Level 4</strong> with basic pay of ₹25,500–₹81,100 per month. The difference in pay levels means a significant gap in starting gross salary — approximately ₹7,000–₹10,000 per month.</p>

<p>The <strong>gross monthly salary</strong> includes basic pay plus several allowances mandated by the central government. <strong>Dearness Allowance (DA)</strong> is currently approximately 50% of basic pay (revised biannually in January and July based on AICPI). <strong>House Rent Allowance (HRA)</strong> varies by city classification — 24% of basic pay for X-category cities (Delhi, Mumbai, Bangalore, etc.), 16% for Y-category cities, and 8% for Z-category cities. <strong>Transport Allowance (TPTA)</strong> provides ₹3,600 per month for X/Y cities and ₹1,350 for Z cities.</p>

<p>For an <strong>LDC posted in Delhi</strong> (X-city), the approximate monthly calculation is: Basic Pay ₹19,900 + DA (50%) ₹9,950 + HRA (24%) ₹4,776 + TPTA ₹3,600 = Gross ₹38,226. After deductions (NPS 10%, CGHS, etc.), the in-hand salary is approximately ₹28,000–₹30,000. For a <strong>PA/SA posted in Delhi</strong>: Basic Pay ₹25,500 + DA ₹12,750 + HRA ₹6,120 + TPTA ₹3,600 = Gross ₹47,970, with in-hand approximately ₹38,000–₹40,000.</p>

<p>Beyond the monthly salary, SSC CHSL employees receive several <strong>additional benefits</strong>: Children Education Allowance (₹2,250 per child per month for up to 2 children), Leave Travel Concession (LTC) for travel to hometown or anywhere in India, National Pension System (NPS) with 14% employer contribution, Medical Benefits under the Central Government Health Scheme (CGHS), Group Insurance Scheme, and Earned Leave encashment at the time of retirement. The government also provides festival advance, house building advance, and computer advance at concessional rates.</p>

<p><strong>Career progression</strong> for SSC CHSL employees follows the MACP (Modified Assured Career Progression) scheme, which grants three financial upgrades at 10, 20, and 30 years of service regardless of vacancy-based promotions. LDC employees can progress to UDC (Pay Level 4), then to Assistant (Pay Level 6) through departmental exams and seniority. PA/SA employees can progress to Inspector Posts and higher administrative positions. Many SSC CHSL recruits also appear for SSC CGL or other departmental exams to accelerate their career growth within the government system.</p>

<p>Comparing with private sector equivalents, a 12th-pass candidate in the private sector typically earns ₹12,000–₹18,000 per month without job security or benefits. The SSC CHSL package with all benefits, pension contribution, and job security makes the effective compensation 2–3 times higher than comparable private sector roles.</p>`,

  salary: {
    salaryMin: 19900,
    salaryMax: 81100,
    payLevels: 'Pay Level 2 to Pay Level 4',
    grossRange: '₹28,000 – ₹65,000 per month',
    netRange: '₹24,000 – ₹55,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – approximately 50% of basic pay, revised biannually',
      'House Rent Allowance (HRA) – 24% (X cities), 16% (Y cities), 8% (Z cities)',
      'Transport Allowance (TPTA) – ₹3,600 (X/Y cities), ₹1,350 (Z cities)',
      'Children Education Allowance – ₹2,250 per child per month (max 2 children)',
      'Leave Travel Concession (LTC) – travel to hometown or anywhere in India',
      'National Pension System (NPS) – 14% employer contribution',
      'Medical Benefits under CGHS – cashless treatment at empanelled hospitals',
    ],
    postWiseSalary: [
      { post: 'Lower Division Clerk (LDC) / JSA', payLevel: 'Level 2', basicPay: '₹19,900 – ₹63,200' },
      { post: 'Postal Assistant (PA) / Sorting Assistant', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Data Entry Operator (DEO)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Data Entry Operator (DEO Grade A)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
    ],
  },

  faqs: [
    { question: 'What is the starting salary for SSC CHSL LDC?', answer: 'SSC CHSL LDC/JSA starting basic pay is ₹19,900 (Pay Level 2). With all allowances in a metro city, the gross salary is approximately ₹38,000 and in-hand salary is ₹28,000–₹30,000.' },
    { question: 'What is the salary difference between LDC and PA/SA?', answer: 'PA/SA is at Pay Level 4 (₹25,500 basic) while LDC is at Pay Level 2 (₹19,900 basic). The monthly gross difference is approximately ₹8,000–₹10,000.' },
    { question: 'Do SSC CHSL employees get pension?', answer: 'SSC CHSL employees appointed after 2004 are covered under the National Pension System (NPS) with 14% employer contribution. The accumulated corpus provides pension after retirement.' },
    { question: 'What are the career growth opportunities after SSC CHSL?', answer: 'LDC can progress to UDC (Level 4), then Assistant (Level 6) through MACP and departmental exams. Many SSC CHSL recruits also clear SSC CGL for higher posts while in service.' },
    { question: 'Is HRA included in SSC CHSL salary?', answer: 'Yes, HRA is a major component — 24% of basic pay in X-category cities (Delhi, Mumbai, etc.), 16% in Y-category cities, and 8% in Z-category cities.' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC CHSL Eligibility 2026', href: '/ssc-chsl-2026-eligibility' },
    { label: 'SSC CGL Salary 2026', href: '/ssc-cgl-2026-salary' },
    { label: 'SSC MTS Salary 2026', href: '/ssc-mts-2026-salary' },
  ],
};

export const sscChslCutoff: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-cutoff',
  pageType: 'cutoff',
  metaTitle: 'SSC CHSL Cutoff 2026 — Category-Wise Cut Off Marks',
  metaDescription: 'SSC CHSL 2026 cutoff marks: category-wise Tier 1 cut off for General, OBC, SC, ST. Previous year cutoff trends from 2022–2024.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',

  h1: 'SSC CHSL Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',

  overview: `<p>The <strong>SSC CHSL Cutoff</strong> is the minimum qualifying score required to clear Tier 1 and advance to the Tier 2 Typing/Skill Test stage. Cutoff marks vary by category (General, OBC, SC, ST, EWS, PwBD) and are determined after normalisation of scores across multiple shifts. Understanding cutoff trends is essential for setting realistic preparation targets.</p>

<h3>SSC CHSL 2026 Expected Cutoff</h3>
<p>Based on analysis of previous years' trends, the expected Tier 1 cutoff for SSC CHSL 2026 is approximately:</p>
<ul>
<li><strong>General:</strong> 200–210 (normalised out of 200)</li>
<li><strong>OBC:</strong> 185–195</li>
<li><strong>SC:</strong> 170–180</li>
<li><strong>ST:</strong> 155–165</li>
</ul>
<p>The actual cutoff depends on several factors: number of vacancies, number of candidates appeared, difficulty level of the examination, and normalisation formula. SSC CHSL 2024 saw a significant increase in cutoff compared to 2023 due to higher competition and relatively easier paper.</p>

<h3>Cutoff Trend Analysis (2022–2024)</h3>
<p>The General category cutoff has shown a consistent upward trend: from 192.78 in 2022 to 197.56 in 2023 to 202.34 in 2024. This indicates increasing competition as more candidates prepare systematically. The gap between General and OBC cutoff has remained stable at approximately 15–16 marks, while the SC-ST gap is around 13 marks.</p>

<h3>Factors Affecting SSC CHSL Cutoff</h3>
<ul>
<li><strong>Number of Vacancies:</strong> More vacancies generally lead to lower cutoff. SSC CHSL typically recruits 3,000–5,000 candidates.</li>
<li><strong>Difficulty Level:</strong> Easier papers result in higher cutoffs as more candidates score well.</li>
<li><strong>Number of Candidates:</strong> SSC CHSL attracts 15–20 lakh candidates. Higher appearance pushes cutoff up.</li>
<li><strong>Normalisation:</strong> SSC applies normalisation across multiple shifts to ensure fairness, which can shift individual cutoffs.</li>
</ul>

<h3>Post-Wise Cutoff Variation</h3>
<p>SSC CHSL Tier 1 has a single cutoff for all posts (LDC/JSA, PA/SA, DEO). However, the final allocation cutoff varies — PA/SA posts typically require 5–10 marks higher than LDC/JSA due to higher demand and better pay scale. Candidates should aim for 10–15 marks above the expected cutoff to secure their preferred post.</p>

<p>For salary details of posts you qualify for, see our <a href="/ssc-chsl-2026-salary">SSC CHSL Salary 2026</a> page. To check your age eligibility, use our <a href="/govt-job-age-calculator">Age Calculator</a>.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '202.34', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '186.55', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '171.48', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '158.34', totalMarks: '200' },
    { year: 2024, category: 'EWS', cutoffScore: '195.20', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '197.56', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '181.20', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '166.02', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '153.45', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '192.78', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '177.10', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '162.15', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '148.92', totalMarks: '200' },
  ],

  faqs: [
    { question: 'What is the SSC CHSL 2026 expected cutoff?', answer: 'Based on previous trends, the expected General category Tier 1 cutoff is 200–210 marks out of 200 (normalised). OBC cutoff is expected around 185–195.' },
    { question: 'Is SSC CHSL cutoff increasing every year?', answer: 'Yes, the General category cutoff has increased from 192.78 (2022) to 202.34 (2024), showing a clear upward trend due to increasing competition.' },
    { question: 'What score should I target in SSC CHSL Tier 1?', answer: 'Aim for 140+ raw marks out of 200 to be safe across all categories. After normalisation, this typically translates to a comfortable qualifying score.' },
    { question: 'Does SSC CHSL have separate cutoff for each post?', answer: 'Tier 1 has a single qualifying cutoff. However, final allocation cutoff varies by post — PA/SA typically requires 5–10 marks higher than LDC/JSA.' },
    { question: 'How does normalisation affect SSC CHSL cutoff?', answer: 'SSC normalises scores across multiple shifts using a statistical formula. Your raw score is converted to a normalised score, which determines your rank and qualification.' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC CHSL Syllabus 2026', href: '/ssc-chsl-2026-syllabus' },
    { label: 'SSC CHSL Salary 2026', href: '/ssc-chsl-2026-salary' },
    { label: 'SSC CGL Cutoff 2026', href: '/ssc-cgl-2026-cutoff' },
  ],
};

export const sscChslAgeLimit: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-chsl-2026-age-limit',
  pageType: 'age-limit',
  metaTitle: 'SSC CHSL Age Limit 2026 — Post-Wise & Relaxation',
  metaDescription: 'SSC CHSL 2026 age limit: post-wise age requirements for LDC, PA/SA, DEO. Category-wise relaxation for SC/ST/OBC/PwD candidates.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',

  h1: 'SSC CHSL Age Limit 2026 — Post-Wise Requirements & Category Relaxation',

  overview: `<p>The <strong>SSC CHSL Age Limit</strong> is a critical eligibility criterion that differs by post. Since SSC CHSL recruits for LDC/JSA, PA/SA, and DEO posts with different age brackets, candidates must verify their eligibility carefully before applying. This page provides a complete breakdown of age limits and category-wise relaxation for SSC CHSL 2026.</p>

<h3>SSC CHSL 2026 Age Limit — Post-Wise Breakdown</h3>
<p>Age is calculated as on <strong>1st January 2026</strong>:</p>
<ul>
<li><strong>LDC/JSA & PA/SA:</strong> 18–27 years (born between 02-01-1999 and 01-01-2008)</li>
<li><strong>DEO:</strong> 18–25 years (born between 02-01-2001 and 01-01-2008)</li>
<li><strong>DEO (Grade A) in C&AG:</strong> 18–25 years</li>
</ul>

<h3>Category-Wise Age Relaxation</h3>
<p>The Government of India provides the following age relaxation on the upper age limit:</p>
<ul>
<li><strong>SC/ST:</strong> 5 years relaxation</li>
<li><strong>OBC (Non-Creamy Layer):</strong> 3 years relaxation</li>
<li><strong>PwBD (General):</strong> 10 years | PwBD (OBC): 13 years | PwBD (SC/ST): 15 years</li>
<li><strong>Ex-Servicemen:</strong> 3 years after deduction of military service rendered</li>
<li><strong>J&K Domicile (1980–1989):</strong> 5 years</li>
</ul>

<h3>Effective Upper Age Limit After Relaxation</h3>
<p>For LDC/JSA and PA/SA posts (base upper limit: 27 years):</p>
<ul>
<li><strong>General:</strong> 27 years | <strong>OBC:</strong> 30 years | <strong>SC/ST:</strong> 32 years</li>
<li><strong>PwBD (General):</strong> 37 years | <strong>PwBD (OBC):</strong> 40 years | <strong>PwBD (SC/ST):</strong> 42 years</li>
</ul>
<p>For DEO posts (base upper limit: 25 years):</p>
<ul>
<li><strong>General:</strong> 25 years | <strong>OBC:</strong> 28 years | <strong>SC/ST:</strong> 30 years</li>
</ul>

<h3>How to Calculate Your Eligibility</h3>
<ol>
<li>Note your date of birth from your 10th class certificate</li>
<li>Calculate your age on 1 January 2026</li>
<li>Check whether your age falls within the required range for your desired post</li>
<li>Add applicable category relaxation to the upper age limit</li>
</ol>
<p>For example, an OBC female candidate born on 15 June 1996 would be 29 years 6 months on 1 January 2026. With 3 years OBC relaxation on the 27-year limit, the effective upper limit is 30 years — so she IS eligible for LDC/PA posts.</p>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a> to instantly check your SSC CHSL eligibility with automatic category relaxation calculation.</p>

<h3>Important Notes</h3>
<ul>
<li>Age is strictly based on the date of birth in your matriculation (10th) certificate</li>
<li>No age relaxation is available for EWS category candidates</li>
<li>OBC candidates must have a valid non-creamy layer certificate</li>
<li>Age relaxation applies only to the upper age limit, not the minimum age of 18 years</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary (as on 01-01-2026)</h3>
<ul>
<li><strong>LDC/JSA & PA/SA:</strong> 18–27 years (General), 18–30 (OBC), 18–32 (SC/ST)</li>
<li><strong>DEO:</strong> 18–25 years (General), 18–28 (OBC), 18–30 (SC/ST)</li>
</ul>`,

  faqs: [
    { question: 'What is the age limit for SSC CHSL 2026?', answer: 'For LDC/JSA and PA/SA posts: 18–27 years. For DEO posts: 18–25 years. Age is calculated as on 1 January 2026.' },
    { question: 'Is there age relaxation for OBC in SSC CHSL?', answer: 'Yes, OBC (Non-Creamy Layer) candidates get 3 years relaxation on the upper age limit. So for LDC/PA posts, the effective limit is 30 years.' },
    { question: 'What is the maximum age for DEO in SSC CHSL?', answer: 'The upper age limit for DEO is 25 years for General category. With OBC relaxation it is 28, and with SC/ST relaxation it is 30 years.' },
    { question: 'Can I apply for SSC CHSL if I am 26 years old?', answer: 'Yes, 26-year-old General category candidates can apply for LDC/JSA and PA/SA posts (limit 27) but NOT for DEO posts (limit 25). OBC/SC/ST candidates have additional relaxation.' },
    { question: 'Is there age relaxation for EWS in SSC CHSL?', answer: 'No, EWS category candidates do not get age relaxation. They must meet the same age limits as General category candidates.' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC CHSL Eligibility 2026', href: '/ssc-chsl-2026-eligibility' },
    { label: 'SSC CHSL Salary 2026', href: '/ssc-chsl-2026-salary' },
    { label: 'SSC CGL Age Limit 2026', href: '/ssc-cgl-2026-age-limit' },
    { label: 'Age Calculator', href: '/govt-job-age-calculator' },
  ],
};

export const SSC_CHSL_CONFIGS: ExamAuthorityConfig[] = [
  sscChslNotification,
  sscChslSyllabus,
  sscChslExamPattern,
  sscChslEligibility,
  sscChslSalary,
  sscChslCutoff,
  sscChslAgeLimit,
];
