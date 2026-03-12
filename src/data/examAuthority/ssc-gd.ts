import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'ssc-jobs' as const,
  examName: 'SSC GD Constable',
  examYear: 2026,
  conductingBody: 'Staff Selection Commission (SSC)',
  officialWebsite: 'https://ssc.gov.in',
};

export const sscGdNotification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-notification',
  pageType: 'notification',
  metaTitle: 'SSC GD Constable 2026 – Notification & Apply',
  metaDescription: 'SSC GD Constable 2026 notification out. Check eligibility, exam dates, physical standards, vacancy details and apply online at ssc.gov.in.',
  lastUpdated: '2026-03-07',
  datePublished: '2026-01-15',
  applicationEndDate: '2026-05-30',
  applyLink: 'https://ssc.gov.in',
  notificationPdfUrl: 'https://ssc.gov.in/api/Notices',

  h1: 'SSC GD Constable 2026 Notification – General Duty Constable Recruitment',

  overview: `<p>The Staff Selection Commission (SSC) has released the <strong>SSC GD Constable 2026 Notification</strong> for recruitment to the post of General Duty Constable in Central Armed Police Forces (CAPFs), NIA, SSF, and Rifleman in Assam Rifles. SSC GD is one of the largest recruitment drives in India, attracting millions of candidates annually for paramilitary and border security forces.</p>

<p>SSC GD Constable 2026 recruits candidates for forces including the <strong>Border Security Force (BSF)</strong>, <strong>Central Reserve Police Force (CRPF)</strong>, <strong>Central Industrial Security Force (CISF)</strong>, <strong>Indo-Tibetan Border Police (ITBP)</strong>, <strong>Sashastra Seema Bal (SSB)</strong>, <strong>National Investigation Agency (NIA)</strong>, <strong>Secretariat Security Force (SSF)</strong>, and <strong>Rifleman in Assam Rifles (AR)</strong>. These are prestigious uniformed positions with excellent career growth, housing facilities, and retirement benefits.</p>

<p>The exact number of SSC GD Constable 2026 vacancies will be announced with the detailed notification. SSC GD typically recruits 25,000–75,000 candidates per cycle, making it one of the highest-vacancy government exams in India. The recruitment covers all states and union territories with reservation as per government norms.</p>

<p>The selection process comprises four stages: <strong>Computer Based Examination (CBE)</strong>, <strong>Physical Efficiency Test (PET)</strong>, <strong>Physical Standard Test (PST)</strong>, and <strong>Medical Examination</strong>. The CBE consists of 80 objective-type questions carrying 160 marks in 60 minutes across four sections — General Intelligence & Reasoning, General Knowledge & General Awareness, Elementary Mathematics, and English/Hindi.</p>

<p>Candidates must have passed <strong>10th Standard (Matriculation)</strong> or equivalent from a recognised board. The age limit is <strong>18–23 years</strong> with standard relaxations for reserved categories. Physical standards vary by force and category — male candidates generally require a minimum height of 170 cm (165 cm for certain categories) and female candidates require 157 cm (155 cm for certain categories).</p>

<p>The application process is entirely online through the SSC portal. The application fee is ₹100 for General/OBC male candidates, while female candidates and SC/ST/Ex-Servicemen candidates are exempted. Candidates must upload photographs, signatures, and valid ID proof during the application process.</p>

<p>This page provides comprehensive details about SSC GD 2026 including important dates, eligibility criteria, physical standards, exam pattern, syllabus, selection process, salary structure, and application steps. Bookmark this page for latest updates.</p>`,

  dates: [
    { label: 'Notification Release Date', date: '2026-01-15' },
    { label: 'Online Application Start Date', date: '2026-02-20' },
    { label: 'Last Date to Apply Online', date: '2026-05-30' },
    { label: 'Last Date for Fee Payment', date: '2026-06-01' },
    { label: 'CBE Exam Date', date: '2026-09-01 to 2026-09-30' },
    { label: 'PET/PST Date', date: 'To Be Announced' },
    { label: 'Medical Examination', date: 'To Be Announced' },
    { label: 'Final Result Date', date: 'To Be Announced' },
  ],

  eligibility: `<p>To be eligible for SSC GD Constable 2026:</p>
<h3>Educational Qualification</h3>
<ul>
<li><strong>Minimum:</strong> 10th Standard (Matriculation) pass or equivalent from a recognised Board.</li>
</ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul>
<li><strong>General:</strong> 18–23 years</li>
</ul>
<h3>Age Relaxation</h3>
<ul>
<li>SC/ST: 5 years | OBC (NCL): 3 years</li>
<li>Ex-Servicemen: 3 years after deduction of military service</li>
</ul>
<h3>Physical Standards (Male — General/OBC/SC)</h3>
<ul>
<li>Height: 170 cm | Chest: 80 cm (expanded 85 cm)</li>
</ul>
<h3>Physical Standards (Female)</h3>
<ul>
<li>Height: 157 cm</li>
</ul>`,

  feeStructure: {
    general: 100,
    obc: 100,
    scSt: 0,
    female: 0,
    ph: 0,
    paymentModes: ['Net Banking', 'Credit Card', 'Debit Card', 'UPI', 'SBI Challan'],
  },

  selectionProcess: [
    'Computer Based Examination (CBE) – 80 questions, 160 marks',
    'Physical Efficiency Test (PET) – Race, Long Jump, High Jump',
    'Physical Standard Test (PST) – Height and Chest measurement',
    'Document Verification',
    'Medical Examination (Detailed & Review)',
    'Final Merit List',
  ],

  examPattern: [
    {
      stageName: 'Computer Based Examination (CBE)',
      rows: [
        { subject: 'General Intelligence & Reasoning', questions: 20, marks: 40, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Knowledge & General Awareness', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Elementary Mathematics', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English / Hindi', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
  ],

  syllabusSummary: `<p>SSC GD syllabus covers General Intelligence (analogies, coding, series, classification), General Knowledge (current affairs, history, geography, polity, science), Elementary Mathematics (number systems, percentage, ratio, time & work, geometry, data interpretation), and English/Hindi (comprehension, grammar, vocabulary). Difficulty level is 10th standard. See our <a href="/ssc-gd-2026-syllabus">SSC GD 2026 Syllabus</a> page for topic-wise details.</p>`,

  salary: {
    salaryMin: 21700,
    salaryMax: 69100,
    payLevels: 'Pay Level 3',
    grossRange: '₹30,000 – ₹45,000 per month',
    netRange: '₹26,000 – ₹38,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – revised biannually',
      'House Rent Allowance (HRA) or Free Accommodation',
      'Ration Allowance / Free Ration',
      'Uniform Allowance',
      'Risk & Hardship Allowance',
      'National Pension System (NPS) – 14% employer contribution',
      'Free Medical Facilities for self and family',
    ],
    postWiseSalary: [
      { post: 'Constable GD (BSF/CRPF/CISF/ITBP/SSB)', payLevel: 'Level 3', basicPay: '₹21,700 – ₹69,100' },
      { post: 'Constable GD (NIA/SSF)', payLevel: 'Level 3', basicPay: '₹21,700 – ₹69,100' },
      { post: 'Rifleman (Assam Rifles)', payLevel: 'Level 3', basicPay: '₹21,700 – ₹69,100' },
    ],
  },

  howToApply: [
    'Visit the official SSC website at ssc.gov.in and click on "Register/Login".',
    'Complete one-time registration with personal details, email, mobile number, and password.',
    'Log in and click "Apply" next to the GD Constable 2026 notification.',
    'Fill in personal details, educational qualification (10th pass board, year), and force/post preferences.',
    'Upload scanned photograph (20–50 KB, JPEG), signature (10–20 KB, JPEG), and photo ID (100–300 KB, PDF).',
    'Pay ₹100 application fee via Net Banking, Credit/Debit Card, UPI, or SBI Challan. Female/SC/ST/ESM are exempted.',
    'Review, submit, and download the confirmation page with Registration ID for future reference.',
  ],

  faqs: [
    { question: 'When is the SSC GD Constable 2026 exam?', answer: 'SSC GD 2026 CBE is scheduled from September 1 to September 30, 2026. PET/PST dates will be announced after CBE results.' },
    { question: 'What is the qualification for SSC GD?', answer: '10th Standard (Matriculation) pass or equivalent from a recognised board is the minimum qualification.' },
    { question: 'What is the height requirement for SSC GD?', answer: 'Male General/OBC/SC: 170 cm. Male ST: 162.5 cm. Female General/OBC/SC: 157 cm. Female ST: 150 cm. Relaxation varies by force and region.' },
    { question: 'How many vacancies in SSC GD 2026?', answer: 'The exact vacancy count for 2026 will be announced with the detailed notification. SSC GD typically recruits 25,000–75,000 candidates per cycle.' },
    { question: 'What is the SSC GD Constable salary?', answer: 'SSC GD Constable salary is Pay Level 3 with basic pay ₹21,700. Gross salary including allowances is approximately ₹30,000–₹45,000 per month plus free accommodation and ration.' },
    { question: 'Is there physical test in SSC GD?', answer: 'Yes, after clearing the CBE, candidates must pass PET (race, long jump, high jump) and PST (height, chest measurement). These are qualifying stages.' },
  ],

  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://ssc.gov.in',
    instructions: [
      'Visit ssc.gov.in and click on "Status/Download Admit Card" under the Candidate\'s Corner',
      'Select "GD Constable Examination 2026" from the exam list',
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
      'CBE qualified candidates will be called for Physical Efficiency Test (PET) and Physical Standard Test (PST)',
      'Final merit list is prepared based on normalised CBE scores and uploaded to the official website',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '152.75', totalMarks: '160' },
    { year: 2024, category: 'OBC', cutoffScore: '137.50', totalMarks: '160' },
    { year: 2024, category: 'SC', cutoffScore: '124.38', totalMarks: '160' },
    { year: 2024, category: 'ST', cutoffScore: '113.25', totalMarks: '160' },
    { year: 2023, category: 'General', cutoffScore: '148.62', totalMarks: '160' },
    { year: 2023, category: 'OBC', cutoffScore: '133.87', totalMarks: '160' },
    { year: 2023, category: 'SC', cutoffScore: '121.24', totalMarks: '160' },
    { year: 2023, category: 'ST', cutoffScore: '110.37', totalMarks: '160' },
    { year: 2022, category: 'General', cutoffScore: '143.11', totalMarks: '160' },
    { year: 2022, category: 'OBC', cutoffScore: '129.86', totalMarks: '160' },
    { year: 2022, category: 'SC', cutoffScore: '118.12', totalMarks: '160' },
    { year: 2022, category: 'ST', cutoffScore: '107.64', totalMarks: '160' },
  ],

  relatedExams: [
    { label: 'SSC CGL 2026', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CHSL 2026', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC MTS 2026', href: '/ssc-mts-2026-notification' },
    { label: 'SSC CPO 2026', href: '/ssc-cpo-2026-notification' },
  ],
};

