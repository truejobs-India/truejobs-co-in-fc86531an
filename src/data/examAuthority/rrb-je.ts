import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'railway-jobs' as const,
  examName: 'RRB JE',
  examYear: 2026,
  conductingBody: 'Railway Recruitment Boards (RRBs)',
  officialWebsite: 'rrbcdg.gov.in',
  datePublished: '2026-02-22',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
  { label: 'RRB ALP 2026 Notification', href: '/rrb-alp-2026-notification' },
  { label: 'Railway Group D 2026 Notification', href: '/railway-group-d-2026-notification' },
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'RRB JE 2026 Syllabus', href: '/rrb-je-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-je-2026-notification',
  pageType: 'notification',
  metaTitle: 'RRB JE 2026 Notification — Vacancies & Apply',
  metaDescription: 'RRB JE 2026 Notification out. Check vacancies, eligibility, exam dates for Junior Engineer posts across Indian Railways. Apply online now.',
  h1: 'RRB JE 2026 Notification — Vacancies, Eligibility & How to Apply Online',
  totalVacancies: 7654,
  applicationEndDate: '2026-06-30',
  applyLink: 'https://rrbcdg.gov.in',
  overview: `<p>The <strong>RRB JE 2026 Notification</strong> has been issued by the Railway Recruitment Boards for the recruitment of <strong>Junior Engineer (JE)</strong>, <strong>Junior Engineer (IT)</strong>, <strong>Depot Material Superintendent (DMS)</strong>, and <strong>Chemical & Metallurgical Assistant (CMA)</strong> posts. Approximately <strong>7,654 vacancies</strong> are available across all railway zones.</p>
<p>Junior Engineers in Indian Railways play a critical role in maintenance, construction, and supervision of railway infrastructure including tracks, bridges, electrical systems, signalling equipment, and rolling stock. JE posts are placed under <strong>Pay Level 6</strong> of the 7th CPC, making it one of the most attractive technical positions in government service.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>Railway Recruitment Boards</td></tr><tr><td>Posts</td><td>Junior Engineer, JE (IT), DMS, CMA</td></tr><tr><td>Total Vacancies</td><td>7,654 (approximate)</td></tr><tr><td>Qualification</td><td>Diploma/Degree in Engineering</td></tr><tr><td>Pay Level</td><td>Level 6 (₹35,400 basic)</td></tr><tr><td>Selection</td><td>CBT-1 → CBT-2 → DV → Medical</td></tr></table>
<p>The selection process involves two Computer Based Tests. CBT-1 is a screening exam covering general subjects, while CBT-2 tests technical knowledge specific to the engineering branch. Candidates with a 3-year Diploma or 4-year Degree in Engineering from recognized institutions are eligible to apply.</p>
<p>Railway JE posts offer excellent career growth with promotions to Senior Section Engineer (SSE), Section Engineer, and higher supervisory/managerial positions. The combination of good starting salary, job security, and structured career progression makes RRB JE one of the most popular engineering recruitment exams.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-02-22' },
    { label: 'Application Start', date: '2026-03-25' },
    { label: 'Application Last Date', date: '2026-06-30' },
    { label: 'CBT-1 Exam Date', date: 'September 2026 (Tentative)' },
    { label: 'CBT-2 Exam Date', date: 'To Be Announced' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>3-year Diploma in Engineering in relevant branch, OR 4-year B.E./B.Tech degree from a recognized institution. Branches include Civil, Mechanical, Electrical, Electronics, Computer Science, IT, and others as per specific post requirements.</p><h3>Age Limit</h3><p>18 to 33 years for General/EWS</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years</p>`,
  feeStructure: { general: 500, obc: 500, scSt: 250, female: 250, ph: 250, paymentModes: ['Online (Net Banking, UPI, Debit Card)', 'SBI Challan'] },
  selectionProcess: [
    'CBT-1 (First Stage) — general subjects screening',
    'CBT-2 (Second Stage) — technical subjects based on engineering branch',
    'Document Verification',
    'Medical Examination',
    'Final Merit based on CBT-2 normalized scores',
  ],
  examPattern: [
    { stageName: 'CBT-1', rows: [
      { subject: 'Mathematics', questions: 30, marks: 30, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Intelligence & Reasoning', questions: 25, marks: 25, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Awareness', questions: 15, marks: 15, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Science', questions: 30, marks: 30, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
    ]},
    { stageName: 'CBT-2 (Technical)', rows: [
      { subject: 'General Awareness', questions: 15, marks: 15, duration: '120 minutes', negativeMarking: '1/3 per wrong answer' },
      { subject: 'Physics & Chemistry', questions: 15, marks: 15, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'Basics of Computer Applications', questions: 10, marks: 10, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'Basics of Environment & Pollution Control', questions: 10, marks: 10, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'Technical Abilities (Branch-specific)', questions: 100, marks: 100, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 35400, salaryMax: 112400, payLevels: 'Pay Level 6', grossRange: '₹55,000 – ₹1,30,000', netRange: '₹45,000 – ₹1,05,000',
    allowances: ['DA', 'HRA', 'Transport Allowance', 'Free Railway Passes', 'Medical Benefits', 'NPS', 'LTC', 'Children Education Allowance'],
    postWiseSalary: [
      { post: 'Junior Engineer (Civil/Mechanical/Electrical)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Junior Engineer (IT)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Depot Material Superintendent', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Chemical & Metallurgical Assistant', payLevel: 'Level 6', basicPay: '₹35,400' },
    ],
  },
  howToApply: [
    'Visit official RRB website (rrbcdg.gov.in or respective zone)',
    'Register for CEN JE 2026 with email and mobile',
    'Fill application form with engineering qualification details',
    'Upload photograph and signature per specs',
    'Select JE department preference and railway zone',
    'Pay application fee online',
    'Submit and save confirmation page',
  ],
  faqs: [
    { question: 'What is the RRB JE 2026 vacancy count?', answer: 'Approximately 7,654 vacancies for JE, JE(IT), DMS, and CMA posts across all railway zones.' },
    { question: 'Is B.Tech required for RRB JE?', answer: 'No, a 3-year Diploma in Engineering is the minimum qualification. B.Tech holders are also eligible.' },
    { question: 'What is the starting salary of Railway JE?', answer: 'Pay Level 6 with ₹35,400 basic pay. Gross salary is approximately ₹55,000-₹65,000 per month.' },
    { question: 'Which engineering branches are eligible?', answer: 'Civil, Mechanical, Electrical, Electronics, Computer Science, IT, and others depending on the specific JE post.' },
    { question: 'Can JE get promoted to SSE?', answer: 'Yes, JE can be promoted to Senior Section Engineer (SSE) at Pay Level 7, and further to higher supervisory positions.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://rrbcdg.gov.in',
    instructions: [
      'Visit the official RRB website of your region (e.g. rrbcdg.gov.in for RRB New Delhi)',
      'Click on "Download Admit Card" or "CEN JE 2026 Admit Card" link',
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
      'RRBs apply normalisation across multiple shifts to ensure fair scoring — your raw score is converted to a normalised score',
      'Download your individual score card from the RRB candidate login portal after result declaration',
      'CBT-1 qualified candidates will be called for CBT-2 (technical subjects)',
      'Final merit list is prepared based on normalised CBT-2 scores and published on respective RRB websites',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '72.50', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '64.25', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '55.75', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '47.50', totalMarks: '100' },
    { year: 2019, category: 'General', cutoffScore: '68.38', totalMarks: '100' },
    { year: 2019, category: 'OBC', cutoffScore: '60.12', totalMarks: '100' },
    { year: 2019, category: 'SC', cutoffScore: '52.25', totalMarks: '100' },
    { year: 2019, category: 'ST', cutoffScore: '44.75', totalMarks: '100' },
    { year: 2026, category: 'General', cutoffScore: 'To Be Announced', totalMarks: '100' },
    { year: 2026, category: 'OBC', cutoffScore: 'To Be Announced', totalMarks: '100' },
    { year: 2026, category: 'SC', cutoffScore: 'To Be Announced', totalMarks: '100' },
    { year: 2026, category: 'ST', cutoffScore: 'To Be Announced', totalMarks: '100' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-je-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'RRB JE 2026 Syllabus — Technical Topics',
  metaDescription: 'RRB JE 2026 complete syllabus for CBT-1 and CBT-2 technical subjects. Branch-wise topics for Civil, Mechanical, Electrical, Electronics JE.',
  h1: 'RRB JE 2026 Syllabus — CBT-1 & CBT-2 Technical Subject-wise Topics',
  overview: `<p>The <strong>RRB JE 2026 Syllabus</strong> comprises general subjects in CBT-1 and heavily technical content in CBT-2. The technical section (100 marks out of 150 in CBT-2) tests in-depth knowledge of the candidate's engineering branch.</p>
<h3>CBT-1 Syllabus</h3>
<p><strong>Mathematics (30 marks):</strong> Number system, Algebra, Trigonometry, Geometry, Mensuration, Statistics, Percentages, Ratio-Proportion, Time-Speed-Distance, Profit-Loss, Interest calculations.</p>
<p><strong>General Intelligence & Reasoning (25 marks):</strong> Analogies, Series, Coding-Decoding, Syllogism, Venn Diagrams, Classification, Data Interpretation, Blood Relations, Directions, Puzzles.</p>
<p><strong>General Awareness (15 marks):</strong> Current affairs, Indian history, geography, polity, economy, science & technology, awards, sports.</p>
<p><strong>General Science (30 marks):</strong> Physics, Chemistry, Life Sciences — up to 12th standard level.</p>
<h3>CBT-2 Technical Syllabus (Branch-wise)</h3>
<p><strong>Civil Engineering:</strong> Building Materials, Estimating & Costing, Surveying, Soil Mechanics, Hydraulics, Irrigation, Transportation Engineering, Environmental Engineering, Structural Engineering, Concrete Technology.</p>
<p><strong>Mechanical Engineering:</strong> Thermodynamics, IC Engines, Fluid Mechanics, Machine Design, Manufacturing, Industrial Engineering, Strength of Materials, Theory of Machines.</p>
<p><strong>Electrical Engineering:</strong> Circuit Theory, Electrical Machines, Power Systems, Control Systems, Measurements, Power Electronics, Digital Electronics.</p>
<p><strong>Electronics Engineering:</strong> Electronic Devices, Digital Electronics, Communication Systems, Microprocessors, Signal Processing, Control Systems, Electromagnetic Theory.</p>`,
  syllabusSummary: `<ul><li><strong>CBT-1:</strong> Maths (30), Reasoning (25), GK (15), Science (30) — general level</li><li><strong>CBT-2:</strong> GK (15), Physics-Chemistry (15), Computers (10), Environment (10), Technical (100) — branch-specific</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'What are the technical topics for Civil JE?', answer: 'Building Materials, Surveying, Soil Mechanics, Hydraulics, Transportation, Structural and Environmental Engineering topics from Diploma/Degree curriculum.' },
    { question: 'How many marks is the technical section in CBT-2?', answer: '100 marks out of 150 total in CBT-2 are from branch-specific technical subjects.' },
    { question: 'Is CBT-1 syllabus difficult?', answer: 'CBT-1 is at 12th standard level for general subjects. It is a screening test — prepare well but focus major effort on CBT-2 technicals.' },
    { question: 'Are computer questions in JE exam?', answer: 'Yes, CBT-2 has 10 marks from Basics of Computer Applications covering hardware, software, OS, networking fundamentals.' },
    { question: 'How to prepare for RRB JE technical?', answer: 'Use your Diploma/Degree textbooks, solve previous year papers, focus on the 100-mark technical section of CBT-2.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-je-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'RRB JE 2026 Exam Pattern — CBT 1 & 2 Details',
  metaDescription: 'RRB JE 2026 exam pattern. CBT-1 and CBT-2 structure, total marks, questions, time duration, negative marking and merit calculation.',
  h1: 'RRB JE 2026 Exam Pattern — CBT-1 & CBT-2 Structure, Marks & Time',
  overview: `<p>The <strong>RRB JE 2026 Exam Pattern</strong> has two CBT stages. CBT-1 is a screening test covering general subjects (100 marks in 90 minutes), while CBT-2 is the merit test with heavy emphasis on technical subjects (150 marks in 120 minutes).</p>
<h3>CBT-1 (Screening)</h3>
<p>100 questions for 100 marks in 90 minutes. Distribution: Mathematics (30), General Intelligence & Reasoning (25), General Awareness (15), General Science (30). This is only for shortlisting candidates for CBT-2. CBT-1 marks do NOT count toward the final merit. Negative marking of 1/3 per wrong answer applies.</p>
<h3>CBT-2 (Merit Test)</h3>
<p>150 questions for 150 marks in 120 minutes. Distribution: General Awareness (15), Physics & Chemistry (15), Basics of Computers (10), Basics of Environment (10), and <strong>Technical Abilities (100)</strong>. The Technical section covers branch-specific topics based on Diploma/Degree curriculum. CBT-2 marks determine the final merit. Negative marking of 1/3 applies.</p>
<h3>Normalization</h3>
<p>Since the exam is conducted in multiple shifts, RRBs apply score normalization to ensure fairness. The normalized CBT-2 score is used for final merit ranking. Candidates are ranked within their opted post and zone preferences.</p>
<p>There is no interview or skill test for JE posts. Document Verification and Medical Examination follow CBT-2 for shortlisted candidates.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How many marks is CBT-2 for JE?', answer: '150 marks — 50 from general subjects and 100 from branch-specific technical subjects. Duration is 120 minutes.' },
    { question: 'Does CBT-1 count in final merit?', answer: 'No, CBT-1 is only for screening. Only CBT-2 normalized marks determine the final merit list.' },
    { question: 'Is there interview for RRB JE?', answer: 'No, there is no interview. Selection is based purely on CBT-2 merit, followed by DV and Medical.' },
    { question: 'What is the time for CBT-2?', answer: '120 minutes (2 hours) for 150 questions including both general and technical sections.' },
    { question: 'Is normalization applied?', answer: 'Yes, multi-shift normalization is applied to CBT-2 scores to ensure fair ranking across different sessions.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-je-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'RRB JE 2026 Eligibility — Age & Education',
  metaDescription: 'RRB JE 2026 eligibility. Diploma and degree requirements, accepted branches, age limit, age relaxation and medical standards.',
  h1: 'RRB JE 2026 Eligibility — Engineering Qualification, Age & Medical Standards',
  overview: `<p>The <strong>RRB JE 2026 Eligibility</strong> requires candidates to have formal engineering education — either a 3-year Diploma or 4-year B.E./B.Tech degree from a recognized institution. The specific branch must match the JE department being applied for.</p>
<h3>Educational Qualification</h3>
<p><strong>Junior Engineer (Civil):</strong> Diploma/Degree in Civil Engineering<br><strong>JE (Mechanical):</strong> Diploma/Degree in Mechanical Engineering<br><strong>JE (Electrical):</strong> Diploma/Degree in Electrical Engineering<br><strong>JE (Electronics/S&T):</strong> Diploma/Degree in Electronics/Telecommunication<br><strong>JE (IT):</strong> B.Tech in CS/IT or BCA/MCA<br><strong>DMS:</strong> B.Sc in relevant science or Diploma in relevant engineering<br><strong>CMA:</strong> B.Sc in Chemistry/Metallurgy</p>
<h3>Age Limit</h3>
<p>18 to 33 years for General/EWS candidates. The cut-off date for age calculation is specified in the notification.</p>
<h3>Age Relaxation</h3>
<p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years | Ex-Servicemen: as per rules</p>
<h3>Medical Standards</h3>
<p>JE posts generally fall under medical category B1 or C1, which have standard vision and hearing requirements. Unlike ALP, JE posts do not require unaided 6/6 vision — corrected vision with spectacles is acceptable for most JE posts.</p>`,
  eligibility: `<h3>Qualification</h3><p>3-year Diploma or 4-year B.E./B.Tech in relevant branch from a recognized institution</p><h3>Age</h3><p>18-33 years (General) | OBC: +3 | SC/ST: +5 | PwBD: +10</p><h3>Medical</h3><p>Category B1/C1 — corrected vision acceptable for most posts</p>`,
  faqs: [
    { question: 'Is Diploma sufficient for RRB JE?', answer: 'Yes, a 3-year Diploma in the relevant engineering branch is the minimum qualification.' },
    { question: 'Can final year students apply?', answer: 'Candidates in their final year can apply provisionally but must produce the degree/diploma at document verification.' },
    { question: 'What is the age limit for JE?', answer: '18 to 33 years for General/EWS. Standard relaxation for reserved categories.' },
    { question: 'Can B.Sc graduates apply for JE?', answer: 'B.Sc is accepted only for DMS and CMA posts, not for core JE positions which require engineering qualifications.' },
    { question: 'Is spectacle use allowed for JE medical?', answer: 'Yes, most JE posts have relaxed medical standards where corrected vision with spectacles is acceptable.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-je-2026-salary', pageType: 'salary',
  metaTitle: 'RRB JE 2026 Salary — Pay Level 6 Details',
  metaDescription: 'RRB JE 2026 salary. Pay Level 6 basic pay ₹35,400, gross salary, in-hand salary, allowances and promotion to SSE details.',
  h1: 'RRB JE 2026 Salary — Pay Level 6, Gross Salary, Allowances & Career Growth',
  overview: `<p>The <strong>RRB JE 2026 Salary</strong> is placed at <strong>Pay Level 6</strong> of the 7th CPC with a basic pay of ₹35,400 per month — one of the highest entry-level pay scales in railway recruitment. This makes JE one of the most financially rewarding technical positions in government service.</p>
<h3>Salary Components</h3>
<p>The gross salary includes basic pay (₹35,400), Dearness Allowance (approximately 50% of basic), House Rent Allowance (8-24% based on city), Transport Allowance, and other applicable allowances. Initial gross salary is approximately ₹55,000-₹65,000 per month.</p>
<h3>In-Hand Salary</h3>
<p>After deductions for NPS (10%), income tax, and professional tax, the in-hand salary for a new JE is approximately ₹45,000-₹55,000 per month. JEs posted in X-class cities (Delhi, Mumbai) receive higher HRA, resulting in a better take-home.</p>
<h3>Career Progression</h3>
<p>JE (Level 6) → Senior Section Engineer/SSE (Level 7, ₹44,900) → Section Engineer/SE → Junior Administrative Grade (JAG) → Senior Administrative Grade (SAG). Through LDCE (Limited Departmental Competitive Exam) and seniority, JEs can reach Group A officer positions. The maximum pay at Level 6 is ₹1,12,400.</p>
<p>Railway JEs also enjoy all standard railway benefits including free travel passes, medical facilities, subsidized housing, and pension. The combination of high starting pay and rapid career growth makes JE one of the most sought-after positions.</p>`,
  salary: {
    salaryMin: 35400, salaryMax: 112400, payLevels: 'Pay Level 6', grossRange: '₹55,000 – ₹1,30,000', netRange: '₹45,000 – ₹1,05,000',
    allowances: ['Dearness Allowance', 'HRA', 'Transport Allowance', 'Free Railway Passes', 'Medical Benefits', 'NPS', 'LTC', 'CEA', 'Overtime Allowance'],
    postWiseSalary: [
      { post: 'Junior Engineer (All branches)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'SSE (after promotion)', payLevel: 'Level 7', basicPay: '₹44,900' },
    ],
  },
  faqs: [
    { question: 'What is RRB JE starting salary?', answer: '₹35,400 basic pay under Pay Level 6. Gross salary is approximately ₹55,000-₹65,000 per month initially.' },
    { question: 'Is JE salary higher than NTPC?', answer: 'Yes, JE is at Level 6 (₹35,400) while most NTPC posts are at Level 2-5 (₹19,900-₹29,200). JE has a higher starting salary.' },
    { question: 'What is SSE salary after promotion?', answer: 'Senior Section Engineer is at Level 7 with ₹44,900 basic pay. Gross salary exceeds ₹70,000-₹80,000.' },
    { question: 'Can JE become a Group A officer?', answer: 'Yes, through LDCE and career progression, JEs can reach JAG and SAG level Group A positions in railways.' },
    { question: 'What is the maximum pay at Level 6?', answer: 'The maximum basic pay at Pay Level 6 is ₹1,12,400, achievable through annual increments over the career.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-je-cutoff', pageType: 'cutoff',
  metaTitle: 'RRB JE Cutoff 2026 — CBT-1 & CBT-2 Cut Off Marks',
  metaDescription: 'RRB JE cutoff 2026: Category-wise cut off marks for CBT-1 and CBT-2. Previous year cutoffs with zone-wise trend analysis.',
  h1: 'RRB JE Cutoff 2026 — Category-Wise Cut Off Marks & Zone-Wise Trends',
  overview: `<p>The <strong>RRB JE Cutoff</strong> is released in two stages — CBT-1 (screening) and CBT-2 (final merit). Junior Engineer is a technical post at Pay Level 6 (₹35,400 basic), making it one of the most sought-after railway positions. The cutoffs reflect this demand, with General category requiring 65-75% in CBT-1 to qualify for the next stage.</p>

<h3>How RRB JE Cutoff Works</h3>
<ul>
<li><strong>CBT-1:</strong> Screening test — shortlists 15× vacancies for CBT-2. Based on normalised scores.</li>
<li><strong>CBT-2:</strong> Technical merit stage — includes branch-specific questions (Civil/Mechanical/Electrical/Electronics). Final merit based on CBT-2 score.</li>
<li><strong>Zone-wise:</strong> Each RRB releases separate cutoffs. Vacancy distribution varies by zone.</li>
</ul>

<h3>RRB JE Cutoff Trend (2019–2024)</h3>
<p>General category CBT-1 cutoffs rose from 72.50 (2019) to 82.25 (2024) out of 100, reflecting a significant upward trend driven by limited vacancies and increasing applicants. The technical nature of the exam means engineering graduates dominate the competition.</p>

<h3>Expected RRB JE 2026 Cutoff</h3>
<p>General category CBT-1 cutoff is expected to be <strong>83–88 out of 100</strong>. Candidates should target 90+ for comfortable qualification. For CBT-2, branch-wise cutoffs vary — Civil and Mechanical tend to have higher cutoffs than Electronics/Electrical.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '82.25', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '73.50', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '64.75', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '56.25', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: '77.40', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: '69.25', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: '60.50', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: '52.75', totalMarks: '100' },
    { year: 2019, category: 'General', cutoffScore: '72.50', totalMarks: '100' },
    { year: 2019, category: 'OBC', cutoffScore: '64.80', totalMarks: '100' },
    { year: 2019, category: 'SC', cutoffScore: '56.10', totalMarks: '100' },
    { year: 2019, category: 'ST', cutoffScore: '48.50', totalMarks: '100' },
  ],
  faqs: [
    { question: 'What is the expected RRB JE 2026 cutoff?', answer: 'General category CBT-1 cutoff is expected around 83-88 out of 100. Target 90+ to be safe across all zones.' },
    { question: 'Is JE cutoff higher than NTPC?', answer: 'Yes, JE cutoffs are typically higher due to fewer vacancies and the technical qualification requirement limiting the applicant pool quality.' },
    { question: 'Is CBT-2 cutoff branch-wise?', answer: 'Yes, CBT-2 has branch-specific questions. Civil and Mechanical branches tend to have higher cutoffs than Electronics/Electrical.' },
    { question: 'Are JE cutoffs zone-wise?', answer: 'Yes, each RRB releases separate cutoffs based on zone-specific vacancies and applications.' },
    { question: 'Does CBT-1 score matter for final selection?', answer: 'No, CBT-1 is only for screening. Final merit is based entirely on CBT-2 normalised score.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-je-age-limit', pageType: 'age-limit',
  metaTitle: 'RRB JE Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'RRB JE age limit 2026: 18-33 years for General. Category-wise relaxation for OBC/SC/ST/PwD/Ex-Servicemen.',
  h1: 'RRB JE Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>RRB JE Age Limit</strong> follows standard railway norms with 18–33 years for General category, similar to other railway recruitment exams. This generous upper limit allows engineering graduates who have spent additional years in higher education or work experience to still be eligible.</p>

<h3>RRB JE 2026 Age Limit</h3>
<ul>
<li><strong>General:</strong> 18–33 years</li>
<li><strong>OBC:</strong> 18–36 years (3 years relaxation)</li>
<li><strong>SC/ST:</strong> 18–38 years (5 years relaxation)</li>
<li><strong>PwBD:</strong> 18–43/46/48 years</li>
<li><strong>Ex-Servicemen:</strong> Military service deduction + 3 years</li>
</ul>

<h3>Why 33 Years?</h3>
<p>Railway JE posts require engineering diploma/degree. Most candidates complete B.Tech/diploma by 21-23, leaving 10+ years of eligibility window. This accommodates candidates who prepare for multiple exams or gain work experience before applying.</p>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator</a> to check your RRB JE eligibility instantly.</p>`,

  eligibility: `<h3>Age Limit Summary</h3><ul><li><strong>General:</strong> 18–33</li><li><strong>OBC:</strong> 18–36</li><li><strong>SC/ST:</strong> 18–38</li><li><strong>PwBD:</strong> 18–43/46/48</li></ul>`,
  faqs: [
    { question: 'What is the age limit for RRB JE 2026?', answer: '18-33 years for General. OBC: up to 36, SC/ST: up to 38.' },
    { question: 'Is RRB JE age limit same as NTPC?', answer: 'Yes, both follow the standard railway upper limit of 33 years for General category.' },
    { question: 'Can diploma holders apply at 18?', answer: 'If you have completed your diploma and are 18+, yes. Polytechnic diplomas can be completed by 17-18.' },
    { question: 'Is there extra relaxation for railway employees?', answer: 'Yes, existing railway employees get relaxation up to 40 years of age.' },
    { question: 'How is age calculated?', answer: 'As per the closing date of application notified by RRBs. DOB from matriculation certificate is used.' },
  ],
  relatedExams: RELATED,
};

export const RRB_JE_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg, ageLimitCfg2];
