import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'railway-jobs' as const,
  examName: 'RRB ALP',
  examYear: 2026,
  conductingBody: 'Railway Recruitment Boards (RRBs)',
  officialWebsite: 'rrbcdg.gov.in',
  datePublished: '2026-02-18',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
  { label: 'Railway Group D 2026 Notification', href: '/railway-group-d-2026-notification' },
  { label: 'RRB JE 2026 Notification', href: '/rrb-je-2026-notification' },
  { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
  { label: 'RRB ALP 2026 Syllabus', href: '/rrb-alp-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-alp-2026-notification',
  pageType: 'notification',
  metaTitle: 'RRB ALP 2026 Notification — Vacancies & Dates',
  metaDescription: 'RRB ALP 2026 Notification released. Check vacancies, eligibility, exam pattern, syllabus and apply online for Assistant Loco Pilot posts.',
  h1: 'RRB ALP 2026 Notification — Vacancies, Eligibility & How to Apply',
  totalVacancies: 5696,
  applicationEndDate: '2026-06-15',
  applyLink: 'https://rrbcdg.gov.in',
  overview: `<p>The Railway Recruitment Boards have released the <strong>RRB ALP 2026 Notification</strong> for the recruitment of <strong>Assistant Loco Pilot (ALP)</strong> and <strong>Technician</strong> posts across Indian Railways. This recruitment aims to fill approximately <strong>5,696 vacancies</strong> in various railway zones.</p>
<p>Assistant Loco Pilots are responsible for assisting the Loco Pilot in operating trains, monitoring gauges and instruments, and ensuring safe train operations. Technicians work in electrical, mechanical, and signal departments maintaining railway infrastructure. Both posts require technical qualifications — 10th pass with ITI or a Diploma/Degree in Engineering.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>Railway Recruitment Boards (RRBs)</td></tr><tr><td>Posts</td><td>Assistant Loco Pilot & Technician</td></tr><tr><td>Total Vacancies</td><td>5,696 (approximate)</td></tr><tr><td>Pay Level</td><td>Level 2 (₹19,900 basic)</td></tr><tr><td>Selection Stages</td><td>CBT-1 → CBT-2 → CBAT → Document Verification</td></tr><tr><td>Official Website</td><td>rrbcdg.gov.in</td></tr></table>
<p>The ALP post is under Pay Level 2 of the 7th CPC. With promotions, ALP can progress to Senior ALP, Loco Pilot (Goods), Loco Pilot (Passenger), and eventually Loco Pilot (Mail/Express). The career progression in the loco running cadre is well-structured and offers excellent long-term growth within Indian Railways.</p>
<p>The selection process includes CBT-1 (screening), CBT-2 (technical), and Computer Based Aptitude Test (CBAT) for ALP posts. The CBAT tests psycho-motor abilities essential for safe train driving. Candidates must meet specific visual acuity standards as ALP is a safety-category post.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-02-18' },
    { label: 'Online Application Start', date: '2026-03-20' },
    { label: 'Application Last Date', date: '2026-06-15' },
    { label: 'CBT-1 Exam Date', date: 'August–September 2026 (Tentative)' },
    { label: 'CBT-2 Exam Date', date: 'To Be Announced' },
    { label: 'CBAT Date', date: 'To Be Announced' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p><strong>ALP:</strong> 10th pass + ITI in relevant trade, OR Diploma in Engineering (Mechanical/Electrical/Electronics/Automobile), OR Degree in Engineering</p><p><strong>Technician:</strong> 10th pass + ITI in relevant trade, OR Diploma/Degree in Engineering in relevant branch</p><h3>Age Limit</h3><p>18 to 30 years for General/EWS category</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years | SC/ST: 5 years | PwBD: 10 years</p><h3>Medical Standards</h3><p>ALP is a safety category post — candidates must have visual acuity of 6/6 (distant vision) without glasses and no colour blindness.</p>`,
  feeStructure: { general: 500, obc: 500, scSt: 250, female: 250, ph: 250, paymentModes: ['Online (Net Banking, UPI, Debit Card)', 'SBI Challan'] },
  selectionProcess: [
    'CBT-1 (First Stage Computer Based Test) — screening',
    'CBT-2 (Second Stage) — technical subjects based on trade',
    'CBAT (Computer Based Aptitude Test) — for ALP posts only',
    'Document Verification',
    'Medical Examination (stringent for ALP — safety category)',
  ],
  examPattern: [
    { stageName: 'CBT-1', rows: [
      { subject: 'Mathematics', questions: 20, marks: 20, duration: '60 minutes', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Intelligence & Reasoning', questions: 25, marks: 25, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Science', questions: 20, marks: 20, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Awareness', questions: 10, marks: 10, duration: 'Combined', negativeMarking: '1/3 per wrong answer' },
    ]},
    { stageName: 'CBT-2 (Part A + Part B)', rows: [
      { subject: 'Part A: Maths, Reasoning, Basic Science & Engineering', questions: 100, marks: 100, duration: '90 minutes', negativeMarking: '1/3 per wrong answer' },
      { subject: 'Part B: Trade-specific (relevant to ITI/Diploma)', questions: 75, marks: 75, duration: '60 minutes', negativeMarking: '1/3 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 19900, salaryMax: 63200, payLevels: 'Pay Level 2', grossRange: '₹30,000 – ₹65,000', netRange: '₹25,000 – ₹55,000',
    allowances: ['Dearness Allowance', 'HRA', 'Transport Allowance', 'Running Allowance (for loco running staff)', 'Free Railway Passes', 'Medical Benefits', 'NPS'],
    postWiseSalary: [
      { post: 'Assistant Loco Pilot', payLevel: 'Level 2', basicPay: '₹19,900' },
      { post: 'Technician Grade-III', payLevel: 'Level 2', basicPay: '₹19,900' },
    ],
  },
  howToApply: [
    'Visit official RRB website of your region',
    'Click "New Registration" for CEN ALP/Technician 2026',
    'Register with email and mobile number',
    'Fill application with personal, education, and trade details',
    'Upload photo and signature as per specifications',
    'Pay application fee online',
    'Submit and download confirmation page',
  ],
  faqs: [
    { question: 'What is the RRB ALP 2026 vacancy count?', answer: 'Approximately 5,696 vacancies for ALP and Technician posts across railway zones.' },
    { question: 'What qualification is needed for ALP?', answer: '10th pass with ITI in relevant trade, or Diploma/Degree in Engineering (Mechanical/Electrical/Electronics/Automobile).' },
    { question: 'Is there a computer aptitude test for ALP?', answer: 'Yes, CBAT is mandatory for ALP posts to test psycho-motor abilities required for safe train operations.' },
    { question: 'What is the ALP starting salary?', answer: 'Basic pay of ₹19,900 under Level 2. With running allowance and other benefits, gross salary is ₹30,000-₹35,000.' },
    { question: 'Can ALP get promoted to Loco Pilot?', answer: 'Yes, ALP → Senior ALP → Loco Pilot (Goods) → Loco Pilot (Passenger) → Loco Pilot (Mail/Express) is the career path.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://rrbcdg.gov.in',
    instructions: [
      'Visit the official RRB website of your region (e.g. rrbcdg.gov.in for RRB New Delhi)',
      'Click on "Download Admit Card" or "CEN ALP/Technician 2026 Admit Card" link',
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
      'CBT-1 qualified candidates will be called for CBT-2; ALP candidates additionally appear for CBAT',
      'Final merit list is prepared based on normalised CBT-2 Part A scores and published on respective RRB websites',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '58.75', totalMarks: '75' },
    { year: 2024, category: 'OBC', cutoffScore: '51.25', totalMarks: '75' },
    { year: 2024, category: 'SC', cutoffScore: '43.50', totalMarks: '75' },
    { year: 2024, category: 'ST', cutoffScore: '36.75', totalMarks: '75' },
    { year: 2018, category: 'General', cutoffScore: '55.12', totalMarks: '75' },
    { year: 2018, category: 'OBC', cutoffScore: '47.88', totalMarks: '75' },
    { year: 2018, category: 'SC', cutoffScore: '40.62', totalMarks: '75' },
    { year: 2018, category: 'ST', cutoffScore: '34.25', totalMarks: '75' },
    { year: 2026, category: 'General', cutoffScore: 'To Be Announced', totalMarks: '75' },
    { year: 2026, category: 'OBC', cutoffScore: 'To Be Announced', totalMarks: '75' },
    { year: 2026, category: 'SC', cutoffScore: 'To Be Announced', totalMarks: '75' },
    { year: 2026, category: 'ST', cutoffScore: 'To Be Announced', totalMarks: '75' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-alp-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'RRB ALP 2026 Syllabus — CBT 1 & 2 Topics',
  metaDescription: 'RRB ALP 2026 syllabus for CBT-1, CBT-2 Part A and Part B. Subject-wise and trade-wise topics for ALP and Technician exam.',
  h1: 'RRB ALP 2026 Syllabus — CBT-1, CBT-2 Part A & Part B Trade-wise Topics',
  overview: `<p>The <strong>RRB ALP 2026 Syllabus</strong> is divided across two CBT stages. CBT-1 covers general subjects while CBT-2 includes both general engineering and trade-specific technical questions.</p>
<h3>CBT-1 Syllabus</h3>
<p><strong>Mathematics (20 marks):</strong> Number system, BODMAS, Fractions, Decimals, Percentages, Ratio-Proportion, Time-Work-Distance, Simple-Compound Interest, Profit-Loss, Algebra, Geometry, Mensuration, Trigonometry, Statistics.</p>
<p><strong>General Intelligence & Reasoning (25 marks):</strong> Analogies, Alphabetical/Number Series, Coding-Decoding, Syllogism, Venn Diagrams, Data Interpretation, Conclusions, Directions, Blood Relations, Classification, Pattern Recognition.</p>
<p><strong>General Science (20 marks):</strong> Physics, Chemistry, Life Sciences up to 10th NCERT. Emphasis on applied science relevant to engineering trades.</p>
<p><strong>General Awareness (10 marks):</strong> Current affairs, Indian polity, history, geography, economy, general knowledge.</p>
<h3>CBT-2 Part A — Engineering Drawing & Basic Science</h3>
<p>Part A covers Mathematics, General Intelligence & Reasoning, Basic Science & Engineering, and General Awareness on Current Affairs. The level is higher than CBT-1 with focus on engineering fundamentals.</p>
<h3>CBT-2 Part B — Trade-Specific</h3>
<p>Part B questions are specific to the candidate's ITI trade or engineering branch — Electrician, Fitter, Mechanic, Welder, Electronics, etc. This section tests practical and theoretical knowledge of the trade. Questions are based on ITI/Diploma curriculum.</p>`,
  syllabusSummary: `<ul><li><strong>CBT-1 (75 marks):</strong> Maths (20), Reasoning (25), General Science (20), GK (10)</li><li><strong>CBT-2 Part A (100 marks):</strong> Maths, Reasoning, Basic Science & Engineering, Current Affairs</li><li><strong>CBT-2 Part B (75 marks):</strong> Trade-specific questions based on ITI/Diploma syllabus</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'What is the ALP CBT-2 Part B syllabus?', answer: 'Part B covers trade-specific questions based on your ITI/Diploma curriculum — Electrician, Fitter, Mechanic, Electronics, etc.' },
    { question: 'Is engineering drawing in the ALP syllabus?', answer: 'Yes, basic engineering drawing is part of CBT-2 Part A under the Basic Science & Engineering section.' },
    { question: 'What level are the science questions?', answer: 'General Science in CBT-1 is at 10th NCERT level. CBT-2 Part A covers applied engineering science at ITI/Diploma level.' },
    { question: 'How to prepare for trade-specific questions?', answer: 'Study your ITI/Diploma textbooks, practice previous year trade papers, and focus on practical applications of your trade.' },
    { question: 'Is the syllabus same for ALP and Technician?', answer: 'CBT-1 and CBT-2 Part A are same. Part B differs based on the specific trade opted by the candidate.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-alp-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'RRB ALP 2026 Exam Pattern — Stages & Marks',
  metaDescription: 'RRB ALP 2026 exam pattern. CBT-1, CBT-2 Part A & B, CBAT details with marks, questions, duration and negative marking.',
  h1: 'RRB ALP 2026 Exam Pattern — CBT-1, CBT-2, CBAT Structure & Marking Scheme',
  overview: `<p>The <strong>RRB ALP 2026 Exam Pattern</strong> is a multi-stage process with CBT-1 (screening), CBT-2 (merit with Part A general + Part B trade), and CBAT (for ALP posts). Understanding each stage is crucial for strategic preparation.</p>
<h3>CBT-1 — First Stage</h3>
<p>75 questions, 75 marks, 60 minutes. Sections: Mathematics (20), General Intelligence & Reasoning (25), General Science (20), General Awareness (10). Screening test — marks not counted in final merit. Negative marking: 1/3 per wrong answer.</p>
<h3>CBT-2 — Second Stage</h3>
<p><strong>Part A:</strong> 100 questions, 100 marks, 90 minutes — covers Mathematics, Reasoning, Basic Science & Engineering, and General Awareness. <strong>Part B:</strong> 75 questions, 75 marks, 60 minutes — trade-specific technical questions. Part A marks count toward merit; Part B is qualifying with minimum 35% (for General) needed to pass.</p>
<h3>CBAT — Computer Based Aptitude Test</h3>
<p>Applicable only for ALP candidates. Tests five cognitive abilities: Memory, Following Directions, Observation, Concentration, and Responsiveness. CBAT is qualifying — minimum T-Score of 42 in each test battery is required. This test ensures candidates have the psycho-motor abilities needed to assist in train driving operations safely.</p>
<p>The final merit for ALP posts is based on normalized CBT-2 Part A marks. For Technician posts, merit is also based on CBT-2 Part A scores.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How many stages are in ALP selection?', answer: 'Three CBT stages: CBT-1 (screening), CBT-2 Part A+B (merit+qualifying), and CBAT (for ALP only). Plus document verification and medical exam.' },
    { question: 'What is CBAT in ALP exam?', answer: 'CBAT tests psycho-motor abilities — memory, observation, concentration, following directions, and responsiveness. It is qualifying with minimum T-Score of 42.' },
    { question: 'Is Part B qualifying or merit-based?', answer: 'Part B is qualifying — candidates need minimum 35% marks. Only Part A marks count toward the final merit list.' },
    { question: 'What is the negative marking in ALP exam?', answer: '1/3 of the marks allotted per question is deducted for each wrong answer in CBT-1 and CBT-2.' },
    { question: 'How long is the CBT-1 exam?', answer: 'CBT-1 has 75 questions to be solved in 60 minutes.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-alp-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'RRB ALP 2026 Eligibility — Qualification & Age',
  metaDescription: 'RRB ALP 2026 eligibility criteria. Educational qualification (ITI/Diploma), age limit, vision standards and medical fitness for ALP.',
  h1: 'RRB ALP 2026 Eligibility — Qualification, Age Limit & Medical Standards',
  overview: `<p>The <strong>RRB ALP 2026 Eligibility</strong> criteria are specific due to the technical and safety-critical nature of ALP and Technician posts. Key requirements include technical education, age limits, and stringent medical standards.</p>
<h3>Educational Qualification</h3>
<p><strong>For ALP:</strong> Candidates must have passed 10th class plus hold an ITI certificate in a relevant trade (Electrician, Fitter, Mechanic Diesel, Instrument Mechanic, etc.) from NCVT/SCVT, OR hold a Diploma in Engineering (Mechanical/Electrical/Electronics/Automobile) from a recognized institution, OR a Degree in Engineering in relevant branches.</p>
<p><strong>For Technician:</strong> Same as ALP — 10th + ITI or Diploma/Degree in the relevant engineering branch. The trade must match the specific Technician post applied for.</p>
<h3>Age Limit</h3>
<p>18 to 30 years for General/EWS category. OBC-NCL: 3 years relaxation | SC/ST: 5 years | PwBD: 10 years (15 for SC/ST PwBD)</p>
<h3>Medical Standards for ALP</h3>
<p>ALP is classified as a <strong>safety category (A2)</strong> post with stringent visual requirements: distant vision 6/6 in both eyes without correction, no colour blindness (tested using Ishihara plates), and normal hearing. Candidates wearing spectacles or contact lenses are NOT eligible for ALP posts. Technician posts have slightly relaxed medical standards but still require good vision and hearing.</p>
<p>Candidates are strongly advised to get their eyes tested before applying to avoid disqualification at the medical examination stage.</p>`,
  eligibility: `<h3>Qualification</h3><p>10th pass + ITI in relevant trade (NCVT/SCVT), OR Diploma in Engineering, OR Degree in Engineering (Mechanical/Electrical/Electronics/Automobile)</p><h3>Age</h3><p>18-30 years (General) | OBC: +3 | SC/ST: +5 | PwBD: +10</p><h3>Vision (ALP)</h3><p>6/6 distant vision without glasses, no colour blindness — safety category A2</p>`,
  faqs: [
    { question: 'Can spectacle wearers apply for ALP?', answer: 'No, ALP requires 6/6 distant vision without correction (glasses/lenses). This is a strict safety-category requirement.' },
    { question: 'What ITI trades are accepted for ALP?', answer: 'Electrician, Fitter, Mechanic Diesel, Instrument Mechanic, Wireman, Electronics Mechanic, and other relevant trades as listed in the notification.' },
    { question: 'Is Diploma in Engineering accepted?', answer: 'Yes, candidates with Diploma in Mechanical/Electrical/Electronics/Automobile Engineering are eligible for both ALP and Technician posts.' },
    { question: 'What is the age limit for ALP 2026?', answer: '18 to 30 years for General/EWS. Standard relaxation applies: OBC +3, SC/ST +5, PwBD +10 years.' },
    { question: 'Is colour blindness tested in medical?', answer: 'Yes, colour vision is tested using Ishihara plates. Colour blind candidates are not eligible for ALP (safety category) posts.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-alp-2026-salary', pageType: 'salary',
  metaTitle: 'RRB ALP 2026 Salary — Pay Level 2 Details',
  metaDescription: 'RRB ALP 2026 salary structure. Pay Level 2 basic pay, running allowance, gross salary, in-hand salary and career progression details.',
  h1: 'RRB ALP 2026 Salary — Pay Level 2, Running Allowance & Career Growth',
  overview: `<p>The <strong>RRB ALP 2026 Salary</strong> starts at Pay Level 2 of the 7th CPC with a basic pay of ₹19,900. A unique advantage for ALP is the <strong>Running Allowance</strong>, which is paid based on kilometres run, significantly boosting the overall compensation.</p>
<h3>Basic Pay & Allowances</h3>
<p>The initial basic pay of ₹19,900 is supplemented by DA, HRA, Transport Allowance, and the special Running Allowance. Running Allowance for loco running staff is calculated based on kilometres operated and can add ₹8,000-₹15,000 per month to the salary.</p>
<h3>Gross & In-Hand Salary</h3>
<p>With running allowance, the gross salary for a new ALP is approximately ₹35,000-₹42,000 per month — significantly higher than other Level 2 posts. After deductions, the in-hand salary is approximately ₹28,000-₹36,000.</p>
<h3>Career Progression & Salary Growth</h3>
<p>ALP has one of the best career progression paths in railways: ALP (Level 2) → Senior ALP (Level 4) → Loco Pilot Goods (Level 5) → Loco Pilot Passenger (Level 6) → Loco Pilot Mail/Express (Level 7). A Loco Pilot Mail/Express earns ₹44,900 basic pay plus running allowance, with gross salary exceeding ₹1,00,000 per month. This progression typically takes 15-20 years.</p>
<p>Technicians also have good progression within their respective departments (Electrical, Mechanical, S&T) with promotions to Senior Technician and Supervisor grades.</p>`,
  salary: {
    salaryMin: 19900, salaryMax: 63200, payLevels: 'Pay Level 2', grossRange: '₹35,000 – ₹65,000', netRange: '₹28,000 – ₹55,000',
    allowances: ['Dearness Allowance', 'HRA', 'Transport Allowance', 'Running Allowance (km-based)', 'Free Railway Passes', 'Medical Benefits', 'NPS', 'Night Duty Allowance'],
    postWiseSalary: [
      { post: 'Assistant Loco Pilot', payLevel: 'Level 2', basicPay: '₹19,900' },
      { post: 'Technician Grade-III', payLevel: 'Level 2', basicPay: '₹19,900' },
      { post: 'Senior ALP (after promotion)', payLevel: 'Level 4', basicPay: '₹25,500' },
      { post: 'Loco Pilot Goods (promotion)', payLevel: 'Level 5', basicPay: '₹29,200' },
    ],
  },
  faqs: [
    { question: 'What is the starting salary of ALP?', answer: 'Basic pay of ₹19,900 (Level 2). With running allowance and other benefits, gross salary is approximately ₹35,000-₹42,000 per month.' },
    { question: 'What is running allowance for ALP?', answer: 'Running allowance is paid based on kilometres operated. It adds ₹8,000-₹15,000 per month, making ALP compensation higher than other Level 2 posts.' },
    { question: 'What is the salary after becoming Loco Pilot?', answer: 'Loco Pilot (Goods) earns ₹29,200 basic (Level 5), LP (Passenger) ₹35,400 (Level 6), LP (Mail/Express) ₹44,900 (Level 7) — plus running allowance.' },
    { question: 'How long to get promoted from ALP?', answer: 'Typically 4-5 years to Senior ALP, 8-10 years to LP Goods, and 15-20 years to LP Mail/Express, subject to vacancies and departmental exams.' },
    { question: 'Is Technician salary same as ALP?', answer: 'Base salary is same (Level 2, ₹19,900) but Technicians don\'t get running allowance. ALP earns more due to this additional allowance.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'rrb-alp-cutoff',
  pageType: 'cutoff',
  metaTitle: 'RRB ALP Cutoff 2026 — Category-Wise Cut Off Marks',
  metaDescription: 'RRB ALP cutoff 2026: Category-wise cut off marks for CBT-1 & CBT-2. Previous year cutoffs (2018-2024) with analysis.',
  h1: 'RRB ALP Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',
  overview: `<p>The <strong>RRB ALP Cutoff</strong> is essential for candidates preparing for Assistant Loco Pilot and Technician recruitment. RRB ALP cutoffs are released zone-wise by each Railway Recruitment Board, meaning scores required to qualify may vary between RRB Allahabad, RRB Mumbai, RRB Secunderabad, and other zones.</p>

<h3>RRB ALP Cutoff Structure</h3>
<p>The ALP selection has multiple cutoff stages:</p>
<ul>
<li><strong>CBT-1 Cutoff:</strong> Screening test — approximately 15 times the vacancies are shortlisted for CBT-2. This cutoff is based on normalised scores.</li>
<li><strong>CBT-2 Part A Cutoff:</strong> Merit-determining stage. Part A marks determine the final merit ranking. Part B is qualifying (35% minimum for General, 30% for others).</li>
<li><strong>CBAT Cutoff:</strong> For ALP posts only — minimum T-Score of 42 in each test battery. This is a qualifying cutoff, not merit-based.</li>
</ul>

<h3>ALP Cutoff Trend Analysis (2018–2024)</h3>
<p>RRB ALP is not conducted as frequently as NTPC. The 2018 and 2024 cycles provide the most relevant data points. General category CBT-1 cutoffs rose from 55.12 (2018) to 58.75 (2024) out of 75 marks, showing a moderate increase of approximately 3.6 marks over 6 years.</p>

<p>OBC cutoffs showed a similar pattern, rising from 47.88 to 51.25. SC and ST cutoffs also increased proportionally. The relatively smaller increase compared to NTPC reflects the technical qualification barrier (ITI/Diploma) that naturally limits the applicant pool for ALP.</p>

<h3>Expected RRB ALP 2026 Cutoff</h3>
<p>Based on the trend analysis, the expected RRB ALP 2026 CBT-1 cutoff for General category is <strong>59–63 out of 75 marks</strong>. With 5,696 estimated vacancies, the competition will be significant but moderated by the technical qualification requirement. Candidates should aim for <strong>65+ marks</strong> to be comfortable across all zones.</p>

<p>For CBT-2 Part A, target 75+ out of 100 marks. Part B requires at least 35% (26.25 out of 75) to qualify — focus on thorough revision of your ITI/diploma trade syllabus.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '58.75', totalMarks: '75' },
    { year: 2024, category: 'OBC', cutoffScore: '51.25', totalMarks: '75' },
    { year: 2024, category: 'SC', cutoffScore: '43.50', totalMarks: '75' },
    { year: 2024, category: 'ST', cutoffScore: '36.75', totalMarks: '75' },
    { year: 2024, category: 'EWS', cutoffScore: '55.00', totalMarks: '75' },
    { year: 2018, category: 'General', cutoffScore: '55.12', totalMarks: '75' },
    { year: 2018, category: 'OBC', cutoffScore: '47.88', totalMarks: '75' },
    { year: 2018, category: 'SC', cutoffScore: '40.62', totalMarks: '75' },
    { year: 2018, category: 'ST', cutoffScore: '34.25', totalMarks: '75' },
  ],

  faqs: [
    { question: 'What is the expected RRB ALP 2026 cutoff?', answer: 'The General category CBT-1 cutoff for RRB ALP 2026 is expected to be 59-63 out of 75 marks based on the 2018-2024 trend. Target 65+ for safety.' },
    { question: 'Is Part B cutoff merit-based or qualifying?', answer: 'CBT-2 Part B (trade-specific) is qualifying only — minimum 35% for General, 30% for SC/ST. Part A marks determine the final merit ranking.' },
    { question: 'What is the CBAT qualifying score for ALP?', answer: 'Candidates must score a minimum T-Score of 42 in each of the five CBAT test batteries. CBAT is qualifying, not merit-based.' },
    { question: 'Is ALP cutoff same as Technician cutoff?', answer: 'CBT-1 cutoff is common for both ALP and Technician. But CBT-2 cutoffs may differ as ALP additionally requires CBAT, while Technicians are selected directly on CBT-2 Part A merit.' },
    { question: 'Are ALP cutoffs zone-wise?', answer: 'Yes, each Railway Recruitment Board releases separate cutoffs for its zone. Cutoffs can vary by 3-5 marks between zones.' },
  ],

  relatedExams: [
    { label: 'RRB ALP 2026 Notification', href: '/rrb-alp-2026-notification' },
    { label: 'RRB ALP Syllabus 2026', href: '/rrb-alp-2026-syllabus' },
    { label: 'RRB ALP Previous Year Papers', href: '/rrb-alp-previous-year-paper' },
    { label: 'RRB NTPC Cutoff', href: '/rrb-ntpc-cutoff' },
    { label: 'SSC CGL Cutoff', href: '/ssc-cgl-cutoff' },
  ],
};

const ageLimitCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'rrb-alp-age-limit', pageType: 'age-limit',
  metaTitle: 'RRB ALP Age Limit 2026 — Category-Wise Relaxation',
  metaDescription: 'RRB ALP age limit 2026: 18-33 years for General. Category-wise relaxation for SC/ST/OBC/PwD and calculation method.',
  h1: 'RRB ALP Age Limit 2026 — Category-Wise Requirements & Relaxation',
  overview: `<p>The <strong>RRB ALP Age Limit</strong> follows standard railway recruitment norms with an upper limit of 33 years for General category. Assistant Loco Pilot is a technical post requiring ITI/diploma qualification, and the generous age window allows candidates who complete technical education later to still be eligible.</p>

<h3>RRB ALP 2026 Age Limit</h3>
<ul>
<li><strong>General:</strong> 18–33 years</li>
<li><strong>OBC (NCL):</strong> 18–36 years</li>
<li><strong>SC/ST:</strong> 18–38 years</li>
<li><strong>PwBD:</strong> 18–43/46/48 years</li>
<li><strong>Ex-Servicemen:</strong> Military service deduction + 3 years</li>
</ul>

<h3>Special Considerations for ALP</h3>
<p>ALP is a physically demanding role — operating locomotives in shifts, including night duty. While there is no physical test like SSC CPO, medical fitness standards are strict:</p>
<ul>
<li>Visual acuity standards: Distant vision 6/6 and 6/9 without glasses</li>
<li>No colour blindness (critical for signal recognition)</li>
<li>Good hearing in both ears</li>
</ul>

<p>The age limit of 33 combined with technical qualification requirement means most ALP candidates are ITI/diploma holders aged 20-30. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify.</p>`,

  eligibility: `<h3>Age Limit Summary</h3><ul><li><strong>General:</strong> 18–33</li><li><strong>OBC:</strong> 18–36</li><li><strong>SC/ST:</strong> 18–38</li></ul>`,
  faqs: [
    { question: 'What is the age limit for RRB ALP 2026?', answer: '18-33 for General. OBC: 36, SC/ST: 38, PwBD: 43/46/48.' },
    { question: 'Is ALP age limit same as Technician?', answer: 'Yes, both ALP and Technician posts in the same recruitment have the same 18-33 age limit.' },
    { question: 'Can ITI pass candidates apply at 18?', answer: 'Yes, if you have completed ITI and are 18+, you are eligible for ALP.' },
    { question: 'Is there medical fitness age consideration?', answer: 'No medical age limit, but strict vision/hearing standards apply regardless of age.' },
    { question: 'Do railway employees get extra relaxation?', answer: 'Yes, existing railway employees get relaxation up to 40 years.' },
  ],
  relatedExams: RELATED,
};

export const RRB_ALP_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg, ageLimitCfg];
