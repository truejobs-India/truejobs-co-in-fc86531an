import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'railway-jobs' as const,
  examName: 'RRB NTPC',
  examYear: 2026,
  conductingBody: 'Railway Recruitment Boards (RRBs)',
  officialWebsite: 'rrbcdg.gov.in',
  datePublished: '2026-02-15',
  lastUpdated: '2026-03-07',
};

const RELATED_EXAMS = [
  { label: 'Railway Group D 2026 Notification', href: '/railway-group-d-2026-notification' },
  { label: 'RRB ALP 2026 Notification', href: '/rrb-alp-2026-notification' },
  { label: 'RRB JE 2026 Notification', href: '/rrb-je-2026-notification' },
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'RRB NTPC 2026 Syllabus', href: '/rrb-ntpc-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-ntpc-2026-notification',
  pageType: 'notification',
  metaTitle: 'RRB NTPC 2026 Notification — Dates & Apply',
  metaDescription: 'RRB NTPC 2026 Notification released. Check vacancies, eligibility, exam dates, syllabus, salary and apply online for NTPC recruitment.',
  h1: 'RRB NTPC 2026 Notification — Complete Details, Eligibility & How to Apply',
  totalVacancies: 11558,
  applicationEndDate: '2026-06-30',
  applyLink: 'https://rrbcdg.gov.in',
  notificationPdfUrl: 'https://rrbcdg.gov.in/ntpc-cen-2026.pdf',
  overview: `<p>The Railway Recruitment Boards (RRBs) have officially released the <strong>RRB NTPC 2026 Notification</strong> for the recruitment of Non-Technical Popular Categories (NTPC) posts across Indian Railways. This recruitment drive aims to fill approximately <strong>11,558 vacancies</strong> across various Graduate and Under-Graduate level posts including Station Master, Goods Guard, Commercial Apprentice, Clerk, Traffic Assistant, and Accounts Clerk.</p>
<p>Indian Railways, being the largest employer in India, conducts the NTPC examination periodically to recruit candidates for ministerial, commercial, and traffic cadre posts. The RRB NTPC 2026 exam is conducted in multiple stages — CBT-1, CBT-2, and Typing Skill Test/Computer Based Aptitude Test (CBAT) — to ensure merit-based selection of candidates across the country.</p>
<h3>Key Highlights of RRB NTPC 2026</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>Railway Recruitment Boards (RRBs)</td></tr><tr><td>Exam Name</td><td>RRB NTPC (Non-Technical Popular Categories)</td></tr><tr><td>Total Vacancies</td><td>11,558 (approximate)</td></tr><tr><td>Application Start</td><td>March 2026</td></tr><tr><td>Application End</td><td>June 2026</td></tr><tr><td>Exam Mode</td><td>Computer Based Test (CBT)</td></tr><tr><td>Official Website</td><td>rrbcdg.gov.in</td></tr></table>
<p>The NTPC recruitment is one of the most sought-after government job examinations in India, attracting millions of applicants annually. Posts under NTPC fall under Pay Level 2 to Pay Level 6 of the 7th Central Pay Commission, offering attractive salary packages along with railway benefits such as free travel passes, medical facilities, and pension under the National Pension System (NPS).</p>
<p>Candidates who are graduates or have completed 12th class from a recognized board are eligible to apply, depending on the specific post. The minimum age requirement is 18 years, with the upper age limit varying between 30 to 33 years based on the post category. Standard age relaxations apply for reserved categories as per government norms.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-02-15' },
    { label: 'Online Application Start', date: '2026-03-15' },
    { label: 'Application Last Date', date: '2026-06-30' },
    { label: 'CBT-1 Exam Date', date: 'September–October 2026 (Tentative)' },
    { label: 'CBT-2 Exam Date', date: 'To Be Announced' },
    { label: 'Result Date', date: 'To Be Announced' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p><strong>Graduate Posts (Pay Level 5 & 6):</strong> Bachelor's degree from a recognized university. Posts include Station Master, Goods Guard, Commercial Apprentice, Senior Clerk, and Traffic Assistant.</p><p><strong>Under-Graduate Posts (Pay Level 2):</strong> 12th pass (10+2) from a recognized board. Posts include Junior Clerk, Accounts Clerk, Junior Time Keeper, Trains Clerk, and Commercial cum Ticket Clerk.</p><h3>Age Limit</h3><p><strong>Graduate Posts:</strong> 18 to 33 years | <strong>Under-Graduate Posts:</strong> 18 to 30 years</p><p><strong>Age Relaxation:</strong> OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years (15 for SC/ST PwBD) | Ex-Servicemen: as per rules</p><h3>Nationality</h3><p>Indian citizens only. Subjects of Nepal, Bhutan, and Tibetan refugees who migrated before 1962 are also eligible with proper documentation.</p>`,
  feeStructure: {
    general: 500,
    obc: 500,
    scSt: 250,
    female: 250,
    ph: 250,
    paymentModes: ['Online (Net Banking, UPI, Debit Card, Credit Card)', 'SBI Challan', 'Post Office Challan'],
  },
  selectionProcess: [
    'CBT-1 (First Stage Computer Based Test) — screening test',
    'CBT-2 (Second Stage Computer Based Test) — merit-based selection',
    'CBAT (Computer Based Aptitude Test) — for Station Master & Traffic Assistant posts',
    'Typing Skill Test — for clerk-grade posts requiring typing proficiency',
    'Document Verification and Medical Examination',
    'Final Merit List preparation based on CBT-2 normalized scores',
  ],
  examPattern: [
    {
      stageName: 'CBT-1 (First Stage)',
      rows: [
        { subject: 'General Awareness', questions: 40, marks: 40, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
    {
      stageName: 'CBT-2 (Second Stage)',
      rows: [
        { subject: 'General Awareness', questions: 50, marks: 50, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 35, marks: 35, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 35, marks: 35, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
  ],
  salary: {
    salaryMin: 19900,
    salaryMax: 112400,
    payLevels: 'Pay Level 2 to Pay Level 6',
    grossRange: '₹30,000 – ₹1,40,000',
    netRange: '₹25,000 – ₹1,15,000',
    allowances: ['Dearness Allowance (DA)', 'House Rent Allowance (HRA)', 'Transport Allowance', 'Free Railway Passes (Duty & Privilege)', 'Medical Benefits for family', 'National Pension System (NPS)', 'Leave Travel Concession (LTC)', 'Children Education Allowance'],
    postWiseSalary: [
      { post: 'Station Master', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Goods Guard', payLevel: 'Level 5', basicPay: '₹29,200' },
      { post: 'Commercial Apprentice', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Senior Clerk / Accounts Clerk', payLevel: 'Level 5', basicPay: '₹29,200' },
      { post: 'Junior Clerk / Trains Clerk', payLevel: 'Level 2', basicPay: '₹19,900' },
    ],
  },
  howToApply: [
    'Visit the official RRB website of your region (e.g., rrbcdg.gov.in)',
    'Click on the "New Registration" link for CEN NTPC 2026',
    'Register using a valid email ID and mobile number',
    'Fill in personal, educational, and preference details carefully',
    'Upload scanned photograph (3.5 cm × 4.5 cm) and signature as per specifications',
    'Pay the application fee via online mode (Net Banking/UPI/Debit Card) or offline challan',
    'Review all details, submit the application, and download the confirmation page',
  ],
  faqs: [
    { question: 'What is the RRB NTPC 2026 total vacancy count?', answer: 'RRB NTPC 2026 has approximately 11,558 vacancies across Graduate and Under-Graduate level posts in various railway zones across India.' },
    { question: 'What is the minimum qualification for RRB NTPC?', answer: 'For Graduate-level posts (Station Master, Goods Guard), a bachelor\'s degree is required. For Under-Graduate posts (Junior Clerk), 12th pass (10+2) is the minimum qualification.' },
    { question: 'Is there negative marking in RRB NTPC exam?', answer: 'Yes, there is negative marking of 1/3 of the marks allotted per question for each wrong answer in both CBT-1 and CBT-2 stages.' },
    { question: 'What is the age limit for RRB NTPC 2026?', answer: 'The age limit is 18-33 years for Graduate posts and 18-30 years for Under-Graduate posts. Age relaxation applies for OBC (3 years), SC/ST (5 years), and PwBD (10 years).' },
    { question: 'How many stages are there in RRB NTPC selection?', answer: 'The RRB NTPC selection process has multiple stages: CBT-1 (screening), CBT-2 (merit), CBAT/Typing Test (for specific posts), Document Verification, and Medical Examination.' },
    { question: 'What is the salary of RRB NTPC posts?', answer: 'RRB NTPC salary ranges from ₹19,900 (Level 2) to ₹35,400 (Level 6) basic pay. The gross salary with allowances ranges from ₹30,000 to ₹1,40,000 per month.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://rrbcdg.gov.in',
    instructions: [
      'Visit the official RRB website of your region (e.g. rrbcdg.gov.in for RRB New Delhi)',
      'Click on "Download Admit Card" or "CEN NTPC 2026 Admit Card" link',
      'Log in with your Registration Number and Date of Birth',
      'Download and print the admit card on A4 paper',
      'Carry the printed admit card to the examination hall',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://rrbcdg.gov.in',
    meritListUrl: 'https://rrbcdg.gov.in',
    nextSteps: [
      'Check the result on your regional RRB website — qualified candidates\' roll numbers are published in a PDF',
      'RRBs apply normalisation across multiple shifts to ensure fair scoring — your raw score is converted to a normalised score based on difficulty level of your shift',
      'Download your individual score card from the RRB candidate login portal after result declaration',
      'CBT-1 qualified candidates will be called for CBT-2; specific posts may require CBAT or Typing Skill Test',
      'Final merit list is prepared based on normalised CBT-2 scores and published on respective RRB websites',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '62.50', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '55.75', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '47.25', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '40.50', totalMarks: '100' },
    { year: 2021, category: 'General', cutoffScore: '56.38', totalMarks: '100' },
    { year: 2021, category: 'OBC', cutoffScore: '49.12', totalMarks: '100' },
    { year: 2021, category: 'SC', cutoffScore: '41.87', totalMarks: '100' },
    { year: 2021, category: 'ST', cutoffScore: '35.25', totalMarks: '100' },
    { year: 2019, category: 'General', cutoffScore: '54.22', totalMarks: '100' },
    { year: 2019, category: 'OBC', cutoffScore: '47.65', totalMarks: '100' },
    { year: 2019, category: 'SC', cutoffScore: '40.15', totalMarks: '100' },
    { year: 2019, category: 'ST', cutoffScore: '33.88', totalMarks: '100' },
  ],
  relatedExams: RELATED_EXAMS,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-ntpc-2026-syllabus',
  pageType: 'syllabus',
  metaTitle: 'RRB NTPC 2026 Syllabus — CBT 1 & 2 Topics',
  metaDescription: 'RRB NTPC 2026 complete syllabus for CBT-1 and CBT-2. Subject-wise topics, weightage, and preparation strategy for all NTPC posts.',
  h1: 'RRB NTPC 2026 Syllabus — Complete Subject-wise Topics for CBT-1 & CBT-2',
  overview: `<p>The <strong>RRB NTPC 2026 Syllabus</strong> covers three main subjects for both CBT-1 and CBT-2 stages: General Awareness, Mathematics, and General Intelligence & Reasoning. Understanding the detailed syllabus is crucial for effective preparation, as the NTPC exam is highly competitive with millions of applicants.</p>
<h3>General Awareness</h3>
<p>This section tests candidates' knowledge of current affairs, Indian history, geography, polity, economics, general science, and static GK. Topics include: Indian History (Ancient, Medieval, Modern), Indian Polity & Constitution, Indian Economy & Budget, General Science (Physics, Chemistry, Biology), Geography (India & World), Current Affairs (National & International), Sports, Awards & Honours, Books & Authors, Important Dates, and Scientific Research.</p>
<h3>Mathematics</h3>
<p>The Mathematics section covers: Number System, BODMAS, Decimals, Fractions, LCM & HCF, Ratio & Proportion, Percentages, Mensuration, Time & Work, Time & Distance, Simple & Compound Interest, Profit & Loss, Algebra, Geometry, Trigonometry, Elementary Statistics, Square Root, Age Calculations, Calendar & Clock, and Pipes & Cistern problems.</p>
<h3>General Intelligence & Reasoning</h3>
<p>This section evaluates logical and analytical reasoning abilities. Topics include: Analogies, Alphabetical & Number Series, Coding & Decoding, Mathematical Operations, Relationships, Syllogism, Jumbling, Venn Diagrams, Data Interpretation, Conclusions, Statement-Assumptions, Decision Making, Maps, Graphs Interpretation, Classification, Directions, and Blood Relations.</p>
<h3>CBT-2 Additional Focus Areas</h3>
<p>While CBT-2 covers the same three subjects, the difficulty level is higher and more questions are asked. Candidates should focus on advanced-level problems in Mathematics and deeper analytical reasoning. General Awareness questions may include more current affairs and railway-specific knowledge.</p>
<p>For optimal preparation, candidates should follow the official RRB syllabus, practice previous year papers, and take regular mock tests. The NTPC exam syllabus is largely similar across all RRB zones, ensuring a uniform standard nationwide.</p>`,
  syllabusSummary: `<h3>Subject-wise Topic List</h3>
<ul>
<li><strong>General Awareness (40 marks in CBT-1, 50 marks in CBT-2):</strong> Current Affairs, Indian History, Geography, Polity, Economy, General Science, Static GK, Sports, Awards</li>
<li><strong>Mathematics (30 marks in CBT-1, 35 marks in CBT-2):</strong> Number System, Ratio-Proportion, Percentage, Mensuration, Time-Work-Distance, Algebra, Geometry, Statistics, Interest, Profit-Loss</li>
<li><strong>General Intelligence & Reasoning (30 marks in CBT-1, 35 marks in CBT-2):</strong> Analogies, Series, Coding-Decoding, Venn Diagrams, Syllogism, Data Interpretation, Blood Relations, Directions</li>
</ul>`,
  examPattern: [
    {
      stageName: 'CBT-1 (First Stage)',
      rows: [
        { subject: 'General Awareness', questions: 40, marks: 40, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
    {
      stageName: 'CBT-2 (Second Stage)',
      rows: [
        { subject: 'General Awareness', questions: 50, marks: 50, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 35, marks: 35, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 35, marks: 35, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
  ],
  faqs: [
    { question: 'What subjects are covered in the RRB NTPC syllabus?', answer: 'The RRB NTPC syllabus covers three subjects: General Awareness, Mathematics, and General Intelligence & Reasoning for both CBT-1 and CBT-2 stages.' },
    { question: 'Is the syllabus same for CBT-1 and CBT-2?', answer: 'Yes, both stages cover the same three subjects, but CBT-2 has a higher difficulty level and more questions (120 vs 100).' },
    { question: 'Are there any railway-specific topics in the syllabus?', answer: 'While not a separate section, General Awareness may include questions about Indian Railways history, railway zones, and railway-related current affairs.' },
    { question: 'What is the best strategy to cover the NTPC syllabus?', answer: 'Focus on General Awareness for maximum weightage, practice Mathematics daily, solve previous year papers, and take weekly mock tests.' },
    { question: 'Is the NTPC syllabus same across all RRB zones?', answer: 'Yes, the syllabus is uniform across all Railway Recruitment Boards. Only the question paper varies.' },
  ],
  relatedExams: RELATED_EXAMS,
};

const examPattern: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-ntpc-2026-exam-pattern',
  pageType: 'exam-pattern',
  metaTitle: 'RRB NTPC 2026 Exam Pattern — CBT Stages',
  metaDescription: 'RRB NTPC 2026 exam pattern for CBT-1, CBT-2, CBAT and Typing Test. Total marks, questions, duration, and negative marking details.',
  h1: 'RRB NTPC 2026 Exam Pattern — CBT-1, CBT-2, CBAT & Typing Test Details',
  overview: `<p>The <strong>RRB NTPC 2026 Exam Pattern</strong> consists of multiple stages designed to assess candidates' aptitude, reasoning, and general awareness. Understanding each stage's structure is vital for targeted preparation and time management during the exam.</p>
<h3>CBT-1 (First Stage Computer Based Test)</h3>
<p>CBT-1 is a screening test with 100 questions carrying 100 marks, to be completed in 90 minutes. It covers General Awareness (40 questions), Mathematics (30 questions), and General Intelligence & Reasoning (30 questions). This stage is qualifying in nature — marks are used only to shortlist candidates for CBT-2. There is negative marking of 1/3 mark for each incorrect answer.</p>
<h3>CBT-2 (Second Stage Computer Based Test)</h3>
<p>CBT-2 is the main examination with 120 questions carrying 120 marks in 90 minutes. The distribution is General Awareness (50), Mathematics (35), and General Intelligence & Reasoning (35). CBT-2 marks are used for final merit preparation. The difficulty level is higher than CBT-1. Negative marking of 1/3 applies here as well.</p>
<h3>CBAT (Computer Based Aptitude Test)</h3>
<p>CBAT is conducted only for candidates applying for Station Master and Traffic Assistant posts. It tests cognitive abilities relevant to safe train operations. CBAT is qualifying in nature — candidates must score the minimum cut-off but the marks don't count toward the final merit.</p>
<h3>Typing Skill Test</h3>
<p>For Junior/Senior Clerk grade posts, a typing skill test is conducted. Candidates must demonstrate a typing speed of 30 WPM in English or 25 WPM in Hindi on a computer. This is a qualifying test and marks are not added to the merit.</p>
<p>PwBD candidates with relevant disabilities receive compensatory time of 20 minutes per hour in CBT stages and are exempt from typing tests where applicable.</p>`,
  examPattern: [
    {
      stageName: 'CBT-1 (First Stage)',
      rows: [
        { subject: 'General Awareness', questions: 40, marks: 40, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
    {
      stageName: 'CBT-2 (Second Stage)',
      rows: [
        { subject: 'General Awareness', questions: 50, marks: 50, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 35, marks: 35, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 35, marks: 35, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
  ],
  faqs: [
    { question: 'How many stages are there in RRB NTPC 2026?', answer: 'RRB NTPC has 4 possible stages: CBT-1 (screening), CBT-2 (merit), CBAT (for Station Master), and Typing Test (for Clerk posts). All candidates appear for CBT-1 and CBT-2.' },
    { question: 'What is the total marks in RRB NTPC CBT-2?', answer: 'CBT-2 has 120 questions worth 120 marks, to be completed in 90 minutes across three subjects.' },
    { question: 'Is there negative marking in NTPC exam?', answer: 'Yes, 1/3 of the marks allotted to a question are deducted for each wrong answer in CBT-1 and CBT-2.' },
    { question: 'Is CBAT mandatory for all NTPC candidates?', answer: 'No, CBAT is only for candidates who have opted for Station Master and Traffic Assistant posts. Other candidates are not required to appear.' },
    { question: 'What is the typing speed required for clerk posts?', answer: '30 WPM in English or 25 WPM in Hindi on a computer keyboard. It is a qualifying test.' },
  ],
  relatedExams: RELATED_EXAMS,
};

const eligibility: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-ntpc-2026-eligibility',
  pageType: 'eligibility',
  metaTitle: 'RRB NTPC 2026 Eligibility — Age & Qualification',
  metaDescription: 'RRB NTPC 2026 eligibility criteria including age limit, educational qualification, age relaxation for OBC/SC/ST/PwBD and nationality requirements.',
  h1: 'RRB NTPC 2026 Eligibility Criteria — Age Limit, Qualification & Relaxation',
  overview: `<p>The <strong>RRB NTPC 2026 Eligibility Criteria</strong> defines the minimum requirements candidates must meet to apply for Non-Technical Popular Categories posts in Indian Railways. The eligibility varies by post category — Graduate-level and Under-Graduate-level — with specific age limits, educational qualifications, and nationality requirements.</p>
<h3>Educational Qualification Requirements</h3>
<p>RRB NTPC posts are divided into two categories based on educational qualification:</p>
<p><strong>Graduate-Level Posts:</strong> Candidates must hold a Bachelor's degree from a recognized university in any discipline. These posts include Station Master, Goods Guard, Commercial Apprentice, Senior Clerk cum Typist, Traffic Assistant, and Senior Time Keeper. Some posts may require additional typing proficiency.</p>
<p><strong>Under-Graduate-Level Posts:</strong> Candidates must have passed 12th class (10+2) from a recognized board. Posts include Junior Clerk cum Typist, Accounts Clerk cum Typist, Trains Clerk, Junior Time Keeper, and Commercial cum Ticket Clerk. Typing proficiency of 30 WPM English or 25 WPM Hindi is required for clerk posts.</p>
<h3>Age Limit Details</h3>
<p>The age is calculated as on the date specified in the notification. For Graduate posts, candidates must be between 18 and 33 years of age. For Under-Graduate posts, the age range is 18 to 30 years. These limits apply to General/EWS category candidates.</p>
<h3>Age Relaxation for Reserved Categories</h3>
<p>OBC-NCL candidates receive 3 years relaxation, SC/ST candidates get 5 years, PwBD candidates receive 10 years (13 for OBC PwBD, 15 for SC/ST PwBD), and Ex-Servicemen get relaxation as per existing government rules. Candidates from Jammu & Kashmir who were domiciled during 1980-1989 get 5 years relaxation.</p>
<h3>Medical Standards</h3>
<p>Candidates must meet the medical fitness standards prescribed by the Railway Board. Specific visual acuity standards apply for safety-category posts like Station Master and Goods Guard. Candidates are advised to check the detailed medical standards in the official notification before applying.</p>`,
  eligibility: `<h3>Qualification by Post Category</h3><p><strong>Graduate Posts (Level 5-6):</strong> Bachelor's degree from a recognized university — Station Master, Goods Guard, Commercial Apprentice, Senior Clerk</p><p><strong>Under-Graduate Posts (Level 2):</strong> 12th pass (10+2) from a recognized board — Junior Clerk, Accounts Clerk, Trains Clerk</p><h3>Age Limit</h3><p>Graduate Posts: 18-33 years | Under-Graduate Posts: 18-30 years</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: as per rules</p>`,
  faqs: [
    { question: 'What is the qualification for RRB NTPC Graduate posts?', answer: 'A Bachelor\'s degree in any discipline from a recognized university is required for Graduate-level NTPC posts like Station Master, Goods Guard, and Commercial Apprentice.' },
    { question: 'Can 12th pass candidates apply for NTPC?', answer: 'Yes, 12th pass candidates can apply for Under-Graduate level posts such as Junior Clerk, Accounts Clerk, and Trains Clerk.' },
    { question: 'What is the maximum age for NTPC 2026?', answer: 'Maximum age is 33 years for Graduate posts and 30 years for Under-Graduate posts for General/EWS category candidates.' },
    { question: 'Is there age relaxation for OBC in NTPC?', answer: 'Yes, OBC-NCL candidates get 3 years of age relaxation over the upper age limit.' },
    { question: 'Are final year students eligible for NTPC?', answer: 'Candidates appearing in their final year of graduation can apply provisionally, but must produce the degree certificate at the time of document verification.' },
  ],
  relatedExams: RELATED_EXAMS,
};

const salary: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-ntpc-2026-salary',
  pageType: 'salary',
  metaTitle: 'RRB NTPC 2026 Salary — Pay Level & In-Hand',
  metaDescription: 'RRB NTPC 2026 salary structure. Post-wise basic pay, gross salary, in-hand salary, pay levels, allowances and railway benefits explained.',
  h1: 'RRB NTPC 2026 Salary Structure — Post-wise Pay Level, Allowances & In-Hand Salary',
  overview: `<p>The <strong>RRB NTPC 2026 Salary</strong> is structured under the 7th Central Pay Commission (7th CPC) and varies based on the post category. NTPC posts fall under Pay Level 2 to Pay Level 6, offering competitive compensation along with numerous railway-specific benefits that make it one of the most attractive government employment opportunities.</p>
<h3>Pay Scale Overview</h3>
<p>Under-Graduate level posts like Junior Clerk and Trains Clerk start at Pay Level 2 with a basic pay of ₹19,900 per month. Graduate-level posts such as Goods Guard and Senior Clerk are placed in Pay Level 5 with ₹29,200 basic pay. Premium posts like Station Master and Commercial Apprentice are in Pay Level 6 with ₹35,400 basic pay.</p>
<h3>Gross and In-Hand Salary Calculation</h3>
<p>The gross salary includes basic pay plus Dearness Allowance (DA), House Rent Allowance (HRA), Transport Allowance, and other applicable allowances. For a Pay Level 6 officer (Station Master), the gross salary is approximately ₹55,000-₹65,000 in the initial years. After deductions for NPS, income tax, and professional tax, the in-hand salary ranges from ₹45,000 to ₹55,000 per month.</p>
<p>For Pay Level 2 posts (Junior Clerk), the initial gross salary is approximately ₹30,000-₹35,000, with in-hand salary around ₹25,000-₹30,000 per month. These figures vary based on the city of posting (X, Y, or Z classification for HRA purposes).</p>
<h3>Railway-Specific Benefits</h3>
<p>Railway employees enjoy several unique benefits including free railway travel passes (duty and privilege passes), subsidized housing in railway colonies, railway hospitals with free medical treatment for the employee and family, children education allowance, Leave Travel Concession (LTC), and post-retirement benefits including pension under NPS. These non-monetary benefits significantly enhance the total compensation package.</p>`,
  salary: {
    salaryMin: 19900,
    salaryMax: 112400,
    payLevels: 'Pay Level 2 to Pay Level 6',
    grossRange: '₹30,000 – ₹1,40,000',
    netRange: '₹25,000 – ₹1,15,000',
    allowances: ['Dearness Allowance (DA)', 'House Rent Allowance (HRA)', 'Transport Allowance', 'Free Railway Passes (Duty & Privilege)', 'Medical Benefits for family', 'National Pension System (NPS)', 'Leave Travel Concession (LTC)', 'Children Education Allowance'],
    postWiseSalary: [
      { post: 'Station Master', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Goods Guard', payLevel: 'Level 5', basicPay: '₹29,200' },
      { post: 'Commercial Apprentice', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Senior Clerk / Accounts Clerk', payLevel: 'Level 5', basicPay: '₹29,200' },
      { post: 'Junior Clerk / Trains Clerk', payLevel: 'Level 2', basicPay: '₹19,900' },
    ],
  },
  faqs: [
    { question: 'What is the starting salary for RRB NTPC Station Master?', answer: 'Station Master is placed in Pay Level 6 with a basic pay of ₹35,400. The gross salary is approximately ₹55,000-₹65,000 and in-hand salary is around ₹45,000-₹55,000 per month.' },
    { question: 'Do NTPC employees get free railway passes?', answer: 'Yes, all railway employees including NTPC recruits receive free duty passes and privilege passes for personal travel. Family members also get passes for a limited number of journeys per year.' },
    { question: 'What is the salary difference between Graduate and UG posts?', answer: 'Graduate-level posts start at ₹29,200-₹35,400 basic pay (Level 5-6), while Under-Graduate posts start at ₹19,900 (Level 2).' },
    { question: 'Is there pension for RRB NTPC employees?', answer: 'Yes, NTPC recruits are covered under the National Pension System (NPS). Both the employee and the employer contribute 10% each of the basic pay plus DA.' },
    { question: 'How does the salary increase over time?', answer: 'Railway employees receive annual increments of 3% of basic pay, periodic pay commission revisions (every 10 years), and promotions to higher pay levels based on seniority and departmental exams.' },
  ],
  relatedExams: RELATED_EXAMS,
};

const cutoff: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-ntpc-cutoff',
  pageType: 'cutoff',
  metaTitle: 'RRB NTPC Cutoff 2026 — Category-Wise Cut Off Marks',
  metaDescription: 'RRB NTPC cutoff 2026: Category-wise cut off marks for CBT-1 & CBT-2. Previous year cutoffs (2019-2024) with trend analysis.',
  h1: 'RRB NTPC Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',
  overview: `<p>The <strong>RRB NTPC Cutoff</strong> is a key factor in railway recruitment, determining which candidates advance from CBT-1 to CBT-2 and ultimately to the final merit list. Railway Recruitment Boards release zone-wise cutoffs, meaning cutoff scores vary across different RRBs (e.g., RRB Allahabad may have different cutoffs than RRB Chennai) based on the number of applicants and vacancies in each zone.</p>

<h3>How RRB NTPC Cutoff Works</h3>
<p>RRB NTPC cutoffs are determined separately for each stage:</p>
<ul>
<li><strong>CBT-1 Cutoff:</strong> Screening stage — determines who proceeds to CBT-2. Typically 15-20 times the number of vacancies are shortlisted.</li>
<li><strong>CBT-2 Cutoff:</strong> Merit stage — final selection is based on normalised CBT-2 scores. Post-wise cutoffs apply (Station Master vs Junior Clerk cutoffs differ).</li>
</ul>

<p>RRBs apply normalisation across multiple shifts to ensure fairness. The cutoff is based on normalised scores, not raw marks. This accounts for variations in question difficulty between different exam shifts.</p>

<h3>RRB NTPC Cutoff Trend Analysis (2019–2024)</h3>
<p>Over the past three recruitment cycles, RRB NTPC CBT-1 cutoffs have shown moderate fluctuation. General category cutoffs ranged from 54.22 (2019) to 62.50 (2024), showing a general upward trend. The significant jump between 2021 and 2024 cutoffs reflects both increased competition and higher candidate preparedness.</p>

<p>OBC cutoffs have tracked a similar pattern, rising from 47.65 (2019) to 55.75 (2024). SC and ST cutoffs show smaller absolute increases but remain proportionally challenging given the reservation quotas.</p>

<h3>Expected RRB NTPC 2026 Cutoff</h3>
<p>Based on the 3-cycle trend, the RRB NTPC 2026 CBT-1 cutoff for General category is expected to be in the <strong>63–68 range out of 100 marks</strong>. However, the actual cutoff will depend on the total vacancies (estimated 11,558), number of applicants (expected 1.5+ crore), and exam difficulty level.</p>

<p>Candidates should target a score of <strong>70+ marks in CBT-1</strong> to be safely above the expected cutoff across all RRB zones. For CBT-2, a score of 80+ out of 120 is recommended for Graduate-level posts.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '62.50', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '55.75', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '47.25', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '40.50', totalMarks: '100' },
    { year: 2024, category: 'EWS', cutoffScore: '58.00', totalMarks: '100' },
    { year: 2021, category: 'General', cutoffScore: '56.38', totalMarks: '100' },
    { year: 2021, category: 'OBC', cutoffScore: '49.12', totalMarks: '100' },
    { year: 2021, category: 'SC', cutoffScore: '41.87', totalMarks: '100' },
    { year: 2021, category: 'ST', cutoffScore: '35.25', totalMarks: '100' },
    { year: 2019, category: 'General', cutoffScore: '54.22', totalMarks: '100' },
    { year: 2019, category: 'OBC', cutoffScore: '47.65', totalMarks: '100' },
    { year: 2019, category: 'SC', cutoffScore: '40.15', totalMarks: '100' },
    { year: 2019, category: 'ST', cutoffScore: '33.88', totalMarks: '100' },
  ],

  faqs: [
    { question: 'What is the expected RRB NTPC 2026 cutoff?', answer: 'The General category CBT-1 cutoff for RRB NTPC 2026 is expected to be around 63-68 out of 100 marks based on the 2019-2024 trend. Aim for 70+ to be safe.' },
    { question: 'Is RRB NTPC cutoff same for all zones?', answer: 'No, RRB NTPC cutoffs vary by zone. Each RRB releases separate cutoffs based on the number of applicants and vacancies in that zone.' },
    { question: 'Does RRB apply normalisation to NTPC scores?', answer: 'Yes, RRBs apply normalisation across multiple shifts to account for difficulty variations. Cutoffs are based on normalised scores, not raw marks.' },
    { question: 'What is the CBT-2 cutoff for Station Master?', answer: 'Station Master (Level 6) cutoff is typically higher than other NTPC posts due to its premium pay level and limited vacancies. Previous CBT-2 cutoffs ranged from 72-80 out of 120.' },
    { question: 'Is RRB NTPC cutoff increasing every year?', answer: 'Yes, there is a general upward trend. General cutoff rose from 54.22 (2019) to 62.50 (2024), reflecting increased competition and better preparation levels.' },
  ],

  relatedExams: [
    { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
    { label: 'RRB NTPC Syllabus 2026', href: '/rrb-ntpc-2026-syllabus' },
    { label: 'RRB NTPC Previous Year Papers', href: '/rrb-ntpc-previous-year-paper' },
    { label: 'RRB ALP Cutoff', href: '/rrb-alp-cutoff' },
    { label: 'SSC CGL Cutoff', href: '/ssc-cgl-cutoff' },
  ],
};

const ageLimit: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-ntpc-age-limit', pageType: 'age-limit',
  metaTitle: 'RRB NTPC Age Limit 2026 — Post-Wise & Relaxation',
  metaDescription: 'RRB NTPC age limit 2026: Post-wise age requirements (18-33 for Graduate, 18-33 for UG). Category-wise relaxation details.',
  h1: 'RRB NTPC Age Limit 2026 — Post-Wise Requirements & Category Relaxation',
  overview: `<p>The <strong>RRB NTPC Age Limit</strong> varies by post level. Graduate-level posts (Station Master, Goods Guard, Commercial Apprentice) and Under-Graduate posts (Junior Clerk, Trains Clerk) have different upper age limits. Understanding the post-wise breakdown is essential for choosing the right posts during application.</p>

<h3>RRB NTPC 2026 Age Limit — Post-Wise</h3>
<ul>
<li><strong>Graduate Level Posts (Level 5/6):</strong> 18–33 years — Station Master, Goods Guard, Commercial Apprentice, Senior Clerk cum Typist, Accounts Clerk</li>
<li><strong>Under-Graduate Level Posts (Level 2/3):</strong> 18–33 years — Junior Clerk cum Typist, Trains Clerk, Junior Time Keeper</li>
</ul>

<h3>Category-Wise Age Relaxation</h3>
<ul>
<li><strong>OBC (NCL):</strong> 3 years (up to 36 years)</li>
<li><strong>SC/ST:</strong> 5 years (up to 38 years)</li>
<li><strong>PwBD (General):</strong> 10 years | (OBC): 13 years | (SC/ST): 15 years</li>
<li><strong>Ex-Servicemen:</strong> Military service + 3 years deduction</li>
<li><strong>Existing Railway Staff:</strong> up to 40 years</li>
</ul>

<p>Railway NTPC has one of the widest eligibility windows among government exams. The 33-year upper limit combined with category relaxations means candidates born between 1988-2008 could be eligible (depending on category). Use our <a href="/govt-job-age-calculator">Age Calculator</a> to check instantly.</p>

<h3>Key Points</h3>
<ul>
<li>Age is calculated as per the closing date of application notified by RRBs</li>
<li>DOB from 10th class certificate is the official reference</li>
<li>All NTPC posts share the same age bracket — unlike SSC CGL where post-wise limits differ</li>
<li>The generous limit makes NTPC popular among older candidates who have crossed limits for SSC/banking exams</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary</h3><ul><li><strong>General:</strong> 18–33</li><li><strong>OBC:</strong> 18–36</li><li><strong>SC/ST:</strong> 18–38</li><li><strong>PwBD:</strong> 18–43/46/48</li></ul>`,
  faqs: [
    { question: 'What is the age limit for RRB NTPC 2026?', answer: '18-33 years for General category for all NTPC posts. OBC: 36, SC/ST: 38.' },
    { question: 'Is the age limit same for Graduate and UG posts?', answer: 'Yes, both Graduate and Under-Graduate level NTPC posts have the same 18-33 age limit for General category.' },
    { question: 'Can a 34-year-old OBC apply for NTPC?', answer: 'Yes, OBC candidates get 3 years relaxation, so the upper limit is 36 years.' },
    { question: 'Is NTPC age limit higher than SSC CGL?', answer: 'Yes, NTPC allows up to 33 (Gen) while SSC CGL posts range from 27-32 depending on the post.' },
    { question: 'Do existing railway employees get extra relaxation?', answer: 'Yes, existing Group C/D railway employees get relaxation up to 40 years for NTPC posts.' },
  ],
  relatedExams: RELATED_EXAMS,
};

export const RRB_NTPC_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPattern, eligibility, salary, cutoff, ageLimit];
