import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'banking-jobs' as const,
  examName: 'IBPS PO',
  examYear: 2026,
  conductingBody: 'Institute of Banking Personnel Selection (IBPS)',
  officialWebsite: 'ibps.in',
  datePublished: '2026-02-10',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'IBPS Clerk 2026 Notification', href: '/ibps-clerk-2026-notification' },
  { label: 'SBI PO 2026 Notification', href: '/sbi-po-2026-notification' },
  { label: 'SBI Clerk 2026 Notification', href: '/sbi-clerk-2026-notification' },
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'IBPS PO 2026 Syllabus', href: '/ibps-po-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ibps-po-2026-notification',
  pageType: 'notification',
  metaTitle: 'IBPS PO 2026 Notification — Vacancies & Apply',
  metaDescription: 'IBPS PO 2026 Notification out. Check vacancies, eligibility, exam dates, syllabus and apply online for Probationary Officer posts in public sector banks.',
  h1: 'IBPS PO 2026 Notification — Vacancies, Eligibility & How to Apply Online',
  totalVacancies: 4455,
  applicationEndDate: '2026-09-15',
  applyLink: 'https://ibps.in',
  overview: `<p>The Institute of Banking Personnel Selection (IBPS) has released the <strong>IBPS PO 2026 Notification</strong> (CRP PO/MT-XVI) for recruitment of <strong>Probationary Officers / Management Trainees</strong> in participating public sector banks. Approximately <strong>4,455 vacancies</strong> are available across banks including Punjab National Bank, Bank of Baroda, Canara Bank, Union Bank, Indian Bank, and others.</p>
<p>IBPS PO is one of India's most prestigious banking examinations, offering a direct entry into officer-cadre positions in nationalized banks. Selected candidates serve a probation period of 2 years, after which they are confirmed as officers in the bank.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>IBPS</td></tr><tr><td>Post</td><td>Probationary Officer / Management Trainee</td></tr><tr><td>Total Vacancies</td><td>4,455 (across participating banks)</td></tr><tr><td>Qualification</td><td>Graduation in any discipline</td></tr><tr><td>Selection</td><td>Prelims → Mains → Interview</td></tr><tr><td>Official Website</td><td>ibps.in</td></tr></table>
<p>The selection process includes Preliminary Examination, Main Examination, and Interview. The prelims is a screening test, while the mains exam is comprehensive covering English, Data Analysis, Reasoning, General Awareness, and Computer Aptitude. The interview carries 100 marks and tests candidates' banking awareness, communication skills, and overall personality.</p>
<p>IBPS PO salary starts at approximately ₹36,000 per month (basic) and can go up to ₹63,840 with increments. With DA, HRA, and other allowances, the initial gross salary ranges from ₹52,000 to ₹60,000 per month. Banking sector also offers excellent perks including concessional loans, medical insurance, LFC, and pension benefits.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-08-01' },
    { label: 'Online Application Start', date: '2026-08-01' },
    { label: 'Application Last Date', date: '2026-09-15' },
    { label: 'Prelims Exam', date: 'October 2026' },
    { label: 'Mains Exam', date: 'November 2026' },
    { label: 'Interview', date: 'January–February 2027' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>Bachelor's degree in <strong>any discipline</strong> from a recognized university. Final year students awaiting results are also eligible to apply provisionally.</p><h3>Age Limit</h3><p>20 to 30 years as on the date specified in the notification</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: 5 years | J&K domicile (1980-89): 5 years</p><h3>Nationality</h3><p>Indian citizen, or subject of Nepal/Bhutan, or Tibetan refugee who came before 1962, or person of Indian origin migrated from specified countries</p>`,
  feeStructure: { general: 850, obc: 850, scSt: 175, female: 175, ph: 175, paymentModes: ['Online (Net Banking, UPI, Debit Card, Credit Card, IMPS, Wallets)'] },
  selectionProcess: [
    'Preliminary Examination — objective, online (screening)',
    'Main Examination — objective + descriptive, online (merit)',
    'Interview — conducted by participating banks',
    'Provisional Allotment — based on combined Mains + Interview merit',
    'Document Verification & Medical at allotted bank',
  ],
  examPattern: [
    { stageName: 'Prelims', rows: [
      { subject: 'English Language', questions: 30, marks: 30, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Quantitative Aptitude', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Reasoning Ability', questions: 35, marks: 35, duration: '20 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
    { stageName: 'Mains (Objective)', rows: [
      { subject: 'Reasoning & Computer Aptitude', questions: 45, marks: 60, duration: '60 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Data Analysis & Interpretation', questions: 35, marks: 60, duration: '45 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'General/Economy/Banking Awareness', questions: 40, marks: 40, duration: '35 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'English Language', questions: 35, marks: 40, duration: '40 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 36000, salaryMax: 63840, payLevels: 'JMGS-I (Junior Management Grade Scale-I)', grossRange: '₹52,000 – ₹75,000', netRange: '₹42,000 – ₹60,000',
    allowances: ['Dearness Allowance', 'House Rent Allowance', 'City Compensatory Allowance', 'Medical Aid', 'Concessional Loan Facility', 'Pension/NPS', 'Leave Fare Concession', 'Leased Accommodation'],
    postWiseSalary: [
      { post: 'Probationary Officer (Initial)', payLevel: 'JMGS-I', basicPay: '₹36,000' },
      { post: 'PO (after 2 years confirmation)', payLevel: 'JMGS-I', basicPay: '₹38,250' },
    ],
  },
  howToApply: [
    'Visit ibps.in and find CRP PO/MT-XVI notification link',
    'Click "Apply Online" and complete new registration',
    'Fill personal, educational, and bank preference details',
    'Upload photograph, signature, left thumb impression, and handwritten declaration',
    'Pay application fee via online mode',
    'Select exam centre preferences',
    'Submit application and save confirmation page',
  ],
  faqs: [
    { question: 'What is the IBPS PO 2026 vacancy count?', answer: 'IBPS PO 2026 has approximately 4,455 vacancies across participating public sector banks.' },
    { question: 'What is the qualification for IBPS PO?', answer: 'Graduation in any discipline from a recognized university. Final year students can apply provisionally.' },
    { question: 'Is there an interview in IBPS PO?', answer: 'Yes, IBPS PO has a three-stage selection: Prelims → Mains → Interview. Interview carries 100 marks.' },
    { question: 'What is IBPS PO starting salary?', answer: 'Basic pay starts at ₹36,000 under JMGS-I scale. Gross salary with allowances is approximately ₹52,000-₹60,000.' },
    { question: 'How many banks participate in IBPS PO?', answer: 'About 11 participating public sector banks including PNB, BoB, Canara Bank, Union Bank, and Indian Bank.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ibps.in',
    instructions: [
      'Visit ibps.in and click on "CRP PO/MT-XVI" under the ongoing processes',
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
      'IBPS PO does not use normalisation — scores are directly computed from the online exam',
      'Download your individual score card showing section-wise and overall scores',
      'Prelims qualified candidates will be called for Mains; Mains qualifiers proceed to Interview',
      'Final merit list is prepared based on Mains (80%) + Interview (20%) weighted scores and state-wise allotment is done to participating banks',
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
  ...COMMON, slug: 'ibps-po-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'IBPS PO 2026 Syllabus — Prelims & Mains',
  metaDescription: 'IBPS PO 2026 complete syllabus for Prelims and Mains. Section-wise topics for English, Quant, Reasoning, GA and Computer Aptitude.',
  h1: 'IBPS PO 2026 Syllabus — Prelims & Mains Subject-wise Topics',
  overview: `<p>The <strong>IBPS PO 2026 Syllabus</strong> covers different subjects across Prelims and Mains stages, with Mains being more comprehensive and including banking-specific topics.</p>
<h3>Prelims Syllabus</h3>
<p><strong>English Language (30 marks):</strong> Reading Comprehension, Cloze Test, Error Spotting, Sentence Rearrangement, Fill in the Blanks, Para Jumbles, Vocabulary.</p>
<p><strong>Quantitative Aptitude (35 marks):</strong> Simplification, Number Series, Data Interpretation, Percentage, Ratio-Proportion, Profit-Loss, Time-Speed-Distance, Mixture-Allegation, SI/CI, Probability, Permutation-Combination.</p>
<p><strong>Reasoning Ability (35 marks):</strong> Puzzles & Seating Arrangement, Syllogism, Coding-Decoding, Blood Relations, Direction Sense, Inequality, Data Sufficiency, Input-Output, Ordering-Ranking.</p>
<h3>Mains Syllabus</h3>
<p><strong>Reasoning & Computer Aptitude (60 marks):</strong> Advanced Puzzles, Coding-Decoding, Syllogism, Data Sufficiency, Machine Input-Output, plus Computer Fundamentals, Operating Systems, Internet, Networking, Database, MS Office.</p>
<p><strong>Data Analysis & Interpretation (60 marks):</strong> Tabular DI, Bar/Line/Pie Chart DI, Caselet DI, Missing DI, Data Sufficiency, Quantity Comparison, Probability, Permutation-Combination.</p>
<p><strong>General/Economy/Banking Awareness (40 marks):</strong> Current Affairs (6 months), Banking Awareness, Financial Awareness, RBI Policies, Budget, Economic Survey, International Organizations, Awards, Sports.</p>
<p><strong>English Language (40 marks):</strong> RC (comprehension + vocabulary), Error Detection, Sentence Correction, Cloze Test with new pattern, Connectors, Paragraph Completion.</p>
<p><strong>Descriptive Paper (25 marks, 30 min):</strong> Essay Writing and Letter Writing — tests English writing ability.</p>`,
  syllabusSummary: `<ul><li><strong>Prelims:</strong> English (30), Quant (35), Reasoning (35) — screening test</li><li><strong>Mains Objective:</strong> Reasoning+Computer (60), Data Analysis (60), Banking GK (40), English (40)</li><li><strong>Mains Descriptive:</strong> Essay + Letter Writing (25 marks, 30 min)</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is banking awareness important for IBPS PO?', answer: 'Yes, the Mains GK section heavily tests banking awareness, RBI policies, financial terms, and economic current affairs (40 marks).' },
    { question: 'Is there a descriptive paper in IBPS PO?', answer: 'Yes, Mains includes a 30-minute descriptive paper (Essay + Letter Writing) worth 25 marks.' },
    { question: 'How many sections are in Prelims?', answer: 'Three sections: English Language (30), Quantitative Aptitude (35), and Reasoning Ability (35).' },
    { question: 'Are computer questions asked in Mains?', answer: 'Yes, Computer Aptitude is combined with Reasoning in Mains for a total of 60 marks.' },
    { question: 'What current affairs period to study?', answer: 'Focus on the last 6 months of current affairs, with special emphasis on banking and economic news.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-po-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'IBPS PO 2026 Exam Pattern — Prelims & Mains',
  metaDescription: 'IBPS PO 2026 exam pattern. Prelims, Mains objective, descriptive paper and interview structure with marks, time and sectional cutoffs.',
  h1: 'IBPS PO 2026 Exam Pattern — Prelims, Mains & Interview Structure',
  overview: `<p>The <strong>IBPS PO 2026 Exam Pattern</strong> has three stages: Preliminary Exam, Main Exam (Objective + Descriptive), and Interview. Each stage has distinct structure, marking scheme, and cutoff criteria.</p>
<h3>Preliminary Examination</h3>
<p>Online test with 100 questions for 100 marks in 60 minutes. Three sections with individual time limits: English (30 questions, 20 min), Quantitative Aptitude (35 questions, 20 min), Reasoning (35 questions, 20 min). Negative marking of 0.25 per wrong answer. <strong>Sectional cutoffs</strong> apply — candidates must clear cutoff in each section. Prelims is purely screening; marks don't count in final merit.</p>
<h3>Main Examination — Objective</h3>
<p>200 questions for 200 marks in 180 minutes (3 hours) across 4 sections with individual time limits. Reasoning & Computer Aptitude (45Q, 60M, 60min), Data Analysis (35Q, 60M, 45min), GK/Banking (40Q, 40M, 35min), English (35Q, 40M, 40min). Sectional cutoffs apply. Negative marking of 0.25 per wrong answer.</p>
<h3>Main Examination — Descriptive</h3>
<p>30 minutes, 25 marks. One Essay (word limit ~300) and one Letter (word limit ~150) in English. This paper is evaluated only for candidates who qualify the objective paper. Minimum qualifying marks apply.</p>
<h3>Interview</h3>
<p>100 marks. Conducted by participating banks at designated centres. Tests banking aptitude, communication skills, general awareness, and personality. Final merit = Mains (80%) + Interview (20%) weighted scores.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Are there sectional cutoffs in IBPS PO?', answer: 'Yes, both Prelims and Mains have sectional cutoffs. Candidates must clear the cutoff in each section to qualify.' },
    { question: 'What is the total time for Mains?', answer: 'Mains objective is 180 minutes (3 hours) plus 30 minutes for the descriptive paper, total 3.5 hours.' },
    { question: 'How is the final merit calculated?', answer: 'Final merit = Mains score (80% weightage) + Interview score (20% weightage).' },
    { question: 'Is there negative marking?', answer: 'Yes, 0.25 marks deducted for each wrong answer in both Prelims and Mains objective papers.' },
    { question: 'How many candidates are called for interview?', answer: 'Generally 3 times the number of vacancies are called for interview based on Mains merit.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-po-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'IBPS PO 2026 Eligibility — Age & Qualification',
  metaDescription: 'IBPS PO 2026 eligibility criteria. Age limit 20-30, graduation requirement, age relaxation for reserved categories and nationality.',
  h1: 'IBPS PO 2026 Eligibility — Age Limit, Educational Qualification & Relaxation',
  overview: `<p>The <strong>IBPS PO 2026 Eligibility</strong> criteria are straightforward — any graduate from a recognized university can apply, making it accessible across all academic backgrounds.</p>
<h3>Educational Qualification</h3>
<p>A degree (Graduation) in <strong>any discipline</strong> from a university recognized by the Government of India or any equivalent qualification recognized by the Central Government. Candidates must have passed the graduation exam. Final year students awaiting results are eligible to apply, provided they produce the degree at the time of document verification.</p>
<h3>Age Limit</h3>
<p>Minimum 20 years and maximum 30 years. Age is reckoned as on the 1st day of the month specified in the notification. Born not before 02-08-1996 and not after 01-08-2006 (indicative dates based on typical IBPS schedule).</p>
<h3>Age Relaxation</h3>
<p>SC/ST: 5 years (max 35) | OBC-NCL: 3 years (max 33) | PwBD: 10 years (max 40) | PwBD + OBC: 13 years | PwBD + SC/ST: 15 years | Ex-Servicemen/Disabled Ex-SM: 5 years | J&K domicile (1980-89): 5 years | Persons affected by 1984 riots: 5 years</p>
<h3>Additional Requirements</h3>
<p>Computer literacy is a prerequisite for the post. Candidates must possess basic computer skills. Knowledge of the local language of the state/UT for which the candidate applies is preferred and may be tested at the interview stage.</p>`,
  eligibility: `<h3>Qualification</h3><p>Graduation in any discipline from a recognized university</p><h3>Age</h3><p>20-30 years (General) | OBC: +3 | SC/ST: +5 | PwBD: +10</p><h3>Other</h3><p>Computer literacy required; local language knowledge preferred</p>`,
  faqs: [
    { question: 'Can arts graduates apply for IBPS PO?', answer: 'Yes, graduation in any discipline is accepted — Arts, Science, Commerce, Engineering, or any other stream.' },
    { question: 'What is the age limit for IBPS PO?', answer: '20 to 30 years for General/EWS. OBC gets 3 years relaxation, SC/ST gets 5 years.' },
    { question: 'Is computer knowledge mandatory?', answer: 'Yes, basic computer literacy is a prerequisite. Computer aptitude is also tested in the Mains exam.' },
    { question: 'Can final year students apply?', answer: 'Yes, final year graduation students can apply but must produce the degree at document verification.' },
    { question: 'Is there a minimum percentage requirement?', answer: 'No minimum percentage is specified. A pass certificate in graduation is sufficient.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-po-2026-salary', pageType: 'salary',
  metaTitle: 'IBPS PO 2026 Salary — Pay Scale & Perks',
  metaDescription: 'IBPS PO 2026 salary structure. JMGS-I pay scale, basic pay ₹36,000, gross salary, in-hand salary, allowances and bank perks.',
  h1: 'IBPS PO 2026 Salary — Pay Scale, Gross Salary, In-Hand & Bank Perks',
  overview: `<p>The <strong>IBPS PO 2026 Salary</strong> follows the bipartite wage settlement for bank officers. Probationary Officers are placed in <strong>Junior Management Grade Scale-I (JMGS-I)</strong> with a starting basic pay of ₹36,000 per month.</p>
<h3>Pay Scale</h3>
<p>JMGS-I scale: ₹36,000 – 1,490/7 – 46,430 – 1,740/2 – 49,910 – 1,990/7 – 63,840. This means basic pay starts at ₹36,000 and increases through defined increments to a maximum of ₹63,840. Annual increment is ₹1,490 for the first 7 years, then ₹1,740 for 2 years, and ₹1,990 for the next 7 years.</p>
<h3>Gross Salary Calculation</h3>
<p>The gross salary includes basic pay + DA (linked to CPI, currently around 18%) + HRA (7-9% depending on city) + CCA + Special Allowance. Initial gross salary is approximately ₹52,000-₹60,000 depending on the posting city. Metro city postings attract higher HRA and CCA.</p>
<h3>In-Hand Salary</h3>
<p>After deductions for NPS/pension fund, income tax, and professional tax, the in-hand salary for a new IBPS PO is approximately ₹42,000-₹50,000 per month.</p>
<h3>Banking Perks & Benefits</h3>
<p>Bank officers enjoy exceptional perks: concessional interest rates on home loans, car loans, and personal loans; full medical insurance for family; leased accommodation or HRA; Leave Fare Concession; newspaper/magazine allowance; telephone/mobile reimbursement; and pension/NPS benefits. These perks can add ₹15,000-₹25,000 in effective monthly value.</p>`,
  salary: {
    salaryMin: 36000, salaryMax: 63840, payLevels: 'JMGS-I (Junior Management Grade Scale-I)', grossRange: '₹52,000 – ₹75,000', netRange: '₹42,000 – ₹60,000',
    allowances: ['Dearness Allowance', 'House Rent Allowance', 'City Compensatory Allowance', 'Special Allowance', 'Medical Insurance', 'Concessional Loans', 'Pension/NPS', 'Leave Fare Concession', 'Leased Accommodation', 'Newspaper Allowance'],
    postWiseSalary: [
      { post: 'Probationary Officer (Initial)', payLevel: 'JMGS-I', basicPay: '₹36,000' },
      { post: 'Officer (after 7 years)', payLevel: 'JMGS-I', basicPay: '₹46,430' },
      { post: 'Officer (Maximum JMGS-I)', payLevel: 'JMGS-I', basicPay: '₹63,840' },
    ],
  },
  faqs: [
    { question: 'What is IBPS PO starting salary?', answer: '₹36,000 basic pay under JMGS-I. Gross salary including allowances is approximately ₹52,000-₹60,000 per month.' },
    { question: 'Do IBPS PO officers get loan benefits?', answer: 'Yes, bank officers get concessional interest rates on home loans, car loans, and personal loans — one of the biggest perks in banking.' },
    { question: 'What is the maximum salary in JMGS-I?', answer: 'Maximum basic pay in JMGS-I is ₹63,840. With promotions to MMGS-II and above, salary increases significantly.' },
    { question: 'Is there pension for IBPS PO?', answer: 'New recruits are covered under NPS. Some banks still offer defined benefit pension for older employees.' },
    { question: 'How does PO salary compare to SSC CGL?', answer: 'IBPS PO starting salary (₹36,000 basic) is slightly higher than most SSC CGL posts and includes banking-specific perks like concessional loans.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-po-cutoff', pageType: 'cutoff',
  metaTitle: 'IBPS PO Cutoff 2026 — Prelims & Mains Marks',
  metaDescription: 'IBPS PO cutoff 2026: Category-wise cut off marks for Prelims and Mains. Previous year cutoffs 2022-2024 with analysis.',
  h1: 'IBPS PO Cutoff 2026 — Category-Wise Prelims & Mains Cut Off Marks',
  overview: `<p>The <strong>IBPS PO Cutoff</strong> is released in two stages — Prelims (screening) and Mains (final merit). As one of the premier banking exams, IBPS PO cutoffs are closely watched by aspirants. The cutoff reflects the competitive nature of Probationary Officer recruitment across 11 participating public sector banks.</p>

<h3>How IBPS PO Cutoff Works</h3>
<ul>
<li><strong>Prelims Cutoff:</strong> Overall cutoff + sectional cutoffs for English, Reasoning, and Quantitative Aptitude. Must clear all three sections AND the overall cutoff.</li>
<li><strong>Mains Cutoff:</strong> Merit-based — shortlists candidates for interview. Mains has 5 sections: Reasoning & Computer Aptitude, Data Analysis, English, General Awareness, and English Descriptive.</li>
<li><strong>Final Cutoff:</strong> 80% Mains + 20% Interview = Final merit score.</li>
</ul>

<h3>IBPS PO Cutoff Trend (2022–2024)</h3>
<p>Prelims overall cutoff for General category has remained in the 52-60 range out of 100 marks. The sectional cutoffs create the real challenge — many candidates clear the overall cutoff but fail in one section. Mains cutoffs have ranged from 72-82 out of 225 marks for General category.</p>

<h3>Expected IBPS PO 2026 Cutoff</h3>
<p>Prelims overall cutoff is expected at <strong>55–62 out of 100</strong> for General category. Target 70+ to be safe. For Mains, aim for 90+ out of 225.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '58.75', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '54.25', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '47.50', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '38.25', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: '55.50', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: '51.25', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: '44.75', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: '35.50', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '52.80', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '48.50', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '42.25', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '33.75', totalMarks: '100' },
  ],
  faqs: [
    { question: 'What is the expected IBPS PO 2026 Prelims cutoff?', answer: 'General category overall cutoff is expected around 55-62 out of 100. Must also clear sectional cutoffs.' },
    { question: 'Are there sectional cutoffs in IBPS PO?', answer: 'Yes, you must clear individual section cutoffs in English, Reasoning, and Quant in addition to the overall cutoff.' },
    { question: 'Is IBPS PO cutoff higher than SBI PO?', answer: 'IBPS PO cutoff as a percentage is generally lower than SBI PO due to more vacancies across 11 banks.' },
    { question: 'How much weight does interview carry?', answer: 'Interview is 20% of final merit (100 marks). Mains is 80%. Strong Mains performance is crucial.' },
    { question: 'Which section has the toughest sectional cutoff?', answer: 'English is often the toughest section for many candidates, with sectional cutoffs around 8-12 out of 30.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'ibps-po-age-limit', pageType: 'age-limit',
  metaTitle: 'IBPS PO Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'IBPS PO age limit 2026: 20-30 years for General. Category-wise relaxation for SC/ST/OBC/PwD/Ex-Servicemen.',
  h1: 'IBPS PO Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>IBPS PO Age Limit</strong> is 20–30 years for General category, offering a generous 10-year eligibility window for graduates. This is wider than many banking exams and allows candidates multiple attempts at the exam.</p>

<h3>IBPS PO 2026 Age Limit</h3>
<ul>
<li><strong>General:</strong> 20–30 years</li>
<li><strong>OBC:</strong> 20–33 years (3 years relaxation)</li>
<li><strong>SC/ST:</strong> 20–35 years (5 years relaxation)</li>
<li><strong>PwBD:</strong> 20–40 years (10 years relaxation)</li>
<li><strong>Ex-Servicemen:</strong> 20–35 years (5 years relaxation)</li>
</ul>

<p>The 20-year minimum ensures candidates have at minimum completed graduation. Most candidates are 21-27 years old when they apply. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify eligibility.</p>

<h3>Key Points</h3>
<ul>
<li>Age calculated as on 1st August of the notification year (typically)</li>
<li>IBPS specifies the exact date for age calculation in the notification</li>
<li>J&K domicile candidates (1980-1989) get 5 years extra relaxation</li>
<li>Widows/divorced women who have not remarried get additional relaxation</li>
</ul>`,

  eligibility: `<h3>Age Summary</h3><ul><li><strong>General:</strong> 20–30</li><li><strong>OBC:</strong> 20–33</li><li><strong>SC/ST:</strong> 20–35</li><li><strong>PwBD:</strong> 20–40</li></ul>`,
  faqs: [
    { question: 'What is the age limit for IBPS PO?', answer: '20-30 for General. OBC: 33, SC/ST: 35, PwBD: 40.' },
    { question: 'Can a 31-year-old General apply?', answer: 'No, the upper limit is strictly 30 for General category. Only reserved categories get relaxation.' },
    { question: 'Is IBPS PO age limit same as SBI PO?', answer: 'SBI PO has 21-30 for General (1 year higher minimum). IBPS PO is 20-30.' },
    { question: 'How many attempts are allowed?', answer: 'There is no limit on attempts — you can apply every year as long as you meet the age limit.' },
    { question: 'Is age calculated differently each year?', answer: 'IBPS specifies the exact date for age calculation in each year\'s notification, typically 1st August.' },
  ],
  relatedExams: RELATED,
};

export const IBPS_PO_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
