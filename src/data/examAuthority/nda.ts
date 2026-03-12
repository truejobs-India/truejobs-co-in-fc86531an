import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'defence-jobs' as const,
  examName: 'NDA',
  examYear: 2026,
  conductingBody: 'Union Public Service Commission (UPSC)',
  officialWebsite: 'upsc.gov.in',
  datePublished: '2026-01-10',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'Agniveer 2026 Notification', href: '/agniveer-2026-notification' },
  { label: 'UPSC CSE 2026 Notification', href: '/upsc-cse-2026-notification' },
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
  { label: 'NDA 2026 Syllabus', href: '/nda-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'nda-2026-notification',
  pageType: 'notification',
  metaTitle: 'NDA 2026 Notification — Vacancies & Apply',
  metaDescription: 'NDA 2026 Notification by UPSC. Check vacancies, eligibility for National Defence Academy exam. Army, Navy, Air Force entries. Apply online.',
  h1: 'NDA 2026 Notification — Vacancies, Eligibility & How to Apply for NDA/NA',
  totalVacancies: 400,
  applicationEndDate: '2026-02-28',
  applyLink: 'https://upsconline.nic.in',
  overview: `<p>The Union Public Service Commission has released the <strong>NDA 2026 Notification</strong> for the National Defence Academy & Naval Academy Examination (NDA/NA). This examination recruits cadets for the <strong>Indian Army, Navy, and Air Force</strong> through the prestigious National Defence Academy, Khadakwasla, Pune. Approximately <strong>400 vacancies</strong> are notified for NDA-I 2026.</p>
<p>NDA is the premier tri-service training institution in the world, where cadets undergo 3 years of integrated training followed by 1 year of pre-commissioning training at their respective service academies (IMA for Army, INA for Navy, AFA for Air Force). NDA graduates are commissioned as officers in the Indian Armed Forces.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>UPSC</td></tr><tr><td>Exam</td><td>NDA & NA Examination (I) 2026</td></tr><tr><td>Vacancies</td><td>~400 (Army: 208, Navy: 42, AF: 120, NA: 30)</td></tr><tr><td>Eligibility</td><td>12th pass / appearing (age 16.5-19.5)</td></tr><tr><td>Selection</td><td>Written Test → SSB Interview (5 days)</td></tr><tr><td>Training</td><td>NDA Khadakwasla (3 years) + Service Academy (1 year)</td></tr></table>
<p>NDA offers one of the most unique career paths in India — candidates enter at 16.5 years of age and emerge as commissioned officers at around 21-22 years. The training is world-class, combining academics (B.Sc/B.A/B.Tech degree from JNU), military training, physical fitness, and character building. Officers start at Pay Level 10 (₹56,100) upon commissioning.</p>
<p>The NDA exam is conducted twice a year (NDA-I in April/June and NDA-II in September/November). Girls are also eligible to apply for NDA since 2022, making it a truly inclusive national institution.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-01-10' },
    { label: 'Application Start', date: '2026-01-10' },
    { label: 'Application Last Date', date: '2026-02-28' },
    { label: 'Written Exam (NDA-I)', date: 'April 2026' },
    { label: 'SSB Interview', date: 'July–September 2026' },
    { label: 'Course Commencement', date: 'January 2027' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p><strong>Army Wing:</strong> 12th pass (Class XII) from a recognized board in any stream<br><strong>Navy & Air Force Wing:</strong> 12th pass with Physics and Mathematics</p><h3>Age Limit</h3><p>16.5 to 19.5 years (born between specified dates as per notification)</p><h3>Gender</h3><p>Both male and female candidates are eligible (women allowed since 2022)</p><h3>Marital Status</h3><p>Must be unmarried</p><h3>Physical Standards</h3><p>Must be physically and medically fit as per armed forces standards. Minimum height 157 cm (male), 152 cm (female). Vision standards vary by service — Air Force has strictest requirements (6/6 without correction).</p>`,
  feeStructure: { general: 100, obc: 100, scSt: 0, female: 0, ph: 0, paymentModes: ['Online (Net Banking, UPI, Debit Card)'] },
  selectionProcess: [
    'Written Examination by UPSC — Mathematics (300 marks) + General Ability Test (600 marks)',
    'SSB Interview (5 days) — screening, psychological tests, group tasks, personal interview, conference',
    'Medical Examination at Military Hospital',
    'Final Merit based on Written + SSB combined score',
    'Allotment to NDA Khadakwasla for 3-year training',
  ],
  examPattern: [
    { stageName: 'Written Examination', rows: [
      { subject: 'Mathematics', questions: 120, marks: 300, duration: '150 minutes', negativeMarking: '1/3 per wrong answer' },
      { subject: 'General Ability Test (English + GK)', questions: 150, marks: 600, duration: '150 minutes', negativeMarking: '1/3 per wrong answer' },
    ]},
    { stageName: 'SSB Interview', rows: [
      { subject: 'Screening Test (OIR + PPDT)', questions: 0, marks: 0, duration: 'Day 1', negativeMarking: 'N/A — Screening' },
      { subject: 'Psychological Tests (TAT, WAT, SRT, SD)', questions: 0, marks: 0, duration: 'Day 2', negativeMarking: 'N/A' },
      { subject: 'Group Tasks (GD, GPE, HGT, PGT, Command Task)', questions: 0, marks: 0, duration: 'Day 3-4', negativeMarking: 'N/A' },
      { subject: 'Personal Interview + Conference', questions: 0, marks: 900, duration: 'Day 4-5', negativeMarking: 'N/A' },
    ]},
  ],
  salary: {
    salaryMin: 56100, salaryMax: 177500, payLevels: 'Pay Level 10 (upon commissioning)',
    grossRange: '₹80,000 – ₹2,20,000', netRange: '₹65,000 – ₹1,80,000',
    allowances: ['Military Service Pay', 'DA', 'Transport Allowance', 'Kit Maintenance Allowance', 'Flying Allowance (AF)', 'Submarine Allowance (Navy)', 'Free Medical & Housing', 'Canteen Facilities', 'Pension'],
    postWiseSalary: [
      { post: 'NDA Stipend (during training)', payLevel: 'Stipend', basicPay: '₹56,100' },
      { post: 'Lieutenant (upon commissioning)', payLevel: 'Level 10', basicPay: '₹56,100' },
      { post: 'Captain (after 2 years)', payLevel: 'Level 10B', basicPay: '₹61,300' },
      { post: 'Major (after 6 years)', payLevel: 'Level 11', basicPay: '₹69,400' },
      { post: 'Colonel (after 15+ years)', payLevel: 'Level 13', basicPay: '₹1,30,600' },
    ],
  },
  howToApply: [
    'Visit upsconline.nic.in and register for NDA/NA (I) 2026',
    'Fill Part I — personal details, educational qualification, NDA wing preference',
    'Fill Part II — upload photograph, signature, and pay fee',
    'Select Army/Navy/Air Force preference (order of priority)',
    'Pay application fee (₹100 General/OBC, free for SC/ST/Female)',
    'Select exam centre from available cities',
    'Submit and download confirmation with registration number',
  ],
  faqs: [
    { question: 'What is the NDA exam age limit?', answer: '16.5 to 19.5 years. Candidates must be in the specified birth date range mentioned in the notification.' },
    { question: 'Can girls apply for NDA?', answer: 'Yes, since 2022, female candidates are eligible to apply for NDA examination.' },
    { question: 'Is 12th pass mandatory?', answer: '12th pass or appearing in 12th exam. For Navy/Air Force, Physics and Maths in 12th is mandatory.' },
    { question: 'What is SSB Interview?', answer: 'A 5-day assessment at Services Selection Board testing personality, leadership, teamwork, and officer-like qualities through psychological tests, group tasks, and interview.' },
    { question: 'What salary do NDA officers get?', answer: 'After commissioning as Lieutenant: ₹56,100 basic (Level 10) plus Military Service Pay and allowances. Gross ~₹80,000-₹90,000.' },
    { question: 'How many times is NDA conducted per year?', answer: 'Twice — NDA-I (exam in April, course starts July) and NDA-II (exam in September, course starts January).' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://upsc.gov.in',
    instructions: [
      'Visit upsc.gov.in and click on "e-Admit Card" link on the home page',
      'Select "NDA & NA Examination (I) 2026" from the list',
      'Log in with your Registration ID and Date of Birth',
      'Download and print the e-Admit Card on A4 paper',
      'Carry the printed admit card to the examination hall',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://upsc.gov.in',
    meritListUrl: 'https://upsc.gov.in',
    nextSteps: [
      'Check the result on upsc.gov.in — qualified candidates\' roll numbers are published in a PDF notification',
      'NDA written exam does not use normalisation — it is a single-shift OMR-based exam with uniform paper',
      'Download your marks statement from the UPSC candidate portal after final result declaration',
      'Written exam qualified candidates will be called for SSB Interview (5-day assessment at Services Selection Board)',
      'Final merit list is prepared based on Written (900) + SSB (900) = 1800 total marks and published on upsc.gov.in',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '355', totalMarks: '900' },
    { year: 2024, category: 'OBC', cutoffScore: '335', totalMarks: '900' },
    { year: 2024, category: 'SC', cutoffScore: '312', totalMarks: '900' },
    { year: 2024, category: 'ST', cutoffScore: '303', totalMarks: '900' },
    { year: 2023, category: 'General', cutoffScore: '343', totalMarks: '900' },
    { year: 2023, category: 'OBC', cutoffScore: '325', totalMarks: '900' },
    { year: 2023, category: 'SC', cutoffScore: '305', totalMarks: '900' },
    { year: 2023, category: 'ST', cutoffScore: '296', totalMarks: '900' },
    { year: 2022, category: 'General', cutoffScore: '336', totalMarks: '900' },
    { year: 2022, category: 'OBC', cutoffScore: '319', totalMarks: '900' },
    { year: 2022, category: 'SC', cutoffScore: '300', totalMarks: '900' },
    { year: 2022, category: 'ST', cutoffScore: '291', totalMarks: '900' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'nda-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'NDA 2026 Syllabus — Maths & GAT Topics',
  metaDescription: 'NDA 2026 syllabus for Mathematics and General Ability Test. Complete topic list for both papers with preparation strategy.',
  h1: 'NDA 2026 Syllabus — Mathematics & General Ability Test Topic-wise Guide',
  overview: `<p>The <strong>NDA 2026 Syllabus</strong> consists of two papers: Mathematics (300 marks) and General Ability Test (600 marks). The Mathematics paper is at 12th standard level while GAT covers English and General Knowledge.</p>
<h3>Mathematics (Paper I — 300 marks)</h3>
<p><strong>Algebra:</strong> Sets, Relations, Functions, Complex Numbers, Quadratic Equations, Sequences & Series, Permutations & Combinations, Binomial Theorem, Logarithms.</p>
<p><strong>Matrices & Determinants:</strong> Types, Operations, Properties, Cramer's Rule, Applications.</p>
<p><strong>Trigonometry:</strong> Angles, Trigonometric Ratios, Identities, Inverse Functions, Applications in Heights & Distances.</p>
<p><strong>Analytical Geometry (2D & 3D):</strong> Straight Lines, Circles, Conic Sections, Points in 3D space, Direction Cosines, Planes.</p>
<p><strong>Differential & Integral Calculus:</strong> Limits, Continuity, Differentiation, Application of Derivatives, Integration, Differential Equations.</p>
<p><strong>Vector Algebra:</strong> Vectors in 2D and 3D, Scalar and Cross Products, Applications.</p>
<p><strong>Statistics & Probability:</strong> Mean, Median, Mode, Variance, SD, Probability concepts, Conditional Probability.</p>
<h3>General Ability Test (Paper II — 600 marks)</h3>
<p><strong>Part A — English (200 marks):</strong> Grammar & Usage, Vocabulary, Comprehension, Cohesion, Rearrangement, Synonyms/Antonyms.</p>
<p><strong>Part B — General Knowledge (400 marks):</strong> Physics, Chemistry, General Science, Social Studies (History, Geography, Polity), Current Events.</p>`,
  syllabusSummary: `<ul><li><strong>Paper I — Mathematics (300):</strong> Algebra, Trigonometry, Calculus, Geometry, Vectors, Statistics & Probability — 12th level</li><li><strong>Paper II — GAT English (200):</strong> Grammar, Vocabulary, Comprehension — 12th level</li><li><strong>Paper II — GAT GK (400):</strong> Physics, Chemistry, Biology, History, Geography, Polity, Current Affairs</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is NDA maths difficult?', answer: 'NDA maths is at Class 11-12 level (NCERT). Includes calculus, trigonometry, and vectors. Regular practice makes it manageable.' },
    { question: 'What is the GAT English weightage?', answer: '200 marks out of 600 in GAT. Focus on grammar, vocabulary, and passage comprehension.' },
    { question: 'Is physics important in NDA GK?', answer: 'Yes, physics has significant weightage in the GK section — focus on mechanics, optics, electricity, and modern physics.' },
    { question: 'Which NCERT books for NDA?', answer: 'NCERT Class 11-12 for Maths, Physics, Chemistry. Class 9-12 for History, Geography, Polity. Plus current affairs from newspapers.' },
    { question: 'Is SSB syllabus different from written?', answer: 'SSB has no syllabus — it tests personality, leadership, and officer qualities through psychological tests and group activities.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'nda-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'NDA 2026 Exam Pattern — Written & SSB',
  metaDescription: 'NDA 2026 exam pattern. Written test (Mathematics + GAT), SSB interview 5-day process, marks distribution and merit calculation.',
  h1: 'NDA 2026 Exam Pattern — Written Examination & SSB Interview Structure',
  overview: `<p>The <strong>NDA 2026 Exam Pattern</strong> consists of a written examination (900 marks) conducted by UPSC, followed by a 5-day SSB Interview (900 marks) for shortlisted candidates.</p>
<h3>Written Examination (900 marks)</h3>
<p><strong>Paper I — Mathematics:</strong> 120 MCQ questions, 300 marks, 2.5 hours. Negative marking of 1/3 per wrong answer. Covers algebra, trigonometry, calculus, geometry, vectors, and statistics at 12th standard level.</p>
<p><strong>Paper II — General Ability Test:</strong> 150 MCQ questions, 600 marks, 2.5 hours. Part A: English (200 marks), Part B: General Knowledge (400 marks covering Physics, Chemistry, General Science, History, Geography, Polity, Current Events). Negative marking 1/3.</p>
<h3>SSB Interview (900 marks, 5 days)</h3>
<p><strong>Day 1 — Screening:</strong> Officer Intelligence Rating (OIR) test + Picture Perception & Discussion Test (PPDT). About 50% are screened out.</p>
<p><strong>Day 2 — Psychological Tests:</strong> Thematic Apperception Test (TAT), Word Association Test (WAT), Situation Reaction Test (SRT), Self-Description Test (SD).</p>
<p><strong>Day 3-4 — Group Tasks:</strong> Group Discussion (GD), Group Planning Exercise (GPE), Progressive Group Task (PGT), Half Group Task (HGT), Individual Obstacles, Command Task, Final Group Task.</p>
<p><strong>Day 5 — Interview & Conference:</strong> Personal Interview by the Interviewing Officer, followed by a Conference where all assessors discuss each candidate.</p>
<h3>Final Merit</h3>
<p>Written (900) + SSB (900) = 1800 marks total. Final merit list determines admission to NDA Khadakwasla.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'What is the total marks in NDA?', answer: 'Written 900 (Maths 300 + GAT 600) + SSB 900 = 1800 total marks.' },
    { question: 'How many days is the SSB interview?', answer: '5 days at a Services Selection Board centre. It includes psychological tests, group activities, and personal interview.' },
    { question: 'What percentage clear SSB screening?', answer: 'Typically 40-50% of reported candidates clear the Day 1 screening. Of those, about 10-15% are finally recommended.' },
    { question: 'Is the written exam MCQ?', answer: 'Yes, both papers are multiple choice (OMR-based). Negative marking of 1/3 applies.' },
    { question: 'What is PPDT in SSB?', answer: 'Picture Perception & Discussion Test — you write a story based on a picture shown for 30 seconds, then discuss it in a group.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'nda-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'NDA 2026 Eligibility — Age & Education',
  metaDescription: 'NDA 2026 eligibility. Age limit 16.5-19.5, 12th pass requirement, physical standards for Army, Navy and Air Force entries.',
  h1: 'NDA 2026 Eligibility — Age, Education, Physical Standards & Wing-wise Requirements',
  overview: `<p>The <strong>NDA 2026 Eligibility</strong> is designed for young aspirants completing or having completed 12th standard. The requirements vary slightly by service wing.</p>
<h3>Educational Qualification</h3>
<p><strong>Army Wing:</strong> 12th pass or appearing in 12th from any recognized board in any stream (Arts/Science/Commerce).<br><strong>Navy Wing:</strong> 12th pass with Physics and Mathematics from a recognized board.<br><strong>Air Force Wing:</strong> 12th pass with Physics and Mathematics from a recognized board.</p>
<h3>Age Limit</h3>
<p>Only unmarried male and female candidates born between specified dates (typically 16.5 to 19.5 years of age on the date of commencement of the course). For NDA-I 2026 (course commencing January 2027), born not earlier than July 2007 and not later than July 2010 (indicative).</p>
<h3>Physical Standards</h3>
<p>Must be physically fit per armed forces standards. Height: minimum 157 cm (male), 152 cm (female). Chest: 81 cm expanded with 5 cm expansion (male). Weight: proportionate to height. Vision: varies by service — Air Force requires 6/6 in each eye without glasses, Navy requires 6/6 & 6/9, Army is relatively relaxed.</p>
<h3>No Attempt Limit</h3>
<p>Unlike UPSC CSE, there is no limit on the number of NDA attempts as long as the candidate is within the age bracket. Candidates can keep appearing until they cross 19.5 years.</p>`,
  eligibility: `<h3>Education</h3><p>Army: 12th any stream | Navy/Air Force: 12th with Physics + Maths</p><h3>Age</h3><p>16.5 to 19.5 years — no relaxation</p><h3>Gender</h3><p>Male and Female both eligible (since 2022)</p><h3>Marital Status</h3><p>Must be unmarried</p>`,
  faqs: [
    { question: 'Can arts students apply for NDA?', answer: 'Arts students can apply for Army Wing only. Navy and Air Force require Physics + Mathematics in 12th.' },
    { question: 'Is there an attempt limit for NDA?', answer: 'No, you can appear unlimited times as long as you are within the age limit (16.5-19.5 years).' },
    { question: 'Can girls apply for NDA?', answer: 'Yes, female candidates have been eligible for NDA since 2022 following a Supreme Court order.' },
    { question: 'What is the vision requirement for Air Force?', answer: '6/6 in each eye without glasses — the strictest among the three wings. Laser-corrected vision is not accepted.' },
    { question: 'Can 11th class students apply?', answer: 'No, candidates must have passed 12th or be appearing in 12th. 11th pass alone is not sufficient.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'nda-2026-salary', pageType: 'salary',
  metaTitle: 'NDA 2026 Salary — Officer Pay & Benefits',
  metaDescription: 'NDA 2026 salary after commissioning. Lieutenant to Colonel pay scale, military allowances, perks and career progression in armed forces.',
  h1: 'NDA 2026 Salary — Officer Pay Scale, Military Allowances & Career Path',
  overview: `<p>The <strong>NDA 2026 Salary</strong> applies after commissioning as a Lieutenant (upon completing 4 years of training). During NDA training, cadets receive a stipend. Post-commissioning, officers are placed at Pay Level 10 with comprehensive military benefits.</p>
<h3>During Training (NDA + Service Academy)</h3>
<p>NDA cadets receive a stipend of ₹56,100 per month during the 3-year NDA course and 1-year service academy training. They also receive free food, accommodation, uniform, medical care, and world-class training facilities.</p>
<h3>Post-Commissioning Salary</h3>
<p>Upon commissioning as Lieutenant, the starting basic pay is ₹56,100 (Level 10). With Military Service Pay (₹15,500), DA, transport allowance, and other allowances, the gross salary is approximately ₹80,000-₹90,000. After 2 years, promotion to Captain (₹61,300 basic) with gross exceeding ₹1,00,000.</p>
<h3>Career Progression</h3>
<p>Lieutenant (Level 10) → Captain (Level 10B, 2 yrs) → Major (Level 11, 6 yrs) → Lt Colonel (Level 12A, 13 yrs) → Colonel (Level 13, selection basis) → Brigadier (Level 13A) → Major General (Level 14) → Lt General (Level 15-16) → General/COAS (Level 18). Army, Navy, and Air Force have equivalent ranks with same pay scales.</p>
<h3>Unique Military Benefits</h3>
<p>Free government accommodation (large bungalow/quarter), subsidized mess/canteen facilities, domestic orderlies, free medical for family at military hospitals, Leave Travel Concession, children's education allowance, CSD canteen for subsidized goods, ex-serviceman status after retirement with pension, and ECHS medical coverage for life.</p>`,
  salary: {
    salaryMin: 56100, salaryMax: 177500, payLevels: 'Pay Level 10 to Level 15+',
    grossRange: '₹80,000 – ₹2,50,000', netRange: '₹65,000 – ₹2,00,000',
    allowances: ['Military Service Pay (₹15,500)', 'DA', 'Transport Allowance', 'Kit Maintenance Allowance', 'Flying Allowance (Air Force)', 'Submarine Allowance (Navy)', 'High Altitude Allowance', 'Field Area Allowance', 'Free Housing', 'Free Medical', 'Canteen/CSD', 'Pension after 20 years'],
    postWiseSalary: [
      { post: 'Lieutenant (upon commissioning)', payLevel: 'Level 10', basicPay: '₹56,100' },
      { post: 'Captain (2 years)', payLevel: 'Level 10B', basicPay: '₹61,300' },
      { post: 'Major (6 years)', payLevel: 'Level 11', basicPay: '₹69,400' },
      { post: 'Lt Colonel (13 years)', payLevel: 'Level 12A', basicPay: '₹1,21,200' },
      { post: 'Colonel (selection)', payLevel: 'Level 13', basicPay: '₹1,30,600' },
      { post: 'Brigadier', payLevel: 'Level 13A', basicPay: '₹1,39,600' },
    ],
  },
  faqs: [
    { question: 'What is the NDA stipend during training?', answer: '₹56,100 per month as stipend, plus free food, accommodation, uniform, and training.' },
    { question: 'What is the salary after NDA commissioning?', answer: 'Lieutenant at Level 10: ₹56,100 basic + ₹15,500 MSP + allowances. Gross ~₹80,000-₹90,000.' },
    { question: 'Do NDA officers get free housing?', answer: 'Yes, military officers get free government quarters with domestic orderlies (sahayak).' },
    { question: 'Is there pension for NDA officers?', answer: 'Yes, full pension after 20 years of service. Also ECHS medical coverage for life post-retirement.' },
    { question: 'What is the salary of a Major?', answer: '₹69,400 basic (Level 11) + MSP. Gross salary approximately ₹1,20,000-₹1,40,000 per month.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'nda-cutoff', pageType: 'cutoff',
  metaTitle: 'NDA Cutoff 2026 — Written Test & SSB Marks',
  metaDescription: 'NDA cutoff 2026: Category-wise cut off marks for Written Test and final SSB. Previous year cutoffs with trend analysis.',
  h1: 'NDA Cutoff 2026 — Written Test & SSB Final Cut Off Marks',
  overview: `<p>The <strong>NDA Cutoff</strong> is released by UPSC in two parts — Written Test cutoff (for SSB interview call) and Final cutoff (Written + SSB combined). NDA is conducted twice a year (NDA I and NDA II), and cutoffs can vary between the two exams based on vacancies and difficulty.</p>

<h3>How NDA Cutoff Works</h3>
<ul>
<li><strong>Written Test:</strong> 900 marks (Maths 300 + GAT 600). Cutoff determines SSB interview call.</li>
<li><strong>SSB Interview:</strong> 900 marks. Includes psychological tests, group tasks, and personal interview over 5 days.</li>
<li><strong>Final Cutoff:</strong> Written (900) + SSB (900) = 1800 marks total.</li>
</ul>

<h3>NDA Cutoff Trend (2022–2024)</h3>
<p>Written test cutoffs for General category ranged from 340 (2022) to 365 (2024) out of 900 marks — approximately 38-41%. The low percentage reflects the extreme difficulty of the exam, particularly the Maths paper which eliminates many candidates. Final cutoffs (Written + SSB) have been around 685-720 out of 1800.</p>

<h3>Expected NDA 2026 Cutoff</h3>
<p>Written test cutoff is expected at <strong>360–380 out of 900</strong> for General. Target 400+ for comfortable SSB call. SSB performance is equally critical as it carries 50% weightage.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '365', totalMarks: '900' },
    { year: 2024, category: 'OBC', cutoffScore: '340', totalMarks: '900' },
    { year: 2024, category: 'SC', cutoffScore: '310', totalMarks: '900' },
    { year: 2024, category: 'ST', cutoffScore: '285', totalMarks: '900' },
    { year: 2023, category: 'General', cutoffScore: '355', totalMarks: '900' },
    { year: 2023, category: 'OBC', cutoffScore: '330', totalMarks: '900' },
    { year: 2023, category: 'SC', cutoffScore: '300', totalMarks: '900' },
    { year: 2023, category: 'ST', cutoffScore: '275', totalMarks: '900' },
    { year: 2022, category: 'General', cutoffScore: '340', totalMarks: '900' },
    { year: 2022, category: 'OBC', cutoffScore: '315', totalMarks: '900' },
    { year: 2022, category: 'SC', cutoffScore: '288', totalMarks: '900' },
    { year: 2022, category: 'ST', cutoffScore: '262', totalMarks: '900' },
  ],
  faqs: [
    { question: 'What is the expected NDA 2026 cutoff?', answer: 'Written test cutoff for General is expected around 360-380 out of 900. Target 400+ for safe qualification.' },
    { question: 'Is NDA I and NDA II cutoff different?', answer: 'Yes, cutoffs can vary by 10-20 marks between NDA I and NDA II based on vacancies and difficulty.' },
    { question: 'Does Maths carry more weight?', answer: 'Maths is 300 marks and GAT is 600 marks. But many candidates fail due to low Maths scores, making it the deciding factor.' },
    { question: 'How important is SSB?', answer: 'SSB is 900 marks (50% of total 1800). A strong SSB can compensate for a borderline written score.' },
    { question: 'Is the NDA cutoff really below 40%?', answer: 'Yes, around 38-41% for General. The extreme difficulty of Maths and GAT makes even this challenging.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'nda-age-limit', pageType: 'age-limit',
  metaTitle: 'NDA Age Limit 2026 — Category-Wise Requirements',
  metaDescription: 'NDA age limit 2026: 16.5-19.5 years. Strict age window for Army, Navy, and Air Force wings with no category relaxation.',
  h1: 'NDA Age Limit 2026 — Age Requirements for Army, Navy & Air Force',
  overview: `<p>The <strong>NDA Age Limit</strong> is the strictest among all government exams — only 16.5 to 19.5 years, with <strong>no relaxation for any category</strong>. This is because NDA is designed for 12th-pass students entering directly into military training, and the physical demands of the 3-year training at the National Defence Academy require young candidates.</p>

<h3>NDA 2026 Age Limit</h3>
<ul>
<li><strong>All Categories (Gen/OBC/SC/ST):</strong> Born between 2 July 2006 and 1 January 2010 (for NDA I 2026)</li>
<li><strong>Minimum Age:</strong> 16 years 6 months</li>
<li><strong>Maximum Age:</strong> 19 years 6 months</li>
<li><strong>No category-wise relaxation</strong> — same for all candidates</li>
</ul>

<h3>Why No Age Relaxation?</h3>
<p>NDA is unique in providing no category-wise age relaxation because:</p>
<ul>
<li>Military training at NDA starts at a young age and lasts 3 years</li>
<li>Physical training standards require young bodies for optimal development</li>
<li>The 3-year window (16.5–19.5) typically covers Class 12 students and immediate post-12th candidates</li>
<li>Defence forces maintain uniform standards regardless of category for combat readiness</li>
</ul>

<p>This means NDA has the smallest eligibility window of any major government exam — only 3 years. Most candidates get 4-6 attempts (NDA is conducted twice annually). Use our <a href="/govt-job-age-calculator">Age Calculator</a> to check.</p>

<h3>Key Points</h3>
<ul>
<li>Only unmarried male candidates were eligible until 2024; females may be allowed from 2025-2026 based on Supreme Court directions</li>
<li>The DOB range changes with each NDA cycle — check the specific notification</li>
<li>12th class or equivalent (appearing candidates can also apply)</li>
<li>Air Force wing has additional physical standards (height, eyesight)</li>
</ul>`,

  eligibility: `<h3>Age Summary (NDA I 2026)</h3>
<ul>
<li><strong>All Categories:</strong> 16.5–19.5 years (born 2 July 2006 to 1 January 2010)</li>
<li><strong>No age relaxation</strong> for any category</li>
</ul>`,
  faqs: [
    { question: 'What is the age limit for NDA 2026?', answer: '16.5 to 19.5 years for ALL categories. No relaxation for SC/ST/OBC.' },
    { question: 'Why is there no age relaxation in NDA?', answer: 'Military training requires young candidates for physical development. Uniform standards apply regardless of category.' },
    { question: 'Can a 20-year-old apply for NDA?', answer: 'No, the maximum age is 19.5 years. Candidates above 19.5 should consider CDS (Combined Defence Services) instead.' },
    { question: 'How many attempts for NDA?', answer: 'Maximum 4-6 attempts within the 3-year window (NDA conducted twice yearly).' },
    { question: 'Is NDA open to female candidates?', answer: 'Based on Supreme Court directions, NDA may open for female candidates. Check the specific notification.' },
  ],
  relatedExams: RELATED,
};

export const NDA_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
