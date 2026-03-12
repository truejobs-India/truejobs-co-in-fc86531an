import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'ssc-jobs' as const,
  examName: 'SSC MTS',
  examYear: 2026,
  conductingBody: 'Staff Selection Commission (SSC)',
  officialWebsite: 'https://ssc.gov.in',
};

export const sscMtsNotification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-2026-notification',
  pageType: 'notification',
  metaTitle: 'SSC MTS 2026 Notification – Dates & Apply Online',
  metaDescription: 'SSC MTS 2026 notification released. Check exam dates, eligibility, application fee, vacancy details and apply online for Multi Tasking Staff posts.',
  lastUpdated: '2026-03-07',
  datePublished: '2026-01-15',
  applicationEndDate: '2026-05-20',
  applyLink: 'https://ssc.gov.in',

  h1: 'SSC MTS 2026 Notification – Multi Tasking Staff Recruitment',

  overview: `<p>The Staff Selection Commission (SSC) has released the <strong>SSC MTS 2026 Notification</strong> for the Multi Tasking (Non-Technical) Staff Examination. SSC MTS is one of the most accessible government exams in India, requiring only a 10th-pass qualification and offering permanent central government positions with comprehensive benefits and job security.</p>

<p>SSC MTS 2026 recruits candidates for <strong>Group C non-gazetted, non-ministerial posts</strong> in various central government ministries, departments, and offices. The posts include Peon, Daftary, Jamadar, Junior Gestetner Operator, Chowkidar, Safaiwala, and Mali. These positions involve general office maintenance, cleanliness, running errands, photocopying, carrying files, and other support tasks essential for smooth government office functioning.</p>

<p>The exact number of SSC MTS 2026 vacancies will be announced with the detailed notification. SSC MTS typically recruits 5,000–10,000 candidates annually, with vacancies distributed across multiple central government organisations throughout India. The recruitment is open to candidates from all states and union territories.</p>

<p>The examination follows a two-stage pattern. <strong>Session 1</strong> is a Computer Based Examination with 40 Numerical & Mathematical Ability questions (60 marks) and 40 Reasoning Ability & Problem Solving questions (60 marks), totalling 80 questions carrying 120 marks in 45 minutes. <strong>Session 2</strong> tests English Language & Comprehension and General Awareness, with 50 questions carrying 75 marks in 45 minutes. There is no negative marking in SSC MTS, which is a significant advantage compared to other SSC exams.</p>

<p>The minimum educational qualification is <strong>10th Standard pass or equivalent</strong>. The age limit is <strong>18–25 years</strong> for General category with standard relaxations for SC/ST (5 years), OBC (3 years), and PwD (10 years). Unlike SSC GD, there are no physical standards for MTS posts as these are desk-based support roles.</p>

<p>The application process is online through ssc.gov.in. The application fee is ₹100 for General/OBC candidates, with exemption for female, SC, ST, PwD, and Ex-Servicemen candidates. Candidates must complete registration, fill application details, upload documents, and pay the fee before the deadline.</p>

<p>This page covers all essential information about SSC MTS 2026 including important dates, eligibility, exam pattern, syllabus, salary structure, and application procedure. Bookmark for latest updates.</p>`,

  dates: [
    { label: 'Notification Release Date', date: '2026-01-15' },
    { label: 'Online Application Start Date', date: '2026-02-20' },
    { label: 'Last Date to Apply Online', date: '2026-05-20' },
    { label: 'Last Date for Fee Payment', date: '2026-05-22' },
    { label: 'Session 1 Exam Date', date: '2026-08-15 to 2026-09-10' },
    { label: 'Session 2 Exam Date', date: '2026-08-15 to 2026-09-10' },
    { label: 'Result Date', date: 'To Be Announced' },
  ],

  eligibility: `<p>SSC MTS 2026 eligibility:</p>
<h3>Educational Qualification</h3>
<ul><li>10th Standard (Matriculation) pass or equivalent from a recognised Board</li></ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul><li>18–25 years (General) | 18–28 years (OBC) | 18–30 years (SC/ST)</li></ul>
<h3>Age Relaxation</h3>
<ul>
<li>SC/ST: 5 years | OBC (NCL): 3 years</li>
<li>PwD: 10 years (Gen) / 13 years (OBC) / 15 years (SC/ST)</li>
<li>Ex-Servicemen: 3 years after deduction of military service</li>
</ul>`,

  feeStructure: {
    general: 100,
    obc: 100,
    scSt: 0,
    female: 0,
    ph: 0,
    paymentModes: ['Net Banking', 'Credit Card', 'Debit Card', 'UPI', 'SBI Challan'],
  },

  selectionProcess: [
    'Session 1 – Computer Based Examination (Numerical & Reasoning)',
    'Session 2 – Computer Based Examination (English & GK)',
    'Document Verification',
    'Medical Examination',
    'Final Merit List based on combined Session 1 + Session 2 score',
  ],

  examPattern: [
    {
      stageName: 'Session 1 (45 minutes)',
      rows: [
        { subject: 'Numerical & Mathematical Ability', questions: 40, marks: 60, duration: '45 min (combined)', negativeMarking: 'No negative marking' },
        { subject: 'Reasoning Ability & Problem Solving', questions: 40, marks: 60, duration: '—', negativeMarking: 'No negative marking' },
      ],
    },
    {
      stageName: 'Session 2 (45 minutes)',
      rows: [
        { subject: 'English Language & Comprehension', questions: 25, marks: 37.5, duration: '45 min (combined)', negativeMarking: 'No negative marking' },
        { subject: 'General Awareness', questions: 25, marks: 37.5, duration: '—', negativeMarking: 'No negative marking' },
      ],
    },
  ],

  syllabusSummary: `<p>SSC MTS syllabus covers Numerical Ability (basic arithmetic, percentage, ratio, time & work), Reasoning (analogies, series, coding, classification, Venn diagrams), English (comprehension, grammar, vocabulary), and General Awareness (current affairs, history, geography, polity, science). All at 10th standard level. See <a href="/ssc-mts-2026-syllabus">SSC MTS 2026 Syllabus</a> for details.</p>`,

  salary: {
    salaryMin: 18000,
    salaryMax: 56900,
    payLevels: 'Pay Level 1',
    grossRange: '₹22,000 – ₹35,000 per month',
    netRange: '₹18,000 – ₹28,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – revised biannually',
      'House Rent Allowance (HRA) – 8% to 24% based on city',
      'Transport Allowance (TPTA)',
      'National Pension System (NPS) – 14% employer contribution',
      'Medical Benefits under CGHS',
    ],
    postWiseSalary: [
      { post: 'Multi Tasking Staff (MTS)', payLevel: 'Level 1', basicPay: '₹18,000 – ₹56,900' },
      { post: 'Peon / Daftary / Jamadar', payLevel: 'Level 1', basicPay: '₹18,000 – ₹56,900' },
    ],
  },

  howToApply: [
    'Visit ssc.gov.in and navigate to the "Register/Login" section.',
    'Complete one-time registration with personal details, email, and mobile number.',
    'Log in and click "Apply" next to the MTS 2026 notification.',
    'Fill in personal details, educational qualification (10th pass board, year, percentage), and centre preferences.',
    'Upload photograph (20–50 KB, JPEG), signature (10–20 KB, JPEG), and photo ID proof (100–300 KB, PDF).',
    'Pay ₹100 application fee via Net Banking, Credit/Debit Card, UPI, or SBI Challan. Female/SC/ST/PwD/ESM exempted.',
    'Review, submit, and download confirmation page with Registration ID.',
  ],

  faqs: [
    { question: 'When is SSC MTS 2026 exam?', answer: 'SSC MTS 2026 exam is scheduled from August 15 to September 10, 2026. Both sessions are conducted on the same day.' },
    { question: 'What is the qualification for SSC MTS?', answer: '10th Standard (Matriculation) pass or equivalent is the minimum qualification. No higher education required.' },
    { question: 'Is there negative marking in SSC MTS?', answer: 'No, SSC MTS has no negative marking, which is a major advantage. Candidates should attempt all questions.' },
    { question: 'How many vacancies in SSC MTS 2026?', answer: 'The exact count will be announced with the notification. SSC MTS typically recruits 5,000–10,000 candidates annually.' },
    { question: 'What is SSC MTS salary?', answer: 'SSC MTS salary is Pay Level 1 with basic pay ₹18,000. Gross monthly salary including allowances is approximately ₹22,000–₹30,000 depending on posting location.' },
  ],

  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ssc.gov.in',
    instructions: [
      'Visit ssc.gov.in and click on "Status/Download Admit Card" under the Candidate\'s Corner',
      'Select "Multi Tasking Staff Examination 2026" from the exam list',
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
      'Qualified candidates will be called for Document Verification',
      'Final merit list is prepared based on normalised combined Session 1 + Session 2 scores and uploaded to the official website',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '105.50', totalMarks: '150' },
    { year: 2024, category: 'OBC', cutoffScore: '94.75', totalMarks: '150' },
    { year: 2024, category: 'SC', cutoffScore: '82.30', totalMarks: '150' },
    { year: 2024, category: 'ST', cutoffScore: '72.15', totalMarks: '150' },
    { year: 2023, category: 'General', cutoffScore: '102.38', totalMarks: '150' },
    { year: 2023, category: 'OBC', cutoffScore: '91.42', totalMarks: '150' },
    { year: 2023, category: 'SC', cutoffScore: '79.88', totalMarks: '150' },
    { year: 2023, category: 'ST', cutoffScore: '69.75', totalMarks: '150' },
    { year: 2022, category: 'General', cutoffScore: '98.67', totalMarks: '150' },
    { year: 2022, category: 'OBC', cutoffScore: '88.20', totalMarks: '150' },
    { year: 2022, category: 'SC', cutoffScore: '77.14', totalMarks: '150' },
    { year: 2022, category: 'ST', cutoffScore: '67.42', totalMarks: '150' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CHSL 2026', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC GD 2026', href: '/ssc-gd-2026-notification' },
    { label: 'SSC CPO 2026', href: '/ssc-cpo-2026-notification' },
  ],
};

