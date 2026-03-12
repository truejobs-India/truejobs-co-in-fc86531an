import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'railway-jobs' as const,
  examName: 'Railway Group D',
  examYear: 2026,
  conductingBody: 'Railway Recruitment Boards (RRBs)',
  officialWebsite: 'rrbcdg.gov.in',
  datePublished: '2026-02-20',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
  { label: 'RRB ALP 2026 Notification', href: '/rrb-alp-2026-notification' },
  { label: 'RRB JE 2026 Notification', href: '/rrb-je-2026-notification' },
  { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
  { label: 'Railway Group D 2026 Syllabus', href: '/railway-group-d-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'railway-group-d-2026-notification',
  pageType: 'notification',
  metaTitle: 'Railway Group D 2026 Notification — Apply Now',
  metaDescription: 'Railway Group D 2026 Notification out. Check vacancies, eligibility, exam dates, syllabus and apply online for RRB Group D Level 1 posts.',
  h1: 'Railway Group D 2026 Notification — Vacancies, Eligibility & How to Apply',
  totalVacancies: 103769,
  applicationEndDate: '2026-07-15',
  applyLink: 'https://rrbcdg.gov.in',
  notificationPdfUrl: 'https://rrbcdg.gov.in/group-d-cen-2026.pdf',
  overview: `<p>The <strong>Railway Group D 2026 Notification</strong> has been released by the Railway Recruitment Boards (RRBs) for the recruitment of Level 1 posts across Indian Railways. This is one of the largest government recruitment drives with approximately <strong>1,03,769 vacancies</strong> for posts including Track Maintainer Grade-IV, Helper/Assistant in various technical departments, and other Level 1 positions.</p>
<p>Railway Group D recruitment attracts massive interest due to its accessibility — candidates with a 10th pass certificate and ITI qualification are eligible. The selection is through a Computer Based Test (CBT) followed by Physical Efficiency Test (PET), Document Verification, and Medical Examination.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>Railway Recruitment Boards (RRBs)</td></tr><tr><td>Total Vacancies</td><td>1,03,769 (approximate)</td></tr><tr><td>Post Category</td><td>Level 1 (Track Maintainer, Helper, Assistant)</td></tr><tr><td>Qualification</td><td>10th Pass + ITI (or equivalent)</td></tr><tr><td>Application Mode</td><td>Online only</td></tr><tr><td>Official Website</td><td>rrbcdg.gov.in</td></tr></table>
<p>Group D posts form the backbone of railway operations, covering track maintenance, workshop assistance, and operational support across all railway zones. The pay is under Level 1 of the 7th CPC with a basic pay of ₹18,000 per month, along with standard railway benefits including free passes, medical facilities, and housing.</p>
<p>Due to the high number of vacancies and minimal educational requirements, Group D recruitment typically receives over 1.25 crore applications, making it one of India's most competitive exams by applicant volume. Candidates are strongly advised to prepare systematically and take advantage of mock tests to improve their score.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-02-20' },
    { label: 'Online Application Start', date: '2026-04-01' },
    { label: 'Application Last Date', date: '2026-07-15' },
    { label: 'CBT Exam Date', date: 'October–December 2026 (Tentative)' },
    { label: 'PET Date', date: 'To Be Announced' },
    { label: 'Result Date', date: 'To Be Announced' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>10th pass from a recognized Board <strong>PLUS</strong> an ITI certificate from an NCVT/SCVT recognized institute, OR National Apprenticeship Certificate (NAC) granted by NCVT. Some posts accept 10th pass with specific trade qualifications.</p><h3>Age Limit</h3><p>18 to 33 years for General/EWS category</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: as per rules</p><h3>Physical Fitness</h3><p>Candidates must pass the Physical Efficiency Test (PET). Male candidates: lift 35 kg and carry it for 100 metres in 2 minutes + run 1000m in 4 minutes 15 seconds. Female candidates: lift 20 kg and carry it for 100 metres in 2 minutes + run 1000m in 5 minutes 40 seconds.</p>`,
  feeStructure: {
    general: 500,
    obc: 500,
    scSt: 250,
    female: 250,
    ph: 250,
    paymentModes: ['Online (Net Banking, UPI, Debit Card)', 'SBI Challan', 'Post Office Challan'],
  },
  selectionProcess: [
    'Computer Based Test (CBT) — 100 marks, 90 minutes',
    'Physical Efficiency Test (PET) — qualifying',
    'Document Verification (DV)',
    'Medical Examination — as per railway medical standards',
    'Final Merit List based on CBT normalized scores',
  ],
  examPattern: [
    {
      stageName: 'Computer Based Test (CBT)',
      rows: [
        { subject: 'General Science', questions: 25, marks: 25, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
        { subject: 'Mathematics', questions: 25, marks: 25, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Intelligence & Reasoning', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
        { subject: 'General Awareness & Current Affairs', questions: 20, marks: 20, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      ],
    },
  ],
  salary: {
    salaryMin: 18000,
    salaryMax: 56900,
    payLevels: 'Pay Level 1',
    grossRange: '₹26,000 – ₹55,000',
    netRange: '₹21,000 – ₹45,000',
    allowances: ['Dearness Allowance (DA)', 'House Rent Allowance (HRA)', 'Transport Allowance', 'Free Railway Passes', 'Medical Benefits', 'National Pension System (NPS)', 'Overtime Allowance'],
    postWiseSalary: [
      { post: 'Track Maintainer Grade-IV', payLevel: 'Level 1', basicPay: '₹18,000' },
      { post: 'Helper/Assistant (Electrical)', payLevel: 'Level 1', basicPay: '₹18,000' },
      { post: 'Helper/Assistant (Mechanical)', payLevel: 'Level 1', basicPay: '₹18,000' },
      { post: 'Helper/Assistant (S&T)', payLevel: 'Level 1', basicPay: '₹18,000' },
    ],
  },
  howToApply: [
    'Visit the official RRB website for your zone (rrbcdg.gov.in or respective regional RRB site)',
    'Click "New Registration" for CEN Group D 2026',
    'Register with valid email ID and active mobile number',
    'Fill personal details, educational qualification, and ITI trade details',
    'Upload photograph (3.5×4.5 cm) and signature as per specifications',
    'Pay the application fee online or through challan',
    'Review, submit, and save the confirmation page for future reference',
  ],
  faqs: [
    { question: 'What is the Railway Group D 2026 vacancy count?', answer: 'Railway Group D 2026 has approximately 1,03,769 vacancies across all railway zones for Level 1 posts.' },
    { question: 'What qualification is needed for Group D?', answer: '10th pass plus ITI/NAC certificate from NCVT/SCVT recognized institute is the minimum qualification.' },
    { question: 'Is there a physical test in Group D recruitment?', answer: 'Yes, candidates must pass the Physical Efficiency Test (PET) which includes weight lifting and running components.' },
    { question: 'What is the age limit for Railway Group D?', answer: '18 to 33 years for General category. OBC gets 3 years relaxation, SC/ST gets 5 years.' },
    { question: 'What is Railway Group D salary?', answer: 'Group D salary starts at ₹18,000 basic pay under Level 1 of 7th CPC. Gross salary is approximately ₹26,000-₹30,000 initially.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://rrbcdg.gov.in',
    instructions: [
      'Visit the official RRB website of your region (e.g. rrbcdg.gov.in for RRB New Delhi)',
      'Click on "Download Admit Card" or "CEN Group D 2026 Admit Card" link',
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
      'RRBs apply normalisation across multiple CBT shifts to ensure fair scoring — your raw score is converted to a normalised score',
      'Download your individual score card from the RRB candidate login portal after result declaration',
      'CBT qualified candidates will be called for Physical Efficiency Test (PET)',
      'Final merit list is prepared based on normalised CBT scores and published on respective RRB websites',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '70.25', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '62.50', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '53.75', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '45.00', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '65.38', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '57.62', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '49.12', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '41.25', totalMarks: '100' },
    { year: 2018, category: 'General', cutoffScore: '62.17', totalMarks: '100' },
    { year: 2018, category: 'OBC', cutoffScore: '54.88', totalMarks: '100' },
    { year: 2018, category: 'SC', cutoffScore: '46.50', totalMarks: '100' },
    { year: 2018, category: 'ST', cutoffScore: '38.75', totalMarks: '100' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'railway-group-d-2026-syllabus',
  pageType: 'syllabus',
  metaTitle: 'Railway Group D 2026 Syllabus — All Topics',
  metaDescription: 'Railway Group D 2026 complete syllabus. Subject-wise topics for General Science, Maths, Reasoning, and GK with preparation tips.',
  h1: 'Railway Group D 2026 Syllabus — Complete Subject-wise Topic List & Preparation Guide',
  overview: `<p>The <strong>Railway Group D 2026 Syllabus</strong> covers four subjects: General Science, Mathematics, General Intelligence & Reasoning, and General Awareness & Current Affairs. The CBT has 100 questions worth 100 marks to be solved in 90 minutes.</p>
<h3>General Science (25 Questions)</h3>
<p>This section tests knowledge of Physics, Chemistry, and Life Sciences up to 10th standard NCERT level. Key topics include: Force and Motion, Work-Energy-Power, Sound and Light, Electricity and Magnetism, Acids-Bases-Salts, Metals-Non-metals, Carbon Compounds, Periodic Table, Cell Biology, Human Body Systems, Diseases, Nutrition, and Environment.</p>
<h3>Mathematics (25 Questions)</h3>
<p>Based on 10th standard level: Number System, BODMAS, Decimals, Fractions, LCM-HCF, Ratio-Proportion, Percentage, Mensuration, Time-Speed-Distance, Time-Work, Simple-Compound Interest, Profit-Loss, Algebra (basics), Geometry, Trigonometry (basics), Statistics, Square Root, Ages, Calendar, Clock.</p>
<h3>General Intelligence & Reasoning (30 Questions)</h3>
<p>Analogies, Alphabetical & Number Series, Coding-Decoding, Mathematical Operations, Relationships, Syllogism, Jumbling, Venn Diagrams, Data Interpretation, Conclusions, Directions, Statement-Arguments, Decision Making, Maps, Graphs, Classification, Embedded Figures, Pattern Completion.</p>
<h3>General Awareness & Current Affairs (20 Questions)</h3>
<p>Current events (National & International), Indian Polity, History, Geography, Economy, Sports, Awards, Science & Technology, Important Schemes, Books & Authors, Organizations, Railway-specific knowledge.</p>`,
  syllabusSummary: `<ul><li><strong>General Science (25 marks):</strong> Physics, Chemistry, Biology — 10th NCERT level</li><li><strong>Mathematics (25 marks):</strong> Arithmetic, Geometry, Mensuration, Statistics — 10th level</li><li><strong>Reasoning (30 marks):</strong> Analogies, Series, Coding, Venn Diagrams, Classification</li><li><strong>General Awareness (20 marks):</strong> Current Affairs, Polity, History, Geography, Economy</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'What is the syllabus for Railway Group D 2026?', answer: 'The syllabus covers General Science, Mathematics, General Intelligence & Reasoning, and General Awareness at 10th standard level.' },
    { question: 'Is the Group D syllabus based on 10th level?', answer: 'Yes, the syllabus is primarily based on 10th standard (NCERT) level topics across all subjects.' },
    { question: 'How many questions come from Science?', answer: '25 questions from General Science covering Physics, Chemistry, and Life Sciences.' },
    { question: 'Are current affairs important for Group D?', answer: 'Yes, 20 questions come from General Awareness including current affairs from the last 6-12 months.' },
    { question: 'What books should I study for Group D?', answer: 'NCERT books for classes 9-10 for Science and Maths, Lucent GK for General Awareness, and any standard Reasoning book.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'railway-group-d-2026-exam-pattern',
  pageType: 'exam-pattern',
  metaTitle: 'Railway Group D 2026 Exam Pattern — CBT & PET',
  metaDescription: 'Railway Group D 2026 exam pattern for CBT and PET. Total marks, questions, time, negative marking and physical test standards.',
  h1: 'Railway Group D 2026 Exam Pattern — CBT, PET & Medical Test Details',
  overview: `<p>The <strong>Railway Group D 2026 Exam Pattern</strong> consists of a Computer Based Test (CBT) followed by a Physical Efficiency Test (PET). The CBT is a single-stage exam with 100 objective questions worth 100 marks, to be completed in 90 minutes.</p>
<h3>CBT Structure</h3>
<p>The CBT contains questions from four sections: General Science (25 questions, 25 marks), Mathematics (25 questions, 25 marks), General Intelligence & Reasoning (30 questions, 30 marks), and General Awareness & Current Affairs (20 questions, 20 marks). Negative marking of 1/3 mark applies for each incorrect answer. Questions are of 10th standard level.</p>
<h3>Physical Efficiency Test (PET)</h3>
<p>PET is a qualifying stage. <strong>Male candidates</strong> must: (a) lift and carry 35 kg for 100 metres in 2 minutes, and (b) run 1000 metres in 4 minutes 15 seconds. <strong>Female candidates</strong> must: (a) lift and carry 20 kg for 100 metres in 2 minutes, and (b) run 1000 metres in 5 minutes 40 seconds. PwBD candidates are exempt from PET.</p>
<h3>Document Verification & Medical Examination</h3>
<p>Candidates clearing CBT and PET undergo Document Verification followed by Medical Examination. Medical standards for Group D are prescribed by the Railway Board — candidates must meet vision, hearing, and general fitness standards.</p>
<p>Normalization is applied across multiple CBT sessions to ensure fair scoring. The final merit is based on normalized CBT scores, subject to qualifying PET, document verification, and medical fitness.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How many questions are in Railway Group D CBT?', answer: '100 questions from four subjects — General Science (25), Maths (25), Reasoning (30), and General Awareness (20) — to be completed in 90 minutes.' },
    { question: 'Is PET compulsory for Group D?', answer: 'Yes, PET is compulsory and qualifying. Candidates who fail PET are eliminated regardless of CBT score.' },
    { question: 'What is the running requirement in PET?', answer: 'Males must run 1000m in 4:15 minutes and females in 5:40 minutes.' },
    { question: 'Is there negative marking in Group D exam?', answer: 'Yes, 1/3 of the marks are deducted for each wrong answer in the CBT.' },
    { question: 'How many stages are in Group D selection?', answer: 'Four stages: CBT (merit-based) → PET (qualifying) → Document Verification → Medical Examination.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'railway-group-d-2026-eligibility',
  pageType: 'eligibility',
  metaTitle: 'Railway Group D 2026 Eligibility Criteria',
  metaDescription: 'Railway Group D 2026 eligibility. Age limit, qualification (10th+ITI), age relaxation for SC/ST/OBC, physical standards and nationality.',
  h1: 'Railway Group D 2026 Eligibility — Qualification, Age Limit & Physical Standards',
  overview: `<p>The <strong>Railway Group D 2026 Eligibility</strong> requirements are designed to be accessible while ensuring candidates meet minimum standards for railway operations. The key requirements cover educational qualification, age limits, physical fitness, and nationality.</p>
<h3>Educational Qualification</h3>
<p>Candidates must have passed 10th class (Matriculation) from a recognized Board <strong>AND</strong> hold an ITI certificate from an NCVT or SCVT recognized institution, OR a National Apprenticeship Certificate (NAC) granted by NCVT. The ITI/NAC must be in a relevant trade as specified in the notification.</p>
<h3>Age Limit</h3>
<p>The age limit for Railway Group D 2026 is <strong>18 to 33 years</strong> for General/EWS candidates, calculated as on the date specified in the official notification.</p>
<h3>Age Relaxation</h3>
<p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD (UR): 10 years | PwBD (OBC): 13 years | PwBD (SC/ST): 15 years | Ex-Servicemen: as per existing government rules | Candidates who had ordinarily been domiciled in J&K from 01.01.1980 to 31.12.1989: 5 years</p>
<h3>Physical Fitness Standards</h3>
<p>Given the physically demanding nature of Group D work, candidates must pass the PET. Male candidates must lift 35 kg and carry it 100 metres plus run 1000m within prescribed time limits. Female candidates have reduced weight and relaxed timing. Medical fitness as per railway standards is mandatory.</p>
<p>Candidates with certain disabilities recognized under RPwD Act 2016 may be exempt from PET requirements, subject to the post being identified as suitable for their disability category.</p>`,
  eligibility: `<h3>Minimum Qualification</h3><p>10th pass + ITI (NCVT/SCVT) or NAC (NCVT) in a relevant trade</p><h3>Age Limit</h3><p>18 to 33 years (General/EWS)</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10-15 years | Ex-Servicemen: as per rules</p><h3>Physical Standards</h3><p>Must pass PET: Males — 35 kg carry + 1000m run | Females — 20 kg carry + 1000m run</p>`,
  faqs: [
    { question: 'Is ITI compulsory for Railway Group D?', answer: 'Yes, candidates must have 10th pass plus ITI/NAC certificate from an NCVT or SCVT recognized institute.' },
    { question: 'What is the age limit for Group D 2026?', answer: '18 to 33 years for General/EWS category. Standard relaxation applies for reserved categories.' },
    { question: 'Can female candidates apply for Group D?', answer: 'Yes, female candidates are eligible with relaxed PET standards — 20 kg weight carry and 1000m run in 5:40 minutes.' },
    { question: 'Which ITI trades are accepted?', answer: 'Relevant trades as specified in the notification including Fitter, Electrician, Welder, Mechanic, and others depending on the post.' },
    { question: 'Is there age relaxation for SC candidates?', answer: 'Yes, SC/ST candidates get 5 years of age relaxation over the upper age limit.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'railway-group-d-2026-salary',
  pageType: 'salary',
  metaTitle: 'Railway Group D 2026 Salary — Pay & Benefits',
  metaDescription: 'Railway Group D 2026 salary under 7th CPC. Pay Level 1 basic pay, gross salary, in-hand salary, allowances and railway benefits.',
  h1: 'Railway Group D 2026 Salary — Pay Level 1, Allowances & In-Hand Salary Details',
  overview: `<p>The <strong>Railway Group D 2026 Salary</strong> falls under <strong>Pay Level 1</strong> of the 7th Central Pay Commission with a starting basic pay of ₹18,000 per month. While Level 1 is the entry-level pay scale in Indian Railways, the total compensation including allowances and non-monetary benefits makes it a solid government job option.</p>
<h3>Salary Breakdown</h3>
<p>The basic pay of ₹18,000 is supplemented by Dearness Allowance (currently around 50% of basic), House Rent Allowance (8-24% depending on city classification), Transport Allowance, and other applicable allowances. The gross salary in the initial months is approximately ₹26,000-₹32,000 per month, depending on the posting location.</p>
<h3>In-Hand Salary Calculation</h3>
<p>After standard deductions including NPS contribution (10% of basic + DA), income tax (if applicable), and professional tax, the in-hand salary for a new Group D recruit is approximately ₹21,000-₹28,000 per month. Employees posted in metro cities receive higher HRA, resulting in better take-home pay.</p>
<h3>Career Progression</h3>
<p>Group D employees receive annual increments of 3% on basic pay. With experience and departmental exams, employees can progress to higher levels. Track Maintainer Grade-IV can progress to Grade-III (Level 2) and eventually to higher supervisory positions. The maximum basic pay at Level 1 is ₹56,900 per month.</p>
<h3>Non-Monetary Benefits</h3>
<p>Railway Group D employees enjoy free railway travel passes for duty and personal use, subsidized railway quarter accommodation, free medical treatment at railway hospitals for self and family, children education allowance, and post-retirement pension benefits. These benefits collectively add significant value to the overall compensation package.</p>`,
  salary: {
    salaryMin: 18000,
    salaryMax: 56900,
    payLevels: 'Pay Level 1',
    grossRange: '₹26,000 – ₹55,000',
    netRange: '₹21,000 – ₹45,000',
    allowances: ['Dearness Allowance (DA)', 'House Rent Allowance (HRA)', 'Transport Allowance', 'Free Railway Passes', 'Medical Benefits', 'National Pension System (NPS)', 'Overtime Allowance', 'Night Duty Allowance'],
    postWiseSalary: [
      { post: 'Track Maintainer Grade-IV', payLevel: 'Level 1', basicPay: '₹18,000' },
      { post: 'Helper/Assistant (Electrical)', payLevel: 'Level 1', basicPay: '₹18,000' },
      { post: 'Helper/Assistant (Mechanical)', payLevel: 'Level 1', basicPay: '₹18,000' },
      { post: 'Helper/Assistant (Workshop)', payLevel: 'Level 1', basicPay: '₹18,000' },
    ],
  },
  faqs: [
    { question: 'What is the starting salary of Railway Group D?', answer: 'The starting basic pay is ₹18,000 per month under Pay Level 1. Gross salary including allowances is approximately ₹26,000-₹32,000.' },
    { question: 'Do Group D employees get railway passes?', answer: 'Yes, Group D employees receive free duty and privilege passes for railway travel, along with passes for family members.' },
    { question: 'What is the maximum salary at Level 1?', answer: 'The maximum basic pay at Pay Level 1 is ₹56,900, achievable through annual increments over the career span.' },
    { question: 'Is there overtime allowance for Group D?', answer: 'Yes, Group D employees are eligible for overtime allowance and night duty allowance when working beyond normal hours.' },
    { question: 'Can Group D employees get promoted?', answer: 'Yes, through departmental exams and seniority, Group D employees can progress to Level 2 and above.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'railway-group-d-cutoff', pageType: 'cutoff',
  metaTitle: 'Railway Group D Cutoff 2026 — Zone-Wise Marks',
  metaDescription: 'Railway Group D cutoff 2026: Zone-wise and category-wise cut off marks. Previous year cutoffs 2019-2024 with trend analysis.',
  h1: 'Railway Group D Cutoff 2026 — Zone-Wise Cut Off Marks & Trends',
  overview: `<p>The <strong>Railway Group D Cutoff</strong> varies by RRB zone, as each zone has different vacancy counts and applicant numbers. Group D recruitment (RRC Level 1) is the largest railway recruitment drive, often attracting 1–2 crore applicants for lakhs of vacancies across Track Maintainer, Helper, and other Level 1 posts.</p>

<h3>How Railway Group D Cutoff Works</h3>
<ul>
<li><strong>CBT Cutoff:</strong> Computer Based Test scores determine qualification. Normalisation is applied across multiple shifts.</li>
<li><strong>Zone-wise variation:</strong> Different RRBs/RRCs release separate cutoffs. South zones (Chennai, Secunderabad) often have higher cutoffs than North/East zones.</li>
<li><strong>PET:</strong> Qualifying Physical Efficiency Test follows CBT — failure at PET eliminates even CBT qualifiers.</li>
</ul>

<h3>Railway Group D Cutoff Trend (2019–2024)</h3>
<p>General category cutoffs ranged from 68.50 (2019) to 78.25 (2024) out of 100 marks. The steady increase reflects growing competition and improved preparation among candidates. With the last Group D recruitment in 2024 receiving over 1.25 crore applications, cutoffs have been rising consistently.</p>

<h3>Expected Railway Group D 2026 Cutoff</h3>
<p>General category cutoff for 2026 is expected to be <strong>79–84 out of 100</strong>. Candidates should aim for 85+ to ensure qualification across all zones.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '78.25', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '70.50', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '62.75', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '55.50', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '73.80', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '66.25', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '58.40', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '51.75', totalMarks: '100' },
    { year: 2019, category: 'General', cutoffScore: '68.50', totalMarks: '100' },
    { year: 2019, category: 'OBC', cutoffScore: '61.20', totalMarks: '100' },
    { year: 2019, category: 'SC', cutoffScore: '54.10', totalMarks: '100' },
    { year: 2019, category: 'ST', cutoffScore: '47.25', totalMarks: '100' },
  ],
  faqs: [
    { question: 'What is the expected Railway Group D 2026 cutoff?', answer: 'General category cutoff is expected around 79-84 out of 100 based on past trends. Aim for 85+.' },
    { question: 'Is Group D cutoff zone-wise?', answer: 'Yes, each RRC releases separate cutoffs based on zone-specific vacancies and applicant numbers.' },
    { question: 'Does PET affect the cutoff?', answer: 'PET is qualifying, not merit-based. But many CBT qualifiers fail PET, effectively reducing final competition.' },
    { question: 'Is Group D cutoff higher than ALP?', answer: 'As a percentage of total marks, Group D cutoff is often similar to ALP CBT-1 cutoff (75-80% range for General).' },
    { question: 'How many attempts for Group D?', answer: 'There is no limit on the number of attempts — you can apply each time recruitment is announced, as long as you meet the age limit.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'railway-group-d-age-limit', pageType: 'age-limit',
  metaTitle: 'Railway Group D Age Limit 2026 — Relaxation Rules',
  metaDescription: 'Railway Group D age limit 2026: 18-33 years for General. Category-wise relaxation for SC/ST/OBC/PwD/Ex-Servicemen.',
  h1: 'Railway Group D Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>Railway Group D Age Limit</strong> is relatively generous compared to other government exams, with an upper limit of 33 years for General category. This wider window makes Group D accessible to a larger candidate pool, including those who may have missed the age window for exams like SSC CGL or CHSL.</p>

<h3>Railway Group D 2026 Age Limit</h3>
<ul>
<li><strong>Minimum Age:</strong> 18 years</li>
<li><strong>Maximum Age (General):</strong> 33 years</li>
<li><strong>Maximum Age (OBC):</strong> 36 years (3 years relaxation)</li>
<li><strong>Maximum Age (SC/ST):</strong> 38 years (5 years relaxation)</li>
</ul>

<h3>Category-Wise Age Relaxation</h3>
<ul>
<li><strong>OBC (NCL):</strong> 3 years</li>
<li><strong>SC/ST:</strong> 5 years</li>
<li><strong>PwBD (General):</strong> 10 years | PwBD (OBC): 13 years | PwBD (SC/ST): 15 years</li>
<li><strong>Ex-Servicemen:</strong> deduction of military service + 3 years</li>
<li><strong>Existing Railway employees:</strong> upper limit relaxed up to 40 years</li>
</ul>

<p>Railway Group D has one of the most relaxed age limits among government exams, making it popular among candidates who have crossed the age limit for SSC or banking exams. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify your eligibility.</p>

<h3>Key Points</h3>
<ul>
<li>Age is calculated as per the closing date of application as notified by RRBs/RRCs</li>
<li>DOB is verified from the matriculation (10th) certificate</li>
<li>The generous 33-year limit means candidates born between 1993-2008 are likely eligible in 2026</li>
<li>Ex-servicemen get significant relaxation, making railway Group D popular among veterans</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary</h3>
<ul>
<li><strong>General:</strong> 18–33 years</li>
<li><strong>OBC:</strong> 18–36 years</li>
<li><strong>SC/ST:</strong> 18–38 years</li>
<li><strong>PwBD:</strong> 18–43 years (Gen) / 46 (OBC) / 48 (SC/ST)</li>
</ul>`,
  faqs: [
    { question: 'What is the age limit for Railway Group D?', answer: '18-33 years for General. OBC: up to 36, SC/ST: up to 38, PwBD: up to 43 years.' },
    { question: 'Is Railway Group D age limit 33 or 36?', answer: '33 for General category. OBC gets 3 years relaxation, making it 36.' },
    { question: 'Can a 35-year-old apply for Group D?', answer: 'Yes, if you are OBC (up to 36), SC/ST (up to 38), or PwBD (up to 43/46/48).' },
    { question: 'Do railway employees get extra age relaxation?', answer: 'Yes, existing railway employees get relaxation up to 40 years of age for Group D posts.' },
    { question: 'Is the age limit same for all Group D posts?', answer: 'Yes, all Level 1 posts (Track Maintainer, Helper, etc.) have the same 18-33 age limit.' },
  ],
  relatedExams: RELATED,
};

export const RAILWAY_GROUP_D_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg, ageLimitCfg];