export const sscGdSyllabus: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-syllabus',
  pageType: 'syllabus',
  metaTitle: 'SSC GD Syllabus 2026 – Subject-wise Topics',
  metaDescription: 'Complete SSC GD Constable 2026 syllabus. Topic-wise breakdown of General Intelligence, GK, Mathematics, and English/Hindi sections.',
  lastUpdated: '2026-03-05',
  datePublished: '2026-01-20',

  h1: 'SSC GD Constable Syllabus 2026 – Complete Subject-Wise Topic List',

  overview: `<p>The <strong>SSC GD Constable 2026 syllabus</strong> is designed to test candidates at the 10th standard level across four sections. Unlike SSC CGL or CHSL, the GD exam is relatively straightforward in terms of academic difficulty, but competition is intense due to the massive number of applicants. A clear understanding of the syllabus helps candidates focus on high-weightage topics and build exam-ready speed and accuracy.</p>

<p><strong>General Intelligence & Reasoning</strong> (20 questions, 40 marks) covers both verbal and non-verbal reasoning. Key topics include Analogies, Classification, Series (number, letter, figure), Coding-Decoding, Direction Sense, Blood Relations, Venn Diagrams, Dice, Calendar, Clock, Paper Folding & Cutting, Mirror Image, Water Image, Embedded Figures, and Pattern Completion. Non-verbal reasoning carries significant weightage — expect 8–10 questions from figure-based reasoning. Practice with visual puzzles and pattern recognition exercises daily.</p>

<p><strong>General Knowledge & General Awareness</strong> (20 questions, 40 marks) tests knowledge of current events and static GK. Major topics include Current Affairs (national and international events of last 6 months), Indian History (freedom movement, ancient and medieval India), Geography (Indian states, rivers, mountains, climate), Indian Polity (fundamental rights, Parliament, judiciary), Economics (basic concepts, Indian economy), General Science (physics, chemistry, biology at 10th level), and Static GK (countries & capitals, national parks, awards, sports, important dates, books & authors). Allocate 20–30 minutes daily to current affairs reading from newspapers or apps.</p>

<p><strong>Elementary Mathematics</strong> (20 questions, 40 marks) covers Number Systems (HCF, LCM, simplification), Decimals & Fractions, Percentage, Ratio & Proportion, Averages, Profit & Loss, Discount, Simple & Compound Interest, Time & Work, Time Speed & Distance, Mensuration (area, perimeter, volume of basic shapes), Geometry (angles, triangles, circles), Data Interpretation (tables, bar charts, pie charts), and basic Algebra. The difficulty is 10th standard — focus on speed and accuracy rather than complex problem-solving. Most questions can be solved within 30–45 seconds each.</p>

<p><strong>English/Hindi Language</strong> (20 questions, 40 marks) — candidates can choose either language. English section covers Reading Comprehension (1 passage), Fill in the Blanks, Error Spotting, Synonyms & Antonyms, Sentence Improvement, Idioms & Phrases, One-word Substitution, Spelling Correction, and Active/Passive Voice. Hindi section covers similar topics in Hindi — गद्यांश, रिक्त स्थान, वाक्य शुद्धि, पर्यायवाची/विलोम, मुहावरे, and अनेक शब्दों के लिए एक शब्द. Choose the language you're more comfortable with for maximum scoring.</p>

<p>The exam has 80 questions carrying 160 marks with 60 minutes duration. Negative marking is 0.50 per wrong answer. The difficulty level is significantly lower than SSC CGL/CHSL, but candidates must achieve high scores (typically 120+ out of 160) to qualify for PET/PST given the extreme competition. Previous year papers from 2018–2025 are the best preparation resource — they reveal exact question patterns and difficulty levels.</p>

<p>Preparation timeline: Start 3–4 months before the exam. Spend the first month covering all topics, the second month on practice sets, and the final month on mock tests and revision. Aim for 3 full-length mock tests per week in the last month to build speed and stamina.</p>`,

  examPattern: [
    {
      stageName: 'Computer Based Examination (CBE)',
      rows: [
        { subject: 'General Intelligence & Reasoning', questions: 20, marks: 40, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Knowledge & General Awareness', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Elementary Mathematics', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English / Hindi', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC GD 2026 syllabus?', answer: 'SSC GD syllabus covers four sections: General Intelligence & Reasoning, General Knowledge & General Awareness, Elementary Mathematics, and English/Hindi. All topics are at 10th standard level.' },
    { question: 'Is SSC GD syllabus easy compared to CGL?', answer: 'Yes, SSC GD syllabus is significantly easier than CGL. It tests 10th-level knowledge whereas CGL tests graduate-level aptitude. However, cut-offs are relatively high due to massive competition.' },
    { question: 'Which subject is most important in SSC GD?', answer: 'Mathematics and Reasoning are the most scoring sections. GK requires consistent daily reading. Focus on speed and accuracy — aim for 30–40 seconds per question.' },
    { question: 'Can I choose Hindi instead of English in SSC GD?', answer: 'Yes, candidates can choose either English or Hindi for the language section. Select the language you are more comfortable with for higher accuracy.' },
    { question: 'How many mock tests should I give for SSC GD?', answer: 'In the last month before the exam, aim for 3 full-length mock tests per week. Analyse each test to identify weak areas and improve speed.' },
  ],

  relatedExams: [
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
    { label: 'SSC GD Exam Pattern 2026', href: '/ssc-gd-2026-exam-pattern' },
    { label: 'SSC GD Salary 2026', href: '/ssc-gd-2026-salary' },
    { label: 'SSC CGL Syllabus 2026', href: '/ssc-cgl-2026-syllabus' },
  ],
};

export const sscGdExamPattern: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-exam-pattern',
  pageType: 'exam-pattern',
  metaTitle: 'SSC GD Exam Pattern 2026 – CBE & PET Details',
  metaDescription: 'SSC GD Constable 2026 exam pattern for CBE, PET, PST. Check marking scheme, number of questions, duration, negative marking and physical test details.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC GD Constable Exam Pattern 2026 – CBE, PET & PST Complete Details',

  overview: `<p>The <strong>SSC GD Constable 2026 exam pattern</strong> consists of four stages: Computer Based Examination (CBE), Physical Efficiency Test (PET), Physical Standard Test (PST), and Medical Examination. Understanding each stage is critical as candidates must clear every stage sequentially — failure at any stage results in elimination.</p>

<p>The <strong>Computer Based Examination (CBE)</strong> is the first screening stage. It consists of 80 objective-type MCQs carrying 160 marks, to be completed in 60 minutes. The four sections are General Intelligence & Reasoning (20 questions, 40 marks), General Knowledge & General Awareness (20 questions, 40 marks), Elementary Mathematics (20 questions, 40 marks), and English/Hindi (20 questions, 40 marks). Negative marking is 0.50 marks per wrong answer. Questions are at 10th standard difficulty level.</p>

<p>Unlike SSC CGL/CHSL where there are separate tiers, <strong>SSC GD has only one written exam</strong>. The CBE score (after normalisation across shifts) determines which candidates proceed to PET/PST. Typically, candidates scoring 120+ out of 160 have a strong chance of clearing the CBE cut-off, though exact cut-offs vary by category and year.</p>

<p>The <strong>Physical Efficiency Test (PET)</strong> is the second stage and is qualifying in nature. Male candidates must complete a 2.4 km race within 8 minutes 30 seconds (under 30 years) or 9 minutes (30–32 years). Female candidates must complete a 1.6 km race within 5 minutes 45 seconds (under 30 years) or 6 minutes (30–32 years). For Ladakh and high-altitude regions, relaxed timings apply. Candidates who fail to complete the race within the stipulated time are eliminated.</p>

<p>The <strong>Physical Standard Test (PST)</strong> measures height and chest (for males). Male General/OBC/SC candidates require 170 cm height and 80 cm chest (85 cm expanded). Male ST candidates require 162.5 cm height and 76 cm chest (81 cm expanded). Female General/OBC/SC candidates require 157 cm height, and Female ST candidates require 150 cm height. Regional relaxations apply for candidates from hill areas, Gorkhas, Assam, and North-Eastern states.</p>

<p>The <strong>Medical Examination</strong> is the final stage. Candidates undergo a detailed medical exam checking eyesight (6/6 without glasses for CAPFs), hearing, general physical and mental fitness, and absence of flat feet, knock knees, and other conditions that may affect duty performance. Candidates declared medically unfit can request a Review Medical Examination (RME) within 15 days. The medical standards are strict for armed forces — prepare your health well in advance.</p>

<p>Key strategy: Since PET/PST is qualifying and CBE score determines merit, candidates should prioritise CBE preparation. However, start physical training (running, height-related exercises) at least 3 months before PET to avoid elimination at this stage. Many CBE-qualified candidates fail in PET due to inadequate physical preparation.</p>`,

  examPattern: [
    {
      stageName: 'Computer Based Examination (CBE)',
      rows: [
        { subject: 'General Intelligence & Reasoning', questions: 20, marks: 40, duration: '60 min (combined)', negativeMarking: '0.50 per wrong answer' },
        { subject: 'General Knowledge & General Awareness', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'Elementary Mathematics', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
        { subject: 'English / Hindi', questions: 20, marks: 40, duration: '—', negativeMarking: '0.50 per wrong answer' },
      ],
    },
  ],

  faqs: [
    { question: 'What is the SSC GD 2026 exam pattern?', answer: 'SSC GD has 4 stages: CBE (80 MCQs, 160 marks, 60 min), PET (race), PST (height/chest), and Medical. CBE score determines merit; other stages are qualifying.' },
    { question: 'How many questions are there in SSC GD exam?', answer: '80 questions carrying 160 marks across 4 sections, to be completed in 60 minutes. Each section has 20 questions worth 40 marks.' },
    { question: 'What is the running requirement for SSC GD PET?', answer: 'Male: 2.4 km in 8 min 30 sec (under 30 years). Female: 1.6 km in 5 min 45 sec (under 30 years). Relaxed timings for older candidates and high-altitude regions.' },
    { question: 'Is there negative marking in SSC GD?', answer: 'Yes, 0.50 marks are deducted for every wrong answer in the CBE. With 160 total marks, avoiding negative marking is crucial for a good score.' },
    { question: 'What is the height requirement for SSC GD male?', answer: 'Male General/OBC/SC: 170 cm height, 80 cm chest (85 cm expanded). Male ST: 162.5 cm height, 76 cm chest (81 cm expanded). Regional relaxations apply for hill areas.' },
  ],

  relatedExams: [
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
    { label: 'SSC GD Syllabus 2026', href: '/ssc-gd-2026-syllabus' },
    { label: 'SSC GD Salary 2026', href: '/ssc-gd-2026-salary' },
    { label: 'SSC CPO Exam Pattern 2026', href: '/ssc-cpo-2026-exam-pattern' },
  ],
};

export const sscGdEligibility: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-eligibility',
  pageType: 'eligibility',
  metaTitle: 'SSC GD Eligibility 2026 – Age, Height, Fitness',
  metaDescription: 'Check SSC GD Constable 2026 eligibility: age limit 18-23, 10th pass, physical standards for height, chest, and medical fitness requirements.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC GD Constable Eligibility 2026 – Age, Qualification & Physical Standards',

  overview: `<p>The <strong>SSC GD Constable 2026 eligibility criteria</strong> include educational qualification, age limit, physical standards, and medical fitness — all of which must be met. Unlike desk-based government jobs, GD Constable is a uniformed armed position requiring physical fitness, making the eligibility criteria more comprehensive than exams like SSC CGL or CHSL.</p>

<p>The basic educational qualification is <strong>10th Standard (Matriculation) pass</strong> or equivalent from a recognised Board. This makes SSC GD accessible to a very large candidate pool. Candidates who have completed higher education (12th, graduation, etc.) are also eligible — there is no upper qualification limit. The certificate/mark sheet must be available at the time of document verification.</p>

<p>The <strong>age limit</strong> is <strong>18–23 years</strong> as on 1st January 2026. This is one of the strictest age brackets among SSC exams. Age relaxation is provided as per government rules: SC/ST candidates get 5 years, OBC (Non-Creamy Layer) candidates get 3 years, and Ex-Servicemen get relaxation equivalent to military service plus 3 years. PwD candidates are not eligible for GD Constable posts due to the physical nature of the job.</p>

<p><strong>Physical standards</strong> are critical and vary by gender, category, and region:</p>
<p><strong>Male candidates — General/OBC/SC:</strong> Minimum height 170 cm, chest 80 cm (unexpanded) / 85 cm (expanded), i.e., 5 cm expansion required. <strong>Male ST:</strong> Minimum height 162.5 cm, chest 76 cm (unexpanded) / 81 cm (expanded). <strong>Male candidates from hill areas</strong> (Gorkhas, Kumaonis, Garhwalis, Dogras, Marathas, Assam/NE states): Minimum height 165 cm.</p>

<p><strong>Female candidates — General/OBC/SC:</strong> Minimum height 157 cm. <strong>Female ST:</strong> Minimum height 150 cm. <strong>Female from hill areas/NE states:</strong> Minimum height 155 cm. There is no chest measurement requirement for female candidates.</p>

<p><strong>Medical fitness</strong> standards include: Eyesight must be 6/6 (distant vision) and 0.6 (near vision) without glasses — spectacle-wearing candidates are not eligible. Candidates must not have flat feet, knock knees, varicose veins, or any physical deformity. Hearing must be normal in both ears. Candidates must be free from any mental or communicable disease. Color blindness is also a disqualification criterion.</p>

<p><strong>Nationality:</strong> Candidate must be a citizen of India. For posts in Assam Rifles, only male Indian citizens are eligible. Certain posts may have domicile requirements as specified in the notification.</p>

<p>Candidates currently serving in CAPFs or other government positions can apply but must submit their application through proper channel and produce NOC during document verification. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify your age eligibility.</p>`,

  eligibility: `<p>Summary of SSC GD 2026 eligibility:</p>
<h3>Educational Qualification</h3>
<ul><li>10th Standard (Matriculation) pass or equivalent</li></ul>
<h3>Age Limit (as on 01-01-2026)</h3>
<ul><li>18–23 years</li></ul>
<h3>Physical Standards (Male Gen/OBC/SC)</h3>
<ul><li>Height: 170 cm | Chest: 80/85 cm</li></ul>
<h3>Physical Standards (Female Gen/OBC/SC)</h3>
<ul><li>Height: 157 cm</li></ul>
<h3>Medical</h3>
<ul><li>Eyesight: 6/6 without glasses | No flat feet, no color blindness</li></ul>`,

  faqs: [
    { question: 'What is the minimum qualification for SSC GD?', answer: '10th Standard (Matriculation) pass or equivalent from a recognised Board is the minimum qualification. Higher education is also accepted.' },
    { question: 'What is the age limit for SSC GD 2026?', answer: '18–23 years as on 01-01-2026. SC/ST get 5 years relaxation, OBC gets 3 years. No PwD reservation for GD Constable posts.' },
    { question: 'Can spectacle-wearing candidates apply for SSC GD?', answer: 'No, eyesight must be 6/6 (distant vision) without glasses. Candidates who wear spectacles or contact lenses for 6/6 vision are not eligible.' },
    { question: 'Is there chest measurement for female SSC GD candidates?', answer: 'No, chest measurement is only for male candidates. Female candidates only need to meet the height requirement (157 cm General, 150 cm ST).' },
    { question: 'What if I am slightly below the height requirement?', answer: 'SSC does not allow any relaxation beyond the category-wise minimums. If you are even 0.5 cm below the required height, your candidature will be cancelled during PST.' },
  ],

  relatedExams: [
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
    { label: 'SSC GD Syllabus 2026', href: '/ssc-gd-2026-syllabus' },
    { label: 'SSC GD Salary 2026', href: '/ssc-gd-2026-salary' },
    { label: 'SSC CPO Eligibility 2026', href: '/ssc-cpo-2026-eligibility' },
  ],
};

