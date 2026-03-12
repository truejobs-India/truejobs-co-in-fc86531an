import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'ssc-jobs' as const,
  examName: 'SSC CPO',
  examYear: 2026,
  conductingBody: 'Staff Selection Commission (SSC)',
  officialWebsite: 'ssc.gov.in',
  datePublished: '2026-02-08',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
  { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
  { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
  { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
  { label: 'SSC CPO 2026 Syllabus', href: '/ssc-cpo-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cpo-2026-notification',
  pageType: 'notification',
  metaTitle: 'SSC CPO 2026 Notification — SI/ASI Vacancies',
  metaDescription: 'SSC CPO 2026 Notification out. Check vacancies for Sub-Inspector in Delhi Police, CAPF and ASI in CISF. Eligibility, dates & apply online.',
  h1: 'SSC CPO 2026 Notification — SI/ASI Vacancies, Eligibility & How to Apply',
  totalVacancies: 4187,
  applicationEndDate: '2026-05-31',
  applyLink: 'https://ssc.gov.in',
  overview: `<p>The Staff Selection Commission has released the <strong>SSC CPO 2026 Notification</strong> for the recruitment of <strong>Sub-Inspector (SI)</strong> in Delhi Police and Central Armed Police Forces (CAPF), and <strong>Assistant Sub-Inspector (ASI)</strong> in CISF. Approximately <strong>4,187 vacancies</strong> have been announced.</p>
<p>SSC CPO (Central Police Organization) exam recruits officers for law enforcement and paramilitary forces including BSF, CRPF, CISF, ITBP, and SSB. Sub-Inspectors are placed at Pay Level 6 (₹35,400 basic), making it one of the highest-paying SSC examinations. ASI posts in CISF are at Pay Level 5 (₹29,200).</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>SSC</td></tr><tr><td>Posts</td><td>SI (Delhi Police/CAPF) & ASI (CISF)</td></tr><tr><td>Total Vacancies</td><td>4,187</td></tr><tr><td>Qualification</td><td>Graduation in any discipline</td></tr><tr><td>Selection</td><td>Paper I → PET/PST → Paper II → Medical</td></tr><tr><td>Pay Level</td><td>Level 6 (SI) / Level 5 (ASI)</td></tr></table>
<p>The selection process is unique among SSC exams as it includes a Physical Endurance Test (PET) and Physical Standard Test (PST) between Paper I and Paper II. Candidates must meet height, chest, and running standards to qualify. This makes SSC CPO attractive for candidates who are both academically strong and physically fit.</p>
<p>SI in Delhi Police is a prestigious post offering the opportunity to serve in India's capital. CAPF SIs serve in border and internal security forces across the country. Both roles offer excellent career progression with promotions to Inspector, DSP, and beyond through departmental exams.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-03-01' },
    { label: 'Application Start', date: '2026-03-15' },
    { label: 'Application Last Date', date: '2026-05-31' },
    { label: 'Paper I Exam', date: 'July 2026' },
    { label: 'PET/PST', date: 'September 2026' },
    { label: 'Paper II Exam', date: 'November 2026' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p>Bachelor's degree in any discipline from a recognized university</p><h3>Age Limit</h3><p>20 to 25 years for SI (Delhi Police/CAPF) | 20 to 25 years for ASI (CISF)</p><h3>Age Relaxation</h3><p>OBC: 3 years | SC/ST: 5 years | Ex-Servicemen: 3 years (after military service)</p><h3>Physical Standards (Male)</h3><p>Height: 170 cm (Gen/OBC) / 162.5 cm (SC/ST) | Chest: 80 cm (unexpanded), 85 cm (expanded) | Running: 1.6 km in 6.5 minutes</p><h3>Physical Standards (Female)</h3><p>Height: 157 cm (Gen/OBC) / 150 cm (SC/ST) | Running: 1.6 km in 9 minutes</p>`,
  feeStructure: { general: 200, obc: 200, scSt: 0, female: 0, ph: 0, paymentModes: ['Online (Net Banking, UPI, Debit Card)', 'SBI Challan'] },
  selectionProcess: [
    'Paper I — Computer Based Exam (200 marks)',
    'Physical Endurance Test (PET) & Physical Standard Test (PST) — qualifying',
    'Paper II — Computer Based Exam (200 marks)',
    'Document Verification',
    'Detailed Medical Examination',
    'Final Merit based on Paper I + Paper II aggregate',
  ],
  examPattern: [
    { stageName: 'Paper I', rows: [
      { subject: 'General Intelligence & Reasoning', questions: 50, marks: 50, duration: '120 minutes', negativeMarking: '0.25 per wrong answer' },
      { subject: 'General Knowledge & General Awareness', questions: 50, marks: 50, duration: 'Combined', negativeMarking: '0.25 per wrong answer' },
      { subject: 'Quantitative Aptitude', questions: 50, marks: 50, duration: 'Combined', negativeMarking: '0.25 per wrong answer' },
      { subject: 'English Comprehension', questions: 50, marks: 50, duration: 'Combined', negativeMarking: '0.25 per wrong answer' },
    ]},
    { stageName: 'Paper II', rows: [
      { subject: 'English Language & Comprehension', questions: 200, marks: 200, duration: '120 minutes', negativeMarking: '0.25 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 35400, salaryMax: 112400, payLevels: 'Pay Level 6 (SI) / Level 5 (ASI)',
    grossRange: '₹50,000 – ₹1,20,000', netRange: '₹42,000 – ₹1,00,000',
    allowances: ['DA', 'HRA', 'Transport Allowance', 'Ration Money', 'Kit Allowance', 'Medical Benefits', 'NPS', 'Risk & Hardship Allowance (CAPF)'],
    postWiseSalary: [
      { post: 'Sub-Inspector (Delhi Police)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Sub-Inspector (CAPF)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'ASI (CISF)', payLevel: 'Level 5', basicPay: '₹29,200' },
    ],
  },
  howToApply: [
    'Visit ssc.gov.in and register (one-time registration)',
    'Navigate to SSC CPO 2026 application link',
    'Fill personal details, educational qualification, and post preferences',
    'Upload recent photograph and signature per specifications',
    'Pay application fee online (free for SC/ST/Female/Ex-Servicemen)',
    'Select exam centre and zone preferences',
    'Submit application and save confirmation',
  ],
  faqs: [
    { question: 'What posts are recruited through SSC CPO?', answer: 'Sub-Inspector in Delhi Police & CAPF (BSF, CRPF, CISF, ITBP, SSB) and Assistant Sub-Inspector in CISF.' },
    { question: 'Is physical test mandatory for SSC CPO?', answer: 'Yes, PET/PST is mandatory and qualifying. You must meet height, chest, and running standards.' },
    { question: 'What is the starting salary of SI?', answer: '₹35,400 basic (Level 6). With allowances, gross salary is ₹50,000-₹60,000. CAPF SIs also get risk allowance.' },
    { question: 'What is the age limit for SSC CPO?', answer: '20-25 years for General. Tighter than SSC CGL (up to 32) due to the physical nature of the job.' },
    { question: 'Can SI get promoted to Inspector?', answer: 'Yes, SI → Inspector → DSP/Commandant through departmental exams and seniority.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ssc.gov.in',
    instructions: [
      'Visit ssc.gov.in and click on "Status/Download Admit Card" under the Candidate\'s Corner',
      'Select "CPO SI/ASI Examination 2026" from the exam list',
      'Log in with your Registration ID and Date of Birth',
      'Download and print the admit card on A4 paper',
      'Carry the printed admit card to the examination hall',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://ssc.gov.in',
    meritListUrl: 'https://ssc.gov.in',
    nextSteps: [
      'Check the result PDF on ssc.gov.in — qualified candidates\' roll numbers are listed category-wise',
      'SSC applies normalisation across multiple shifts to ensure fair scoring — your raw score is converted to a normalised score',
      'Download your individual score card from the candidate login portal after result declaration',
      'Paper I qualified candidates will be called for Physical Endurance Test (PET) and Physical Standard Test (PST)',
      'Final merit list is prepared based on Paper I + Paper II aggregate scores and uploaded to the official website',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '165.12', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '148.56', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '135.22', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '122.10', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '161.20', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '144.88', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '131.67', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '119.28', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '157.43', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '141.23', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '128.15', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '116.10', totalMarks: '200' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'ssc-cpo-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'SSC CPO 2026 Syllabus — Paper I & II Topics',
  metaDescription: 'SSC CPO 2026 syllabus for Paper I and Paper II. Subject-wise topics for Reasoning, GK, Quant, and English Comprehension.',
  h1: 'SSC CPO 2026 Syllabus — Paper I & Paper II Complete Topics',
  overview: `<p>The <strong>SSC CPO 2026 Syllabus</strong> covers general subjects in Paper I and focuses entirely on English in Paper II.</p>
<h3>Paper I Syllabus</h3>
<p><strong>General Intelligence & Reasoning (50):</strong> Analogies, Classification, Series, Coding-Decoding, Matrix, Word Formation, Venn Diagram, Direction, Blood Relations, Syllogism, Mirror/Water Image, Embedded Figures, Critical Thinking, Problem Solving, Emotional Intelligence, Social Intelligence.</p>
<p><strong>General Knowledge & Awareness (50):</strong> Current Affairs, History, Geography, Polity, Economy, General Science, Sports, Awards, Books, Important Dates, Inventions, Indian Constitution, Culture, Defence.</p>
<p><strong>Quantitative Aptitude (50):</strong> Number System, Computation, Decimals, Fractions, Ratio-Proportion, Percentage, Profit-Loss, Discount, Interest, Mensuration, Time-Speed-Distance, Time-Work, Algebra, Geometry, Trigonometry, Statistics, Probability, Bar/Pie/Line Charts.</p>
<p><strong>English Comprehension (50):</strong> Error Detection, Fill in Blanks, Synonyms/Antonyms, Spellings, Idioms & Phrases, One-word Substitution, Sentence Correction, Reading Comprehension, Cloze Test.</p>
<h3>Paper II Syllabus</h3>
<p>Entirely English Language & Comprehension: Error Recognition, Fill in Blanks, Vocabulary, Spellings, Grammar, Sentence Structure, Synonyms, Antonyms, Sentence Completion, Phrases & Idioms, One-word Substitution, Comprehension Passage, Active/Passive Voice, Direct/Indirect Speech.</p>`,
  syllabusSummary: `<ul><li><strong>Paper I:</strong> Reasoning (50), GK (50), Quant (50), English (50) — total 200 marks</li><li><strong>Paper II:</strong> English Language & Comprehension — 200 marks (200 questions)</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'Is Paper II only English?', answer: 'Yes, Paper II is entirely English Language & Comprehension with 200 questions for 200 marks.' },
    { question: 'Is the CPO syllabus similar to CGL?', answer: 'Paper I is very similar to CGL Tier-1. Paper II focuses on English, unlike CGL which has Maths/Statistics in Tier-2.' },
    { question: 'What level of maths is asked?', answer: 'Up to 10th-12th standard level — basic arithmetic, algebra, geometry, trigonometry, and data interpretation.' },
    { question: 'Is general science important for CPO?', answer: 'Yes, General Science is part of the GK section. Focus on Physics, Chemistry, and Biology basics.' },
    { question: 'How important is English for CPO?', answer: 'Extremely important — Paper I has 50 marks English and Paper II is entirely English (200 marks). Total 250 out of 400 marks.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ssc-cpo-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'SSC CPO 2026 Exam Pattern — Papers & PET',
  metaDescription: 'SSC CPO 2026 exam pattern. Paper I, PET/PST, Paper II structure with marks, questions, duration and physical test standards.',
  h1: 'SSC CPO 2026 Exam Pattern — Paper I, PET/PST & Paper II Details',
  overview: `<p>The <strong>SSC CPO 2026 Exam Pattern</strong> is unique with a physical test sandwiched between two written papers.</p>
<h3>Paper I (200 marks, 2 hours)</h3>
<p>200 MCQ questions across 4 sections: Reasoning (50), GK (50), Quant (50), English (50). Negative marking of 0.25 per wrong answer. Paper I shortlists candidates for PET/PST.</p>
<h3>PET/PST (Qualifying)</h3>
<p><strong>Physical Standard Test:</strong> Height and chest measurements. <strong>Physical Endurance Test:</strong> Males — 1.6 km run in 6.5 minutes, long jump 3.65m/running, high jump 1.2m. Females — 1.6 km in 9 minutes, long jump 2.7m, high jump 0.9m. PET/PST is qualifying — no marks. Failure means elimination.</p>
<h3>Paper II (200 marks, 2 hours)</h3>
<p>200 questions on English Language & Comprehension only. Negative marking 0.25. This tests higher-level English proficiency needed for police/CAPF officer duties.</p>
<h3>Final Merit</h3>
<p>Paper I + Paper II aggregate (400 marks) determines the final merit, subject to passing PET/PST and medical examination.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How many papers are in SSC CPO?', answer: 'Two written papers (Paper I and Paper II) with PET/PST between them. Total written marks: 400.' },
    { question: 'What is the PET requirement?', answer: 'Males: 1.6 km in 6.5 min + jumps. Females: 1.6 km in 9 min + jumps. PET is qualifying.' },
    { question: 'Is Paper II difficult?', answer: 'Paper II is entirely English (200 questions). If your English is strong, it\'s an advantage as it\'s half the total marks.' },
    { question: 'Is there negative marking?', answer: 'Yes, 0.25 marks deducted per wrong answer in both Paper I and Paper II.' },
    { question: 'How is final merit calculated?', answer: 'Paper I (200) + Paper II (200) = 400 marks total. Aggregate score determines the merit ranking.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ssc-cpo-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'SSC CPO 2026 Eligibility — Age & Physical',
  metaDescription: 'SSC CPO 2026 eligibility. Age limit 20-25, graduation, physical standards (height, chest, running) for SI in Delhi Police and CAPF.',
  h1: 'SSC CPO 2026 Eligibility — Age, Qualification & Physical Standards',
  overview: `<p>The <strong>SSC CPO 2026 Eligibility</strong> has strict physical standards in addition to educational and age requirements, reflecting the demanding nature of police and paramilitary service.</p>
<h3>Educational Qualification</h3><p>Bachelor's degree in any discipline from a recognized university or equivalent.</p>
<h3>Age Limit</h3><p>20 to 25 years for both SI and ASI posts. This is significantly tighter than other SSC exams like CGL (up to 32).</p>
<h3>Age Relaxation</h3><p>OBC: 3 years | SC/ST: 5 years | Ex-SM: 3 years (after deducting military service) | PwBD: not applicable for most CPO posts</p>
<h3>Physical Standards — Male</h3><p>Height: 170 cm (Gen/OBC), 165 cm (SC/ST), 162.5 cm (hill area candidates) | Chest: 80 cm (unexpanded), 85 cm (expanded) — 5 cm expansion mandatory | Weight: proportionate to height | Eyesight: 6/6 and 6/9 without glasses</p>
<h3>Physical Standards — Female</h3><p>Height: 157 cm (Gen/OBC), 150 cm (SC/ST), 155 cm (hill area) | Weight: proportionate to height | Eyesight: 6/6 and 6/9 without glasses</p>
<h3>Medical Fitness</h3><p>Candidates must be in sound physical and mental health. No knock knees, flat feet, varicose veins, squint eyes, or other conditions that could impair duty performance. Colour blindness is disqualifying.</p>`,
  eligibility: `<h3>Qualification</h3><p>Graduation in any discipline</p><h3>Age</h3><p>20-25 years (General) | OBC: +3 | SC/ST: +5</p><h3>Height (Male)</h3><p>170 cm (Gen/OBC), 165 cm (SC/ST)</p><h3>Height (Female)</h3><p>157 cm (Gen/OBC), 150 cm (SC/ST)</p>`,
  faqs: [
    { question: 'What is the height requirement for CPO?', answer: 'Male: 170 cm (Gen/OBC), 165 cm (SC/ST). Female: 157 cm (Gen/OBC), 150 cm (SC/ST).' },
    { question: 'Is the age limit strict at 25?', answer: 'Yes, 20-25 is the General limit. With relaxation: OBC up to 28, SC/ST up to 30.' },
    { question: 'Can spectacle wearers apply?', answer: 'You need 6/6 and 6/9 distant vision without glasses. Spectacle wearers may not qualify for medical.' },
    { question: 'Is flat foot disqualifying?', answer: 'Yes, flat foot is a disqualifying condition for SSC CPO posts.' },
    { question: 'Is chest expansion tested for females?', answer: 'No, chest measurement and expansion test is only for male candidates.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'ssc-cpo-2026-salary', pageType: 'salary',
  metaTitle: 'SSC CPO 2026 Salary — SI/ASI Pay & Benefits',
  metaDescription: 'SSC CPO 2026 salary. SI Delhi Police and CAPF Pay Level 6 salary, ASI CISF Pay Level 5, allowances and career progression.',
  h1: 'SSC CPO 2026 Salary — SI & ASI Pay Scale, Allowances & Career Growth',
  overview: `<p>The <strong>SSC CPO 2026 Salary</strong> is among the highest for SSC examinations. Sub-Inspectors are placed at Pay Level 6 (₹35,400 basic) and ASIs at Level 5 (₹29,200 basic), with additional allowances specific to police and paramilitary service.</p>
<h3>SI Salary (Delhi Police & CAPF)</h3><p>Basic pay ₹35,400. With DA, HRA, transport allowance, and ration money, gross salary is ₹50,000-₹60,000. CAPF SIs additionally receive risk and hardship allowance (₹6,500-₹25,000 depending on area classification), field area allowance, and free accommodation in force quarters.</p>
<h3>ASI Salary (CISF)</h3><p>Basic pay ₹29,200 (Level 5). Gross salary ₹42,000-₹50,000 with allowances. CISF provides posting at airports, metro stations, government installations — often urban postings.</p>
<h3>Career Progression</h3><p>SI → Inspector → DSP/Commandant (through departmental exam) → SP/DIG. In Delhi Police, SI can rise to ACP and DCP through promotions. CAPF progression: SI → Inspector → AC → DC → Commandant → DIG → IG → ADG → DG. Career growth is well-structured with regular departmental exams.</p>
<h3>Unique Benefits</h3><p>Free uniform and kit, ration money allowance, government quarters, canteen facilities at subsidized rates, free medical treatment at force hospitals, children education allowance, and pension/NPS. CAPF personnel also receive free travel home once a year (annual leave travel).</p>`,
  salary: {
    salaryMin: 29200, salaryMax: 112400, payLevels: 'Pay Level 5 (ASI) to Level 6 (SI)',
    grossRange: '₹42,000 – ₹1,20,000', netRange: '₹35,000 – ₹1,00,000',
    allowances: ['DA', 'HRA / Free Quarters', 'Transport Allowance', 'Ration Money', 'Kit Allowance', 'Risk & Hardship Allowance (CAPF)', 'Field Area Allowance', 'Medical Benefits', 'NPS', 'Annual Leave Travel'],
    postWiseSalary: [
      { post: 'Sub-Inspector (Delhi Police)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'Sub-Inspector (CAPF)', payLevel: 'Level 6', basicPay: '₹35,400' },
      { post: 'ASI (CISF)', payLevel: 'Level 5', basicPay: '₹29,200' },
      { post: 'Inspector (after promotion)', payLevel: 'Level 7', basicPay: '₹44,900' },
    ],
  },
  faqs: [
    { question: 'What is SI starting salary in Delhi Police?', answer: '₹35,400 basic (Level 6). Gross salary approximately ₹50,000-₹60,000 with Delhi HRA and allowances.' },
    { question: 'Do CAPF SIs get extra allowance?', answer: 'Yes, risk & hardship allowance (₹6,500-₹25,000) and field area allowance based on posting location.' },
    { question: 'Is free housing provided?', answer: 'Yes, CAPF provides free government quarters. Delhi Police SIs get HRA if quarters aren\'t available.' },
    { question: 'What is the ASI CISF salary?', answer: '₹29,200 basic (Level 5). CISF postings are often at airports and metro — urban locations.' },
    { question: 'Can SI become DSP?', answer: 'Yes, through Limited Departmental Competitive Exam (LDCE), SIs can be promoted to DSP/Commandant level.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cpo-cutoff',
  pageType: 'cutoff',
  metaTitle: 'SSC CPO Cutoff 2026 — Paper I & II Cut Off Marks',
  metaDescription: 'SSC CPO cutoff 2026: Category-wise cut off marks for Paper I and Paper II. Previous year cutoffs 2022-2024 with trend analysis.',
  h1: 'SSC CPO Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',
  overview: `<p>The <strong>SSC CPO Cutoff</strong> is released in two stages — Paper I cutoff (for PET/PST qualification) and Paper II cutoff (for final merit). Since SSC CPO recruits Sub-Inspectors for Delhi Police and CAPF, the cutoffs are generally higher than SSC CHSL or MTS, reflecting the prestige and pay level of the posts.</p>

<h3>How SSC CPO Cutoff Works</h3>
<p>The cutoff determination process:</p>
<ul>
<li><strong>Paper I Cutoff:</strong> Screening stage — shortlists candidates for Physical Endurance Test (PET) and Physical Standard Test (PST). Approximately 10× vacancies are shortlisted.</li>
<li><strong>Paper II Cutoff:</strong> Final merit — Paper I + Paper II aggregate (400 marks) determines the final selection. Post preferences affect allocation.</li>
<li><strong>Normalisation:</strong> SSC applies normalisation across multiple shifts for both papers.</li>
</ul>

<h3>SSC CPO Cutoff Trend Analysis (2022–2024)</h3>
<p>SSC CPO Paper I cutoffs have risen steadily. General category cutoffs increased from 157.43 (2022) to 165.12 (2024) out of 200 marks — an increase of nearly 8 marks in 2 years. OBC cutoffs moved from 141.23 to 148.56. The upward trend reflects increasing competition for SI posts, driven by the attractive Pay Level 6 salary and career prospects in police/CAPF.</p>

<h3>Expected SSC CPO 2026 Cutoff</h3>
<p>Based on the trend, SSC CPO 2026 Paper I cutoff for General category is expected to be <strong>167–173 out of 200</strong>. Candidates should aim for 175+ in Paper I to clear with a comfortable margin. For Paper II (English only), a score of 140+ out of 200 is recommended.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '165.12', totalMarks: '200' },
    { year: 2024, category: 'OBC', cutoffScore: '148.56', totalMarks: '200' },
    { year: 2024, category: 'SC', cutoffScore: '135.22', totalMarks: '200' },
    { year: 2024, category: 'ST', cutoffScore: '122.10', totalMarks: '200' },
    { year: 2023, category: 'General', cutoffScore: '161.20', totalMarks: '200' },
    { year: 2023, category: 'OBC', cutoffScore: '144.88', totalMarks: '200' },
    { year: 2023, category: 'SC', cutoffScore: '131.67', totalMarks: '200' },
    { year: 2023, category: 'ST', cutoffScore: '119.28', totalMarks: '200' },
    { year: 2022, category: 'General', cutoffScore: '157.43', totalMarks: '200' },
    { year: 2022, category: 'OBC', cutoffScore: '141.23', totalMarks: '200' },
    { year: 2022, category: 'SC', cutoffScore: '128.15', totalMarks: '200' },
    { year: 2022, category: 'ST', cutoffScore: '116.10', totalMarks: '200' },
  ],

  faqs: [
    { question: 'What is the expected SSC CPO 2026 cutoff?', answer: 'General category Paper I cutoff is expected around 167-173 out of 200 based on the 2022-2024 trend.' },
    { question: 'Is CPO cutoff higher than CGL?', answer: 'CPO Paper I cutoff as a percentage of total marks is similar to CGL Tier-1. But CPO also requires PET/PST clearance, adding another hurdle.' },
    { question: 'Does PET/PST failure affect the cutoff?', answer: 'PET/PST is qualifying — no marks. But many candidates who clear Paper I fail PET/PST, effectively reducing competition for Paper II.' },
    { question: 'Are CPO cutoffs post-wise?', answer: 'Paper I cutoff is common. Post-wise allocation happens during counselling based on Paper I + Paper II aggregate and preferences.' },
    { question: 'Is Paper II cutoff separate?', answer: 'Final merit is based on Paper I + Paper II aggregate (400 marks). There is no separate cutoff for Paper II alone.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-cpo-age-limit',
  pageType: 'age-limit',
  metaTitle: 'SSC CPO Age Limit 2026 — SI/ASI Age & Relaxation',
  metaDescription: 'SSC CPO 2026 age limit: 20-25 years for SI and ASI. Category-wise relaxation and physical standard requirements.',
  h1: 'SSC CPO Age Limit 2026 — SI/ASI Age Requirements & Category Relaxation',
  overview: `<p>The <strong>SSC CPO Age Limit</strong> is one of the strictest among SSC examinations. The 20–25 age bracket is significantly tighter than SSC CGL (up to 32) or CHSL (up to 27), reflecting the physical demands of police and paramilitary service. Many candidates who are eligible for other SSC exams may not qualify for CPO due to the strict age limit.</p>

<h3>SSC CPO 2026 Age Limit</h3>
<p>Age calculated as on <strong>1st January 2026</strong>:</p>
<ul>
<li><strong>Sub-Inspector (Delhi Police/CAPF):</strong> 20–25 years (General)</li>
<li><strong>ASI (CISF):</strong> 20–25 years (General)</li>
</ul>

<h3>Category-Wise Age Relaxation</h3>
<ul>
<li><strong>OBC (NCL):</strong> 3 years (up to 28 years)</li>
<li><strong>SC/ST:</strong> 5 years (up to 30 years)</li>
<li><strong>Ex-Servicemen:</strong> 3 years after deduction of military service</li>
<li><strong>PwBD:</strong> Generally not applicable for CPO posts due to physical requirements</li>
</ul>

<h3>Why is CPO Age Limit Strict?</h3>
<p>The tight age bracket exists because:</p>
<ul>
<li>SI/ASI posts require physical fitness — younger candidates adapt better to rigorous training</li>
<li>CAPF training at academies lasts 1–2 years, so entry age must allow sufficient service years</li>
<li>The PET/PST requirements (1.6 km run, jumps) favour younger candidates</li>
<li>Career progression in police requires long service years for promotions to Inspector, DSP, etc.</li>
</ul>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a> to check your SSC CPO eligibility instantly.</p>

<h3>Important Notes</h3>
<ul>
<li>Both minimum (20) and maximum (25) age limits are strictly enforced</li>
<li>Candidates below 20 cannot apply even if they hold a graduation degree</li>
<li>The minimum age of 20 ensures candidates have completed graduation (typically at 21-22)</li>
<li>There is no age relaxation for EWS category</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary (as on 01-01-2026)</h3>
<ul>
<li><strong>General:</strong> 20–25 years</li>
<li><strong>OBC:</strong> 20–28 years</li>
<li><strong>SC/ST:</strong> 20–30 years</li>
<li><strong>Ex-SM:</strong> 20–28 years (after military service deduction)</li>
</ul>`,

  faqs: [
    { question: 'What is the age limit for SSC CPO 2026?', answer: '20-25 years for General category as on 1 January 2026. OBC: up to 28, SC/ST: up to 30.' },
    { question: 'Why is CPO age limit only 25?', answer: 'Due to the physical nature of police/CAPF service, the age is kept lower to ensure fitness for PET/PST and extensive field training.' },
    { question: 'Can PwBD candidates apply for CPO?', answer: 'Generally no, as CPO posts require full physical fitness including running, jumps, and eyesight standards that PwBD relaxation doesn\'t cover.' },
    { question: 'Is the minimum age 20 for both SI and ASI?', answer: 'Yes, both SI (Delhi Police/CAPF) and ASI (CISF) require a minimum age of 20 years.' },
    { question: 'Can I apply at exactly 25 years?', answer: 'If your age is exactly 25 years 0 days on 1 January 2026, you are eligible. If 25 years and 1+ days, you are not (unless reserved category).' },
  ],
  relatedExams: RELATED,
};

export const SSC_CPO_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg, ageLimitCfg];
