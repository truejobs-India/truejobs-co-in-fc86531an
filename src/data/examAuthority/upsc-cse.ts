import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'upsc-jobs' as const,
  examName: 'UPSC CSE',
  examYear: 2026,
  conductingBody: 'Union Public Service Commission (UPSC)',
  officialWebsite: 'upsc.gov.in',
  datePublished: '2026-02-05',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'NDA 2026 Notification', href: '/nda-2026-notification' },
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'IBPS PO 2026 Notification', href: '/ibps-po-2026-notification' },
  { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
  { label: 'UPSC CSE 2026 Syllabus', href: '/upsc-cse-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'upsc-cse-2026-notification',
  pageType: 'notification',
  metaTitle: 'UPSC CSE 2026 Notification — Dates & Apply',
  metaDescription: 'UPSC CSE 2026 Notification released. Check vacancies, eligibility, exam dates, syllabus and apply online for IAS/IPS/IFS Civil Services exam.',
  h1: 'UPSC CSE 2026 Notification — Complete Details, Eligibility & How to Apply',
  totalVacancies: 1056,
  applicationEndDate: '2026-03-31',
  applyLink: 'https://upsconline.nic.in',
  notificationPdfUrl: 'https://upsc.gov.in/cse-2026-notification.pdf',
  overview: `<p>The Union Public Service Commission has released the <strong>UPSC CSE 2026 Notification</strong> for the Civil Services Examination, India's most prestigious competitive examination. The exam recruits officers for the <strong>Indian Administrative Service (IAS)</strong>, <strong>Indian Police Service (IPS)</strong>, <strong>Indian Foreign Service (IFS)</strong>, and other Group A and Group B Central Services. Approximately <strong>1,056 vacancies</strong> have been notified.</p>
<p>The UPSC Civil Services Examination is a three-stage process: Preliminary Examination (Objective), Main Examination (Written/Descriptive), and Personality Test (Interview). The entire process spans nearly a year from notification to final results, making it one of the longest and most rigorous selection processes in government recruitment.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>Union Public Service Commission (UPSC)</td></tr><tr><td>Exam Name</td><td>Civil Services Examination (CSE)</td></tr><tr><td>Total Vacancies</td><td>1,056</td></tr><tr><td>Services</td><td>IAS, IPS, IFS, IRS, IRTS, IDAS + 20 more</td></tr><tr><td>Qualification</td><td>Graduation in any discipline</td></tr><tr><td>Selection</td><td>Prelims → Mains → Interview</td></tr></table>
<p>UPSC CSE is often called the "toughest exam in India" due to its vast syllabus, intense competition, and low selection ratio. With over 10 lakh aspirants and roughly 1,000 vacancies, the success rate is under 0.1%. However, the rewards are unmatched — IAS officers hold some of the most powerful administrative positions in the country, with salaries starting at Pay Level 10 (₹56,100) and going up to Cabinet Secretary level (₹2,50,000).</p>
<p>Candidates can attempt UPSC CSE a limited number of times: General category gets 6 attempts, OBC gets 9 attempts, and SC/ST have unlimited attempts until the age limit. This makes strategic preparation and early starts crucial for success.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-02-05' },
    { label: 'Application Start', date: '2026-02-10' },
    { label: 'Application Last Date', date: '2026-03-31' },
    { label: 'Prelims Exam', date: 'May 2026' },
    { label: 'Mains Exam', date: 'September 2026' },
    { label: 'Interview', date: 'January–April 2027' },
    { label: 'Final Result', date: 'May 2027' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>Bachelor's degree in <strong>any discipline</strong> from a recognized university. Final year students are eligible to appear for Prelims.</p><h3>Age Limit</h3><p>21 to 32 years for General category</p><h3>Age Relaxation</h3><p>OBC-NCL: 3 years (max 35) | SC/ST: 5 years (max 37) | PwBD: 10 years | Defence Services personnel: 3 years (after military service) | Ex-Servicemen: 5 years</p><h3>Number of Attempts</h3><p>General: 6 attempts | OBC: 9 attempts | SC/ST: Unlimited (till age limit) | PwBD (General): 9 attempts | PwBD (OBC): 9 attempts | PwBD (SC/ST): Unlimited</p>`,
  feeStructure: { general: 100, obc: 100, scSt: 0, female: 0, ph: 0, paymentModes: ['Online (Net Banking, UPI, Debit Card)', 'SBI Pay-in Slip'] },
  selectionProcess: [
    'Preliminary Examination — two objective papers (GS Paper I + CSAT Paper II)',
    'Main Examination — nine written papers (descriptive, essay, optional subject)',
    'Personality Test (Interview) — 275 marks',
    'Final Merit based on Mains + Interview total',
    'Service allocation based on rank, preference, and vacancies',
  ],
  examPattern: [
    { stageName: 'Prelims (Screening)', rows: [
      { subject: 'General Studies Paper I', questions: 100, marks: 200, duration: '120 minutes', negativeMarking: '1/3 per wrong answer' },
      { subject: 'CSAT Paper II (Qualifying)', questions: 80, marks: 200, duration: '120 minutes', negativeMarking: '1/3 per wrong answer' },
    ]},
    { stageName: 'Mains (Descriptive — Merit Papers)', rows: [
      { subject: 'Essay', questions: 2, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
      { subject: 'GS Paper I (History, Geography, Society)', questions: 20, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
      { subject: 'GS Paper II (Governance, Polity, IR)', questions: 20, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
      { subject: 'GS Paper III (Economy, Environment, S&T)', questions: 20, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
      { subject: 'GS Paper IV (Ethics, Integrity, Aptitude)', questions: 14, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
      { subject: 'Optional Subject Paper I', questions: 8, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
      { subject: 'Optional Subject Paper II', questions: 8, marks: 250, duration: '180 minutes', negativeMarking: 'N/A' },
    ]},
  ],
  salary: {
    salaryMin: 56100, salaryMax: 250000, payLevels: 'Pay Level 10 to Pay Level 18',
    grossRange: '₹90,000 – ₹4,00,000', netRange: '₹70,000 – ₹3,00,000',
    allowances: ['DA', 'HRA', 'Transport Allowance', 'Official Vehicle (senior ranks)', 'Government Bungalow', 'Medical for family', 'LTC', 'Pension/NPS', 'Staff Car', 'Security detail (senior ranks)'],
    postWiseSalary: [
      { post: 'IAS/IPS Entry (Sub-Divisional Magistrate)', payLevel: 'Level 10', basicPay: '₹56,100' },
      { post: 'IAS (District Collector / SP)', payLevel: 'Level 13', basicPay: '₹1,23,100' },
      { post: 'IAS (Joint Secretary)', payLevel: 'Level 14', basicPay: '₹1,44,200' },
      { post: 'IAS (Additional/Chief Secretary)', payLevel: 'Level 17', basicPay: '₹2,25,000' },
      { post: 'Cabinet Secretary', payLevel: 'Level 18', basicPay: '₹2,50,000' },
    ],
  },
  howToApply: [
    'Visit upsconline.nic.in and register for One-Time Registration (OTR)',
    'Log in and navigate to CSE 2026 application',
    'Fill Part I — personal details, educational qualification, exam preferences',
    'Fill Part II — photo, signature upload and fee payment',
    'Select optional subject, exam centre, and medium of examination',
    'Pay application fee online (₹100 for General/OBC, free for SC/ST/Female/PwBD)',
    'Submit both parts and download confirmation with registration ID',
  ],
  faqs: [
    { question: 'What services can I join through UPSC CSE?', answer: 'IAS, IPS, IFS, IRS (IT & Customs), IRTS, IDAS, IDES, IIS, and 15+ other All India and Central Group A/B services.' },
    { question: 'How many attempts are allowed for UPSC CSE?', answer: 'General: 6, OBC: 9, SC/ST: unlimited (till age limit of 37). Each Prelims appearance counts as one attempt.' },
    { question: 'What is the age limit for UPSC CSE 2026?', answer: '21-32 years for General. OBC: 35, SC/ST: 37, PwBD General: 42.' },
    { question: 'Is UPSC CSE the toughest exam in India?', answer: 'It is considered the most competitive with ~10 lakh applicants for ~1,000 posts (0.1% selection rate).' },
    { question: 'What is the starting salary of IAS officer?', answer: 'Pay Level 10 with ₹56,100 basic pay. Gross salary approximately ₹90,000-₹1,00,000 plus government accommodation and vehicle.' },
    { question: 'Can I write UPSC in Hindi?', answer: 'Yes, you can write Mains in any language listed in the 8th Schedule of the Constitution, including Hindi.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://upsc.gov.in',
    instructions: [
      'Visit upsc.gov.in and click on "e-Admit Card" link on the home page',
      'Select "Civil Services (Preliminary) Examination 2026" from the list',
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
      'UPSC CSE does not use normalisation — Prelims and Mains are single-shift exams with uniform question papers',
      'Download your marks statement from the UPSC candidate portal after final result declaration',
      'Prelims qualified candidates will be called for Mains (descriptive); Mains qualifiers proceed to Personality Test (Interview)',
      'Final merit list is prepared based on Mains (1750) + Interview (275) = 2025 total marks and published on upsc.gov.in',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '935', totalMarks: '2025' },
    { year: 2024, category: 'OBC', cutoffScore: '900', totalMarks: '2025' },
    { year: 2024, category: 'SC', cutoffScore: '865', totalMarks: '2025' },
    { year: 2024, category: 'ST', cutoffScore: '850', totalMarks: '2025' },
    { year: 2023, category: 'General', cutoffScore: '922', totalMarks: '2025' },
    { year: 2023, category: 'OBC', cutoffScore: '889', totalMarks: '2025' },
    { year: 2023, category: 'SC', cutoffScore: '852', totalMarks: '2025' },
    { year: 2023, category: 'ST', cutoffScore: '838', totalMarks: '2025' },
    { year: 2022, category: 'General', cutoffScore: '908', totalMarks: '2025' },
    { year: 2022, category: 'OBC', cutoffScore: '876', totalMarks: '2025' },
    { year: 2022, category: 'SC', cutoffScore: '840', totalMarks: '2025' },
    { year: 2022, category: 'ST', cutoffScore: '825', totalMarks: '2025' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'upsc-cse-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'UPSC CSE 2026 Syllabus — Prelims & Mains',
  metaDescription: 'UPSC CSE 2026 complete syllabus for Prelims GS, CSAT and Mains GS Papers I-IV, Essay, and Optional Subjects. Topic-wise breakdown.',
  h1: 'UPSC CSE 2026 Syllabus — Prelims & Mains Complete Topic-wise Guide',
  overview: `<p>The <strong>UPSC CSE 2026 Syllabus</strong> is vast, covering virtually every aspect of governance, polity, history, geography, economy, science, ethics, and current affairs. Understanding the syllabus structure is crucial for efficient preparation.</p>
<h3>Prelims GS Paper I (200 marks)</h3>
<p>Current events of national and international importance, History of India and Indian National Movement, Indian and World Geography, Indian Polity and Governance, Economic and Social Development, Environmental Ecology and Climate Change, General Science.</p>
<h3>Prelims CSAT Paper II (Qualifying — 200 marks)</h3>
<p>Comprehension, Interpersonal Skills, Logical Reasoning, Analytical Ability, Decision Making, Problem Solving, Basic Numeracy, Data Interpretation, English Language Comprehension (Class X level). Minimum 33% qualifying marks.</p>
<h3>Mains — GS Papers I to IV</h3>
<p><strong>GS-I:</strong> Indian Heritage & Culture, History, Geography of the World and Society. <strong>GS-II:</strong> Governance, Constitution, Polity, Social Justice, International Relations. <strong>GS-III:</strong> Technology, Economic Development, Biodiversity, Environment, Security, Disaster Management. <strong>GS-IV:</strong> Ethics, Integrity, Aptitude — case studies, emotional intelligence, public service values.</p>
<h3>Essay Paper</h3>
<p>Two essays from different sections (philosophical, socio-economic, current affairs, abstract). Each essay is ~1000-1200 words. Tests analytical thinking, clarity of expression, and balanced perspective.</p>
<h3>Optional Subject</h3>
<p>Candidates choose one optional subject from 48 subjects (ranging from Literature to Sciences to Engineering to Law). Two papers of 250 marks each. Choice of optional significantly impacts score and rank.</p>`,
  syllabusSummary: `<ul><li><strong>Prelims GS-I (200):</strong> History, Geography, Polity, Economy, Science, Current Affairs</li><li><strong>Prelims CSAT (200, qualifying):</strong> Comprehension, Reasoning, Numeracy, Decision Making</li><li><strong>Mains GS I-IV (250 each):</strong> History-Culture-Geography, Governance-Polity-IR, Economy-Environment-S&T, Ethics</li><li><strong>Essay (250):</strong> Two essays from different topics</li><li><strong>Optional (250×2):</strong> One subject from 48 choices</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How many papers are in UPSC Mains?', answer: 'Nine papers: Essay, 4 GS papers, 2 Optional papers, and 2 qualifying language papers (English + Indian language).' },
    { question: 'Which optional subject is best for UPSC?', answer: 'Depends on your background. Popular choices: Public Administration, Geography, Sociology, History, Political Science, Anthropology.' },
    { question: 'Is CSAT qualifying?', answer: 'Yes, CSAT is qualifying with 33% minimum marks. Only GS Paper I marks count for Prelims cutoff.' },
    { question: 'How vast is the UPSC syllabus?', answer: 'Extremely vast — covers all of Indian history, geography, polity, economy, science, international relations, ethics, and your optional subject in depth.' },
    { question: 'Are newspaper reading and current affairs important?', answer: 'Critical — at least 30-40% of Prelims and Mains questions are linked to current affairs. Daily newspaper reading is essential.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'upsc-cse-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'UPSC CSE 2026 Exam Pattern — All Stages',
  metaDescription: 'UPSC CSE 2026 exam pattern. Prelims, Mains and Interview structure with marks, papers, duration and qualifying criteria.',
  h1: 'UPSC CSE 2026 Exam Pattern — Prelims, Mains & Interview Structure',
  overview: `<p>The <strong>UPSC CSE 2026 Exam Pattern</strong> consists of three successive stages, each more demanding than the previous.</p>
<h3>Prelims (Screening)</h3>
<p>Two objective papers on a single day. GS Paper I: 100 questions, 200 marks, 2 hours — determines cutoff. CSAT Paper II: 80 questions, 200 marks, 2 hours — qualifying only (33% minimum). Negative marking of 1/3 in both papers. Only GS-I marks count for cutoff.</p>
<h3>Mains (Written — 1750 marks)</h3>
<p>Nine papers over 5-7 days. <strong>Qualifying papers:</strong> Compulsory Indian Language (300 marks, qualifying) and English (300 marks, qualifying). <strong>Merit papers (1750 total):</strong> Essay (250), GS-I to GS-IV (250 each = 1000), Optional Paper I & II (250 each = 500). All descriptive/essay format. Each paper is 3 hours.</p>
<h3>Interview / Personality Test (275 marks)</h3>
<p>Conducted by UPSC board over 30-45 minutes. Tests not academic knowledge but personal qualities: mental alertness, critical thinking, social cohesion, integrity, leadership potential. The board includes the Chairman/Member of UPSC and external experts.</p>
<h3>Final Merit</h3>
<p>Total marks = Mains (1750) + Interview (275) = 2025. Final ranking determines service allocation. Top ranks (~100) get IAS, followed by IPS, IFS, and other services based on preference and availability.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'What is the total marks in UPSC CSE?', answer: 'Mains 1750 + Interview 275 = 2025 total marks for final ranking. Prelims is only screening.' },
    { question: 'How many days is the Mains exam?', answer: 'Mains is spread over 5-7 days with one or two papers per day. Each paper is 3 hours.' },
    { question: 'Is the language paper difficult?', answer: 'The Indian language paper and English paper are qualifying (at matriculation/basic level). Most candidates clear them easily.' },
    { question: 'How long is the UPSC interview?', answer: '30-45 minutes typically. The board assesses personality, not just knowledge.' },
    { question: 'How are services allocated?', answer: 'Based on final rank and candidate preference. Top ranks get IAS, then IPS, IFS, and other Group A services.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'upsc-cse-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'UPSC CSE 2026 Eligibility — Age & Attempts',
  metaDescription: 'UPSC CSE 2026 eligibility. Age limit 21-32, graduation requirement, number of attempts, age relaxation and nationality criteria.',
  h1: 'UPSC CSE 2026 Eligibility — Age, Qualification, Attempts & Relaxation',
  overview: `<p>The <strong>UPSC CSE 2026 Eligibility</strong> requires only graduation but has strict age limits and attempt restrictions that vary by category.</p>
<h3>Educational Qualification</h3>
<p>Bachelor's degree from any recognized university in <strong>any discipline</strong>. Even degrees from open universities and foreign degrees recognized by AIU are accepted. Final year students can appear for Prelims. No minimum percentage requirement.</p>
<h3>Age Limit</h3>
<p>Minimum 21 years and maximum 32 years for General category. Age calculated as on August 1st of the exam year.</p>
<h3>Age Relaxation</h3>
<p>OBC-NCL: +3 (max 35) | SC/ST: +5 (max 37) | PwBD General: +10 (max 42) | PwBD OBC: +13 (max 45) | PwBD SC/ST: +15 (max 47) | Defence Personnel disabled in operations: +3 | Ex-Servicemen (incl. ECOs/SSCOs with 5 years military service): +5</p>
<h3>Number of Attempts</h3>
<p>This is unique to UPSC CSE. General: 6 attempts | EWS: 6 | OBC: 9 | SC/ST: unlimited (until age limit) | PwBD General/EWS: 9 | PwBD OBC: 9 | PwBD SC/ST: unlimited. Each appearance at Prelims counts as one attempt, regardless of whether the candidate actually writes the exam.</p>
<h3>Nationality</h3>
<p>For IAS/IPS: Must be Indian citizen. For other services: Indian citizens, subjects of Nepal/Bhutan, Tibetan refugees (pre-1962), and persons of Indian origin migrated from specified countries are eligible.</p>`,
  eligibility: `<h3>Qualification</h3><p>Graduation in any discipline from a recognized university</p><h3>Age</h3><p>21-32 (General) | OBC: 35 | SC/ST: 37 | PwBD: 42</p><h3>Attempts</h3><p>General: 6 | OBC: 9 | SC/ST: unlimited</p><h3>Nationality</h3><p>Indian citizen (mandatory for IAS/IPS)</p>`,
  faqs: [
    { question: 'How many attempts for General category?', answer: '6 attempts maximum. Each Prelims appearance (even without writing) counts as one attempt.' },
    { question: 'Can I appear without completing graduation?', answer: 'Final year students can appear for Prelims but must produce the degree by the time of Mains.' },
    { question: 'Is there a minimum percentage for UPSC?', answer: 'No minimum percentage. A pass certificate in graduation is sufficient.' },
    { question: 'Can foreign degree holders apply?', answer: 'Yes, if the degree is recognized by the Association of Indian Universities (AIU).' },
    { question: 'What happens if I exhaust all attempts?', answer: 'You cannot appear again. Plan your attempts strategically — many successful candidates clear in their 2nd-4th attempt.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'upsc-cse-2026-salary', pageType: 'salary',
  metaTitle: 'UPSC CSE 2026 Salary — IAS/IPS Pay Scale',
  metaDescription: 'UPSC CSE 2026 salary structure. IAS/IPS pay levels, basic pay, gross salary, perks including bungalow, vehicle, and career progression.',
  h1: 'UPSC CSE 2026 Salary — IAS/IPS Officer Pay Scale, Perks & Career Growth',
  overview: `<p>The <strong>UPSC CSE 2026 Salary</strong> offers the highest pay scales and most prestigious perks in Indian government service. IAS/IPS officers start at Pay Level 10 and can reach Pay Level 18 (Cabinet Secretary), the apex of the civil service pay structure.</p>
<h3>Entry-Level Salary</h3>
<p>New IAS/IPS officers start at Pay Level 10 with basic pay of ₹56,100. With DA, HRA (or government accommodation), TA, and other allowances, the gross salary is approximately ₹90,000-₹1,00,000 per month. However, the real value lies in non-monetary benefits.</p>
<h3>Non-Monetary Benefits</h3>
<p>IAS/IPS officers receive government bungalow/accommodation (worth ₹50,000-₹2,00,000/month in market value), official vehicle with driver, staff (cook, gardener, peon), security detail (for senior officers and IPS), subsidized utilities, full medical coverage for entire family, and domestic help allowance. These benefits make the effective compensation 3-5x the gross salary.</p>
<h3>Career Progression</h3>
<p>IAS officers progress through: SDM/Under Secretary (Level 10) → ADC/Deputy Secretary (Level 11) → DC/Collector/Director (Level 13) → Joint Secretary/IG (Level 14) → Additional Secretary/DGP (Level 15-16) → Secretary/DGP (Level 17) → Cabinet Secretary (Level 18, ₹2,50,000 basic). The journey from entry to Secretary takes 30-35 years, with significant power and influence at each stage.</p>
<p>IPS officers follow a parallel track from ASP to DGP with similar pay scales but different designations and responsibilities. IFS officers serve as diplomats abroad with foreign service allowances that can double their compensation.</p>`,
  salary: {
    salaryMin: 56100, salaryMax: 250000, payLevels: 'Pay Level 10 to Pay Level 18',
    grossRange: '₹90,000 – ₹4,00,000', netRange: '₹70,000 – ₹3,00,000',
    allowances: ['DA', 'HRA (or Government Bungalow)', 'Transport Allowance', 'Official Vehicle with Driver', 'Domestic Help Allowance', 'Medical for family', 'LTC', 'Pension/NPS', 'Security Detail (senior ranks)', 'Staff (cook, gardener, peon)'],
    postWiseSalary: [
      { post: 'SDM / Under Secretary (Entry)', payLevel: 'Level 10', basicPay: '₹56,100' },
      { post: 'ADC / Deputy Secretary (4-5 yrs)', payLevel: 'Level 11', basicPay: '₹67,700' },
      { post: 'District Collector / Director (9-12 yrs)', payLevel: 'Level 13', basicPay: '₹1,23,100' },
      { post: 'Joint Secretary (16-20 yrs)', payLevel: 'Level 14', basicPay: '₹1,44,200' },
      { post: 'Secretary to GoI (30+ yrs)', payLevel: 'Level 17', basicPay: '₹2,25,000' },
      { post: 'Cabinet Secretary (Apex)', payLevel: 'Level 18', basicPay: '₹2,50,000' },
    ],
  },
  faqs: [
    { question: 'What is the starting salary of IAS officer?', answer: '₹56,100 basic pay (Level 10). With accommodation and vehicle, effective compensation exceeds ₹2,00,000/month in value.' },
    { question: 'Do IAS officers get free housing?', answer: 'Yes, government bungalows/quarters are provided free or at nominal rent, worth ₹50,000-₹2,00,000 in market value.' },
    { question: 'What is the highest salary in IAS?', answer: 'Cabinet Secretary at Level 18 earns ₹2,50,000 basic. With DA and perks, total value exceeds ₹5,00,000/month.' },
    { question: 'Is IAS salary less than private sector?', answer: 'Monetarily yes at entry level, but non-monetary benefits (housing, vehicle, staff, power, pension) make effective compensation very competitive.' },
    { question: 'Do IPS officers get security?', answer: 'Senior IPS officers (SP and above) receive personal security detail. DGP-level officers get extensive security cover.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'upsc-cse-cutoff', pageType: 'cutoff',
  metaTitle: 'UPSC CSE Cutoff 2026 — Prelims & Mains Marks',
  metaDescription: 'UPSC CSE cutoff 2026: Category-wise cut off marks for Prelims, Mains, and Final. Previous year cutoffs with analysis.',
  h1: 'UPSC CSE Cutoff 2026 — Category-Wise Prelims & Mains Cut Off Marks',
  overview: `<p>The <strong>UPSC CSE Cutoff</strong> is among the most closely watched numbers in Indian competitive exams. The Civil Services Examination has three stages — Prelims, Mains, and Interview — each with separate cutoffs. UPSC is unique in that the Prelims cutoff is relatively low (around 50-55% of total marks) but the overall competition makes even this challenging.</p>

<h3>How UPSC CSE Cutoff Works</h3>
<ul>
<li><strong>Prelims (GS Paper I):</strong> Qualifying cutoff based on GS Paper I marks only (200 marks). CSAT (Paper II) is qualifying with 33% minimum.</li>
<li><strong>Mains:</strong> 7 subjective papers + 2 qualifying papers. Merit-based cutoff for interview shortlisting.</li>
<li><strong>Final:</strong> Mains (1750 marks) + Interview (275 marks) = Total 2025 marks.</li>
</ul>

<h3>UPSC CSE Cutoff Trend (2022–2024)</h3>
<p>Prelims cutoff for General category ranged from 86 to 96 marks out of 200 — approximately 43-48%. This seemingly low percentage is deceptive because the questions are extremely challenging, and many of the 10+ lakh applicants fail to cross this threshold. Mains cutoffs have been around 735-780 out of 1750 marks.</p>

<h3>Expected UPSC CSE 2026 Cutoff</h3>
<p>Prelims cutoff is expected at <strong>90–100 out of 200</strong> for General. Aim for 110+ to be safely qualified. For Mains, target 800+ out of 1750 for strong interview call chances.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '96', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '88', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '78', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '72', totalMarks: '200' },
    { year: 2024, category: 'EWS', cutoffScore: '90', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '91', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '84', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '74', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '68', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '86', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '79', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '70', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '64', totalMarks: '200' },
  ],
  faqs: [
    { question: 'What is the expected UPSC Prelims 2026 cutoff?', answer: 'General category cutoff is expected around 90-100 out of 200 based on recent trends.' },
    { question: 'Does CSAT count in cutoff?', answer: 'No, CSAT (Paper II) is qualifying with 33% minimum. Only GS Paper I marks determine Prelims cutoff.' },
    { question: 'Is the UPSC cutoff really below 50%?', answer: 'Yes, the cutoff is around 43-48% of 200 marks. The extremely challenging nature of questions makes even this difficult to achieve.' },
    { question: 'How is the final merit calculated?', answer: 'Mains (1750) + Interview (275) = 2025 total marks. Prelims marks do not count in final merit.' },
    { question: 'Is the cutoff increasing every year?', answer: 'There is a gradual upward trend — from 86 (2022) to 96 (2024) for General — reflecting better preparation resources.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'upsc-cse-age-limit', pageType: 'age-limit',
  metaTitle: 'UPSC CSE Age Limit 2026 — Attempts & Relaxation',
  metaDescription: 'UPSC CSE age limit 2026: 21-32 years for General with 6 attempts. Category-wise relaxation and attempt limits.',
  h1: 'UPSC CSE Age Limit 2026 — Age, Attempts & Category-Wise Relaxation',
  overview: `<p>The <strong>UPSC CSE Age Limit</strong> is one of the most important eligibility criteria, as it directly limits the number of attempts a candidate can make. The interplay between age limit and number of attempts creates a finite window for preparation that candidates must plan carefully.</p>

<h3>UPSC CSE 2026 Age Limit & Attempts</h3>
<ul>
<li><strong>General:</strong> 21–32 years, 6 attempts</li>
<li><strong>OBC:</strong> 21–35 years, 9 attempts</li>
<li><strong>SC/ST:</strong> 21–37 years, unlimited attempts (within age limit)</li>
<li><strong>PwBD (General):</strong> 21–42 years, 9 attempts</li>
<li><strong>PwBD (OBC):</strong> 21–45 years, 9 attempts</li>
<li><strong>PwBD (SC/ST):</strong> 21–42 years, unlimited attempts</li>
</ul>

<h3>Understanding the Attempt System</h3>
<p>UPSC CSE is unique in having both age limits AND attempt limits. For General category:</p>
<ul>
<li>First possible attempt: at age 21 (2026 notification)</li>
<li>Maximum 6 attempts between age 21-32 = roughly one attempt per 2 years</li>
<li>An attempt is counted if you appear for at least one paper of Prelims (even if you withdraw midway)</li>
<li>If you don't appear at all, it is NOT counted as an attempt</li>
</ul>

<p>Strategic planning is critical. Most successful candidates clear UPSC in their 2nd–4th attempt, so starting early (21-24) maximizes your chances.</p>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator</a> to check your eligibility and remaining attempts.</p>

<h3>Key Points</h3>
<ul>
<li>Age is calculated as on 1st August of the year of examination</li>
<li>EWS candidates follow General category rules (21-32, 6 attempts)</li>
<li>Disabled ex-servicemen get additional relaxation</li>
<li>There is no minimum educational qualification age — you just need a degree by the time of Mains</li>
</ul>`,

  eligibility: `<h3>Age & Attempts Summary</h3>
<ul>
<li><strong>General:</strong> 21–32 years, 6 attempts</li>
<li><strong>OBC:</strong> 21–35 years, 9 attempts</li>
<li><strong>SC/ST:</strong> 21–37 years, unlimited</li>
<li><strong>PwBD:</strong> 21–42 years, 9 attempts</li>
</ul>`,
  faqs: [
    { question: 'What is the age limit for UPSC CSE?', answer: '21-32 for General with 6 attempts. OBC: 35 (9 attempts), SC/ST: 37 (unlimited).' },
    { question: 'When is an attempt counted?', answer: 'An attempt is counted only if you appear for at least one paper of the Prelims exam. Simply applying does not count.' },
    { question: 'Can I start preparing before 21?', answer: 'Yes, start preparation early. But you can only appear for the exam from age 21 onwards.' },
    { question: 'Is there any relaxation for EWS?', answer: 'No, EWS follows General category rules — 21-32 age limit with 6 attempts.' },
    { question: 'How is age calculated?', answer: 'As on 1st August of the examination year. For UPSC CSE 2026, age is calculated as on 1st August 2026.' },
  ],
  relatedExams: RELATED,
};

export const UPSC_CSE_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