export const sscGdSalary: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-salary',
  pageType: 'salary',
  metaTitle: 'SSC GD Salary 2026 – Pay, Allowances & Perks',
  metaDescription: 'SSC GD Constable 2026 salary at Pay Level 3. Check basic pay ₹21,700, gross salary, in-hand salary, allowances, free accommodation & other perks.',
  lastUpdated: '2026-03-04',
  datePublished: '2026-01-20',

  h1: 'SSC GD Constable Salary 2026 – Pay Scale, Allowances & In-Hand Salary',

  overview: `<p>The <strong>SSC GD Constable 2026 salary</strong> follows the 7th Central Pay Commission (7th CPC) structure. GD Constables are posted in Central Armed Police Forces (CAPFs) which offer not just competitive salaries but a comprehensive lifestyle package including free accommodation, ration, medical facilities, and canteen benefits that significantly enhance the effective compensation.</p>

<p>SSC GD Constable posts are at <strong>Pay Level 3</strong> with a basic pay range of <strong>₹21,700–₹69,100</strong> per month. The starting basic pay of ₹21,700 is higher than the LDC post (Pay Level 2, ₹19,900) in SSC CHSL, reflecting the demanding nature of paramilitary duty. Annual increments of 3% of basic pay ensure steady salary growth throughout the career.</p>

<p>The <strong>gross monthly salary</strong> for a GD Constable includes: Basic Pay ₹21,700 + Dearness Allowance (approximately 50% of basic, i.e., ₹10,850) + House Rent Allowance (if not provided quarters) + Transport Allowance + Uniform Allowance + Risk & Hardship Allowance. However, since most CAPFs provide <strong>free accommodation in camps/barracks</strong>, the HRA component is typically replaced by free housing. The effective gross salary including monetised benefits ranges from ₹30,000 to ₹45,000 per month.</p>

<p><strong>Unique CAPF benefits</strong> beyond basic salary include: Free furnished accommodation in camps (significant saving of ₹8,000–₹15,000 per month in rent), free ration or ration money allowance (₹3,000–₹5,000 monthly value), free medical treatment for self and family at CAPF hospitals and empanelled civilian hospitals, subsidised canteen facilities (CSD canteen access), free uniform and equipment, and Leave Travel Concession (LTC) for travel to home town. These non-monetary benefits effectively double the value of the salary package.</p>

<p><strong>Career progression</strong> for GD Constables follows a structured promotion path: Constable → Head Constable (Pay Level 4, ₹25,500) → Assistant Sub-Inspector (Pay Level 5, ₹29,200) → Sub-Inspector (Pay Level 6, ₹35,400) → Inspector (Pay Level 7, ₹44,900). Promotions are based on seniority and departmental exams. Additionally, the MACP (Modified Assured Career Progression) scheme guarantees three financial upgrades at 10, 20, and 30 years of service. Many constables also appear for SSC CPO or departmental exams to accelerate their promotion to Sub-Inspector or Inspector level.</p>

<p><strong>Retirement benefits</strong> include National Pension System (NPS) with 14% employer contribution, Gratuity (after 5 years of service), Leave Encashment (up to 300 days of earned leave), CGEGIS (Central Government Employees Group Insurance Scheme), and Ex-Servicemen status (after completing minimum qualifying service). The pension corpus built through NPS over 25–30 years of service typically yields a monthly pension of ₹25,000–₹40,000.</p>

<p>Compared to private sector jobs available to 10th-pass candidates (typically ₹8,000–₹15,000 per month without benefits), the SSC GD Constable package with all benefits, job security, and career progression is significantly superior. The total effective compensation, including housing and medical benefits, is equivalent to ₹50,000–₹65,000 per month in the private sector.</p>`,

  salary: {
    salaryMin: 21700,
    salaryMax: 69100,
    payLevels: 'Pay Level 3',
    grossRange: '₹30,000 – ₹45,000 per month',
    netRange: '₹26,000 – ₹38,000 per month (approx.)',
    allowances: [
      'Dearness Allowance (DA) – approximately 50% of basic pay',
      'House Rent Allowance (HRA) or Free Accommodation in camp/barracks',
      'Ration Allowance or Free Ration (₹3,000–₹5,000 monthly value)',
      'Uniform Allowance – free uniforms and equipment',
      'Risk & Hardship Allowance – for difficult postings',
      'National Pension System (NPS) – 14% employer contribution',
      'Free Medical Facilities – CAPF hospitals + empanelled hospitals',
    ],
    postWiseSalary: [
      { post: 'Constable GD (BSF/CRPF/CISF/ITBP/SSB)', payLevel: 'Level 3', basicPay: '₹21,700 – ₹69,100' },
      { post: 'Constable GD (NIA/SSF)', payLevel: 'Level 3', basicPay: '₹21,700 – ₹69,100' },
      { post: 'Rifleman (Assam Rifles)', payLevel: 'Level 3', basicPay: '₹21,700 – ₹69,100' },
    ],
  },

  faqs: [
    { question: 'What is the starting salary of SSC GD Constable?', answer: 'Starting basic pay is ₹21,700 (Pay Level 3). With all allowances and benefits, the gross salary is approximately ₹30,000–₹35,000 per month plus free accommodation and ration.' },
    { question: 'Do SSC GD Constables get free accommodation?', answer: 'Yes, most CAPFs provide free furnished accommodation in camps/barracks. If quarters are not available, HRA is provided instead (8–24% of basic pay based on city).' },
    { question: 'What is the promotion path for GD Constable?', answer: 'Constable → Head Constable (Level 4) → ASI (Level 5) → SI (Level 6) → Inspector (Level 7). MACP scheme guarantees 3 financial upgrades at 10, 20, 30 years.' },
    { question: 'Is SSC GD salary higher than CHSL LDC?', answer: 'Yes, GD Constable is at Pay Level 3 (₹21,700) while LDC is at Pay Level 2 (₹19,900). Additionally, GD Constables get free accommodation and ration, making the effective package higher.' },
    { question: 'Do SSC GD employees get pension?', answer: 'Employees appointed after 2004 are covered under NPS with 14% employer contribution. The accumulated corpus provides pension after retirement. Gratuity is also payable after 5 years.' },
  ],

  relatedExams: [
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
    { label: 'SSC GD Eligibility 2026', href: '/ssc-gd-2026-eligibility' },
    { label: 'SSC CGL Salary 2026', href: '/ssc-cgl-2026-salary' },
    { label: 'SSC CPO Salary 2026', href: '/ssc-cpo-2026-salary' },
  ],
};

