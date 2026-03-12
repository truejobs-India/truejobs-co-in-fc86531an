import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'banking-jobs' as const,
  examName: 'SBI Clerk',
  examYear: 2026,
  conductingBody: 'State Bank of India (SBI)',
  officialWebsite: 'sbi.co.in/careers',
  datePublished: '2026-01-20',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'SBI PO 2026 Notification', href: '/sbi-po-2026-notification' },
  { label: 'IBPS Clerk 2026 Notification', href: '/ibps-clerk-2026-notification' },
  { label: 'IBPS PO 2026 Notification', href: '/ibps-po-2026-notification' },
  { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
  { label: 'SBI Clerk 2026 Syllabus', href: '/sbi-clerk-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'sbi-clerk-2026-notification',
  pageType: 'notification',
  metaTitle: 'SBI Clerk 2026 Notification — Vacancies & Apply',
  metaDescription: 'SBI Clerk 2026 Notification released. Check vacancies, eligibility, exam dates and apply online for Junior Associate posts in SBI.',
  h1: 'SBI Clerk 2026 Notification — Vacancies, Eligibility & How to Apply',
  totalVacancies: 8773,
  applicationEndDate: '2026-05-15',
  applyLink: 'https://sbi.co.in/careers',
  overview: `<p>The State Bank of India has announced the <strong>SBI Clerk 2026 Notification</strong> (Junior Associate – Customer Support & Sales) for approximately <strong>8,773 vacancies</strong> across its branches nationwide. This is one of the largest bank clerk recruitment drives, given SBI's massive branch network of over 22,000 branches.</p>
<p>SBI Clerk (Junior Associate) is a clerical-cadre position responsible for customer service, cash handling, account management, and basic banking operations at branch level. The position offers excellent job stability and the opportunity for career progression to officer cadre through internal promotions.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>State Bank of India</td></tr><tr><td>Post</td><td>Junior Associate (Customer Support & Sales)</td></tr><tr><td>Total Vacancies</td><td>8,773</td></tr><tr><td>Qualification</td><td>Graduation in any discipline</td></tr><tr><td>Selection</td><td>Prelims → Mains (No Interview)</td></tr><tr><td>Official Website</td><td>sbi.co.in/careers</td></tr></table>
<p>Like IBPS Clerk, SBI Clerk selection has <strong>no interview round</strong>. The final merit is based entirely on the Mains examination score. The Prelims serves as a screening test. SBI Clerk salary starts at approximately ₹17,900 basic pay, similar to IBPS Clerk, but SBI provides additional allowances and perks specific to SBI employees.</p>
<p>SBI Clerk is a state/circle-wise recruitment — candidates apply for a specific state and are posted within that state. Knowledge of the local language is important. The exam attracts massive participation due to SBI's brand value, job security, and attractive banking perks.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-03-10' },
    { label: 'Online Application Start', date: '2026-03-20' },
    { label: 'Application Last Date', date: '2026-05-15' },
    { label: 'Prelims Exam', date: 'June 2026' },
    { label: 'Mains Exam', date: 'August 2026' },
    { label: 'Provisional Allotment', date: 'October 2026' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>Graduation in any discipline from a recognized university or equivalent. Computer literacy is essential. Knowledge of the local language of the state/UT applied for is required.</p><h3>Age Limit</h3><p>20 to 28 years</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: as per rules | Widows/Divorced/Judicially Separated women: 9 years (UR)</p>`,
  feeStructure: { general: 750, obc: 750, scSt: 125, female: 125, ph: 125, paymentModes: ['Online (Net Banking, UPI, Debit Card, Credit Card)'] },
  selectionProcess: [
    'Preliminary Examination — online objective (screening)',
    'Main Examination — online objective (merit)',
    'Local Language Test — qualifying (if not studied in school/college)',
    'Document Verification at allotted circle',
  ],
  examPattern: [
    { stageName: 'Prelims', rows: [
      { subject: 'English Language', questions: 30, marks: 30, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Numerical Ability', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Reasoning Ability', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
    { stageName: 'Mains', rows: [
      { subject: 'General/Financial Awareness', questions: 50, marks: 50, duration: '35 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'General English', questions: 40, marks: 40, duration: '35 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Quantitative Aptitude', questions: 50, marks: 50, duration: '45 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Reasoning Ability & Computer Aptitude', questions: 50, marks: 60, duration: '45 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 17900, salaryMax: 47920, payLevels: 'Clerical Cadre Scale', grossRange: '₹26,000 – ₹50,000', netRange: '₹22,000 – ₹42,000',
    allowances: ['DA', 'HRA', 'CCA', 'Special Allowance', 'Medical Insurance', 'Concessional SBI Staff Loans', 'LFC', 'NPS'],
  },
  howToApply: [
    'Visit sbi.co.in/careers and find Junior Associate recruitment link',
    'Register with email and mobile number',
    'Fill application form with personal and educational details',
    'Upload photo, signature, and documents per specifications',
    'Pay application fee online',
    'Select state/circle and exam centre preferences',
    'Submit and note registration number',
  ],
  faqs: [
    { question: 'What is SBI Clerk 2026 vacancy count?', answer: 'Approximately 8,773 vacancies for Junior Associate (Customer Support & Sales) posts across SBI circles.' },
    { question: 'Is there interview for SBI Clerk?', answer: 'No, SBI Clerk has no interview. Selection is based on Mains exam merit only.' },
    { question: 'Is local language required for SBI Clerk?', answer: 'Yes, candidates must know the local/official language of the state they apply for. A language test may be conducted.' },
    { question: 'What is SBI Clerk salary?', answer: 'Starting basic pay is ₹17,900 with gross salary approximately ₹26,000-₹30,000 per month including allowances.' },
    { question: 'Can SBI Clerk become PO?', answer: 'Yes, SBI Clerks can be promoted to officer cadre through internal exams and seniority-based promotions.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://sbi.co.in/careers',
    instructions: [
      'Visit sbi.co.in/careers and navigate to the Junior Associate recruitment section',
      'Click on "Download Admit Card" or "Call Letter" link for SBI Clerk 2026',
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
      'SBI Clerk does not use normalisation — scores are directly computed from the online exam',
      'Download your individual score card showing section-wise and overall scores',
      'Prelims qualified candidates will be called for Mains examination (no interview for clerical cadre)',
      'Final merit list is prepared based on Mains score and circle-wise (state-wise) provisional allotment is done',
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
  ...COMMON, slug: 'sbi-clerk-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'SBI Clerk 2026 Syllabus — All Subjects',
  metaDescription: 'SBI Clerk 2026 syllabus for Prelims and Mains. Section-wise topics for English, Quant, Reasoning, Financial Awareness and Computer.',
  h1: 'SBI Clerk 2026 Syllabus — Prelims & Mains Subject-wise Topics',
  overview: `<p>The <strong>SBI Clerk 2026 Syllabus</strong> covers banking aptitude subjects. SBI's question paper difficulty is slightly higher than IBPS Clerk, particularly in reasoning and English sections.</p>
<h3>Prelims Syllabus</h3>
<p><strong>English (30):</strong> Reading Comprehension, Cloze Test, Error Spotting, Fillers, Sentence Rearrangement, Para Jumbles, Vocabulary.</p>
<p><strong>Numerical Ability (35):</strong> Simplification, Approximation, Number Series, Data Interpretation, Percentage, Average, Ratio-Proportion, Profit-Loss, Time-Work-Distance, SI/CI, Mensuration.</p>
<p><strong>Reasoning (35):</strong> Puzzles, Seating Arrangement (linear, circular), Syllogism, Inequality, Coding-Decoding, Blood Relations, Direction Sense, Ordering-Ranking.</p>
<h3>Mains Syllabus</h3>
<p><strong>General/Financial Awareness (50):</strong> Banking terminology, RBI functions & policies, Financial Awareness, Government Schemes, Budget basics, Current Affairs (6 months), SBI history, Insurance & Capital Markets, Awards, Sports, Static GK.</p>
<p><strong>General English (40):</strong> RC, Error Detection, Sentence Correction, Cloze Test, Para Jumbles, Fill in Blanks, Idioms & Phrases.</p>
<p><strong>Quantitative Aptitude (50):</strong> DI (Bar, Pie, Line, Tabular, Caselet), Number Series, Quadratic Equations, Arithmetic (Percentage, Profit-Loss, Interest, Time-Work, Time-Distance, Mixture, Partnership).</p>
<p><strong>Reasoning & Computer Aptitude (60):</strong> Advanced Puzzles, Machine Input-Output, Syllogism, Data Sufficiency, Coding-Decoding, Statement-Conclusion, plus Computer Basics (Hardware, Software, OS, MS Office, Internet, Networking, Database concepts).</p>`,
  syllabusSummary: `<ul><li><strong>Prelims:</strong> English (30), Numerical Ability (35), Reasoning (35)</li><li><strong>Mains:</strong> Financial GK (50), English (40), Quant (50), Reasoning+Computer (60) — total 200 marks</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is SBI Clerk syllabus harder than IBPS Clerk?', answer: 'The syllabus is similar but SBI tends to set slightly harder questions, especially in reasoning puzzles and English.' },
    { question: 'What financial awareness topics to study?', answer: 'Banking terminology, RBI policies, SBI history, Budget, Government Schemes, Insurance, and financial current affairs.' },
    { question: 'Are computer questions in SBI Clerk Mains?', answer: 'Yes, computer aptitude is combined with reasoning (60 marks total) covering hardware, software, OS, internet, and networking.' },
    { question: 'How many months of current affairs?', answer: 'Focus on the last 6 months with emphasis on banking and financial news.' },
    { question: 'Is the syllabus different from IBPS Clerk?', answer: 'The syllabus is largely the same. The difference is in question difficulty and pattern, not topics.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-clerk-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'SBI Clerk 2026 Exam Pattern — Prelims & Mains',
  metaDescription: 'SBI Clerk 2026 exam pattern. Prelims and Mains structure, marks, sections, time limits, negative marking and state-wise merit.',
  h1: 'SBI Clerk 2026 Exam Pattern — Prelims, Mains & Selection Process',
  overview: `<p>The <strong>SBI Clerk 2026 Exam Pattern</strong> follows a two-stage process: Prelims (screening) and Mains (merit). There is no interview for clerical cadre.</p>
<h3>Prelims</h3>
<p>100 questions, 100 marks, 60 minutes with sectional time limits. English Language: 30Q, 30M, 20min. Numerical Ability: 35Q, 35M, 20min. Reasoning Ability: 35Q, 35M, 20min. Negative marking of 0.25. Sectional cutoffs apply. Screening test only.</p>
<h3>Mains</h3>
<p>190 questions, 200 marks, 160 minutes. General/Financial Awareness: 50Q, 50M, 35min. General English: 40Q, 40M, 35min. Quantitative Aptitude: 50Q, 50M, 45min. Reasoning & Computer Aptitude: 50Q, 60M, 45min. Negative marking 0.25. Sectional cutoffs apply. Merit is based on Mains score.</p>
<h3>Local Language Test</h3>
<p>Candidates who haven't studied the local language of their applied state in school/college may need to pass a language proficiency test. This is qualifying in nature.</p>
<h3>State-wise Allotment</h3>
<p>SBI Clerk follows circle-wise (state-wise) recruitment. Separate merit lists are prepared for each circle, and candidates are posted within their chosen circle.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is SBI Clerk exam pattern same as IBPS Clerk?', answer: 'Very similar — both have Prelims (100 marks, 60 min) and Mains (200 marks, 160 min) with same section structure.' },
    { question: 'Is there a language test in SBI Clerk?', answer: 'If you haven\'t studied the local language of your state in school/college, you may need to pass a qualifying language test.' },
    { question: 'How is SBI Clerk merit prepared?', answer: 'State/circle-wise merit based on Mains score. Separate cutoffs for each category within each state.' },
    { question: 'Are there sectional cutoffs?', answer: 'Yes, both Prelims and Mains have sectional cutoffs that must be cleared individually.' },
    { question: 'Can I change my state preference later?', answer: 'No, state/circle preference is final once submitted. Choose carefully based on where you can serve.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-clerk-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'SBI Clerk 2026 Eligibility — Age & Qualification',
  metaDescription: 'SBI Clerk 2026 eligibility. Age limit 20-28, graduation requirement, local language knowledge and age relaxation for reserved categories.',
  h1: 'SBI Clerk 2026 Eligibility — Qualification, Age Limit & Language Requirement',
  overview: `<p>The <strong>SBI Clerk 2026 Eligibility</strong> requires graduation and proficiency in the local language of the applied state. The requirements are similar to IBPS Clerk.</p>
<h3>Educational Qualification</h3>
<p>Graduation in any discipline from a recognized university. No minimum percentage specified. Computer literacy is essential as all banking operations are computerized.</p>
<h3>Age Limit</h3>
<p>20 to 28 years for General/EWS category.</p>
<h3>Age Relaxation</h3>
<p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-SM: 3 years (after deducting military service) | Widows/Divorced/Judicially Separated Women: 9 years (UR), 14 years (SC/ST)</p>
<h3>Language Requirement</h3>
<p>Candidates must be proficient in reading, writing, and speaking the official language of the state/UT for which they are applying. This is crucial as SBI Clerk involves direct customer interaction. A language proficiency test may be conducted for those who haven't studied the language formally.</p>
<h3>Additional Requirements</h3>
<p>Valid email ID and mobile number for registration. Candidates must be Indian citizens. Good health and no physical disability that would prevent normal banking duties (unless PwBD category).</p>`,
  eligibility: `<h3>Qualification</h3><p>Graduation in any discipline + Computer literacy</p><h3>Age</h3><p>20-28 years (General) | OBC: +3 | SC/ST: +5 | PwBD: +10</p><h3>Language</h3><p>Must know official language of applied state</p>`,
  faqs: [
    { question: 'Is local language mandatory for SBI Clerk?', answer: 'Yes, proficiency in the official language of your applied state is mandatory. A language test may be conducted.' },
    { question: 'What is the age limit for SBI Clerk?', answer: '20 to 28 years for General. Same as IBPS Clerk.' },
    { question: 'Can engineering graduates apply?', answer: 'Yes, any graduate regardless of discipline can apply.' },
    { question: 'Is percentage mentioned in eligibility?', answer: 'No, SBI does not specify any minimum percentage for Clerk eligibility.' },
    { question: 'Do widows get extra age relaxation?', answer: 'Yes, widows/divorced/judicially separated women get up to 9 years (UR) and 14 years (SC/ST) relaxation.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-clerk-2026-salary', pageType: 'salary',
  metaTitle: 'SBI Clerk 2026 Salary — Pay Scale & SBI Perks',
  metaDescription: 'SBI Clerk 2026 salary. Clerical pay scale, basic pay ₹17,900, gross and in-hand salary, SBI-specific perks and promotion prospects.',
  h1: 'SBI Clerk 2026 Salary — Pay Scale, In-Hand Salary & SBI Employee Perks',
  overview: `<p>The <strong>SBI Clerk 2026 Salary</strong> follows the bipartite wage settlement for clerical staff. While the pay scale is the same as other nationalized banks (₹17,900 basic), SBI clerks benefit from SBI's superior perks and brand value.</p>
<h3>Pay Scale</h3>
<p>Same clerical scale as other banks: ₹17,900 – ₹47,920 with defined annual increments. Initial basic pay is ₹17,900 which increases through increments to the maximum of ₹47,920.</p>
<h3>Gross & In-Hand Salary</h3>
<p>Gross salary including DA, HRA, CCA, and special allowance is approximately ₹26,000-₹32,000 initially (varies by city). In-hand after deductions: ₹22,000-₹28,000. SBI clerks in metro cities earn higher due to city-specific allowances.</p>
<h3>SBI-Specific Benefits</h3>
<p>SBI clerks enjoy: concessional SBI staff loans (home loan at reduced rates, car loan, personal loan), comprehensive medical insurance (Mediclaim), free/subsidized banking services, SBI life insurance benefits, earned leave encashment, and strong pension/NPS contributions. SBI's staff welfare programs are considered the best in the banking sector.</p>
<h3>Promotion to Officer</h3>
<p>SBI clerks can get promoted to Junior Management Grade (Officer) through internal promotion exams. The JAIIB and CAIIB certifications boost promotion chances. After 3-5 years, performing clerks can move to officer cadre with significantly higher salary and responsibilities.</p>`,
  salary: {
    salaryMin: 17900, salaryMax: 47920, payLevels: 'Clerical Cadre Scale', grossRange: '₹26,000 – ₹50,000', netRange: '₹22,000 – ₹42,000',
    allowances: ['DA', 'HRA', 'CCA', 'Special Allowance', 'SBI Mediclaim Insurance', 'Concessional SBI Staff Loans', 'LFC', 'NPS', 'Earned Leave Encashment', 'SBI Life Insurance Benefits'],
    postWiseSalary: [
      { post: 'SBI Junior Associate (Initial)', payLevel: 'Clerical Scale', basicPay: '₹17,900' },
      { post: 'SBI Clerk (after 3 years)', payLevel: 'Clerical Scale', basicPay: '₹20,900' },
      { post: 'SBI Clerk (Maximum)', payLevel: 'Clerical Scale', basicPay: '₹47,920' },
    ],
  },
  faqs: [
    { question: 'Is SBI Clerk salary same as IBPS Clerk?', answer: 'The basic pay scale is the same (₹17,900-₹47,920). But SBI-specific perks and brand value make it more desirable.' },
    { question: 'Do SBI clerks get staff loans?', answer: 'Yes, SBI clerks get concessional staff loans including home loan, car loan, and personal loan at reduced interest rates.' },
    { question: 'What is SBI Clerk in-hand salary?', answer: 'Approximately ₹22,000-₹28,000 per month initially, depending on the city of posting.' },
    { question: 'Can SBI clerks get promoted quickly?', answer: 'With JAIIB/CAIIB certifications and good performance, promotion to officer cadre is possible in 3-5 years.' },
    { question: 'Is SBI Clerk a permanent job?', answer: 'Yes, SBI Clerk (Junior Associate) is a permanent, pensionable government banking position after the probation period.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-clerk-cutoff', pageType: 'cutoff',
  metaTitle: 'SBI Clerk Cutoff 2026 — State-Wise Cut Off Marks',
  metaDescription: 'SBI Clerk cutoff 2026: State-wise and category-wise cut off marks for Prelims and Mains with trend analysis.',
  h1: 'SBI Clerk Cutoff 2026 — State-Wise & Category-Wise Cut Off Marks',
  overview: `<p>The <strong>SBI Clerk Cutoff</strong> follows a state-wise pattern similar to IBPS Clerk, as Junior Associate vacancies are allocated state-wise. SBI Clerk cutoffs tend to be slightly higher than IBPS Clerk due to the prestige and perks associated with State Bank of India.</p>

<h3>How SBI Clerk Cutoff Works</h3>
<ul>
<li><strong>Prelims:</strong> National screening with sectional + overall cutoffs (100 marks).</li>
<li><strong>Mains:</strong> State-wise merit — 200 marks. No interview for clerical posts.</li>
<li><strong>State-wise variation:</strong> Southern states have significantly higher cutoffs than NE states.</li>
</ul>

<h3>SBI Clerk Cutoff Trend (2022–2024)</h3>
<p>Prelims cutoffs for General category ranged from 50.50 (2022) to 57.75 (2024) out of 100 — consistently 3-5 marks higher than IBPS Clerk for the same category.</p>

<h3>Expected SBI Clerk 2026 Cutoff</h3>
<p>Prelims cutoff expected at <strong>55–61 out of 100</strong> for General. Target 65+ for comfortable clearance.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '57.75', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '52.25', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '43.50', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '35.25', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: '54.25', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: '49.50', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: '41.25', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: '33.50', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '50.50', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '46.25', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '38.75', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '31.50', totalMarks: '100' },
  ],
  faqs: [
    { question: 'Is SBI Clerk cutoff higher than IBPS Clerk?', answer: 'Yes, typically 3-5 marks higher due to SBI brand value and better perks.' },
    { question: 'Is SBI Clerk cutoff state-wise?', answer: 'Yes, Mains cutoff is state-wise. Prelims has national cutoff for screening.' },
    { question: 'Is there interview for SBI Clerk?', answer: 'No, SBI Clerk (Junior Associate) selection is based on Mains score alone.' },
    { question: 'Which state has the highest SBI Clerk cutoff?', answer: 'Kerala and Andhra Pradesh typically have the highest SBI Clerk cutoffs.' },
    { question: 'How many vacancies does SBI recruit for Clerk?', answer: 'SBI typically recruits 8,000-14,000 clerks annually, more than any individual IBPS bank.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'sbi-clerk-age-limit', pageType: 'age-limit',
  metaTitle: 'SBI Clerk Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'SBI Clerk age limit 2026: 20-28 years for General. Category-wise relaxation for SC/ST/OBC/PwD.',
  h1: 'SBI Clerk Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>SBI Clerk Age Limit</strong> is 20–28 years for General category, identical to IBPS Clerk. SBI calculates age as on 1st April of the recruitment year.</p>

<h3>SBI Clerk 2026 Age Limit</h3>
<ul>
<li><strong>General:</strong> 20–28 years</li>
<li><strong>OBC:</strong> 20–31 years</li>
<li><strong>SC/ST:</strong> 20–33 years</li>
<li><strong>PwBD:</strong> 20–38 years</li>
</ul>

<p>The 8-year window allows candidates 6-7 attempts. Many SBI Clerk aspirants simultaneously prepare for SBI PO (age limit 21-30). Use our <a href="/govt-job-age-calculator">Age Calculator</a> to check eligibility.</p>

<h3>Key Points</h3>
<ul>
<li>SBI uses 1st April as the age cutoff date (IBPS uses 1st August)</li>
<li>Widows and divorced women who have not remarried get age relaxation up to 35 years</li>
<li>Ex-servicemen get 5 years relaxation</li>
<li>The minimum 20-year requirement means graduation must be completed by application date</li>
</ul>`,

  eligibility: `<h3>Age Summary</h3><ul><li><strong>General:</strong> 20–28</li><li><strong>OBC:</strong> 20–31</li><li><strong>SC/ST:</strong> 20–33</li><li><strong>PwBD:</strong> 20–38</li></ul>`,
  faqs: [
    { question: 'What is the age limit for SBI Clerk?', answer: '20-28 for General. OBC: 31, SC/ST: 33, PwBD: 38.' },
    { question: 'Is SBI Clerk age limit same as IBPS Clerk?', answer: 'Yes, both have 20-28 for General. Only the age calculation date differs (SBI: 1st April, IBPS: 1st August).' },
    { question: 'Can I apply for SBI Clerk at 20?', answer: 'Yes, if you are 20 as on 1st April 2026 and have completed graduation.' },
    { question: 'Is there relaxation for widows?', answer: 'Yes, widows and divorced women who have not remarried get relaxation up to 35 years.' },
    { question: 'Can I apply for both SBI Clerk and PO?', answer: 'Yes, if you meet both age limits. Clerk: 20-28, PO: 21-30.' },
  ],
  relatedExams: RELATED,
};

export const SBI_CLERK_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
