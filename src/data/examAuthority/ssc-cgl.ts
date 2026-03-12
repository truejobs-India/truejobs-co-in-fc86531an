import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'ssc-jobs' as const,
  examName: 'SSC CGL',
  examYear: 2026,
  conductingBody: 'Staff Selection Commission (SSC)',
  officialWebsite: 'https://ssc.gov.in',
};

export const sscCglNotification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-2026-notification',
  pageType: 'notification',
  metaTitle: 'SSC CGL 2026 Notification – Dates, Eligibility, Apply',
  metaDescription: 'SSC CGL 2026 notification released. Check exam dates, eligibility, application fee, vacancy details and apply online before the last date.',
  lastUpdated: '2026-03-07',
  datePublished: '2026-01-15',
  applicationEndDate: '2026-04-30',
  totalVacancies: 17727,
  applyLink: 'https://ssc.gov.in',
  notificationPdfUrl: 'https://ssc.gov.in/api/Notices',

  h1: 'SSC CGL 2026 Notification – Combined Graduate Level Examination',

  overview: `<p>The Staff Selection Commission (SSC) has officially released the <strong>SSC CGL 2026 Notification</strong> for the Combined Graduate Level Examination. This is one of the most competitive and sought-after government examinations in India, conducted annually to recruit staff for various Group B and Group C posts across central government ministries, departments, and organisations.</p>

<p>SSC CGL 2026 offers an excellent opportunity for graduates to secure prestigious government positions with attractive pay scales ranging from Pay Level 4 (₹25,500) to Pay Level 11 (₹67,700–₹1,51,100). The examination covers posts such as Tax Assistant, Auditor, Upper Division Clerk (UDC), Inspector (Central Excise/Preventive Officer/Examiner), Assistant Section Officer (ASO), and Statistical Investigator Grade-II, among others.</p>

<p>The total number of vacancies for SSC CGL 2026 is expected to be approximately <strong>17,727</strong>, covering multiple ministries including the Ministry of Finance, Ministry of Commerce, Comptroller & Auditor General of India (C&AG), Central Bureau of Investigation (CBI), and the Ministry of External Affairs. Candidates from all states and union territories across India are eligible to apply.</p>

<p>The examination follows a two-tier pattern: <strong>Tier 1 (Computer Based Examination)</strong> serves as the screening test with 100 questions carrying 200 marks across four sections — General Intelligence & Reasoning, General Awareness, Quantitative Aptitude, and English Comprehension. <strong>Tier 2 (Computer Based Examination)</strong> is the main examination comprising multiple papers including Quantitative Abilities, English Language & Comprehension, Statistics, and General Studies (Finance & Economics).</p>

<p>Candidates must hold a bachelor's degree from a recognised university or equivalent at the time of application. The age limit varies by post, with the general age bracket being 18–32 years for most positions, with relaxations applicable for SC/ST (5 years), OBC (3 years), and PwD candidates (up to 10 years) as per government norms.</p>

<p>The application process is entirely online through the SSC's official website. Candidates must register on the SSC portal, fill in personal and educational details, upload required documents (photograph, signature, and identity proof), and pay the application fee online. The application fee is ₹100 for General/OBC candidates, while female candidates and SC/ST/PwD/ESM candidates are exempted from payment.</p>

<p>This page provides comprehensive details about SSC CGL 2026 including important dates, eligibility criteria, exam pattern, syllabus overview, selection process, salary structure, and a step-by-step application guide. Bookmark this page for the latest updates as we track every official announcement from SSC.</p>`,

  dates: [
    { label: 'Notification Release Date', date: '2026-01-15' },
    { label: 'Online Application Start Date', date: '2026-02-01' },
    { label: 'Last Date to Apply Online', date: '2026-04-30' },
    { label: 'Last Date for Fee Payment', date: '2026-05-02' },
    { label: 'Application Correction Window', date: '2026-05-05 to 2026-05-10' },
    { label: 'Tier 1 Exam Date', date: '2026-07-15 to 2026-08-10' },
    { label: 'Tier 1 Result Date', date: '2026-09-15' },
    { label: 'Tier 2 Exam Date', date: '2026-11-20 to 2026-11-22' },
    { label: 'Final Result Date', date: 'To Be Announced' },
  ],

  eligibility: `<p>To be eligible for SSC CGL 2026, candidates must meet the following criteria:</p>
<h3>Educational Qualification</h3>
<ul>
<li><strong>Minimum Qualification:</strong> Bachelor's Degree from a recognised university or equivalent.</li>
<li><strong>Statistical Investigator Grade-II:</strong> Bachelor's Degree with Statistics as one of the subjects in graduation, OR Bachelor's Degree with Mathematics in Class 12 and Statistics as a paper in the final year.</li>
<li><strong>Compiler (in RGI):</strong> Bachelor's Degree with Economics or Statistics or Mathematics as a compulsory/elective subject.</li>
</ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul>
<li><strong>Group B Posts (ASO, Tax Assistant, etc.):</strong> 20–30 years</li>
<li><strong>Group C Posts (UDC, LDC, DEO):</strong> 18–27 years</li>
<li><strong>Inspector Posts:</strong> 18–30 years</li>
</ul>
<h3>Age Relaxation</h3>
<ul>
<li>SC/ST: 5 years</li>
<li>OBC (Non-Creamy Layer): 3 years</li>
<li>PwD (General): 10 years | PwD (OBC): 13 years | PwD (SC/ST): 15 years</li>
<li>Ex-Servicemen: 3 years after deduction of military service rendered</li>
</ul>
<p>Check your exact eligibility using our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a>.</p>`,

  feeStructure: {
    general: 100,
    obc: 100,
    scSt: 0,
    female: 0,
    ph: 0,
    paymentModes: ['Net Banking', 'Credit Card', 'Debit Card', 'UPI', 'SBI Challan'],
  },

  selectionProcess: [
    'Tier 1 – Computer Based Examination (Screening)',
    'Tier 2 – Computer Based Examination (Main)',
    'Document Verification',
    'Medical Examination',
    'Final Merit List based on Tier 2 score (normalised)',
  ],

  examPattern: [
    {
      stageName: 'Tier 1 – Computer Based Examination',
      rows: [
        { subject: 'General Intelligence & Reasoning', questions: 25, marks: 50, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English Comprehension', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Paper 1 (Compulsory for all posts)',
      rows: [
        { subject: 'Mathematical Abilities', questions: 30, marks: 90, duration: '60 min (Module I)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'Reasoning & General Intelligence', questions: 30, marks: 90, duration: '60 min (Module I)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'English Language & Comprehension', questions: 45, marks: 135, duration: '60 min (Module II)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 75, duration: '60 min (Module II)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'Computer Knowledge', questions: 20, marks: 60, duration: '15 min (Module III)', negativeMarking: '1.0 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Paper 2 (Statistics – for JSO only)',
      rows: [
        { subject: 'Statistics', questions: 100, marks: 200, duration: '120 min', negativeMarking: '0.50 per wrong answer' },
      ],
    },
  ],

  syllabusSummary: `<p>The SSC CGL syllabus covers a wide range of topics across Tier 1 and Tier 2. <strong>Tier 1</strong> tests fundamental aptitude across Reasoning (analogies, classification, coding-decoding, matrix, syllogism), Quantitative Aptitude (number systems, algebra, geometry, trigonometry, data interpretation), English (reading comprehension, cloze test, error spotting, synonyms/antonyms), and General Awareness (current affairs, history, geography, polity, economics, science).</p>
<p><strong>Tier 2</strong> covers advanced topics including Data Sufficiency, Mathematical Modelling, advanced English passages, and Computer Proficiency (MS Office, networking basics, database). For detailed topic-wise syllabus, see our <a href="/ssc-cgl-2026-syllabus">SSC CGL 2026 Syllabus</a> page.</p>`,

  salary: {
    salaryMin: 25500,
    salaryMax: 151100,
    payLevels: 'Pay Level 4 to Pay Level 11',
    grossRange: '₹35,000 – ₹1,80,000 per month',
    netRange: '₹30,000 – ₹1,50,000 per month (approx.)',
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
      { post: 'Upper Division Clerk (UDC)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Tax Assistant (CBDT/CBIC)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Auditor (C&AG/CGDA)', payLevel: 'Level 5', basicPay: '₹29,200 – ₹92,300' },
      { post: 'Sub-Inspector (CBI)', payLevel: 'Level 6', basicPay: '₹35,400 – ₹1,12,400' },
      { post: 'Inspector (Central Excise/Customs)', payLevel: 'Level 7', basicPay: '₹44,900 – ₹1,42,400' },
      { post: 'Assistant Section Officer (CSS)', payLevel: 'Level 8', basicPay: '₹47,600 – ₹1,51,100' },
      { post: 'Statistical Investigator Gr-II', payLevel: 'Level 8', basicPay: '₹47,600 – ₹1,51,100' },
      { post: 'Assistant Audit/Accounts Officer', payLevel: 'Level 8', basicPay: '₹47,600 – ₹1,51,100' },
    ],
  },

  howToApply: [
    'Visit the official SSC website at ssc.gov.in and navigate to the "Register/Login" section.',
    'If you are a new user, click "New User? Register Now" and complete one-time registration with your name, email, mobile number, and create a password.',
    'After registration, log in to the SSC portal and click on "Apply" next to the CGL 2026 notification.',
    'Fill in the application form with personal details (name, date of birth, category), educational qualifications, and examination preferences (centres, posts).',
    'Upload scanned copies of your recent passport-size photograph (20–50 KB, JPEG), signature (10–20 KB, JPEG), and a valid photo ID proof (100–300 KB, PDF).',
    'Pay the application fee of ₹100 via Net Banking, Credit/Debit Card, UPI, or SBI Challan. Female, SC, ST, PwD, and Ex-Servicemen candidates are exempted.',
    'Review all details carefully, submit the application, and download/print the confirmation page with your Registration ID for future reference.',
  ],

  faqs: [
    { question: 'When is the SSC CGL 2026 exam date?', answer: 'SSC CGL 2026 Tier 1 exam is scheduled from 15 July 2026 to 10 August 2026. Tier 2 is expected in November 2026.' },
    { question: 'What is the last date to apply for SSC CGL 2026?', answer: 'The last date to apply online for SSC CGL 2026 is 30 April 2026. Fee payment deadline is 2 May 2026.' },
    { question: 'What is the SSC CGL 2026 application fee?', answer: 'The application fee is ₹100 for General and OBC candidates. Female, SC, ST, PwD, and Ex-Servicemen candidates are exempted from the fee.' },
    { question: 'What is the minimum qualification for SSC CGL?', answer: 'A bachelor\'s degree from a recognised university is the minimum qualification. Some posts like Statistical Investigator require Statistics as a subject.' },
    { question: 'How many vacancies are there in SSC CGL 2026?', answer: 'SSC CGL 2026 is expected to have approximately 17,727 vacancies across various Group B and Group C posts.' },
    { question: 'Is there negative marking in SSC CGL?', answer: 'Yes, Tier 1 has 0.50 marks negative marking per wrong answer. Tier 2 has 1.0 mark negative marking per wrong answer.' },
  ],

  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ssc.gov.in',
    instructions: [
      'Visit ssc.gov.in and click on "Status/Download Admit Card" under the Candidate\'s Corner',
      'Select "Combined Graduate Level Examination 2026" from the exam list',
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
      'Tier 1 qualified candidates will be called for Tier 2 examination',
      'Final merit list is prepared based on normalised Tier 2 scores and uploaded to the official website',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '175.44', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '153.70', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '141.63', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '126.28', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '170.26', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '149.52', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '137.33', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '122.41', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '160.04', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '140.68', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '130.31', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '117.51', totalMarks: '200' },
  ],

  relatedExams: [
    { label: 'SSC CHSL 2026', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC MTS 2026', href: '/ssc-mts-2026-notification' },
    { label: 'SSC CPO 2026', href: '/ssc-cpo-2026-notification' },
    { label: 'SSC GD Constable 2026', href: '/ssc-gd-2026-notification' },
  ],
};

export const sscCglSyllabus: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-2026-syllabus',
  pageType: 'syllabus',
  metaTitle: 'SSC CGL Syllabus 2026 – Complete Topic-wise Guide',
  metaDescription: 'Complete SSC CGL 2026 syllabus for Tier 1 and Tier 2. Topic-wise breakdown of all subjects with weightage and preparation tips.',
  lastUpdated: '2026-03-05',
  datePublished: '2026-01-20',

  h1: 'SSC CGL Syllabus 2026 – Complete Topic-wise Breakdown for Tier 1 & Tier 2',

  overview: `<p>Understanding the <strong>SSC CGL 2026 syllabus</strong> in depth is the first and most critical step towards cracking this highly competitive examination. The Staff Selection Commission conducts the Combined Graduate Level Examination in two tiers, each testing different competencies and knowledge areas. A thorough understanding of the syllabus helps candidates prioritise topics, allocate study time efficiently, and avoid wasting effort on low-yield areas.</p>

<p>The <strong>Tier 1 syllabus</strong> covers four major sections: General Intelligence & Reasoning, General Awareness, Quantitative Aptitude, and English Comprehension. Each section carries 50 marks with 25 questions, making the total 200 marks to be completed in 60 minutes. This tier serves as a qualifying/screening stage, so candidates need to clear the sectional and overall cut-offs to advance to Tier 2.</p>

<p><strong>General Intelligence & Reasoning</strong> includes verbal and non-verbal reasoning topics such as Analogies, Classification, Coding-Decoding, Matrix, Paper Folding, Pattern Completion, Syllogism, Statement & Conclusion, Blood Relations, Direction Sense, and Order & Ranking. This section tests logical thinking and pattern recognition abilities.</p>

<p><strong>Quantitative Aptitude</strong> covers Number Systems, Percentage, Ratio & Proportion, Averages, Profit & Loss, Simple & Compound Interest, Time & Work, Time Speed & Distance, Algebra, Geometry, Mensuration, Trigonometry, and Data Interpretation (bar charts, pie charts, tables). Candidates should focus heavily on Arithmetic and Algebra as they carry the maximum weightage.</p>

<p><strong>English Comprehension</strong> tests Reading Comprehension, Cloze Test, Error Spotting, Sentence Improvement, Synonyms, Antonyms, Idioms & Phrases, One-word Substitution, Active/Passive Voice, Direct/Indirect Speech, and Spelling Errors. Regular reading and practice with previous year papers significantly improve performance in this section.</p>

<p><strong>General Awareness</strong> is the most dynamic section, covering Current Affairs (last 6 months), Indian History (Ancient, Medieval, Modern), Geography (Indian & World), Indian Polity & Governance, Economics (basic concepts, budget, five-year plans), General Science (Physics, Chemistry, Biology up to Class 10 level), and Static GK (awards, books, important dates, sports, organisations). This section requires consistent daily reading and revision.</p>

<p>The <strong>Tier 2 syllabus</strong> is divided into three modules within Paper 1 (compulsory for all posts) and a separate Paper 2 for Statistical Investigator and Compiler posts. Module I covers Mathematical Abilities (30 questions, 90 marks) and Reasoning & General Intelligence (30 questions, 90 marks). Module II tests English Language & Comprehension (45 questions, 135 marks) and General Awareness (25 questions, 75 marks). Module III covers Computer Knowledge (20 questions, 60 marks). Tier 2 mathematics goes deeper into topics like Data Sufficiency, Mathematical Modelling, and advanced Algebra compared to Tier 1.</p>

<p>For a strategic approach to preparation, candidates should complete the Tier 1 syllabus first as it forms the foundation, then progressively move to Tier 2 advanced topics. Previous year question papers from 2019–2025 are the best resource for understanding question patterns and difficulty levels. We recommend dedicating 4–6 months of focused preparation for Tier 1 and an additional 2–3 months for Tier 2.</p>`,

  examPattern: [
    {
      stageName: 'Tier 1 – Computer Based Examination',
      rows: [
        { subject: 'General Intelligence & Reasoning', questions: 25, marks: 50, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English Comprehension', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Paper 1 (Compulsory)',
      rows: [
        { subject: 'Mathematical Abilities', questions: 30, marks: 90, duration: '60 min (Module I)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'Reasoning & General Intelligence', questions: 30, marks: 90, duration: '60 min (Module I)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'English Language & Comprehension', questions: 45, marks: 135, duration: '60 min (Module II)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 75, duration: '60 min (Module II)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'Computer Knowledge', questions: 20, marks: 60, duration: '15 min (Module III)', negativeMarking: '1.0 per wrong answer' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC CGL 2026 Tier 1 syllabus?', answer: 'SSC CGL Tier 1 syllabus covers four sections: General Intelligence & Reasoning, General Awareness, Quantitative Aptitude, and English Comprehension. Each section has 25 questions carrying 50 marks.' },
    { question: 'Is the SSC CGL Tier 2 syllabus different from Tier 1?', answer: 'Yes, Tier 2 has advanced-level questions in Mathematics, Reasoning, English, General Awareness, and Computer Knowledge. The difficulty level is significantly higher than Tier 1.' },
    { question: 'Which subjects should I focus on for SSC CGL?', answer: 'Focus on Quantitative Aptitude and English as they carry the highest combined weightage in both tiers. General Awareness requires daily current affairs reading for at least 6 months before the exam.' },
    { question: 'How many months of preparation are needed for SSC CGL?', answer: 'Most successful candidates spend 6–8 months in focused preparation. Plan 4–6 months for Tier 1 and 2–3 months additional for Tier 2.' },
    { question: 'Are previous year papers important for SSC CGL preparation?', answer: 'Yes, solving previous year papers from 2019–2025 is one of the most effective preparation strategies. It helps understand question patterns, difficulty levels, and frequently tested topics.' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CGL Exam Pattern 2026', href: '/ssc-cgl-2026-exam-pattern' },
    { label: 'SSC CGL Salary 2026', href: '/ssc-cgl-2026-salary' },
    { label: 'SSC CHSL 2026 Syllabus', href: '/ssc-chsl-2026-syllabus' },
  ],
};

export const sscCglExamPattern: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-2026-exam-pattern',
  pageType: 'exam-pattern',
  metaTitle: 'SSC CGL Exam Pattern 2026 – Tier 1 & 2 Details',
  metaDescription: 'SSC CGL 2026 exam pattern for Tier 1 and Tier 2. Check marking scheme, number of questions, duration, negative marking and sectional details.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC CGL Exam Pattern 2026 – Complete Tier-wise Structure & Marking Scheme',

  overview: `<p>The <strong>SSC CGL 2026 exam pattern</strong> defines the structure, marking scheme, and time allocation for each stage of the Combined Graduate Level Examination. Understanding the exam pattern is essential for effective preparation strategy, time management during the exam, and maximising your score. The Staff Selection Commission revised the CGL exam pattern in 2022, and the current two-tier structure continues for 2026.</p>

<p>The examination consists of <strong>two computer-based tiers</strong>. Tier 1 is the screening stage — its marks are not counted in the final merit but candidates must clear cut-offs to qualify for Tier 2. Tier 2 is the main examination whose normalised score determines the final merit list and post allocation. This means your Tier 2 performance directly decides which post you receive.</p>

<p>In <strong>Tier 1</strong>, candidates face 100 objective-type multiple-choice questions (MCQs) carrying 200 marks. The four sections are General Intelligence & Reasoning (25 questions, 50 marks), General Awareness (25 questions, 50 marks), Quantitative Aptitude (25 questions, 50 marks), and English Comprehension (25 questions, 50 marks). The total time allowed is 60 minutes. For PwD candidates with certain disabilities, extra time of 20 minutes is provided. There is a negative marking of 0.50 marks for every incorrect answer, making accuracy crucial.</p>

<p>The <strong>Tier 2 Paper 1</strong> is compulsory for all posts and is divided into three sessions/modules. Session I (Module I) covers Mathematical Abilities (30 questions, 90 marks) and Reasoning & General Intelligence (30 questions, 90 marks) with 60 minutes duration. Session II (Module II) covers English Language & Comprehension (45 questions, 135 marks) and General Awareness (25 questions, 75 marks) with 60 minutes duration. Session III (Module III) covers Computer Knowledge Test (20 questions, 60 marks) with 15 minutes duration. The total Tier 2 Paper 1 carries 450 marks over 2 hours 15 minutes.</p>

<p><strong>Tier 2 Paper 2</strong> is only for candidates who apply for the post of Junior Statistical Officer (JSO). It consists of 100 questions on Statistics carrying 200 marks with a duration of 120 minutes. Negative marking in Tier 2 is 1.0 mark per wrong answer for Paper 1 and 0.50 marks per wrong answer for Paper 2.</p>

<p>Key strategic points for candidates: (1) In Tier 1, attempt accuracy is more important than completion since negative marking is steep relative to low marks per question; (2) In Tier 2, Module II (English + GA) carries the highest combined marks (210) — strong performance here often determines success; (3) The Computer Knowledge section in Module III is relatively easy and should be treated as a guaranteed score area; (4) For Tier 2, there is no sectional cut-off — only an overall cut-off applies, so candidates should maximise their strong sections.</p>

<p>The normalisation formula used by SSC adjusts for difficulty variations across different shifts. Candidates appearing in a relatively harder shift receive slightly adjusted scores. The normalised Tier 2 score is the sole basis for the final merit list. Understanding this helps candidates focus their entire preparation intensity on Tier 2 once they clear the Tier 1 cut-off.</p>`,

  examPattern: [
    {
      stageName: 'Tier 1 – Computer Based Examination',
      rows: [
        { subject: 'General Intelligence & Reasoning', questions: 25, marks: 50, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Quantitative Aptitude', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English Comprehension', questions: 25, marks: 50, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Paper 1 (Compulsory)',
      rows: [
        { subject: 'Mathematical Abilities', questions: 30, marks: 90, duration: '60 min (Module I)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'Reasoning & General Intelligence', questions: 30, marks: 90, duration: '60 min (Module I)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'English Language & Comprehension', questions: 45, marks: 135, duration: '60 min (Module II)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'General Awareness', questions: 25, marks: 75, duration: '60 min (Module II)', negativeMarking: '1.0 per wrong answer' },
        { subject: 'Computer Knowledge', questions: 20, marks: 60, duration: '15 min (Module III)', negativeMarking: '1.0 per wrong answer' },
      ],
    },
    {
      stageName: 'Tier 2 – Paper 2 (Statistics – JSO only)',
      rows: [
        { subject: 'Statistics', questions: 100, marks: 200, duration: '120 min', negativeMarking: '0.50 per wrong answer' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC CGL 2026 exam pattern?', answer: 'SSC CGL 2026 follows a two-tier pattern. Tier 1 has 100 questions (200 marks, 60 mins). Tier 2 Paper 1 has 150 questions (450 marks, 2 hrs 15 mins) across three modules.' },
    { question: 'Is there negative marking in SSC CGL 2026?', answer: 'Yes. Tier 1 has 0.50 marks negative marking per wrong answer. Tier 2 Paper 1 has 1.0 mark negative marking. Tier 2 Paper 2 (Statistics) has 0.50 marks negative marking.' },
    { question: 'How is the final merit list prepared for SSC CGL?', answer: 'The final merit list is based solely on the normalised Tier 2 score. Tier 1 marks are only used for screening/qualification purposes.' },
    { question: 'What is the total marks in SSC CGL Tier 2?', answer: 'Tier 2 Paper 1 carries 450 marks. Paper 2 (for JSO only) carries an additional 200 marks on Statistics.' },
    { question: 'How long is the SSC CGL exam?', answer: 'Tier 1 is 60 minutes. Tier 2 Paper 1 is 2 hours 15 minutes (across 3 sessions). Tier 2 Paper 2 is 2 hours.' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CGL Syllabus 2026', href: '/ssc-cgl-2026-syllabus' },
    { label: 'SSC CGL Eligibility 2026', href: '/ssc-cgl-2026-eligibility' },
    { label: 'SSC CHSL Exam Pattern 2026', href: '/ssc-chsl-2026-exam-pattern' },
  ],
};

export const sscCglEligibility: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-2026-eligibility',
  pageType: 'eligibility',
  metaTitle: 'SSC CGL Eligibility 2026 – Age, Qualification',
  metaDescription: 'SSC CGL 2026 eligibility criteria: age limit, educational qualification, nationality, and category-wise age relaxation. Check if you qualify.',
  lastUpdated: '2026-03-06',
  datePublished: '2026-01-20',

  h1: 'SSC CGL Eligibility Criteria 2026 – Qualification, Age Limit & Relaxation',

  overview: `<p>The <strong>SSC CGL 2026 eligibility criteria</strong> determine whether a candidate can apply for the Combined Graduate Level Examination conducted by the Staff Selection Commission. Meeting the eligibility requirements is mandatory — applications from ineligible candidates are summarily rejected, and even if a candidate clears the exam, appointment can be cancelled during document verification if eligibility is not met.</p>

<p>The eligibility criteria cover four main dimensions: <strong>nationality</strong>, <strong>educational qualification</strong>, <strong>age limit</strong>, and <strong>physical standards</strong> (for certain posts only). Each post under SSC CGL may have slightly different age limits and qualification requirements, so candidates must carefully check the specific posts they are applying for.</p>

<p><strong>Nationality:</strong> A candidate must be either (a) a citizen of India, or (b) a subject of Nepal/Bhutan, or (c) a Tibetan refugee who came over to India before 1st January 1962 with the intention of permanently settling in India, or (d) a person of Indian origin who has migrated from Pakistan, Burma, Sri Lanka, Kenya, Uganda, Tanzania, Zambia, Malawi, Zaire, Ethiopia, or Vietnam with the intention of permanently settling in India. Candidates in categories (b), (c), and (d) must possess an eligibility certificate issued by the Government of India.</p>

<p><strong>Educational Qualification:</strong> The minimum qualification is a bachelor's degree from a recognised university or institution. Candidates who are appearing in their final year/semester of graduation can also apply provisionally, provided they produce proof of passing the degree within the specified timeline (usually by a cut-off date mentioned in the notification). For specific posts like Statistical Investigator Grade-II, additional subject requirements apply — candidates need Statistics as one of the subjects in graduation. For the post of Compiler in the Registrar General of India (RGI), candidates need Economics, Statistics, or Mathematics as a compulsory or elective subject in graduation.</p>

<p><strong>Age Limit:</strong> The age is calculated as on 1st January 2026 (or the cut-off date mentioned in the notification). Different posts have different age ranges. For most Group C posts (UDC, LDC, DEO), the age range is 18–27 years. For Group B posts like Assistant Section Officer and Tax Assistant, it is 20–30 years. Inspector-level posts (Central Excise, Customs, CBI) have an age range of 18–30 years. The maximum age limit is the most critical factor, as the minimum age is usually easy to meet for graduate candidates.</p>

<p><strong>Age Relaxation:</strong> Category-wise age relaxation is provided as per government rules: SC/ST candidates get 5 years, OBC (Non-Creamy Layer) candidates get 3 years, PwD candidates get up to 10 years (General), 13 years (OBC), or 15 years (SC/ST). Ex-Servicemen receive 3 years relaxation after deduction of military service rendered. Government employees get up to 5 years relaxation (as per specific conditions). Widows, divorced women, and women judicially separated who are not remarried may get relaxation up to 35 years (General) or 40 years (SC/ST).</p>

<p><strong>Physical Standards:</strong> Certain posts like Inspector (Central Excise/Preventive Officer), Sub-Inspector in CBI, and Inspector of Posts require candidates to meet physical standards including minimum height and chest measurements. These standards differ for male and female candidates and vary by region (e.g., candidates from hill areas, tribal areas, and northeastern states may have relaxed standards). Detailed physical standards are specified in the official notification.</p>

<p>We strongly recommend using our <a href="/govt-job-age-calculator">Government Job Age Calculator</a> to check your exact age eligibility after applying all applicable relaxations. This tool accounts for category, disability status, ex-serviceman status, and the specific age cut-off date.</p>`,

  eligibility: `<h3>Educational Qualification by Post</h3>
<ul>
<li><strong>All Posts (General):</strong> Bachelor's Degree from a recognised university</li>
<li><strong>Statistical Investigator Grade-II:</strong> Bachelor's Degree with Statistics as one of the subjects; OR Mathematics in 12th + Statistics in final year</li>
<li><strong>Compiler (RGI):</strong> Bachelor's Degree with Economics/Statistics/Mathematics as compulsory or elective subject</li>
</ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul>
<li><strong>UDC, LDC, DEO, Court Clerk:</strong> 18–27 years</li>
<li><strong>Auditor, Accountant, Junior Accountant:</strong> 18–27 years</li>
<li><strong>Tax Assistant (CBDT/CBIC):</strong> 18–27 years</li>
<li><strong>ASO (CSS/MEA/AFHQ), Assistant (CSSS/IB):</strong> 20–30 years</li>
<li><strong>Inspector (Central Excise/Customs/Preventive Officer):</strong> 18–30 years</li>
<li><strong>Sub-Inspector (CBI):</strong> 20–30 years</li>
<li><strong>Statistical Investigator Grade-II:</strong> 20–30 years</li>
</ul>
<p>Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify your eligibility with applicable relaxations.</p>`,

  faqs: [
    { question: 'What is the minimum qualification for SSC CGL 2026?', answer: 'A bachelor\'s degree from a recognised university is the minimum qualification for most SSC CGL posts. Some posts like Statistical Investigator require specific subjects (Statistics) in graduation.' },
    { question: 'What is the age limit for SSC CGL 2026?', answer: 'The age limit varies by post: 18–27 years for Group C posts (UDC, Tax Assistant), 20–30 years for Group B posts (ASO, Inspector). Age relaxation applies for SC/ST (5 years), OBC (3 years), and PwD (up to 10 years).' },
    { question: 'Can final year students apply for SSC CGL?', answer: 'Yes, candidates appearing in their final year of graduation can apply provisionally. They must produce the degree certificate by the cut-off date mentioned in the notification.' },
    { question: 'Is there any physical test in SSC CGL?', answer: 'Physical standards (height, chest) are required for certain posts like Inspector of Central Excise, Sub-Inspector in CBI, and Inspector of Posts. Most clerical posts do not require physical tests.' },
    { question: 'Can OBC candidates get age relaxation in SSC CGL?', answer: 'Yes, OBC (Non-Creamy Layer) candidates get 3 years age relaxation. They must possess a valid OBC NCL certificate issued within the specified validity period.' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CGL Syllabus 2026', href: '/ssc-cgl-2026-syllabus' },
    { label: 'SSC CGL Salary 2026', href: '/ssc-cgl-2026-salary' },
    { label: 'SSC CHSL Eligibility 2026', href: '/ssc-chsl-2026-eligibility' },
  ],
};

export const sscCglSalary: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-2026-salary',
  pageType: 'salary',
  metaTitle: 'SSC CGL Salary 2026 – Pay Scale, In-Hand, Perks',
  metaDescription: 'SSC CGL 2026 salary details: post-wise pay level, basic pay, in-hand salary, allowances (DA, HRA, TA), and perks for all CGL posts.',
  lastUpdated: '2026-03-03',
  datePublished: '2026-01-25',

  h1: 'SSC CGL Salary 2026 – Post-wise Pay Scale, In-Hand Salary & Benefits',

  overview: `<p>The <strong>SSC CGL salary structure</strong> is one of the most attractive aspects of government employment through the Combined Graduate Level Examination. Posts under SSC CGL span Pay Levels 4 through 11 of the 7th Central Pay Commission (7th CPC), with basic pay ranging from ₹25,500 to ₹1,51,100 per month. When combined with Dearness Allowance, House Rent Allowance, Transport Allowance, and other benefits, the total in-hand salary for SSC CGL posts ranges approximately from ₹30,000 to ₹1,50,000 per month depending on the post and posting location.</p>

<p>Understanding the salary structure is crucial for aspirants to set realistic career expectations and choose their post preferences wisely. The pay structure under the 7th CPC consists of the <strong>Basic Pay</strong> (fixed amount based on Pay Level), <strong>Dearness Allowance (DA)</strong> which is revised twice a year (currently around 50% of basic pay), <strong>House Rent Allowance (HRA)</strong> which ranges from 8% to 24% of basic pay depending on the city classification (X, Y, or Z category), and <strong>Transport Allowance</strong>.</p>

<p>At the entry level, posts like <strong>Upper Division Clerk (UDC)</strong> and <strong>Tax Assistant</strong> fall under Pay Level 4 with a basic pay of ₹25,500. With DA (≈50%) and HRA (8–24%), the gross monthly salary for these posts starts at approximately ₹35,000–₹42,000. The in-hand salary after deductions (Income Tax, NPS contribution, CGHS) is around ₹30,000–₹37,000 for X-category cities like Delhi, Mumbai, and Kolkata.</p>

<p><strong>Auditor and Accountant</strong> posts under C&AG and CGDA fall under Pay Level 5 with a basic pay of ₹29,200. These posts offer slightly higher starting salaries of approximately ₹40,000–₹48,000 gross and ₹34,000–₹42,000 in-hand. Many candidates prefer these posts due to the relatively better pay-to-work-life balance ratio.</p>

<p>The mid-range posts like <strong>Sub-Inspector (CBI)</strong> and <strong>Divisional Accountant</strong> are placed at Pay Level 6 with a basic pay of ₹35,400. The gross salary starts at approximately ₹50,000–₹58,000 with in-hand of ₹42,000–₹50,000. These posts also carry additional prestige and career growth opportunities.</p>

<p>The highest-paying CGL posts are <strong>Assistant Section Officer (CSS/MEA)</strong>, <strong>Assistant Audit/Accounts Officer</strong>, and <strong>Statistical Investigator Grade-II</strong>, all placed at Pay Level 7–8 with basic pay of ₹44,900–₹47,600. These positions offer gross salaries of ₹65,000–₹80,000 and in-hand salaries of ₹55,000–₹70,000 at the entry level. With promotions and increments, officers at these levels can reach Pay Level 11–12 within 8–12 years of service.</p>

<p>Beyond the monthly salary, SSC CGL posts come with significant <strong>non-monetary benefits</strong>: government accommodation or HRA, comprehensive medical coverage under CGHS (Central Government Health Scheme), Leave Travel Concession (LTC) for domestic/international travel, children's education allowance, subsidised canteen facilities, and a generous pension through the National Pension System (NPS) with 14% employer contribution. These benefits often add 25–40% to the effective compensation package.</p>

<p>For a personalised calculation of your expected in-hand salary based on specific post, city, and category, use our <a href="/govt-salary-calculator">Government Salary Calculator</a>.</p>`,

  salary: {
    salaryMin: 25500,
    salaryMax: 151100,
    payLevels: 'Pay Level 4 to Pay Level 11',
    grossRange: '₹35,000 – ₹1,80,000 per month',
    netRange: '₹30,000 – ₹1,50,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – currently ~50% of basic pay, revised biannually (Jan & Jul)',
      'House Rent Allowance (HRA) – 24% (X cities: Delhi, Mumbai), 16% (Y cities), 8% (Z cities)',
      'Transport Allowance (TPTA) – ₹3,600/month for X/Y cities, ₹1,800 for Z cities',
      'Children Education Allowance – ₹2,250/month per child (max 2 children)',
      'Leave Travel Concession (LTC) – travel reimbursement for home town/anywhere in India',
      'National Pension System (NPS) – 14% employer contribution on basic + DA',
      'Medical Benefits – free treatment under CGHS at government hospitals and empanelled facilities',
      'Group Insurance – ₹5 lakh coverage under CGEIS',
    ],
    postWiseSalary: [
      { post: 'Upper Division Clerk (UDC)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Tax Assistant (CBDT/CBIC)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Sub-Inspector (NIA)', payLevel: 'Level 4', basicPay: '₹25,500 – ₹81,100' },
      { post: 'Auditor (C&AG/CGDA)', payLevel: 'Level 5', basicPay: '₹29,200 – ₹92,300' },
      { post: 'Accountant (CAG)', payLevel: 'Level 5', basicPay: '₹29,200 – ₹92,300' },
      { post: 'Sub-Inspector (CBI)', payLevel: 'Level 6', basicPay: '₹35,400 – ₹1,12,400' },
      { post: 'Divisional Accountant', payLevel: 'Level 6', basicPay: '₹35,400 – ₹1,12,400' },
      { post: 'Inspector (Central Excise/Customs)', payLevel: 'Level 7', basicPay: '₹44,900 – ₹1,42,400' },
      { post: 'Inspector of Posts', payLevel: 'Level 7', basicPay: '₹44,900 – ₹1,42,400' },
      { post: 'Assistant Section Officer (CSS)', payLevel: 'Level 8', basicPay: '₹47,600 – ₹1,51,100' },
      { post: 'Assistant Audit/Accounts Officer', payLevel: 'Level 8', basicPay: '₹47,600 – ₹1,51,100' },
      { post: 'Statistical Investigator Grade-II', payLevel: 'Level 8', basicPay: '₹47,600 – ₹1,51,100' },
    ],
  },

  faqs: [
    { question: 'What is the starting salary for SSC CGL posts?', answer: 'The starting basic pay ranges from ₹25,500 (Pay Level 4 for UDC/Tax Assistant) to ₹47,600 (Pay Level 8 for ASO/AAO). With DA and HRA, the in-hand salary starts at ₹30,000–₹70,000 depending on the post and city.' },
    { question: 'Which SSC CGL post has the highest salary?', answer: 'Assistant Section Officer (CSS), Assistant Audit Officer, and Statistical Investigator Grade-II have the highest starting salary at Pay Level 8 (₹47,600 basic). Inspector posts at Level 7 (₹44,900) are the next highest.' },
    { question: 'Does SSC CGL salary increase with experience?', answer: 'Yes, government employees receive annual increments of 3% on basic pay plus regular promotions. DA is revised biannually. With promotions, CGL officers can reach Pay Level 11–12 within 8–12 years.' },
    { question: 'What allowances do SSC CGL employees get?', answer: 'Major allowances include DA (≈50% of basic), HRA (8–24% of basic), Transport Allowance, Children Education Allowance, LTC, NPS (14% employer contribution), and CGHS medical benefits.' },
    { question: 'How much is the in-hand salary for Tax Assistant after SSC CGL?', answer: 'Tax Assistant at Pay Level 4 (₹25,500 basic) receives approximately ₹35,000–₹42,000 gross salary. After deductions (NPS, income tax), the in-hand salary is around ₹30,000–₹37,000 depending on the posting city.' },
    { question: 'Is SSC CGL salary the same in all cities?', answer: 'No, the basic pay and DA are same everywhere, but HRA varies: 24% in X cities (Delhi, Mumbai, Bangalore, etc.), 16% in Y cities (state capitals, large cities), and 8% in Z cities (smaller cities/towns).' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CGL Exam Pattern 2026', href: '/ssc-cgl-2026-exam-pattern' },
    { label: 'SSC CGL Eligibility 2026', href: '/ssc-cgl-2026-eligibility' },
    { label: 'SSC CHSL Salary 2026', href: '/ssc-chsl-2026-salary' },
  ],
};

const sscCglCutoff: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-cutoff',
  pageType: 'cutoff',
  metaTitle: 'SSC CGL Cutoff 2026 — Category-Wise Cut Off Marks',
  metaDescription: 'SSC CGL cutoff 2026: Category-wise cut off marks for Tier 1 & 2. Previous year cutoffs from 2022-2024 with trend analysis.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',

  h1: 'SSC CGL Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',

  overview: `<p>The <strong>SSC CGL Cutoff</strong> is one of the most searched topics among government exam aspirants, as it directly determines who qualifies for the next selection stage. The cutoff marks for SSC CGL are released separately for Tier 1 (screening) and Tier 2 (final merit). Understanding cutoff trends helps candidates set realistic preparation targets and allocate study time to high-impact areas.</p>

<p>SSC CGL cutoff scores vary significantly by category — General, OBC, SC, ST, EWS, and PwBD. The Staff Selection Commission applies normalisation across multiple shifts to ensure fairness, converting raw scores into normalised scores before determining cutoffs. This means the cutoff you see is not based on raw marks but on the normalised score, which accounts for difficulty variations between shifts.</p>

<h3>How SSC CGL Cutoff Is Determined</h3>
<p>The SSC CGL cutoff depends on several key factors:</p>
<ul>
<li><strong>Number of Vacancies:</strong> Higher vacancies generally lead to lower cutoffs, as more candidates can be accommodated. SSC CGL 2026 has approximately 17,727 vacancies.</li>
<li><strong>Number of Candidates:</strong> More applicants typically push cutoffs higher due to increased competition.</li>
<li><strong>Difficulty Level:</strong> Easier papers result in higher cutoffs because more candidates score well. SSC applies normalisation to balance difficulty across shifts.</li>
<li><strong>Post Preferences:</strong> Different posts have different cutoffs — Inspector-level posts (Level 7) have higher cutoffs than UDC posts (Level 4).</li>
</ul>

<h3>SSC CGL Cutoff Trend Analysis (2022–2024)</h3>
<p>Over the past three years, SSC CGL Tier 1 cutoffs have shown a gradual upward trend for General category candidates, rising from 160.04 in 2022 to 175.44 in 2024 — an increase of over 15 marks. This trend reflects both increasing competition and improvements in candidate preparation quality. OBC cutoffs have similarly risen from 140.68 to 153.70 over the same period.</p>

<p>For SC and ST categories, the upward trend is less steep but still noticeable. SC cutoffs increased from 130.31 (2022) to 141.63 (2024), while ST cutoffs moved from 117.51 to 126.28. This data suggests that all categories are becoming more competitive, reinforcing the need for thorough preparation.</p>

<h3>Expected SSC CGL 2026 Cutoff</h3>
<p>Based on the 3-year trend analysis, SSC CGL 2026 Tier 1 cutoff for General category is expected to be in the range of <strong>178–185 marks out of 200</strong>. However, the actual cutoff will depend on the final vacancy count, number of applicants, and exam difficulty. Candidates should aim for a score of 180+ to be safely above the expected cutoff for most posts.</p>

<p>For detailed post-wise cutoffs and Tier 2 cutoff analysis, refer to the tables below. We update this page immediately after SSC releases official cutoff data.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '175.44', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '153.70', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '141.63', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '126.28', totalMarks: '200' },
    { year: 2024, category: 'EWS', cutoffScore: '165.12', totalMarks: '200' },
    { year: 2024, category: 'PwBD', cutoffScore: '110.50', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '170.26', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '149.52', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '137.33', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '122.41', totalMarks: '200' },
    { year: 2023, category: 'EWS', cutoffScore: '160.88', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '160.04', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '140.68', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '130.31', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '117.51', totalMarks: '200' },
    { year: 2022, category: 'EWS', cutoffScore: '150.22', totalMarks: '200' },
  ],

  faqs: [
    { question: 'What is the expected SSC CGL 2026 Tier 1 cutoff?', answer: 'Based on the 2022–2024 trend, the SSC CGL 2026 Tier 1 cutoff for General category is expected to be around 178–185 marks out of 200. Actual cutoff depends on vacancies, applicants, and difficulty.' },
    { question: 'Does SSC CGL apply normalisation to cutoffs?', answer: 'Yes, SSC applies normalisation across multiple exam shifts to account for difficulty variations. Cutoff scores are based on normalised marks, not raw scores.' },
    { question: 'Are SSC CGL cutoffs different for different posts?', answer: 'Yes, post-wise cutoffs vary. Inspector-level posts (Level 7) typically have higher cutoffs than UDC or Tax Assistant posts (Level 4).' },
    { question: 'How can I check my SSC CGL score?', answer: 'SSC releases individual score cards on its official website after result declaration. Log in with your Registration ID and date of birth to download your score card.' },
    { question: 'Is SSC CGL cutoff increasing every year?', answer: 'Yes, the General category cutoff has risen from 160.04 (2022) to 175.44 (2024) — a 15-mark increase over 3 years, reflecting growing competition.' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CGL Syllabus 2026', href: '/ssc-cgl-2026-syllabus' },
    { label: 'SSC CGL Exam Pattern 2026', href: '/ssc-cgl-2026-exam-pattern' },
    { label: 'SSC CGL Previous Year Papers', href: '/ssc-cgl-previous-year-paper' },
    { label: 'SSC CGL Salary 2026', href: '/ssc-cgl-2026-salary' },
  ],
};

const sscCglAgeLimit: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cgl-age-limit',
  pageType: 'age-limit',
  metaTitle: 'SSC CGL Age Limit 2026 — Post-Wise & Relaxation',
  metaDescription: 'SSC CGL 2026 age limit: post-wise age requirements, category-wise relaxation for SC/ST/OBC/PwD, and how to calculate your eligibility.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',

  h1: 'SSC CGL Age Limit 2026 — Post-Wise Requirements & Category Relaxation',

  overview: `<p>The <strong>SSC CGL Age Limit</strong> is a crucial eligibility criterion that varies by post. Many candidates are confused about whether they qualify because SSC CGL recruits for multiple posts with different age brackets. This page provides a comprehensive, post-wise breakdown of age limits along with category-wise relaxation details to help you determine your exact eligibility.</p>

<h3>SSC CGL 2026 Age Limit — Post-Wise Breakdown</h3>
<p>The age limit for SSC CGL 2026 is calculated as on <strong>1st January 2026</strong>. Different posts have different upper age limits:</p>
<ul>
<li><strong>18–27 years:</strong> Lower Division Clerk (LDC), Data Entry Operator (DEO), Postal Assistant/Sorting Assistant</li>
<li><strong>20–30 years:</strong> Tax Assistant (CBDT/CBIC), Auditor (C&AG/CGDA), Sub-Inspector (CBI), Upper Division Clerk (UDC)</li>
<li><strong>18–30 years:</strong> Inspector (Central Excise), Inspector (Preventive Officer), Inspector (Examiner)</li>
<li><strong>20–30 years:</strong> Assistant Section Officer (CSS), Statistical Investigator Grade-II</li>
<li><strong>18–32 years:</strong> Assistant Audit Officer, Assistant Accounts Officer</li>
</ul>

<h3>Category-Wise Age Relaxation</h3>
<p>The Government of India provides age relaxation for reserved categories as per established norms:</p>
<ul>
<li><strong>SC/ST:</strong> 5 years relaxation on the upper age limit</li>
<li><strong>OBC (Non-Creamy Layer):</strong> 3 years relaxation</li>
<li><strong>PwBD (General):</strong> 10 years | PwBD (OBC): 13 years | PwBD (SC/ST): 15 years</li>
<li><strong>Ex-Servicemen:</strong> 3 years after deduction of military service rendered (minimum 6 months)</li>
<li><strong>J&K Domicile (1980–1989):</strong> 5 years</li>
<li><strong>Defence Personnel disabled in operations:</strong> 3 years (General), 6 years (OBC), 8 years (SC/ST)</li>
</ul>

<h3>How to Calculate Your SSC CGL Age Eligibility</h3>
<p>To determine if you are eligible, calculate your age as on 1st January 2026:</p>
<ol>
<li>Note your date of birth from your 10th class certificate (this is the official DOB used by SSC)</li>
<li>Calculate your age on 1 January 2026</li>
<li>Check whether your age falls within the required range for your desired post</li>
<li>If you belong to a reserved category, add the applicable relaxation to the upper age limit</li>
</ol>
<p>For example, if you are a General category candidate born on 15 March 1996, your age on 1 January 2026 is 29 years 9 months. You would be eligible for posts with a 30-year upper limit (Inspector, ASO) but NOT for posts with a 27-year limit (LDC, DEO).</p>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a> to instantly check your eligibility for any SSC CGL post with automatic category relaxation calculation.</p>

<h3>Important Notes on SSC CGL Age Limit</h3>
<ul>
<li>Age is calculated based on the date of birth mentioned in your matriculation (10th) certificate — not Aadhaar or any other document</li>
<li>OBC candidates must have a valid non-creamy layer certificate issued after 1 April of the previous financial year</li>
<li>PwBD candidates must have a disability certificate showing minimum 40% disability from a competent medical authority</li>
<li>Age relaxation is applicable only on the upper age limit, not the minimum age</li>
<li>There is no age relaxation for EWS category candidates</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary (as on 01-01-2026)</h3>
<ul>
<li><strong>Group B Posts (ASO, Tax Assistant, Inspector):</strong> 20–30 years (General), 23–33 (OBC), 25–35 (SC/ST)</li>
<li><strong>Group C Posts (UDC, LDC, DEO):</strong> 18–27 years (General), 21–30 (OBC), 23–32 (SC/ST)</li>
<li><strong>AAO/AAuO Posts:</strong> 18–32 years (General), 21–35 (OBC), 23–37 (SC/ST)</li>
</ul>`,

  faqs: [
    { question: 'What is the age limit for SSC CGL 2026?', answer: 'The age limit varies by post: 18-27 for LDC/DEO, 20-30 for Inspector/ASO/Tax Assistant, and 18-32 for AAO posts. Age is calculated as on 1 January 2026.' },
    { question: 'Is there age relaxation for OBC in SSC CGL?', answer: 'Yes, OBC (Non-Creamy Layer) candidates get 3 years relaxation on the upper age limit. So for a 30-year limit post, OBC candidates can apply up to 33 years.' },
    { question: 'How is age calculated for SSC CGL?', answer: 'Age is calculated as on 1st January 2026 based on the date of birth in your 10th class (matriculation) certificate. No other document is accepted for DOB verification.' },
    { question: 'Can I apply for SSC CGL if I am 31 years old (General)?', answer: 'General category candidates aged 31 can apply only for AAO/AAuO posts (upper limit 32). For most other posts, the upper limit is 27 or 30 years.' },
    { question: 'Is there age relaxation for EWS in SSC CGL?', answer: 'No, there is no age relaxation for EWS (Economically Weaker Section) category. EWS candidates must meet the same age limits as General category candidates.' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CGL Eligibility 2026', href: '/ssc-cgl-2026-eligibility' },
    { label: 'SSC CGL Cutoff', href: '/ssc-cgl-cutoff' },
    { label: 'SSC CGL Salary 2026', href: '/ssc-cgl-2026-salary' },
    { label: 'Age Calculator', href: '/govt-job-age-calculator' },
  ],
};

export const SSC_CGL_CONFIGS = [
  sscCglNotification,
  sscCglSyllabus,
  sscCglExamPattern,
  sscCglEligibility,
  sscCglSalary,
  sscCglCutoff,
  sscCglAgeLimit,
];