export const sscGdCutoff: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-cutoff',
  pageType: 'cutoff',
  metaTitle: 'SSC GD Cutoff 2026 — Category-Wise Cut Off Marks',
  metaDescription: 'SSC GD Constable 2026 cutoff marks: category-wise CBE cut off for General, OBC, SC, ST. Previous year cutoff trends from 2022–2024.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',

  h1: 'SSC GD Constable Cutoff 2026 — Category-Wise Cut Off Marks & Previous Year Trends',

  overview: `<p>The <strong>SSC GD Constable Cutoff</strong> is the minimum qualifying score in the Computer Based Examination (CBE) required to advance to the Physical Efficiency Test (PET) and Physical Standard Test (PST) stages. The cutoff is determined after normalisation across multiple shifts and varies by category and force preference.</p>

<h3>SSC GD 2026 Expected Cutoff</h3>
<p>Based on trends from 2022–2024, the expected CBE cutoff for SSC GD 2026:</p>
<ul>
<li><strong>General (Male):</strong> 150–160 (normalised out of 160)</li>
<li><strong>OBC (Male):</strong> 135–145</li>
<li><strong>SC (Male):</strong> 122–132</li>
<li><strong>ST (Male):</strong> 110–120</li>
</ul>
<p>Female candidates generally have 2–5 marks lower cutoff than male candidates in the same category. The actual cutoff depends on vacancy count, paper difficulty, and number of candidates appeared.</p>

<h3>Cutoff Trend Analysis (2022–2024)</h3>
<p>The General category male cutoff has shown a steady increase: 143.11 in 2022 → 148.62 in 2023 → 152.75 in 2024. This upward trend reflects growing competition as SSC GD becomes increasingly popular among 10th-pass candidates. The OBC-General gap has remained stable at approximately 15 marks.</p>

<h3>Force-Wise Cutoff Variation</h3>
<p>While SSC declares a single qualifying cutoff, the final allocation cutoff varies by force. BSF and CRPF typically have the highest cutoff due to maximum vacancies, while ITBP and SSB may have slightly lower cutoffs. Candidates should list their force preferences strategically based on their expected score.</p>

<h3>Factors Affecting SSC GD Cutoff</h3>
<ul>
<li><strong>Number of Vacancies:</strong> SSC GD recruits 25,000–75,000 candidates per cycle. Higher vacancies lead to lower cutoff.</li>
<li><strong>Difficulty Level:</strong> Easier CBE papers result in higher cutoffs.</li>
<li><strong>Number of Candidates:</strong> SSC GD attracts 25–30 lakh candidates. Massive competition pushes cutoff higher.</li>
<li><strong>Normalisation:</strong> SSC normalises scores across shifts, which can change individual cutoffs significantly.</li>
</ul>

<p>Remember that clearing the CBE cutoff is only the first step — candidates must also pass PET, PST, and medical examination. For physical standards, see our <a href="/ssc-gd-2026-notification">SSC GD 2026 Notification</a> page. For salary information, visit <a href="/ssc-gd-2026-salary">SSC GD Salary 2026</a>.</p>`,

  cutoffs: [
    { year: 2024, category: 'General (Male)', cutoffScore: '152.75', totalMarks: '160' },
    { year: 2024, category: 'OBC (Male)', cutoffScore: '137.50', totalMarks: '160' },
    { year: 2024, category: 'SC (Male)', cutoffScore: '124.38', totalMarks: '160' },
    { year: 2024, category: 'ST (Male)', cutoffScore: '113.25', totalMarks: '160' },
    { year: 2024, category: 'General (Female)', cutoffScore: '148.10', totalMarks: '160' },
    { year: 2023, category: 'General (Male)', cutoffScore: '148.62', totalMarks: '160' },
    { year: 2023, category: 'OBC (Male)', cutoffScore: '133.87', totalMarks: '160' },
    { year: 2023, category: 'SC (Male)', cutoffScore: '121.24', totalMarks: '160' },
    { year: 2023, category: 'ST (Male)', cutoffScore: '110.37', totalMarks: '160' },
    { year: 2022, category: 'General (Male)', cutoffScore: '143.11', totalMarks: '160' },
    { year: 2022, category: 'OBC (Male)', cutoffScore: '129.86', totalMarks: '160' },
    { year: 2022, category: 'SC (Male)', cutoffScore: '118.12', totalMarks: '160' },
    { year: 2022, category: 'ST (Male)', cutoffScore: '107.64', totalMarks: '160' },
  ],

  faqs: [
    { question: 'What is the SSC GD 2026 expected cutoff?', answer: 'The expected General category male cutoff is 150–160 marks out of 160 (normalised). OBC is expected around 135–145, SC around 122–132, and ST around 110–120.' },
    { question: 'Is SSC GD cutoff different for male and female?', answer: 'Yes, female candidates generally have 2–5 marks lower cutoff than male candidates in the same category due to separate merit lists.' },
    { question: 'What score should I target in SSC GD CBE?', answer: 'Aim for 130+ raw marks out of 160 to be safe for General category. After normalisation, this typically converts to a qualifying score.' },
    { question: 'Does SSC GD have separate cutoff for each force?', answer: 'CBE has a single qualifying cutoff. However, final force allocation depends on your rank, preferences, and force-wise vacancies.' },
    { question: 'How does normalisation affect SSC GD cutoff?', answer: 'SSC normalises scores across multiple shifts using a statistical formula. Your normalised score determines qualification, not your raw score.' },
  ],

  relatedExams: [
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
    { label: 'SSC GD Syllabus 2026', href: '/ssc-gd-2026-syllabus' },
    { label: 'SSC GD Salary 2026', href: '/ssc-gd-2026-salary' },
    { label: 'SSC CGL Cutoff 2026', href: '/ssc-cgl-2026-cutoff' },
  ],
};

