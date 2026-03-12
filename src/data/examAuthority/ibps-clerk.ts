import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'banking-jobs' as const,
  examName: 'IBPS Clerk',
  examYear: 2026,
  conductingBody: 'Institute of Banking Personnel Selection (IBPS)',
  officialWebsite: 'ibps.in',
  datePublished: '2026-02-12',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'IBPS PO 2026 Notification', href: '/ibps-po-2026-notification' },
  { label: 'SBI Clerk 2026 Notification', href: '/sbi-clerk-2026-notification' },
  { label: 'SBI PO 2026 Notification', href: '/sbi-po-2026-notification' },
  { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
  { label: 'IBPS Clerk 2026 Syllabus', href: '/ibps-clerk-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ibps-clerk-2026-notification',
  pageType: 'notification',
  metaTitle: 'IBPS Clerk 2026 Notification — Vacancies & Apply',
  metaDescription: 'IBPS Clerk 2026 Notification released. Check vacancies, eligibility, exam dates and apply online for clerical cadre posts in public sector banks.',
  h1: 'IBPS Clerk 2026 Notification — Vacancies, Eligibility & How to Apply',
  totalVacancies: 6035,
  applicationEndDate: '2026-08-30',
  applyLink: 'https://ibps.in',
  overview: `<p>The Institute of Banking Personnel Selection has released the <strong>IBPS Clerk 2026 Notification</strong> (CRP Clerks-XVI) for recruitment of <strong>clerical cadre</strong> employees in participating public sector banks. This recruitment covers approximately <strong>6,035 vacancies</strong> across nationalized banks including Punjab National Bank, Bank of Baroda, Canara Bank, Union Bank, Indian Bank, Bank of Maharashtra, and others.</p>
<p>IBPS Clerk is one of the most popular banking examinations in India, attracting millions of graduates seeking a career in the banking sector. The clerical cadre provides a stable government job with structured career progression — clerks can be promoted to officer cadre through internal exams and seniority.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>IBPS</td></tr><tr><td>Post</td><td>Clerk (Clerical Cadre)</td></tr><tr><td>Total Vacancies</td><td>6,035</td></tr><tr><td>Qualification</td><td>Graduation in any discipline</td></tr><tr><td>Selection</td><td>Prelims → Mains (No Interview)</td></tr><tr><td>Official Website</td><td>ibps.in</td></tr></table>
<p>Unlike IBPS PO, there is <strong>no interview</strong> for IBPS Clerk — selection is based purely on the Mains examination score. The prelims serves as a screening test, and the mains covers English, Quantitative Aptitude, Reasoning, Computer Aptitude, and Financial/General Awareness.</p>
<p>The starting salary for IBPS Clerk is approximately ₹17,900 per month basic pay, which with allowances translates to a gross salary of ₹26,000-₹30,000 per month initially. Bank clerks also enjoy perks like concessional loans, medical insurance, and LFC.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-07-01' },
    { label: 'Online Application Start', date: '2026-07-01' },
    { label: 'Application Last Date', date: '2026-08-30' },
    { label: 'Prelims Exam', date: 'September 2026' },
    { label: 'Mains Exam', date: 'October 2026' },
    { label: 'Provisional Allotment', date: 'December 2026' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>Graduation in any discipline from a recognized university or equivalent. Candidates must possess computer literacy — certificate or diploma in computers, or Computer Science/IT as a subject in graduation.</p><h3>Age Limit</h3><p>20 to 28 years</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: 5 years</p>`,
  feeStructure: { general: 850, obc: 850, scSt: 175, female: 175, ph: 175, paymentModes: ['Online (Net Banking, UPI, Debit Card, Credit Card)'] },
  selectionProcess: [
    'Preliminary Examination — online objective (screening)',
    'Main Examination — online objective (merit)',
    'Provisional Allotment to participating banks based on merit and preference',
    'Document Verification at allotted bank',
  ],
  examPattern: [
    { stageName: 'Prelims', rows: [
      { subject: 'English Language', questions: 30, marks: 30, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Numerical Ability', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Reasoning Ability', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
    { stageName: 'Mains', rows: [
      { subject: 'General/Financial Awareness', questions: 50, marks: 50, duration: '35 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'English Language', questions: 40, marks: 40, duration: '35 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Reasoning Ability & Computer Aptitude', questions: 50, marks: 60, duration: '45 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Quantitative Aptitude', questions: 50, marks: 50, duration: '45 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 17900, salaryMax: 47920, payLevels: 'Clerical Cadre Scale', grossRange: '₹26,000 – ₹50,000', netRange: '₹22,000 – ₹42,000',
    allowances: ['DA', 'HRA', 'CCA', 'Special Allowance', 'Medical Insurance', 'Concessional Loans', 'LFC', 'NPS'],
  },
  howToApply: [
    'Visit ibps.in and find CRP Clerks-XVI notification',
    'Click "Apply Online" and register with email/mobile',
    'Fill personal, educational, and state/bank preferences',
    'Upload photograph, signature, left thumb impression, and handwritten declaration',
    'Pay application fee online',
    'Select exam centre preferences (state-wise allotment)',
    'Submit and download confirmation',
  ],
  faqs: [
    { question: 'Is there an interview for IBPS Clerk?', answer: 'No, IBPS Clerk selection is based on Prelims (screening) and Mains (merit) only. There is no interview round.' },
    { question: 'What is the IBPS Clerk 2026 vacancy count?', answer: 'Approximately 6,035 vacancies across participating public sector banks.' },
    { question: 'What is the qualification for IBPS Clerk?', answer: 'Graduation in any discipline plus computer literacy. No minimum percentage specified.' },
    { question: 'What is IBPS Clerk starting salary?', answer: 'Basic pay starts at ₹17,900. Gross salary is approximately ₹26,000-₹30,000 per month initially.' },
    { question: 'Can Clerk get promoted to PO?', answer: 'Yes, bank clerks can be promoted to officer cadre through internal departmental exams (JAIIB/CAIIB) and seniority.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ibps.in',
    instructions: [
      'Visit ibps.in and click on "CRP Clerks-XVI" under the ongoing processes',
      'Click on "Download Call Letter" or "Admit Card" link',
      'Log in with your Registration Number and Password or Date of Birth',
      'Download and print the admit card on A4 paper',
      'Carry the printed admit card to the examination hall',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://ibps.in',
    meritListUrl: 'https://ibps.in',
    nextSteps: [
      'Check the result on ibps.in — individual score cards are made available for download',
      'IBPS Clerk does not use normalisation — scores are directly computed from the online exam',
      'Download your individual score card showing section-wise and overall scores',
      'Prelims qualified candidates will be called for Mains examination (no interview for clerical cadre)',
      'Final merit list is prepared based on Mains score and state-wise provisional allotment is done to participating banks',
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
  ...COMMON, slug: 'ibps-clerk-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'IBPS Clerk 2026 Syllabus — Prelims & Mains',
  metaDescription: 'IBPS Clerk 2026 syllabus for Prelims and Mains. Section-wise topics for English, Quant, Reasoning, GK and Computer Aptitude.',
  h1: 'IBPS Clerk 2026 Syllabus — Prelims & Mains Subject-wise Topics',
  overview: `<p>The <strong>IBPS Clerk 2026 Syllabus</strong> covers fundamental banking aptitude subjects. Prelims tests basic skills while Mains is more comprehensive with banking awareness.</p>
<h3>Prelims Syllabus</h3>
<p><strong>English Language (30):</strong> Reading Comprehension, Cloze Test, Fillers, Error Spotting, Phrase Replacement, Para Jumbles, Sentence Improvement.</p>
<p><strong>Numerical Ability (35):</strong> Simplification, Approximation, Number Series, Data Interpretation, Percentage, Average, Ratio-Proportion, Profit-Loss, Time-Work-Distance, SI/CI, Mensuration.</p>
<p><strong>Reasoning Ability (35):</strong> Puzzles, Seating Arrangement, Syllogism, Inequality, Coding-Decoding, Blood Relations, Direction Sense, Ordering-Ranking, Alphabet Test.</p>
<h3>Mains Syllabus</h3>
<p><strong>General/Financial Awareness (50):</strong> Banking Awareness, Financial terms, RBI policies, Budget, Current Affairs (6 months), Insurance, Capital Markets, Government Schemes, Awards, Sports, Static GK.</p>
<p><strong>English Language (40):</strong> RC, Error Detection, Cloze Test, Sentence Rearrangement, Fill in Blanks, Paragraph Completion, Column-based matching.</p>
<p><strong>Reasoning & Computer Aptitude (60):</strong> Advanced Puzzles, Seating Arrangement, Machine Input-Output, Syllogism, Data Sufficiency, Coding-Decoding, plus Computer Fundamentals, OS, MS Office, Internet, Networking.</p>
<p><strong>Quantitative Aptitude (50):</strong> Data Interpretation, Quadratic Equations, Number Series, Approximation, Arithmetic (Percentage, Profit-Loss, SI/CI, Time-Work, Time-Distance, Mixture-Allegation, Partnership).</p>`,
  syllabusSummary: `<ul><li><strong>Prelims:</strong> English (30), Numerical Ability (35), Reasoning (35)</li><li><strong>Mains:</strong> GK/Financial (50), English (40), Reasoning+Computer (60), Quant (50) — total 200 marks</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is banking awareness important for Clerk Mains?', answer: 'Yes, 50 marks in Mains are from General/Financial Awareness which heavily tests banking knowledge.' },
    { question: 'Is Clerk syllabus easier than PO?', answer: 'Prelims is similar difficulty. Mains is slightly easier than PO — no descriptive paper, simpler DI, and moderate reasoning puzzles.' },
    { question: 'Are computer questions in Clerk exam?', answer: 'Yes, Computer Aptitude is combined with Reasoning in Mains (60 marks combined).' },
    { question: 'How many months of current affairs to study?', answer: 'Last 6 months of banking, financial, and general current affairs.' },
    { question: 'What books for IBPS Clerk preparation?', answer: 'RS Aggarwal for Reasoning, Arun Sharma for Quant, SP Bakshi for English, and banking awareness from GK publications.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-clerk-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'IBPS Clerk 2026 Exam Pattern — Prelims & Mains',
  metaDescription: 'IBPS Clerk 2026 exam pattern for Prelims and Mains. Sections, marks, time limits, negative marking and cutoff details.',
  h1: 'IBPS Clerk 2026 Exam Pattern — Prelims & Mains Structure & Marking Scheme',
  overview: `<p>The <strong>IBPS Clerk 2026 Exam Pattern</strong> consists of Prelims (screening) and Mains (merit). No interview is conducted for clerical posts. The entire selection depends on the Mains examination score.</p>
<h3>Prelims</h3>
<p>100 questions, 100 marks, 60 minutes total with sectional time limits. English Language: 30Q, 30M, 20 min. Numerical Ability: 35Q, 35M, 20 min. Reasoning Ability: 35Q, 35M, 20 min. Negative marking of 0.25 per wrong answer. Sectional cutoffs apply. This is only a screening test.</p>
<h3>Mains</h3>
<p>190 questions, 200 marks, 160 minutes with sectional time limits. General/Financial Awareness: 50Q, 50M, 35 min. English: 40Q, 40M, 35 min. Reasoning & Computer Aptitude: 50Q, 60M, 45 min. Quantitative Aptitude: 50Q, 50M, 45 min. Negative marking of 0.25. Sectional cutoffs apply. Mains score determines final merit.</p>
<h3>State-wise Allotment</h3>
<p>IBPS Clerk is a state-wise recruitment. Candidates apply for a specific state and are allotted to banks operating in that state. State-wise merit lists are prepared, and candidates must know the local language of the state applied for.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is there interview for IBPS Clerk?', answer: 'No, there is no interview. Selection is based on Mains merit only.' },
    { question: 'Are there sectional cutoffs?', answer: 'Yes, both Prelims and Mains have sectional cutoffs. You must clear each section individually.' },
    { question: 'What is the total time for Mains?', answer: '160 minutes (2 hours 40 minutes) across four sections with individual time limits.' },
    { question: 'Is IBPS Clerk state-wise?', answer: 'Yes, candidates apply for a specific state and are allotted banks in that state only.' },
    { question: 'Is local language required?', answer: 'Yes, knowledge of the official language of the state applied for is desirable and may be required.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-clerk-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'IBPS Clerk 2026 Eligibility — Age & Education',
  metaDescription: 'IBPS Clerk 2026 eligibility. Age limit 20-28, graduation requirement, computer literacy, age relaxation and state preferences.',
  h1: 'IBPS Clerk 2026 Eligibility — Age Limit, Qualification & Requirements',
  overview: `<p>The <strong>IBPS Clerk 2026 Eligibility</strong> requires graduation and computer literacy. The age limit is slightly lower than IBPS PO, reflecting the entry-level nature of clerical positions.</p>
<h3>Educational Qualification</h3>
<p>Graduation in any discipline from a recognized university. Additionally, candidates must have computer literacy — either a certificate/diploma in computers from a recognized institute, or IT/Computer Science as a subject in graduation/post-graduation. This is a mandatory requirement as banking operations are fully computerized.</p>
<h3>Age Limit</h3>
<p>20 to 28 years for General/EWS category. The cut-off date is specified in the notification.</p>
<h3>Age Relaxation</h3>
<p>OBC-NCL: 3 years (max 31) | SC/ST: 5 years (max 33) | PwBD: 10 years (max 38) | PwBD+OBC: 13 years | PwBD+SC/ST: 15 years | Ex-Servicemen: 3 years (after deducting military service) | Widows/Divorced women: 9 years (UR), 14 years (SC/ST)</p>
<h3>Language Requirement</h3>
<p>Candidates must apply for vacancies in a state/UT and should be proficient in the official language of that state. Knowledge of the local language may be verified before joining.</p>`,
  eligibility: `<h3>Qualification</h3><p>Graduation in any discipline + Computer literacy certificate/subject</p><h3>Age</h3><p>20-28 years (General) | OBC: +3 | SC/ST: +5 | PwBD: +10</p><h3>Language</h3><p>Proficiency in official language of the applied state</p>`,
  faqs: [
    { question: 'Is computer knowledge mandatory for Clerk?', answer: 'Yes, candidates must have a computer literacy certificate or Computer/IT as a subject in their degree.' },
    { question: 'What is the age limit for IBPS Clerk?', answer: '20 to 28 years for General category. Lower than IBPS PO (which is 20-30).' },
    { question: 'Can I apply for multiple states?', answer: 'No, you can apply for only one state/UT. Allotment is based on the state you choose.' },
    { question: 'Is graduation percentage specified?', answer: 'No minimum percentage is mentioned. A pass certificate is sufficient.' },
    { question: 'Do widows/divorced women get age relaxation?', answer: 'Yes, up to 9 years for General category and 14 years for SC/ST widows/divorced women.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-clerk-2026-salary', pageType: 'salary',
  metaTitle: 'IBPS Clerk 2026 Salary — Pay Scale & Perks',
  metaDescription: 'IBPS Clerk 2026 salary. Clerical pay scale, basic pay ₹17,900, gross salary, in-hand salary, allowances and promotion to officer.',
  h1: 'IBPS Clerk 2026 Salary — Pay Scale, In-Hand Salary & Banking Perks',
  overview: `<p>The <strong>IBPS Clerk 2026 Salary</strong> follows the bipartite wage settlement for bank clerical staff. The starting basic pay is ₹17,900, which increases through defined increments to a maximum of ₹47,920.</p>
<h3>Pay Scale</h3>
<p>Clerical scale: ₹17,900 – 1,000/3 – 20,900 – 1,230/3 – 24,590 – 1,490/4 – 30,550 – 1,740/7 – 42,730 – 2,120/1 – 44,850 – 1,535/2 – 47,920. Annual increments range from ₹1,000 to ₹2,120 at different stages of the career.</p>
<h3>Gross & In-Hand Salary</h3>
<p>Gross salary including DA, HRA, CCA, and special allowance is approximately ₹26,000-₹30,000 in the initial posting. After deductions for NPS, income tax (if applicable), and professional tax, in-hand salary is approximately ₹22,000-₹26,000. Metro city postings yield higher take-home due to increased HRA.</p>
<h3>Banking Perks</h3>
<p>Bank clerks enjoy concessional interest rates on loans (home, car, personal), medical insurance for family, Leave Fare Concession, pension/NPS benefits, subsidized canteen facilities, and earned leave encashment. These perks add significant value beyond the monthly salary.</p>
<h3>Career Growth</h3>
<p>Clerks can appear for the JAIIB/CAIIB exam and internal departmental exams to get promoted to officer cadre (JMGS-I). With 3-5 years of experience and passing internal exams, clerks can become officers with significantly higher salary and responsibilities.</p>`,
  salary: {
    salaryMin: 17900, salaryMax: 47920, payLevels: 'Clerical Cadre Scale', grossRange: '₹26,000 – ₹50,000', netRange: '₹22,000 – ₹42,000',
    allowances: ['DA', 'HRA', 'CCA', 'Special Allowance', 'Medical Insurance', 'Concessional Loans', 'Leave Fare Concession', 'NPS', 'Earned Leave Encashment'],
    postWiseSalary: [
      { post: 'Clerk (Initial)', payLevel: 'Clerical Scale', basicPay: '₹17,900' },
      { post: 'Clerk (after 3 years)', payLevel: 'Clerical Scale', basicPay: '₹20,900' },
      { post: 'Clerk (Maximum)', payLevel: 'Clerical Scale', basicPay: '₹47,920' },
    ],
  },
  faqs: [
    { question: 'What is IBPS Clerk starting salary?', answer: '₹17,900 basic pay. Gross salary with allowances is approximately ₹26,000-₹30,000 per month.' },
    { question: 'Can clerks become officers?', answer: 'Yes, through JAIIB/CAIIB exams and internal promotion, clerks can reach JMGS-I officer cadre.' },
    { question: 'Do clerks get loan benefits?', answer: 'Yes, bank clerks get concessional interest rates on home, car, and personal loans from their employing bank.' },
    { question: 'What is the maximum clerk salary?', answer: 'Maximum basic pay is ₹47,920. With DA and allowances, gross can reach ₹50,000+ at the top of the scale.' },
    { question: 'Is there pension for bank clerks?', answer: 'New recruits are under NPS. Both employee and bank contribute 10% each of basic+DA.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-clerk-cutoff', pageType: 'cutoff',
  metaTitle: 'IBPS Clerk Cutoff 2026 — Prelims & Mains Marks',
  metaDescription: 'IBPS Clerk cutoff 2026: State-wise and category-wise cut off marks for Prelims and Mains. Previous year trends.',
  h1: 'IBPS Clerk Cutoff 2026 — State-Wise & Category-Wise Cut Off Marks',
  overview: `<p>The <strong>IBPS Clerk Cutoff</strong> is unique because it is determined <strong>state-wise</strong>, not just category-wise. Since clerk vacancies are state-specific (candidates are posted in the state they apply from), cutoffs vary significantly across states. Southern states like Kerala and Karnataka typically have higher cutoffs, while North-Eastern states have lower cutoffs.</p>

<h3>How IBPS Clerk Cutoff Works</h3>
<ul>
<li><strong>Prelims:</strong> National-level screening with sectional + overall cutoffs. Approximately 10× vacancies shortlisted for Mains.</li>
<li><strong>Mains:</strong> State-wise merit. Final selection is based on Mains score alone (no interview for Clerk posts).</li>
<li><strong>State-wise variation:</strong> Kerala General cutoff can be 20+ marks higher than Assam or Meghalaya cutoff for the same category.</li>
</ul>

<h3>IBPS Clerk Cutoff Trend (2022–2024)</h3>
<p>Prelims overall cutoff for General has been in the 45-55 range out of 100 marks nationally. However, the state-wise Mains cutoff shows dramatic variation — from 35 in some NE states to 72 in Kerala for General category.</p>

<h3>Expected IBPS Clerk 2026 Cutoff</h3>
<p>Prelims cutoff is expected at <strong>48–56 out of 100</strong> for General. Target 60+ for safe qualification. Mains cutoff will vary by state — check state-specific trends.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '53.50', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '48.75', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '40.25', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '32.50', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: '50.25', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: '45.50', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: '37.75', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: '30.25', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '47.80', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '43.25', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '35.50', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '28.75', totalMarks: '100' },
  ],
  faqs: [
    { question: 'Is IBPS Clerk cutoff state-wise?', answer: 'Yes, Mains cutoff is state-wise. Prelims has a national cutoff for screening.' },
    { question: 'Which state has the highest IBPS Clerk cutoff?', answer: 'Kerala and Karnataka typically have the highest cutoffs due to high literacy and fewer vacancies.' },
    { question: 'Is there interview for IBPS Clerk?', answer: 'No, IBPS Clerk selection is based on Mains score alone. No interview.' },
    { question: 'Are sectional cutoffs applicable?', answer: 'Yes, Prelims has sectional cutoffs for English, Reasoning, and Numerical Ability in addition to overall cutoff.' },
    { question: 'Can I change my state preference?', answer: 'No, state preference is fixed at application. Choose wisely as it determines your cutoff competition.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-clerk-age-limit', pageType: 'age-limit',
  metaTitle: 'IBPS Clerk Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'IBPS Clerk age limit 2026: 20-28 years for General. Category-wise relaxation for SC/ST/OBC/PwD.',
  h1: 'IBPS Clerk Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>IBPS Clerk Age Limit</strong> is 20–28 years for General category — tighter than IBPS PO (20-30) by 2 years. This reflects the clerical nature of the post, where banks prefer younger recruits who can serve longer before retirement.</p>

<h3>IBPS Clerk 2026 Age Limit</h3>
<ul>
<li><strong>General:</strong> 20–28 years</li>
<li><strong>OBC:</strong> 20–31 years (3 years)</li>
<li><strong>SC/ST:</strong> 20–33 years (5 years)</li>
<li><strong>PwBD:</strong> 20–38 years (10 years)</li>
<li><strong>Ex-Servicemen:</strong> 20–33 years</li>
</ul>

<p>The 8-year eligibility window (20-28) gives candidates about 6-7 genuine attempts, as IBPS Clerk is conducted annually. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to check eligibility.</p>

<h3>Key Differences from IBPS PO Age Limit</h3>
<ul>
<li>Clerk: 20-28 (General) vs PO: 20-30 (General) — 2 years shorter</li>
<li>This means candidates aging out of Clerk can still apply for PO for 2 more years</li>
<li>The minimum age of 20 is same for both — graduation is required</li>
</ul>`,

  eligibility: `<h3>Age Summary</h3><ul><li><strong>General:</strong> 20–28</li><li><strong>OBC:</strong> 20–31</li><li><strong>SC/ST:</strong> 20–33</li><li><strong>PwBD:</strong> 20–38</li></ul>`,
  faqs: [
    { question: 'What is the age limit for IBPS Clerk?', answer: '20-28 for General. OBC: 31, SC/ST: 33, PwBD: 38.' },
    { question: 'Why is Clerk age limit lower than PO?', answer: 'Clerk posts are entry-level and banks prefer younger recruits for longer service tenure. PO is a managerial role with higher age allowance.' },
    { question: 'Can a 29-year-old General apply for Clerk?', answer: 'No, the upper limit is 28 for General. Consider IBPS PO (limit 30) instead.' },
    { question: 'Is the age limit same across all participating banks?', answer: 'Yes, all 11 IBPS participating banks follow the same age criteria for Clerk recruitment.' },
    { question: 'How is age calculated?', answer: 'IBPS specifies the exact date in the notification, typically 1st August of the recruitment year.' },
  ],
  relatedExams: RELATED,
};

export const IBPS_CLERK_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
