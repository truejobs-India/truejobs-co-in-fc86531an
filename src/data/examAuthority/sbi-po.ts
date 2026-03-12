import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'banking-jobs' as const,
  examName: 'SBI PO',
  examYear: 2026,
  conductingBody: 'State Bank of India (SBI)',
  officialWebsite: 'sbi.co.in/careers',
  datePublished: '2026-01-15',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'SBI Clerk 2026 Notification', href: '/sbi-clerk-2026-notification' },
  { label: 'IBPS PO 2026 Notification', href: '/ibps-po-2026-notification' },
  { label: 'IBPS Clerk 2026 Notification', href: '/ibps-clerk-2026-notification' },
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'SBI PO 2026 Syllabus', href: '/sbi-po-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'sbi-po-2026-notification',
  pageType: 'notification',
  metaTitle: 'SBI PO 2026 Notification — Vacancies & Apply',
  metaDescription: 'SBI PO 2026 Notification out. Check vacancies, eligibility, exam dates and apply online for Probationary Officer posts in State Bank of India.',
  h1: 'SBI PO 2026 Notification — Vacancies, Eligibility & How to Apply',
  totalVacancies: 2000,
  applicationEndDate: '2026-04-30',
  applyLink: 'https://sbi.co.in/careers',
  overview: `<p>The State Bank of India has released the <strong>SBI PO 2026 Notification</strong> for the recruitment of <strong>Probationary Officers (POs)</strong>. Approximately <strong>2,000 vacancies</strong> have been announced for this year's recruitment cycle. SBI, being India's largest public sector bank with over 22,000 branches, offers unmatched career opportunities in the banking sector.</p>
<p>SBI PO is widely considered the most prestigious banking exam in India. The rigorous three-stage selection process — Prelims, Mains, and Interview — ensures that only the most capable candidates are selected. POs undergo a 2-year probation period during which they are trained in various banking operations before confirmation as officers.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>State Bank of India</td></tr><tr><td>Post</td><td>Probationary Officer</td></tr><tr><td>Total Vacancies</td><td>2,000 (approximate)</td></tr><tr><td>Qualification</td><td>Graduation in any discipline</td></tr><tr><td>Selection</td><td>Prelims → Mains → Interview/GE</td></tr><tr><td>Official Website</td><td>sbi.co.in/careers</td></tr></table>
<p>SBI PO salary starts at ₹41,960 per month (basic) under JMGS-I scale, which is higher than IBPS PO due to SBI's additional special allowance. The gross salary with DA, HRA, and other allowances ranges from ₹56,000 to ₹65,000 per month initially. SBI officers enjoy India's best banking perks including leased accommodation, vehicle allowance, and comprehensive medical coverage.</p>
<p>The selection includes a Group Exercise (GE) and Interview, together carrying significant weightage. SBI conducts its own recruitment independently from IBPS, and selected candidates are posted only in SBI and its associate offices.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-03-01' },
    { label: 'Online Application Start', date: '2026-03-15' },
    { label: 'Application Last Date', date: '2026-04-30' },
    { label: 'Prelims Exam', date: 'June 2026' },
    { label: 'Mains Exam', date: 'July 2026' },
    { label: 'Interview/GE', date: 'September 2026' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>Graduation in any discipline from a recognized university or equivalent qualification. Final year students are eligible to apply provisionally.</p><h3>Age Limit</h3><p>21 to 30 years</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: 5 years</p>`,
  feeStructure: { general: 750, obc: 750, scSt: 125, female: 125, ph: 125, paymentModes: ['Online (Net Banking, UPI, Debit Card, Credit Card)'] },
  selectionProcess: [
    'Preliminary Examination — online objective (screening)',
    'Main Examination — online objective + descriptive (merit)',
    'Group Exercise (GE) — group discussion/activity',
    'Interview — personal interview by panel',
    'Final Merit based on Mains + GE + Interview',
  ],
  examPattern: [
    { stageName: 'Prelims', rows: [
      { subject: 'English Language', questions: 30, marks: 30, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Quantitative Aptitude', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Reasoning Ability', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
    { stageName: 'Mains (Objective + Descriptive)', rows: [
      { subject: 'Reasoning & Computer Aptitude', questions: 45, marks: 60, duration: '60 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Data Analysis & Interpretation', questions: 35, marks: 60, duration: '45 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'General/Economy/Banking Awareness', questions: 40, marks: 40, duration: '35 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'English Language', questions: 35, marks: 40, duration: '40 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 41960, salaryMax: 63840, payLevels: 'JMGS-I', grossRange: '₹56,000 – ₹78,000', netRange: '₹45,000 – ₹63,000',
    allowances: ['DA', 'HRA', 'CCA', 'Special Allowance', 'Medical Insurance', 'Concessional Loans', 'Leased Accommodation', 'Vehicle Allowance', 'LFC', 'NPS'],
    postWiseSalary: [
      { post: 'SBI PO (Initial)', payLevel: 'JMGS-I', basicPay: '₹41,960' },
      { post: 'SBI PO (after 7 years)', payLevel: 'JMGS-I', basicPay: '₹52,390' },
    ],
  },
  howToApply: [
    'Visit sbi.co.in/careers and find PO recruitment link',
    'Register with valid email and mobile number',
    'Fill application with personal and educational details',
    'Upload photo, signature, and required documents',
    'Pay application fee online',
    'Select exam centre preferences',
    'Submit and save registration number',
  ],
  faqs: [
    { question: 'What is SBI PO 2026 vacancy count?', answer: 'Approximately 2,000 vacancies for Probationary Officer posts in State Bank of India.' },
    { question: 'Is SBI PO salary higher than IBPS PO?', answer: 'Yes, SBI PO starts at ₹41,960 basic (due to SBI special allowance) vs IBPS PO at ₹36,000.' },
    { question: 'Is there group discussion in SBI PO?', answer: 'Yes, SBI PO has a Group Exercise (GE) in addition to the interview, unlike IBPS PO which only has interview.' },
    { question: 'What is the age limit for SBI PO?', answer: '21 to 30 years for General category with standard relaxations for reserved categories.' },
    { question: 'Can SBI PO be posted anywhere in India?', answer: 'Yes, SBI POs can be posted at any SBI branch across India during the probation period.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://sbi.co.in/careers',
    instructions: [
      'Visit sbi.co.in/careers and navigate to the PO recruitment section',
      'Click on "Download Admit Card" or "Call Letter" link for SBI PO 2026',
      'Log in with your Registration Number and Date of Birth or Password',
      'Download and print the admit card on A4 paper',
      'Carry the printed admit card to the examination hall',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://sbi.co.in/careers',
    meritListUrl: 'https://sbi.co.in/careers',
    nextSteps: [
      'Check the result on sbi.co.in/careers — individual score cards are made available for download',
      'SBI PO does not use normalisation — scores are directly computed from the online exam',
      'Download your individual score card showing section-wise and overall scores',
      'Prelims qualified candidates will be called for Mains; Mains qualifiers proceed to Group Exercise (GE) and Interview',
      'Final merit list is prepared based on Mains (75%) + GE & Interview (25%) weighted scores',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: 'Varies by State', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: 'Varies by State', totalMarks: '100' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-po-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'SBI PO 2026 Syllabus — Prelims & Mains Topics',
  metaDescription: 'SBI PO 2026 complete syllabus for Prelims and Mains. English, Quant, Reasoning, Banking Awareness and Descriptive paper topics.',
  h1: 'SBI PO 2026 Syllabus — Prelims & Mains Complete Topic List',
  overview: `<p>The <strong>SBI PO 2026 Syllabus</strong> is similar to IBPS PO but SBI's question paper tends to be slightly harder with more advanced reasoning puzzles and data interpretation questions.</p>
<h3>Prelims Syllabus</h3>
<p><strong>English (30):</strong> Reading Comprehension, Cloze Test, Error Spotting, Para Jumbles, Fillers, Sentence Improvement, Vocabulary-based questions.</p>
<p><strong>Quantitative Aptitude (35):</strong> Simplification, Number Series, Data Interpretation (Bar/Line/Pie/Tabular/Caselet), Percentage, Ratio-Proportion, Profit-Loss, Time-Speed-Distance, SI/CI, Probability, Quadratic Equations.</p>
<p><strong>Reasoning (35):</strong> Puzzles & Seating Arrangement (linear, circular, floor-based), Syllogism, Inequality, Coding-Decoding, Blood Relations, Direction Sense, Data Sufficiency.</p>
<h3>Mains Syllabus</h3>
<p><strong>Reasoning & Computer Aptitude (60):</strong> Advanced Puzzles, Machine Input-Output, Coding with conditions, Data Sufficiency, plus Computer Fundamentals, MS Office, Internet, Networking, DBMS, Cyber Security basics.</p>
<p><strong>Data Analysis & Interpretation (60):</strong> Advanced DI (Caselet, Mixed, Missing), Probability, Permutation-Combination, Data Sufficiency with quantitative data.</p>
<p><strong>General/Economy/Banking Awareness (40):</strong> Current Affairs, Banking Awareness, RBI policies, Government Schemes, Budget, Economic Survey, Financial Markets, International Organizations.</p>
<p><strong>English (40):</strong> Advanced RC, Error Detection, Sentence Connectors, Paragraph Completion, Word Usage, Idioms & Phrases.</p>
<p><strong>Descriptive (50 marks, 30 min):</strong> Essay Writing (250 words) and Letter Writing (150 words) in English.</p>`,
  syllabusSummary: `<ul><li><strong>Prelims:</strong> English (30), Quant (35), Reasoning (35) — 1 hour total</li><li><strong>Mains Objective:</strong> Reasoning+Computer (60), Data Analysis (60), Banking GK (40), English (40) — 3 hours</li><li><strong>Mains Descriptive:</strong> Essay + Letter Writing (50 marks, 30 min)</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is SBI PO syllabus same as IBPS PO?', answer: 'Largely similar but SBI tends to ask harder questions, especially in reasoning puzzles and DI. Descriptive paper carries 50 marks vs 25 in IBPS PO.' },
    { question: 'How many marks is the descriptive paper?', answer: 'SBI PO Mains descriptive paper is 50 marks (higher than IBPS PO\'s 25 marks), with 30 minutes duration.' },
    { question: 'What topics come in banking awareness?', answer: 'RBI policies, banking terminology, financial regulations, government schemes, SBI history, and financial market concepts.' },
    { question: 'Is computer knowledge tested separately?', answer: 'No, it is combined with Reasoning in Mains (60 marks total). Topics include hardware, software, OS, networking, and cyber security.' },
    { question: 'Are SBI PO questions harder than IBPS PO?', answer: 'Generally yes — SBI is known for more complex puzzles, higher-level DI, and trickier English questions.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-po-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'SBI PO 2026 Exam Pattern — All Stages',
  metaDescription: 'SBI PO 2026 exam pattern. Prelims, Mains objective, descriptive, Group Exercise and interview structure with marks and time.',
  h1: 'SBI PO 2026 Exam Pattern — Prelims, Mains, GE & Interview Details',
  overview: `<p>The <strong>SBI PO 2026 Exam Pattern</strong> has three phases: Phase I (Prelims), Phase II (Mains with objective + descriptive), and Phase III (Group Exercise + Interview).</p>
<h3>Phase I — Prelims</h3>
<p>100 questions, 100 marks, 60 minutes with sectional time. English (30Q, 20min), Quant (35Q, 20min), Reasoning (35Q, 20min). Negative marking 0.25. Sectional cutoffs. Screening only.</p>
<h3>Phase II — Mains</h3>
<p><strong>Objective:</strong> 155 questions, 200 marks, 180 minutes. Reasoning+Computer (45Q, 60M, 60min), Data Analysis (35Q, 60M, 45min), Banking GK (40Q, 40M, 35min), English (35Q, 40M, 40min). <strong>Descriptive:</strong> 50 marks, 30 min — Essay + Letter Writing. Total Mains = 250 marks. Sectional cutoffs in objective.</p>
<h3>Phase III — GE & Interview</h3>
<p>Group Exercise: Candidates participate in group discussions/activities assessed on leadership, teamwork, and communication. Interview: Personal interview by a panel testing banking awareness, personality, and career motivation. Combined GE+Interview = 50 marks.</p>
<h3>Final Merit</h3>
<p>Final merit = Mains Marks (75% weightage) + GE & Interview Marks (25% weightage). Candidates are ranked on this combined score and allotted to SBI branches.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How is SBI PO final merit calculated?', answer: 'Mains score (75%) + GE & Interview score (25%) determines the final merit ranking.' },
    { question: 'What is Group Exercise in SBI PO?', answer: 'A group activity where candidates discuss a topic and are evaluated on communication, leadership, and teamwork.' },
    { question: 'Is the descriptive paper evaluated for everyone?', answer: 'No, only candidates who qualify the objective paper have their descriptive papers evaluated.' },
    { question: 'What is the total duration of SBI PO Mains?', answer: '3 hours for objective + 30 minutes for descriptive = 3.5 hours total.' },
    { question: 'Is there negative marking in SBI PO?', answer: 'Yes, 0.25 marks deducted per wrong answer in both Prelims and Mains objective sections.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-po-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'SBI PO 2026 Eligibility — Age & Qualification',
  metaDescription: 'SBI PO 2026 eligibility criteria. Age limit 21-30, graduation requirement, age relaxation and additional requirements for SBI PO.',
  h1: 'SBI PO 2026 Eligibility — Age, Qualification & Requirements',
  overview: `<p>The <strong>SBI PO 2026 Eligibility</strong> is similar to IBPS PO but with a slightly different age bracket. Any graduate can apply regardless of discipline or percentage.</p>
<h3>Educational Qualification</h3>
<p>Graduation in <strong>any discipline</strong> from a recognized university. Final year students can apply. No minimum percentage requirement.</p>
<h3>Age Limit</h3>
<p>21 to 30 years for General/EWS (slightly different from IBPS PO which is 20-30).</p>
<h3>Age Relaxation</h3>
<p>SC/ST: 5 years | OBC-NCL: 3 years | PwBD: 10 years | Ex-SM: 5 years | J&K domicile: 5 years | Persons affected by 1984 riots: 5 years</p>
<h3>Additional Notes</h3>
<p>SBI PO is a transferable post — candidates must be willing to serve anywhere in India. Basic computer proficiency is required. Strong communication skills in English and the local language of the posting state are important for the interview/GE round.</p>`,
  eligibility: `<h3>Qualification</h3><p>Graduation in any discipline from a recognized university</p><h3>Age</h3><p>21-30 years (General) | OBC: +3 | SC/ST: +5 | PwBD: +10</p>`,
  faqs: [
    { question: 'What is the minimum age for SBI PO?', answer: '21 years (vs 20 for IBPS PO). Maximum is 30 years for General category.' },
    { question: 'Can commerce graduates apply?', answer: 'Yes, graduation in any discipline is accepted — Arts, Science, Commerce, Engineering, Law, etc.' },
    { question: 'Is there a percentage criteria?', answer: 'No minimum percentage is specified by SBI for PO recruitment.' },
    { question: 'Is SBI PO a transferable job?', answer: 'Yes, SBI PO is a transferable post. You can be posted at any SBI branch in India.' },
    { question: 'Can NRI apply for SBI PO?', answer: 'Only Indian citizens or subjects of specified countries (Nepal, Bhutan) can apply. NRIs are generally not eligible.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-po-2026-salary', pageType: 'salary',
  metaTitle: 'SBI PO 2026 Salary — Pay Scale & Benefits',
  metaDescription: 'SBI PO 2026 salary. JMGS-I pay scale with SBI special allowance, basic pay ₹41,960, gross salary, in-hand and exclusive SBI perks.',
  h1: 'SBI PO 2026 Salary — JMGS-I Scale, In-Hand Salary & SBI Perks',
  overview: `<p>The <strong>SBI PO 2026 Salary</strong> is the highest among bank PO positions due to SBI's additional special allowance. Starting basic pay is ₹41,960 under JMGS-I, significantly higher than the ₹36,000 starting pay in other nationalized banks.</p>
<h3>Salary Structure</h3>
<p>SBI PO basic pay starts at ₹41,960 (includes SBI's stagnation increment benefit). With DA (approximately 18%), HRA (7-9%), CCA, special allowance, and other components, the gross salary is approximately ₹56,000-₹65,000 per month initially. In metro cities like Mumbai, Delhi, or Bangalore, the gross can reach ₹65,000+ due to higher HRA.</p>
<h3>In-Hand Salary</h3>
<p>After NPS deduction (10%), income tax, and professional tax, the in-hand salary ranges from ₹45,000-₹55,000 per month. This makes SBI PO one of the highest-paying entry-level government positions.</p>
<h3>Exclusive SBI Perks</h3>
<p>SBI officers enjoy premium perks: fully furnished leased accommodation (or HRA), vehicle/conveyance allowance, reimbursement for newspaper/magazines, entertainment allowance, briefcase allowance, staff loans at minimal interest (home loan at ~1-2% below market rate), comprehensive Mediclaim policy for entire family, and membership in staff welfare clubs.</p>
<h3>Career Growth</h3>
<p>SBI PO → MMGS-II (Manager) → MMGS-III (Chief Manager) → SMGS-IV (AGM) → SMGS-V (DGM) → TEGS-VI (GM) → TEGS-VII (CGM). The highest position (Chairman) is at the apex. With promotions, salary can exceed ₹2,50,000 per month at senior management levels.</p>`,
  salary: {
    salaryMin: 41960, salaryMax: 63840, payLevels: 'JMGS-I (with SBI Special Allowance)', grossRange: '₹56,000 – ₹78,000', netRange: '₹45,000 – ₹63,000',
    allowances: ['DA', 'HRA', 'CCA', 'SBI Special Allowance', 'Medical Insurance (Mediclaim)', 'Staff Loans at concessional rates', 'Leased Accommodation', 'Vehicle Allowance', 'LFC', 'NPS', 'Entertainment Allowance', 'Newspaper Allowance'],
    postWiseSalary: [
      { post: 'SBI PO (Initial)', payLevel: 'JMGS-I', basicPay: '₹41,960' },
      { post: 'Manager (MMGS-II promotion)', payLevel: 'MMGS-II', basicPay: '₹48,170' },
      { post: 'Chief Manager (MMGS-III)', payLevel: 'MMGS-III', basicPay: '₹63,840' },
    ],
  },
  faqs: [
    { question: 'Why is SBI PO salary higher than IBPS PO?', answer: 'SBI pays an additional special allowance over the standard banking pay scale, making the starting basic ₹41,960 vs ₹36,000.' },
    { question: 'What is SBI PO in-hand salary?', answer: 'Approximately ₹45,000-₹55,000 per month after all deductions, varying by city of posting.' },
    { question: 'Do SBI POs get leased accommodation?', answer: 'Yes, SBI provides fully furnished leased accommodation to officers, especially in metro and semi-urban areas.' },
    { question: 'What is the home loan interest rate for SBI employees?', answer: 'SBI employees get staff home loans at approximately 1-2% below the standard SBI home loan rate.' },
    { question: 'What is the salary of SBI Manager?', answer: 'After promotion to MMGS-II (Manager), basic pay starts at ₹48,170 with gross salary exceeding ₹70,000.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-po-cutoff', pageType: 'cutoff',
  metaTitle: 'SBI PO Cutoff 2026 — Prelims & Mains Cut Off',
  metaDescription: 'SBI PO cutoff 2026: Category-wise cut off marks for Prelims and Mains. Previous year cutoffs 2022-2024 with trend.',
  h1: 'SBI PO Cutoff 2026 — Category-Wise Prelims & Mains Cut Off Marks',
  overview: `<p>The <strong>SBI PO Cutoff</strong> is among the most competitive in banking recruitment. As India's largest public sector bank, SBI attracts lakhs of applicants for limited PO vacancies, pushing cutoffs higher than IBPS PO. The selection process includes Prelims, Mains, and Interview, each with separate cutoffs.</p>

<h3>How SBI PO Cutoff Works</h3>
<ul>
<li><strong>Prelims:</strong> Screening with sectional + overall cutoffs. 100 marks across 3 sections (English 30, Reasoning 35, Quant 35).</li>
<li><strong>Mains:</strong> Merit stage — 250 marks (objective 200 + descriptive 50). Shortlists 3× vacancies for interview.</li>
<li><strong>Final:</strong> Mains 75% + Interview 25% = Final merit.</li>
</ul>

<h3>SBI PO Cutoff Trend (2022–2024)</h3>
<p>SBI PO Prelims cutoffs are typically 5-8 marks higher than IBPS PO due to fewer vacancies and higher competition. General cutoffs rose from 56.50 (2022) to 63.25 (2024) out of 100. The descriptive paper in Mains (letter/essay) adds another challenge unique to SBI PO.</p>

<h3>Expected SBI PO 2026 Cutoff</h3>
<p>Prelims cutoff is expected at <strong>60–66 out of 100</strong> for General. Target 72+ for comfortable qualification.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '63.25', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '57.50', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '49.75', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '40.25', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: '60.50', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: '55.25', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: '47.50', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: '38.50', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '56.50', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '51.75', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '44.25', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '35.75', totalMarks: '100' },
  ],
  faqs: [
    { question: 'Is SBI PO cutoff higher than IBPS PO?', answer: 'Yes, typically 5-8 marks higher due to fewer vacancies and higher competition for India\'s largest bank.' },
    { question: 'Does SBI PO have sectional cutoffs?', answer: 'Yes, must clear English, Reasoning, and Quant sectional cutoffs in Prelims plus the overall cutoff.' },
    { question: 'How important is the descriptive paper?', answer: 'Very important — 50 marks for letter + essay in Mains. Poor descriptive scores can eliminate even strong objective performers.' },
    { question: 'What is the interview weightage?', answer: '25% of final merit. Mains is 75%. A good interview can significantly improve your rank.' },
    { question: 'Are SBI PO cutoffs increasing?', answer: 'Yes, from 56.50 (2022) to 63.25 (2024) for General — a ~7 mark increase reflecting growing competition.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-po-age-limit', pageType: 'age-limit',
  metaTitle: 'SBI PO Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'SBI PO age limit 2026: 21-30 years for General. Category-wise relaxation for SC/ST/OBC/PwD.',
  h1: 'SBI PO Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>SBI PO Age Limit</strong> is 21–30 years for General category. Note the minimum age is 21 (not 20 like IBPS PO), effectively requiring candidates to have completed at least 3 years of post-12th education before applying.</p>

<h3>SBI PO 2026 Age Limit</h3>
<ul>
<li><strong>General:</strong> 21–30 years</li>
<li><strong>OBC:</strong> 21–33 years</li>
<li><strong>SC/ST:</strong> 21–35 years</li>
<li><strong>PwBD:</strong> 21–40 years</li>
</ul>

<p>SBI calculates age as on 1st April of the recruitment year. This differs from IBPS which typically uses 1st August. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify.</p>

<h3>SBI PO vs IBPS PO Age Comparison</h3>
<ul>
<li>SBI PO: 21-30 (minimum 21) vs IBPS PO: 20-30 (minimum 20)</li>
<li>The 1-year higher minimum in SBI means candidates must wait till 21 to apply</li>
<li>Upper limit is same at 30 for both</li>
</ul>`,

  eligibility: `<h3>Age Summary</h3><ul><li><strong>General:</strong> 21–30</li><li><strong>OBC:</strong> 21–33</li><li><strong>SC/ST:</strong> 21–35</li><li><strong>PwBD:</strong> 21–40</li></ul>`,
  faqs: [
    { question: 'What is the age limit for SBI PO?', answer: '21-30 for General. OBC: 33, SC/ST: 35, PwBD: 40.' },
    { question: 'Why is SBI PO minimum age 21?', answer: 'SBI requires a higher minimum age, effectively ensuring candidates have completed graduation by the time they join.' },
    { question: 'Is age calculated on 1st April?', answer: 'Yes, SBI typically calculates age as on 1st April of the recruitment year, unlike IBPS which uses 1st August.' },
    { question: 'Can I apply for both SBI PO and IBPS PO?', answer: 'Yes, most candidates apply for both. The age limits are nearly identical (SBI: 21-30, IBPS: 20-30).' },
    { question: 'Is there relaxation for ex-bank employees?', answer: 'SBI may provide additional relaxation for candidates with banking experience — check the specific notification.' },
  ],
  relatedExams: RELATED,
};

export const SBI_PO_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