export const sscGdAgeLimit: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'ssc-gd-2026-age-limit',
  pageType: 'age-limit',
  metaTitle: 'SSC GD Age Limit 2026 — Requirements & Relaxation',
  metaDescription: 'SSC GD Constable 2026 age limit: 18–23 years for General. Category-wise relaxation for SC/ST/OBC/PwD and force-wise physical standards.',
  lastUpdated: '2026-03-08',
  datePublished: '2026-01-20',

  h1: 'SSC GD Constable Age Limit 2026 — Requirements & Category-Wise Relaxation',

  overview: `<p>The <strong>SSC GD Constable Age Limit</strong> is one of the most important eligibility criteria for this recruitment. Unlike SSC CGL or CHSL which have different age limits for different posts, SSC GD has a uniform age limit of <strong>18–23 years</strong> for all forces, with standard category-wise relaxation. This page provides a complete breakdown to help you verify your eligibility.</p>

<h3>SSC GD 2026 Age Limit</h3>
<p>Age is calculated as on <strong>1st January 2026</strong>:</p>
<ul>
<li><strong>Minimum Age:</strong> 18 years (born on or before 01-01-2008)</li>
<li><strong>Maximum Age (General):</strong> 23 years (born on or after 02-01-2003)</li>
</ul>
<p>This applies uniformly to all CAPFs (BSF, CRPF, CISF, ITBP, SSB), NIA, SSF, and Assam Rifles.</p>

<h3>Category-Wise Age Relaxation</h3>
<ul>
<li><strong>SC/ST:</strong> 5 years (effective upper limit: 28 years)</li>
<li><strong>OBC (Non-Creamy Layer):</strong> 3 years (effective upper limit: 26 years)</li>
<li><strong>Ex-Servicemen:</strong> 3 years after deduction of military service rendered</li>
<li><strong>J&K Domicile (1980–1989):</strong> 5 years</li>
</ul>
<p>Note: Unlike SSC CGL/CHSL, there is no PwBD category reservation for SSC GD as these are combat/field posts requiring physical fitness.</p>

<h3>Effective Upper Age Limit After Relaxation</h3>
<ul>
<li><strong>General:</strong> 23 years | <strong>OBC:</strong> 26 years | <strong>SC/ST:</strong> 28 years</li>
</ul>

<h3>Why SSC GD Has a Lower Age Limit</h3>
<p>SSC GD recruits for paramilitary and border security forces where physical fitness and endurance are critical. The 18–23 age bracket ensures candidates are at peak physical fitness for the demanding PET (5 km race, long jump, high jump) and the rigorous training that follows recruitment. Candidates older than 23 (General) are unlikely to complete the intense 9–12 month basic training programme.</p>

<h3>How to Calculate Your Eligibility</h3>
<ol>
<li>Note your date of birth from your 10th class certificate</li>
<li>Calculate your age on 1 January 2026</li>
<li>Add applicable category relaxation to the upper limit of 23</li>
<li>Verify you are at least 18 years old on the cutoff date</li>
</ol>
<p>For example, a General category male born on 15 March 2003 would be 22 years 9 months on 1 January 2026 — eligible. But if born on 15 March 2002 (23 years 9 months), they would be over-age.</p>

<p>Use our <a href="/govt-job-age-calculator">Age Calculator for Government Jobs</a> to instantly check your SSC GD eligibility with automatic category relaxation.</p>

<h3>Physical Standards (Separate from Age)</h3>
<p>In addition to age, candidates must meet physical standards during PST. These are separate from age requirements but equally important:</p>
<ul>
<li><strong>Male (General/OBC/SC):</strong> Height 170 cm, Chest 80/85 cm</li>
<li><strong>Male (ST):</strong> Height 162.5 cm, Chest 76/81 cm</li>
<li><strong>Female (General/OBC/SC):</strong> Height 157 cm</li>
<li><strong>Female (ST):</strong> Height 150 cm</li>
</ul>`,

  eligibility: `<h3>Age Limit Summary (as on 01-01-2026)</h3>
<ul>
<li><strong>All Posts:</strong> 18–23 years (General), 18–26 (OBC), 18–28 (SC/ST)</li>
</ul>`,

  faqs: [
    { question: 'What is the age limit for SSC GD 2026?', answer: '18–23 years for General category. OBC gets 3 years relaxation (up to 26), SC/ST get 5 years (up to 28). Age is calculated as on 1 January 2026.' },
    { question: 'Is there age relaxation for OBC in SSC GD?', answer: 'Yes, OBC (Non-Creamy Layer) candidates get 3 years relaxation, making the effective upper age limit 26 years instead of 23.' },
    { question: 'Why is SSC GD age limit lower than SSC CGL?', answer: 'SSC GD recruits for paramilitary forces requiring peak physical fitness. The 18–23 bracket ensures candidates can complete demanding physical training. SSC CGL recruits for desk-based government posts.' },
    { question: 'Can a 24-year-old General candidate apply for SSC GD?', answer: 'No, General category candidates above 23 years cannot apply for SSC GD. Only reserved category candidates with age relaxation may be eligible at 24.' },
    { question: 'Is there PwBD reservation in SSC GD?', answer: 'No, SSC GD does not have PwBD reservation as these are combat/field posts in CAPFs requiring full physical fitness.' },
  ],

  relatedExams: [
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
    { label: 'SSC GD Eligibility 2026', href: '/ssc-gd-2026-eligibility' },
    { label: 'SSC GD Salary 2026', href: '/ssc-gd-2026-salary' },
    { label: 'SSC CGL Age Limit 2026', href: '/ssc-cgl-2026-age-limit' },
    { label: 'Age Calculator', href: '/govt-job-age-calculator' },
  ],
};

export const SSC_GD_CONFIGS: ExamAuthorityConfig[] = [
  sscGdNotification,
  sscGdSyllabus,
  sscGdExamPattern,
  sscGdEligibility,
  sscGdSalary,
  sscGdCutoff,
  sscGdAgeLimit,
];