export const sscMtsSyllabus: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-2026-syllabus',
  pageType: 'syllabus',
  metaTitle: 'SSC MTS Syllabus 2026 – Complete Topic List',
  metaDescription: 'SSC MTS 2026 syllabus for Session 1 and Session 2. Topic-wise breakdown of Maths, Reasoning, English, and GK with preparation tips.',
  lastUpdated: '2026-03-05',
  datePublished: '2026-01-20',

  h1: 'SSC MTS Syllabus 2026 – Complete Subject-Wise Topics for Both Sessions',

  overview: `<p>The <strong>SSC MTS 2026 syllabus</strong> is designed to test basic competencies at the 10th standard level. The exam has two sessions conducted on the same day, covering four subjects — Numerical & Mathematical Ability, Reasoning Ability, English Language, and General Awareness. Understanding the complete syllabus and topic weightage is essential for efficient preparation.</p>

<p><strong>Numerical & Mathematical Ability</strong> (40 questions, 60 marks in Session 1) covers fundamental arithmetic — Number Systems (HCF, LCM, simplification, divisibility), Whole Numbers, Decimals & Fractions, Ratio & Proportion, Percentage, Averages, Profit & Loss, Discount, Simple Interest, Time & Work, Time Speed & Distance, basic Mensuration (area and perimeter of rectangles, squares, circles, triangles), and Data Interpretation (reading tables and bar charts). The difficulty is strictly 10th standard — focus on speed and accuracy with these basic calculations. Practice mental math techniques to solve problems in 20–30 seconds each.</p>

<p><strong>Reasoning Ability & Problem Solving</strong> (40 questions, 60 marks in Session 1) tests logical and analytical thinking through Analogies, Classification, Series (number, letter, figure), Coding-Decoding, Direction Sense, Blood Relations, Order & Ranking, Sitting Arrangement, Venn Diagrams, Calendar & Clock, Dice & Cubes, Paper Folding & Cutting, Mirror/Water Image, Embedded Figures, and Pattern Completion. Non-verbal reasoning questions (figure-based) carry good weightage — practice these daily using SSC-specific reasoning books.</p>

<p><strong>English Language & Comprehension</strong> (25 questions, 37.5 marks in Session 2) covers basic English competency — Reading Comprehension (1 short passage), Fill in the Blanks (prepositions, articles, tenses), Error Spotting (in sentences), Sentence Improvement, Synonyms & Antonyms, Idioms & Phrases, One-word Substitution, Spelling Errors, and basic grammar (active/passive voice, direct/indirect speech). The difficulty level is moderate — candidates with basic English skills can score well. Focus on vocabulary building and grammar rules for maximum marks.</p>

<p><strong>General Awareness</strong> (25 questions, 37.5 marks in Session 2) tests knowledge of current events and basic static GK — Current Affairs (last 6 months national and international events), Indian History (focus on modern history and freedom movement), Geography (Indian states, rivers, mountains, dams), Indian Polity (fundamental rights, duties, directive principles, Parliament), Economics (basic concepts, GDP, inflation, budget), General Science (physics, chemistry, biology at 8th–10th level), and Static GK (countries & capitals, currencies, national symbols, awards, sports, books & authors, important dates). Dedicate 20 minutes daily to current affairs from a reliable source.</p>

<p>A unique advantage of SSC MTS is <strong>no negative marking</strong>, meaning candidates should attempt all 130 questions across both sessions. There is no penalty for guessing, so never leave any question unanswered. This makes the exam strategy different from SSC CGL/CHSL where accuracy is critical.</p>

<p>Recommended preparation timeline: 2–3 months is sufficient for SSC MTS given the 10th-standard difficulty. Spend the first month on topic-wise preparation, the second month on practice sets and mock tests. Give at least 2 mock tests per week to build speed and confidence.</p>`,

  examPattern: [
    {
      stageName: 'Session 1 (45 minutes)',
      rows: [
        { subject: 'Numerical & Mathematical Ability', questions: 40, marks: 60, duration: '45 min (combined)', negativeMarking: 'No negative marking' },
        { subject: 'Reasoning Ability & Problem Solving', questions: 40, marks: 60, duration: '—', negativeMarking: 'No negative marking' },
      ],
    },
    {
      stageName: 'Session 2 (45 minutes)',
      rows: [
        { subject: 'English Language & Comprehension', questions: 25, marks: 37.5, duration: '45 min (combined)', negativeMarking: 'No negative marking' },
        { subject: 'General Awareness', questions: 25, marks: 37.5, duration: '—', negativeMarking: 'No negative marking' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC MTS 2026 syllabus?', answer: 'SSC MTS covers Numerical Ability, Reasoning, English, and General Awareness across two sessions. All topics are at 10th standard level with no negative marking.' },
    { question: 'Is SSC MTS easier than CHSL?', answer: 'Yes, SSC MTS is easier than CHSL. The questions are at 10th-standard level and there is no negative marking, making it more accessible for 10th-pass candidates.' },
    { question: 'Should I attempt all questions in SSC MTS?', answer: 'Absolutely yes. Since there is no negative marking in SSC MTS, you should attempt every single question. Never leave any answer blank.' },
    { question: 'How much time to prepare for SSC MTS?', answer: '2–3 months of focused preparation is sufficient. The syllabus is 10th-standard level, so candidates with good basics can prepare quickly with practice sets and mocks.' },
    { question: 'Which books to study for SSC MTS?', answer: 'Lucent GK for General Awareness, RS Aggarwal for Reasoning and Maths, and any standard English grammar book. SSC MTS previous year papers (2019–2025) are the most important resource.' },
  ],

  relatedExams: [
    { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
    { label: 'SSC MTS Exam Pattern 2026', href: '/ssc-mts-2026-exam-pattern' },
    { label: 'SSC MTS Salary 2026', href: '/ssc-mts-2026-salary' },
    { label: 'SSC CHSL Syllabus 2026', href: '/ssc-chsl-2026-syllabus' },
  ],
};

export const sscMtsExamPattern: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-2026-exam-pattern',
  pageType: 'exam-pattern',
  metaTitle: 'SSC MTS Exam Pattern 2026 – Session 1 & 2',
  metaDescription: 'SSC MTS 2026 exam pattern for Session 1 and Session 2. Check total questions, marks, duration, and no negative marking advantage.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC MTS Exam Pattern 2026 – Complete Session-Wise Structure & Marking Scheme',

  overview: `<p>The <strong>SSC MTS 2026 exam pattern</strong> consists of two computer-based sessions conducted on the same day. The pattern was revised by SSC in 2022, replacing the old Paper 1 + Paper 2 (descriptive) format with the current two-session objective format. This change benefits candidates who were weak in descriptive English, as the entire exam is now objective-type.</p>

<p><strong>Session 1</strong> is 45 minutes long and covers two subjects: Numerical & Mathematical Ability (40 questions, 60 marks) and Reasoning Ability & Problem Solving (40 questions, 60 marks). Total: 80 questions, 120 marks. The key feature of SSC MTS is <strong>no negative marking</strong> — every question should be attempted. Each correct answer in Session 1 carries 1.5 marks for Numerical Ability and 1.5 marks for Reasoning.</p>

<p><strong>Session 2</strong> follows Session 1 on the same day (after a break) and is also 45 minutes long. It covers English Language & Comprehension (25 questions, 37.5 marks) and General Awareness (25 questions, 37.5 marks). Total: 50 questions, 75 marks. Each correct answer carries 1.5 marks. Again, no negative marking applies.</p>

<p>The combined score of both sessions (120 + 75 = <strong>195 marks</strong>) determines the final merit. Normalisation is applied across different shifts to account for difficulty variation. The normalised combined score is the sole basis for preparing the final merit list and post allocation.</p>

<p><strong>Time management</strong> is the biggest challenge in SSC MTS. With 80 questions in 45 minutes (Session 1), candidates have approximately 34 seconds per question. In Session 2, with 50 questions in 45 minutes, candidates have 54 seconds per question. Session 2 provides more time per question because English comprehension passages require reading time. Practice speed-solving techniques: (1) Skip time-consuming calculation questions initially, attempt all easy ones first; (2) In reasoning, figure-based questions can be solved visually in 15–20 seconds; (3) In GK, you either know the answer or you don't — spend maximum 15 seconds per question.</p>

<p><strong>Cut-off trends</strong> from recent years suggest that General category candidates typically need 130–140 out of 195 to qualify. SC/ST cut-offs are lower at 105–120. OBC cut-offs fall between 120–130. These figures vary by year and total vacancies. The absence of negative marking means high scores are common, pushing cut-offs upward.</p>

<p>For PwD candidates (VH, HH, OH), compensatory time of 15 minutes per session is provided, making the total time 60 minutes per session. Scribes are allowed for candidates with disabilities affecting writing speed, with an additional 5 minutes per session.</p>`,

  examPattern: [
    {
      stageName: 'Session 1 (45 minutes)',
      rows: [
        { subject: 'Numerical & Mathematical Ability', questions: 40, marks: 60, duration: '45 min (combined)', negativeMarking: 'No negative marking' },
        { subject: 'Reasoning Ability & Problem Solving', questions: 40, marks: 60, duration: '—', negativeMarking: 'No negative marking' },
      ],
    },
    {
      stageName: 'Session 2 (45 minutes)',
      rows: [
        { subject: 'English Language & Comprehension', questions: 25, marks: 37.5, duration: '45 min (combined)', negativeMarking: 'No negative marking' },
        { subject: 'General Awareness', questions: 25, marks: 37.5, duration: '—', negativeMarking: 'No negative marking' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC MTS 2026 exam pattern?', answer: 'Two sessions on the same day. Session 1: 80 questions (120 marks, 45 min). Session 2: 50 questions (75 marks, 45 min). Total: 130 questions, 195 marks. No negative marking.' },
    { question: 'Is there negative marking in SSC MTS 2026?', answer: 'No, SSC MTS has no negative marking. This is a significant advantage — attempt every question regardless of certainty.' },
    { question: 'How is the SSC MTS merit list prepared?', answer: 'The merit list is based on combined normalised scores of Session 1 and Session 2 (total 195 marks). No descriptive paper or skill test.' },
    { question: 'How much time per question in SSC MTS?', answer: 'Session 1: approximately 34 seconds per question (80 questions in 45 min). Session 2: approximately 54 seconds per question (50 questions in 45 min).' },
    { question: 'What is the expected cut-off for SSC MTS 2026?', answer: 'Based on recent trends, General category cut-off is expected around 130–140 out of 195. SC/ST: 105–120. OBC: 120–130. Actual cut-offs depend on vacancies and competition.' },
  ],

  relatedExams: [
    { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
    { label: 'SSC MTS Syllabus 2026', href: '/ssc-mts-2026-syllabus' },
    { label: 'SSC MTS Salary 2026', href: '/ssc-mts-2026-salary' },
    { label: 'SSC CHSL Exam Pattern 2026', href: '/ssc-chsl-2026-exam-pattern' },
  ],
};

export const sscMtsEligibility: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-2026-eligibility',
  pageType: 'eligibility',
  metaTitle: 'SSC MTS Eligibility 2026 – Age & Qualification',
  metaDescription: 'Check SSC MTS 2026 eligibility: age limit 18-25, 10th pass qualification, age relaxation for SC/ST/OBC/PwD, and nationality requirements.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC MTS Eligibility 2026 – Age Limit, Qualification & Relaxation Details',

  overview: `<p>The <strong>SSC MTS 2026 eligibility criteria</strong> are among the most accessible for any central government recruitment. With only a 10th-pass requirement and no physical standards, SSC MTS opens doors for millions of young Indians seeking secure government employment. However, candidates must carefully verify all eligibility parameters before applying.</p>

<p>The educational qualification is <strong>10th Standard (Matriculation) pass or equivalent</strong> from a recognised Board or institution. Candidates who have passed 10th through NIOS, State Open School, or equivalent examinations are also eligible. Those with higher qualifications (12th pass, graduate, post-graduate) can also apply — there is no upper education limit. The 10th pass certificate must be available at the time of document verification.</p>

<p>The <strong>age limit</strong> is <strong>18–25 years</strong> as on 1st January 2026. This means candidates born between 02-01-2001 and 01-01-2008 are eligible (General category). Age relaxation: SC/ST candidates get 5 years (upper age 30), OBC (Non-Creamy Layer) candidates get 3 years (upper age 28), PwD candidates get 10 years (upper age 35 for General, 38 for OBC, 40 for SC/ST), and Ex-Servicemen get 3 years after deduction of military service.</p>

<p>Unlike SSC GD Constable, SSC MTS posts are <strong>desk-based support roles</strong> with no physical standards requirement. There is no height, weight, chest, or running test. PwD candidates (with benchmark disability of 40% or more) are eligible and encouraged to apply. Posts are identified suitable for Locomotor Disability (OL, OA, BL, OAL), Visual Impairment (LV, B), Hearing Impairment (HH), and certain other disabilities as specified in the notification.</p>

<p><strong>Nationality:</strong> Candidates must be (a) a citizen of India, or (b) a subject of Nepal or Bhutan, or (c) a Tibetan refugee who came to India before 01-01-1962, or (d) a person of Indian origin who has migrated from specified countries. For categories (b) to (d), a certificate of eligibility from the Government of India is required.</p>

<p>Candidates currently employed in government service can apply but must submit through proper channel. A No Objection Certificate (NOC) from the current employer is required at document verification. Candidates are advised to verify all eligibility criteria from the official notification before applying, as SSC can cancel candidature at any stage if found ineligible.</p>`,

  eligibility: `<p>SSC MTS 2026 eligibility summary:</p>
<h3>Educational Qualification</h3>
<ul><li>10th Standard pass or equivalent from a recognised Board</li></ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul><li>General: 18–25 years | OBC: 18–28 years | SC/ST: 18–30 years</li></ul>
<h3>Physical Standards</h3>
<ul><li>No physical standards — desk-based posts</li></ul>
<h3>PwD Eligibility</h3>
<ul><li>PwD candidates with 40%+ benchmark disability are eligible for identified posts</li></ul>`,

  faqs: [
    { question: 'What is the minimum qualification for SSC MTS?', answer: '10th Standard (Matriculation) pass or equivalent from a recognised Board. No graduation or 12th pass required.' },
    { question: 'What is the age limit for SSC MTS 2026?', answer: '18–25 years for General category as on 01-01-2026. OBC: 18–28, SC/ST: 18–30. PwD candidates get additional 10 years relaxation.' },
    { question: 'Can PwD candidates apply for SSC MTS?', answer: 'Yes, PwD candidates with 40% or more benchmark disability are eligible. Posts are identified suitable for various disability categories.' },
    { question: 'Is there any physical test in SSC MTS?', answer: 'No, SSC MTS has no physical test or physical standards requirement. All posts are desk-based office support roles.' },
    { question: 'Can graduates apply for SSC MTS?', answer: 'Yes, there is no upper education limit. Graduates and post-graduates can apply. However, they will be recruited at the MTS level only.' },
  ],

  relatedExams: [
    { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
    { label: 'SSC MTS Syllabus 2026', href: '/ssc-mts-2026-syllabus' },
    { label: 'SSC MTS Salary 2026', href: '/ssc-mts-2026-salary' },
    { label: 'SSC CHSL Eligibility 2026', href: '/ssc-chsl-2026-eligibility' },
  ],
};

export const sscMtsSalary: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-2026-salary',
  pageType: 'salary',
  metaTitle: 'SSC MTS Salary 2026 – Pay Scale & Benefits',
  metaDescription: 'SSC MTS 2026 salary at Pay Level 1. Check basic pay ₹18,000, gross salary, in-hand salary, allowances, MACP promotions and career growth.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC MTS Salary 2026 – Pay Scale, Allowances & Career Growth',

  overview: `<p>The <strong>SSC MTS 2026 salary</strong> is at <strong>Pay Level 1</strong> under the 7th Central Pay Commission, with a basic pay range of <strong>₹18,000–₹56,900</strong> per month. While this is the entry-level pay band in the central government, the comprehensive benefits package — including job security, pension, medical benefits, and assured career progression — makes SSC MTS an attractive career option for 10th-pass candidates.</p>

<p>The <strong>starting gross salary</strong> for an SSC MTS employee posted in a metro city includes: Basic Pay ₹18,000 + Dearness Allowance (approximately 50%, i.e., ₹9,000) + HRA (24% for X-cities = ₹4,320) + Transport Allowance (₹3,600) = approximately ₹34,920 gross. After deductions (NPS 10%, CGHS, etc.), the <strong>in-hand salary is approximately ₹22,000–₹26,000</strong> per month. For postings in smaller cities, HRA and TPTA are lower, resulting in an in-hand salary of approximately ₹18,000–₹22,000.</p>

<p>Beyond the monthly salary, MTS employees receive several <strong>additional benefits</strong>: Children Education Allowance (₹2,250 per child per month for up to 2 children), Leave Travel Concession (LTC) for hometown/all-India travel, National Pension System (NPS) with 14% employer contribution, medical benefits under CGHS (cashless treatment at government and empanelled private hospitals), festival advance, house building advance, and group insurance under CGEGIS.</p>

<p><strong>Annual increments</strong> of 3% of basic pay are granted each July. After the first increment, the basic pay becomes ₹18,540, and after 5 years it reaches approximately ₹20,880. These increments are automatic and not performance-linked, ensuring steady salary growth.</p>

<p><strong>Career progression</strong> under MACP (Modified Assured Career Progression) guarantees three financial upgrades: First MACP at 10 years (Pay Level 2, ₹19,900), Second MACP at 20 years (Pay Level 3, ₹21,700), and Third MACP at 30 years (Pay Level 4, ₹25,500). Additionally, MTS employees can appear for departmental exams to get promoted to LDC/UDC positions (Pay Level 2–4). Many MTS recruits also prepare for SSC CHSL, CGL, or other competitive exams while in service to move into higher positions.</p>

<p>The <strong>total effective compensation</strong> including all monetary benefits, medical coverage (saving ₹3,000–₹5,000 per month on healthcare), and job security is equivalent to a private sector salary of ₹30,000–₹40,000 for a 10th-pass worker. Private sector alternatives for 10th-pass candidates typically offer ₹8,000–₹12,000 without any benefits or job security, making SSC MTS compensation 2–3 times better in effective terms.</p>

<p><strong>Retirement benefits</strong> include NPS pension corpus (typically ₹15,000–₹25,000 monthly pension after 30 years), Gratuity, Leave Encashment, and CGEGIS payout. Government employees also enjoy social prestige and stability that contributes to quality of life beyond monetary compensation.</p>`,

  salary: {
    salaryMin: 18000,
    salaryMax: 56900,
    payLevels: 'Pay Level 1',
    grossRange: '₹22,000 – ₹35,000 per month',
    netRange: '₹18,000 – ₹28,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – approximately 50% of basic pay, revised biannually',
      'House Rent Allowance (HRA) – 24% (X cities), 16% (Y cities), 8% (Z cities)',
      'Transport Allowance (TPTA) – ₹3,600 (X/Y cities), ₹1,350 (Z cities)',
      'Children Education Allowance – ₹2,250 per child (max 2 children)',
      'National Pension System (NPS) – 14% employer contribution',
      'Medical Benefits under CGHS',
      'Leave Travel Concession (LTC)',
    ],
    postWiseSalary: [
      { post: 'Multi Tasking Staff (MTS)', payLevel: 'Level 1', basicPay: '₹18,000 – ₹56,900' },
      { post: 'Peon / Daftary / Jamadar', payLevel: 'Level 1', basicPay: '₹18,000 – ₹56,900' },
    ],
  },

  faqs: [
    { question: 'What is the starting salary of SSC MTS?', answer: 'SSC MTS starting basic pay is ₹18,000 (Pay Level 1). With allowances in a metro city, gross salary is approximately ₹35,000 and in-hand salary is ₹22,000–₹26,000.' },
    { question: 'What is the MACP benefit for SSC MTS?', answer: 'MACP guarantees 3 financial upgrades: Pay Level 2 at 10 years, Level 3 at 20 years, Level 4 at 30 years. These are automatic and don\'t require promotion vacancy.' },
    { question: 'Can SSC MTS employees get promoted to LDC?', answer: 'Yes, through departmental exams and seniority, MTS employees can be promoted to LDC (Pay Level 2), UDC (Pay Level 4), and higher posts.' },
    { question: 'Do SSC MTS employees get pension?', answer: 'Employees appointed after 2004 are under NPS with 14% employer contribution. Gratuity and leave encashment are also payable at retirement.' },
    { question: 'Is SSC MTS salary enough to live in a city?', answer: 'In-hand salary of ₹22,000–₹26,000 in metros is modest but supplemented by CGHS medical benefits, NPS, and LTC. Many MTS employees also prepare for higher exams while serving.' },
  ],

  relatedExams: [
    { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
    { label: 'SSC MTS Eligibility 2026', href: '/ssc-mts-2026-eligibility' },
    { label: 'SSC CHSL Salary 2026', href: '/ssc-chsl-2026-salary' },
    { label: 'SSC GD Salary 2026', href: '/ssc-gd-2026-salary' },
  ],
};

const sscMtsCutoff: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-cutoff',
  pageType: 'cutoff',
  metaTitle: 'SSC MTS Cutoff 2026 — Category-Wise Cut Off Marks',
  metaDescription: 'SSC MTS cutoff 2026: Category-wise cut off marks for Session 1 & 2. Previous year cutoffs 2022-2024 with trend analysis.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',
  h1: 'SSC MTS Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',
  overview: `<p>The <strong>SSC MTS Cutoff</strong> determines which candidates qualify for document verification after the combined Session 1 + Session 2 examination. Since SSC MTS has no negative marking, cutoff scores tend to be higher relative to total marks compared to other SSC exams. Understanding cutoff trends is essential for setting preparation targets.</p>

<h3>How SSC MTS Cutoff Is Determined</h3>
<p>The SSC MTS cutoff depends on several factors:</p>
<ul>
<li><strong>Number of Vacancies:</strong> SSC MTS typically recruits 5,000–10,000 candidates annually. Higher vacancies mean lower cutoffs.</li>
<li><strong>Number of Applicants:</strong> SSC MTS attracts 50–80 lakh applicants due to the low qualification requirement (10th pass).</li>
<li><strong>No Negative Marking:</strong> Since there's no penalty for wrong answers, average scores are higher, pushing cutoffs up.</li>
<li><strong>Normalisation:</strong> SSC applies normalisation across multiple shifts to account for difficulty variations.</li>
</ul>

<h3>SSC MTS Cutoff Trend Analysis (2022–2024)</h3>
<p>Over the past three years, SSC MTS cutoffs have shown a steady upward trend. General category cutoffs rose from 98.67 (2022) to 105.50 (2024) out of 150 total marks — an increase of about 7 marks. This reflects growing competition and better candidate preparation. OBC cutoffs similarly rose from 88.20 to 94.75, while SC cutoffs went from 77.14 to 82.30.</p>

<p>The absence of negative marking means candidates should attempt all 130 questions. Even educated guessing can add 5–10 marks, which could be the difference between qualifying and missing the cutoff.</p>

<h3>Expected SSC MTS 2026 Cutoff</h3>
<p>Based on the 3-year trend, the SSC MTS 2026 cutoff for General category is expected to be <strong>107–112 out of 195 marks</strong> (combined Session 1 + Session 2). Candidates should target a score of 115+ to be safely above the cutoff. Focus on Reasoning and Numerical Ability in Session 1 for maximum marks, as these carry 120 of the total 195 marks.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '105.50', totalMarks: '150' },
    { year: 2024, category: 'OBC', cutoffScore: '94.75', totalMarks: '150' },
    { year: 2024, category: 'SC', cutoffScore: '82.30', totalMarks: '150' },
    { year: 2024, category: 'ST', cutoffScore: '72.15', totalMarks: '150' },
    { year: 2023, category: 'General', cutoffScore: '102.38', totalMarks: '150' },
    { year: 2023, category: 'OBC', cutoffScore: '91.42', totalMarks: '150' },
    { year: 2023, category: 'SC', cutoffScore: '79.88', totalMarks: '150' },
    { year: 2023, category: 'ST', cutoffScore: '69.75', totalMarks: '150' },
    { year: 2022, category: 'General', cutoffScore: '98.67', totalMarks: '150' },
    { year: 2022, category: 'OBC', cutoffScore: '88.20', totalMarks: '150' },
    { year: 2022, category: 'SC', cutoffScore: '77.14', totalMarks: '150' },
    { year: 2022, category: 'ST', cutoffScore: '67.42', totalMarks: '150' },
  ],

  faqs: [
    { question: 'What is the expected SSC MTS 2026 cutoff?', answer: 'The General category cutoff is expected around 107-112 out of 195 marks based on the 2022-2024 trend. Aim for 115+ to be safe.' },
    { question: 'Is SSC MTS cutoff lower than CHSL?', answer: 'In absolute marks yes, but relative to total marks the percentage is similar. MTS cutoff is ~70% while CHSL is ~75% of total marks for General category.' },
    { question: 'Does no negative marking affect the cutoff?', answer: 'Yes, since there is no penalty for wrong answers, average scores are higher and cutoffs tend to be proportionally higher than exams with negative marking.' },
    { question: 'Are SSC MTS cutoffs zone-wise?', answer: 'SSC MTS cutoffs are national, not zone-wise. However, state-wise vacancies affect the final allocation after merit list preparation.' },
    { question: 'How can I check my SSC MTS score?', answer: 'SSC releases individual score cards on ssc.gov.in after result declaration. Log in with your Registration ID to download.' },
  ],

  relatedExams: [
    { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
    { label: 'SSC MTS Exam Pattern 2026', href: '/ssc-mts-2026-exam-pattern' },
    { label: 'SSC MTS Age Limit', href: '/ssc-mts-age-limit' },
    { label: 'SSC CGL Cutoff', href: '/ssc-cgl-cutoff' },
    { label: 'SSC CHSL Cutoff', href: '/ssc-chsl-cutoff' },
  ],
};

const sscMtsAgeLimit: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-mts-age-limit',
  pageType: 'age-limit',
  metaTitle: 'SSC MTS Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'SSC MTS 2026 age limit: 18-25 years for General. Category-wise relaxation for SC/ST/OBC/PwD and how to calculate eligibility.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',
  h1: 'SSC MTS Age Limit 2026 — Category-Wise Requirements & Relaxation Details',
  overview: `<p>The <strong>SSC MTS Age Limit</strong> is straightforward compared to other SSC exams — all MTS posts have the same age bracket since there is only one category of post (Multi Tasking Staff at Pay Level 1). This simplicity makes eligibility checking easier for candidates.</p>

<h3>SSC MTS 2026 Age Limit</h3>
<p>The age limit for SSC MTS 2026 is calculated as on <strong>1st January 2026</strong>:</p>
<ul>
<li><strong>Minimum Age:</strong> 18 years (born on or before 01-01-2008)</li>
<li><strong>Maximum Age (General):</strong> 25 years (born on or after 02-01-2001)</li>
<li><strong>Maximum Age (OBC):</strong> 28 years (born on or after 02-01-1998)</li>
<li><strong>Maximum Age (SC/ST):</strong> 30 years (born on or after 02-01-1996)</li>
</ul>

<h3>Category-Wise Age Relaxation</h3>
<p>The Government of India provides age relaxation for reserved categories:</p>
<ul>
<li><strong>SC/ST:</strong> 5 years on the upper age limit</li>
<li><strong>OBC (Non-Creamy Layer):</strong> 3 years relaxation</li>
<li><strong>PwBD (General):</strong> 10 years | PwBD (OBC): 13 years | PwBD (SC/ST): 15 years</li>
<li><strong>Ex-Servicemen:</strong> 3 years after deduction of military service</li>
<li><strong>J&K Domicile (1980–1989):</strong> 5 years</li>
</ul>

<h3>How to Calculate Your SSC MTS Age Eligibility</h3>
<p>To check if you are eligible:</p>
<ol>
<li>Note your date of birth from your 10th class certificate (SSC uses this as official DOB)</li>
<li>Calculate your age as on 1 January 2026</li>
<li>Your age must be between 18 and 25 years (General category)</li>
<li>If you belong to a reserved category, add the applicable relaxation to the upper limit</li>
</ol>
<p>For example, a General category candidate born on 15 June 2001 would be exactly 24 years 6 months on 1 January 2026 — eligible. But a candidate born on 30 December 2000 would be 25 years 2 days — NOT eligible as they exceed 25 years.</p>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a> to instantly check your SSC MTS eligibility with automatic category relaxation calculation.</p>

<h3>Key Points About SSC MTS Age Limit</h3>
<ul>
<li>Age is based on 10th class certificate DOB — no other document is accepted</li>
<li>SSC MTS has a tighter upper limit (25) compared to SSC CGL (27-32) and CHSL (27)</li>
<li>The lower age limit of 18 makes MTS accessible to candidates immediately after 10th class</li>
<li>OBC candidates must have a valid non-creamy layer certificate</li>
<li>There is no age relaxation for EWS category</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary (as on 01-01-2026)</h3>
<ul>
<li><strong>General:</strong> 18–25 years</li>
<li><strong>OBC:</strong> 18–28 years</li>
<li><strong>SC/ST:</strong> 18–30 years</li>
<li><strong>PwBD:</strong> 18–35 years (General) / 38 (OBC) / 40 (SC/ST)</li>
</ul>`,

  faqs: [
    { question: 'What is the age limit for SSC MTS 2026?', answer: '18-25 years for General category as on 1 January 2026. OBC gets 3 years relaxation (up to 28), SC/ST gets 5 years (up to 30).' },
    { question: 'Is SSC MTS age limit same for all posts?', answer: 'Yes, all MTS posts have the same 18-25 age limit since they are all at the same Pay Level 1.' },
    { question: 'Can I apply for SSC MTS at 17?', answer: 'No, the minimum age is 18 years as on 1 January 2026. You must have turned 18 by that date.' },
    { question: 'Is SSC MTS age limit strict?', answer: 'Yes, there is no discretionary relaxation. Only category-based relaxation (SC/ST/OBC/PwBD/Ex-SM) applies.' },
    { question: 'How is DOB verified for SSC MTS?', answer: 'SSC uses the date of birth mentioned in your 10th class (matriculation) certificate. No changes are permitted after application submission.' },
  ],

  relatedExams: [
    { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
    { label: 'SSC MTS Eligibility 2026', href: '/ssc-mts-2026-eligibility' },
    { label: 'SSC MTS Cutoff', href: '/ssc-mts-cutoff' },
    { label: 'SSC CHSL Age Limit', href: '/ssc-chsl-age-limit' },
    { label: 'Age Calculator', href: '/govt-job-age-calculator' },
  ],
};

export const SSC_MTS_CONFIGS: ExamAuthorityConfig[] = [
  sscMtsNotification,
  sscMtsSyllabus,
  sscMtsExamPattern,
  sscMtsEligibility,
  sscMtsSalary,
  sscMtsCutoff,
  sscMtsAgeLimit,
];
