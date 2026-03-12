import type { ExamAuthorityConfig } from './types';

const COMMON = {
  departmentSlug: 'defence-jobs' as const,
  examName: 'Agniveer',
  examYear: 2026,
  conductingBody: 'Ministry of Defence, Government of India',
  officialWebsite: 'joinindianarmy.nic.in',
  datePublished: '2026-01-25',
  lastUpdated: '2026-03-07',
};

const RELATED = [
  { label: 'NDA 2026 Notification', href: '/nda-2026-notification' },
  { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
  { label: 'Railway Group D 2026 Notification', href: '/railway-group-d-2026-notification' },
  { label: 'SSC MTS 2026 Notification', href: '/ssc-mts-2026-notification' },
  { label: 'Agniveer 2026 Syllabus', href: '/agniveer-2026-syllabus' },
];

const notification: ExamAuthorityConfig = {
  ...COMMON,
  slug: 'agniveer-2026-notification',
  pageType: 'notification',
  metaTitle: 'Agniveer 2026 Notification — Army/Navy/Air Force',
  metaDescription: 'Agniveer 2026 Notification out. Check vacancies, eligibility for Agnipath scheme recruitment in Indian Army, Navy and Air Force. Apply online.',
  h1: 'Agniveer 2026 Notification — Agnipath Scheme Recruitment Details & How to Apply',
  totalVacancies: 46000,
  applicationEndDate: '2026-04-30',
  applyLink: 'https://joinindianarmy.nic.in',
  overview: `<p>The Ministry of Defence has released the <strong>Agniveer 2026 Notification</strong> under the <strong>Agnipath Scheme</strong> for recruitment into the Indian Armed Forces — Army, Navy, and Air Force. Approximately <strong>46,000 vacancies</strong> are available across all three services for a 4-year engagement period.</p>
<p>The Agnipath scheme, introduced in 2022, provides young Indians an opportunity to serve in the armed forces for 4 years. After the engagement, up to 25% of Agniveers are retained for regular service (15 years), while the remaining receive a tax-free Seva Nidhi package of approximately ₹11.71 lakh and priority in government job recruitment.</p>
<h3>Key Highlights</h3>
<table><tr><th>Detail</th><th>Information</th></tr><tr><td>Conducting Body</td><td>Ministry of Defence</td></tr><tr><td>Scheme</td><td>Agnipath Recruitment Scheme</td></tr><tr><td>Services</td><td>Indian Army, Navy, Air Force</td></tr><tr><td>Total Vacancies</td><td>~46,000 (all services combined)</td></tr><tr><td>Engagement Period</td><td>4 years</td></tr><tr><td>Retention</td><td>Up to 25% absorbed in regular cadre</td></tr></table>
<p>Agniveer recruitment is conducted through rally-based selection (Army) and online examinations (Navy/Air Force). The Army conducts rallies at designated centres across states, while Navy and Air Force hold computer-based tests followed by physical and medical examinations.</p>
<p>The monthly salary for Agniveers starts at ₹30,000 in the first year and increases to ₹40,000 by the fourth year. Additionally, 30% of the salary is contributed to the Agniveer Corpus Fund (with matching government contribution), resulting in a substantial lump sum at the end of service. Agniveers also receive life insurance cover of ₹48 lakh.</p>`,
  dates: [
    { label: 'Notification Release', date: '2026-01-25' },
    { label: 'Online Application Start', date: '2026-02-01' },
    { label: 'Application Last Date', date: '2026-04-30' },
    { label: 'Army Rally Dates', date: 'March–June 2026 (zone-wise)' },
    { label: 'Navy/Air Force CBT', date: 'May–July 2026' },
    { label: 'Training Commencement', date: 'October 2026' },
  ],
  eligibility: `<h3>Educational Qualification</h3><p><strong>Agniveer (General Duty):</strong> 10th pass (Class X) with minimum 33% aggregate and 33% in each subject<br><strong>Agniveer (Technical):</strong> 12th pass with Physics, Chemistry, Maths with 50% aggregate<br><strong>Agniveer (Clerk/Store Keeper):</strong> 12th pass with 60% aggregate and 50% in each subject<br><strong>Agniveer (Tradesman):</strong> 10th pass / 8th pass (for specific trades)</p><h3>Age Limit</h3><p>17.5 to 21 years as on the date of enrollment</p><h3>Physical Standards</h3><p>Height: 170 cm (Gen) / relaxed for hill and tribal areas | Weight: proportionate to height | Chest: 77 cm (expanded 82 cm) | Vision: 6/6 distant vision</p><h3>Marital Status</h3><p>Must be unmarried at the time of enrollment</p>`,
  feeStructure: { general: 0, obc: 0, scSt: 0, female: 0, ph: 0, paymentModes: ['No application fee — free registration'] },
  selectionProcess: [
    'Online Registration and Application',
    'Written Test (Online CBT) / Rally Selection (Army)',
    'Physical Fitness Test (PFT) — running, beam, push-ups, sit-ups',
    'Physical Measurement Test (height, weight, chest)',
    'Medical Examination — detailed medical screening',
    'Document Verification',
    'Merit List and Enrollment',
  ],
  examPattern: [
    { stageName: 'Army Agniveer CBT (GD)', rows: [
      { subject: 'General Knowledge', questions: 30, marks: 30, duration: '60 minutes', negativeMarking: '0.5 per wrong answer' },
      { subject: 'General Science', questions: 20, marks: 20, duration: 'Combined', negativeMarking: '0.5 per wrong answer' },
      { subject: 'Mathematics', questions: 20, marks: 20, duration: 'Combined', negativeMarking: '0.5 per wrong answer' },
      { subject: 'Logical Reasoning', questions: 10, marks: 10, duration: 'Combined', negativeMarking: '0.5 per wrong answer' },
    ]},
  ],
  salary: {
    salaryMin: 30000, salaryMax: 40000, payLevels: 'Agniveer Customized Package',
    grossRange: '₹30,000 – ₹40,000', netRange: '₹21,000 – ₹28,000',
    allowances: ['Risk and Hardship Allowance', 'Ration in Kind', 'Dress/Kit Allowance', 'Travel Allowance', 'Life Insurance (₹48 lakh)', 'Seva Nidhi Corpus Fund', 'Free Medical for self'],
    postWiseSalary: [
      { post: 'Agniveer (1st Year)', payLevel: 'Custom', basicPay: '₹30,000' },
      { post: 'Agniveer (2nd Year)', payLevel: 'Custom', basicPay: '₹33,000' },
      { post: 'Agniveer (3rd Year)', payLevel: 'Custom', basicPay: '₹36,500' },
      { post: 'Agniveer (4th Year)', payLevel: 'Custom', basicPay: '₹40,000' },
    ],
  },
  howToApply: [
    'Visit joinindianarmy.nic.in (Army) / joinindiannavy.gov.in (Navy) / agnipathvayu.cdac.in (Air Force)',
    'Register with Aadhaar-linked mobile and email',
    'Fill personal, educational, and physical details',
    'Upload photograph, signature, and educational certificates',
    'Select rally/exam centre preference and trade/category',
    'Submit application — no fee required',
    'Download admit card when released for rally/CBT',
  ],
  faqs: [
    { question: 'What is the Agnipath scheme?', answer: 'A 4-year military recruitment scheme where youth serve as Agniveers. Up to 25% are retained permanently, rest get Seva Nidhi (₹11.71 lakh) and job priority.' },
    { question: 'What is the Agniveer salary?', answer: '₹30,000 in 1st year, increasing to ₹40,000 in 4th year. 30% goes to Seva Nidhi corpus with government matching.' },
    { question: 'What is Seva Nidhi?', answer: 'A tax-free lump sum of approximately ₹11.71 lakh paid after completing the 4-year engagement (employee + government contribution with interest).' },
    { question: 'Is there a written exam for Agniveer?', answer: 'Yes, an online CBT is conducted. For Army, it may be rally-based with written test. Navy/Air Force use online CBT primarily.' },
    { question: 'What is the age limit for Agniveer?', answer: '17.5 to 21 years. Candidates must be unmarried at the time of enrollment.' },
    { question: 'Do Agniveers get life insurance?', answer: 'Yes, ₹48 lakh life insurance coverage is provided by the government during the 4-year service period.' },
  ],
  admitCardInfo: {
    releaseDate: 'To Be Announced',
    downloadUrl: 'https://joinindianarmy.nic.in',
    instructions: [
      'Visit joinindianarmy.nic.in (Army), joinindiannavy.gov.in (Navy), or agnipathvayu.cdac.in (Air Force)',
      'Click on "Download Admit Card" or "Rally Admit Card" link for Agniveer 2026',
      'Log in with your Registration Number and Date of Birth',
      'Download and print the admit card on A4 paper',
      'Carry the printed admit card along with original educational certificates to the rally/exam centre',
      'Carry one valid photo ID proof: Aadhaar Card, Passport, Voter ID, Driving Licence, or PAN Card — candidates without both documents will not be permitted to enter',
    ],
  },
  resultInfo: {
    resultDate: 'To Be Announced',
    resultUrl: 'https://joinindianarmy.nic.in',
    meritListUrl: 'https://joinindianarmy.nic.in',
    nextSteps: [
      'Check rally results on joinindianarmy.nic.in — zone-wise merit lists are published for Army; Navy and Air Force publish results on their respective portals',
      'Agniveer selection does not use normalisation — merit is based on direct CBT scores and rally performance',
      'Download your result/score card from the respective service portal after result declaration',
      'Qualified candidates will be called for Medical Examination at designated military hospitals',
      'Final enrollment list is prepared based on combined merit of CBT + physical fitness and published on the official portal',
    ],
  },
  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2022, category: 'General', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2022, category: 'OBC', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2022, category: 'SC', cutoffScore: 'Not Available', totalMarks: '100' },
    { year: 2022, category: 'ST', cutoffScore: 'Not Available', totalMarks: '100' },
  ],
  relatedExams: RELATED,
};

const syllabus: ExamAuthorityConfig = {
  ...COMMON, slug: 'agniveer-2026-syllabus', pageType: 'syllabus',
  metaTitle: 'Agniveer 2026 Syllabus — Army/Navy/Air Force',
  metaDescription: 'Agniveer 2026 exam syllabus for Army GD, Technical, Clerk and Navy/Air Force. Subject-wise topics and preparation tips.',
  h1: 'Agniveer 2026 Syllabus — Category-wise Exam Topics for Army, Navy & Air Force',
  overview: `<p>The <strong>Agniveer 2026 Syllabus</strong> varies by category (GD, Technical, Clerk) and service branch. The Army CBT covers general subjects at 10th-12th level.</p>
<h3>Agniveer General Duty (GD) Syllabus</h3>
<p><strong>General Knowledge (30 marks):</strong> Current affairs, History of India, Geography, Indian Polity, Economy, Awards, Sports, Defence-related knowledge, Important Dates, UN/International organizations.</p>
<p><strong>General Science (20 marks):</strong> Physics (Force, Energy, Light, Sound, Electricity), Chemistry (Elements, Acids-Bases, Metals), Biology (Human Body, Nutrition, Diseases, Environment). NCERT Class 10 level.</p>
<p><strong>Mathematics (20 marks):</strong> Arithmetic (Number System, HCF-LCM, Fractions, Decimals, Percentage, Average, Ratio-Proportion, Profit-Loss, Interest, Time-Work-Distance), Basic Algebra, Mensuration, Geometry basics.</p>
<p><strong>Logical Reasoning (10 marks):</strong> Analogies, Coding-Decoding, Series, Classification, Blood Relations, Direction Sense, Missing Numbers.</p>
<h3>Agniveer Technical Syllabus</h3>
<p>In addition to GD subjects, Technical trade tests Physics, Chemistry, and Maths at 12th standard level with emphasis on applied science and basic engineering concepts.</p>
<h3>Agniveer Clerk/SKT Syllabus</h3>
<p>GK, General Science, Maths, Computer Science basics, and English Language (grammar, comprehension, vocabulary). Higher emphasis on English and computer skills for clerical roles.</p>`,
  syllabusSummary: `<ul><li><strong>GD:</strong> GK (30), Science (20), Maths (20), Reasoning (10) — 10th level</li><li><strong>Technical:</strong> GK, Science (PCM at 12th level), Engineering basics</li><li><strong>Clerk:</strong> GK, Science, Maths, English, Computer Basics</li></ul>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'What is the exam level for Agniveer GD?', answer: '10th standard (NCERT) level for GD category. Technical requires 12th level PCM knowledge.' },
    { question: 'Is English in the Agniveer exam?', answer: 'English is specifically tested in Clerk/SKT category. GD may have English-medium questions but no separate English section.' },
    { question: 'Are defence-related questions asked?', answer: 'Yes, GK section includes questions on Indian Army/Navy/Air Force, defence exercises, military operations, and defence terminology.' },
    { question: 'Which books for Agniveer preparation?', answer: 'NCERT Class 9-10 for GD, Class 11-12 PCM for Technical, Lucent GK, and Arihant Agniveer guide books.' },
    { question: 'Is computer knowledge tested?', answer: 'Yes, for Clerk/SKT category — basic computer concepts, MS Office, internet, and networking fundamentals.' },
  ],
  relatedExams: RELATED,
};

const examPatternCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'agniveer-2026-exam-pattern', pageType: 'exam-pattern',
  metaTitle: 'Agniveer 2026 Exam Pattern — CBT & Physical',
  metaDescription: 'Agniveer 2026 exam pattern. CBT structure, marks, time, physical fitness test standards for Army, Navy and Air Force Agniveer.',
  h1: 'Agniveer 2026 Exam Pattern — CBT, Physical Fitness Test & Selection Process',
  overview: `<p>The <strong>Agniveer 2026 Exam Pattern</strong> combines written/online tests with physical fitness assessments. The process varies slightly between Army, Navy, and Air Force.</p>
<h3>Army Agniveer CBT</h3>
<p><strong>GD:</strong> 80 questions, 80 marks (some sources say different distributions by rally), 60 minutes. Sections: GK, General Science, Maths, Logical Reasoning. Negative marking of 0.5 per wrong answer.</p>
<p><strong>Technical:</strong> 80 questions with added Physics, Chemistry, Maths at 12th level.</p>
<p><strong>Clerk/SKT:</strong> Includes English and Computer Science sections in addition to GD subjects.</p>
<h3>Physical Fitness Test (PFT)</h3>
<p><strong>1.6 km Run:</strong> Group I (≤5:30 min) = 60 marks, Group II (5:31-5:45) = 48 marks. Above 5:45 = fail.<br><strong>Pull-ups (Beam):</strong> 10 = 40 marks, 9 = 33 marks, decreasing per pull-up. Minimum 6.<br><strong>Balance:</strong> On zig-zag beam — qualifying.<br><strong>9 Feet Ditch:</strong> Jump across — qualifying.</p>
<h3>Medical Examination</h3>
<p>Detailed medical screening at military hospitals. Vision (6/6 for many trades), hearing, general physical fitness, dental check, and no flat feet/knock knees. Temporary rejection allows re-examination within specified period.</p>`,
  examPattern: notification.examPattern,
  faqs: [
    { question: 'How many questions in Agniveer exam?', answer: 'Approximately 80 questions in 60 minutes for Army GD. Distribution varies by category and service branch.' },
    { question: 'What is the running time for PFT?', answer: '1.6 km must be completed within 5:45 minutes. Under 5:30 gets maximum 60 marks.' },
    { question: 'How many pull-ups are needed?', answer: 'Minimum 6 pull-ups. Maximum marks (40) for 10 pull-ups on the beam.' },
    { question: 'Is there negative marking?', answer: 'Yes, 0.5 marks deducted per wrong answer in the CBT.' },
    { question: 'What if I fail the medical?', answer: 'Temporary medical rejection allows review/re-examination. Permanent conditions like flat feet lead to permanent rejection.' },
  ],
  relatedExams: RELATED,
};

const eligibilityCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'agniveer-2026-eligibility', pageType: 'eligibility',
  metaTitle: 'Agniveer 2026 Eligibility — Age & Physical',
  metaDescription: 'Agniveer 2026 eligibility. Age limit 17.5-21, education (10th/12th), physical standards, marital status and medical requirements.',
  h1: 'Agniveer 2026 Eligibility — Age, Education, Physical Standards & Medical',
  overview: `<p>The <strong>Agniveer 2026 Eligibility</strong> has specific requirements for age, education, physical fitness, and marital status, varying by category and service.</p>
<h3>Age Limit</h3><p>17.5 to 21 years as on the date of enrollment. No age relaxation for any category — strictly enforced.</p>
<h3>Educational Qualification by Category</h3>
<p><strong>GD (All Arms):</strong> 10th pass with 33% aggregate and 33% in each subject | <strong>Technical:</strong> 12th pass with PCM, 50% aggregate | <strong>Clerk/SKT:</strong> 12th pass with 60% aggregate, 50% each subject | <strong>Tradesman (8th/10th):</strong> Specific trade-wise requirements</p>
<h3>Physical Standards</h3>
<p>Height: 170 cm minimum for most regions (relaxed for hill/tribal areas) | Weight: proportionate (BMI-based) | Chest: 77 cm unexpanded, 82 cm expanded (5 cm expansion) | Vision: varies by trade (6/6 to 6/12) | Hearing: normal</p>
<h3>Marital Status</h3><p>Must be <strong>unmarried</strong> at the time of enrollment. Married candidates are not eligible.</p>
<h3>Other Requirements</h3><p>Must be an Indian citizen. No criminal record. Domicile certificate from home state required for state-allocated rally centres. Must carry Aadhaar card for biometric verification.</p>`,
  eligibility: `<h3>Age</h3><p>17.5 to 21 years — no relaxation for any category</p><h3>Education</h3><p>GD: 10th pass | Technical: 12th PCM | Clerk: 12th 60%</p><h3>Physical</h3><p>Height 170 cm, Chest 77/82 cm, Vision 6/6</p><h3>Marital Status</h3><p>Must be unmarried</p>`,
  faqs: [
    { question: 'Is there age relaxation for SC/ST in Agniveer?', answer: 'No, there is no age relaxation for any category. The age limit is strictly 17.5-21 years for all candidates.' },
    { question: 'Can married persons apply?', answer: 'No, only unmarried candidates are eligible. Married applicants will be rejected.' },
    { question: 'What is the minimum height?', answer: '170 cm for most regions. Relaxed heights apply for candidates from hill areas and certain tribal communities.' },
    { question: 'Is 10th pass enough for Agniveer?', answer: 'Yes, for GD and Tradesman categories. Technical requires 12th with PCM. Clerk requires 12th with 60% marks.' },
    { question: 'Can women apply for Agniveer?', answer: 'Yes, women can apply for Agniveer in specific categories and services as notified.' },
  ],
  relatedExams: RELATED,
};

const salaryCfg: ExamAuthorityConfig = {
  ...COMMON, slug: 'agniveer-2026-salary', pageType: 'salary',
  metaTitle: 'Agniveer 2026 Salary — Pay & Seva Nidhi',
  metaDescription: 'Agniveer 2026 salary package. Year-wise pay, Seva Nidhi corpus, life insurance, allowances and post-service benefits explained.',
  h1: 'Agniveer 2026 Salary — Monthly Pay, Seva Nidhi Package & Benefits',
  overview: `<p>The <strong>Agniveer 2026 Salary</strong> follows a unique structure different from regular armed forces pay. The monthly package increases each year, with 30% contributed to the Seva Nidhi corpus fund.</p>
<h3>Year-wise Salary</h3>
<p>Year 1: ₹30,000/month (in-hand ₹21,000 after 30% Seva Nidhi deduction)<br>Year 2: ₹33,000/month (in-hand ₹23,100)<br>Year 3: ₹36,500/month (in-hand ₹25,550)<br>Year 4: ₹40,000/month (in-hand ₹28,000)</p>
<h3>Seva Nidhi Package</h3>
<p>30% of monthly salary is deducted and credited to the Seva Nidhi Fund. The government contributes an equal matching amount. After 4 years, with accrued interest, the total Seva Nidhi payout is approximately <strong>₹11.71 lakh (tax-free)</strong>. This is paid to Agniveers who are not retained in regular service.</p>
<h3>Insurance & Benefits During Service</h3>
<p>₹48 lakh non-contributory life insurance cover, free food/ration in kind, free accommodation in barracks, free medical treatment, dress/kit allowance, risk and hardship allowance based on posting, travel allowance for leave, and ex-gratia payment of ₹44 lakh in case of disability/death in service.</p>
<h3>Post-Service Benefits</h3>
<p>Agniveers completing 4 years receive: Seva Nidhi lump sum, Class XII equivalent certificate (for those who entered with 10th pass), skill certification, priority in CAPF/state police recruitment, reserved vacancies in central government jobs, and bank loan priority for entrepreneurship.</p>`,
  salary: {
    salaryMin: 30000, salaryMax: 40000, payLevels: 'Agniveer Customized Package',
    grossRange: '₹30,000 – ₹40,000', netRange: '₹21,000 – ₹28,000',
    allowances: ['Seva Nidhi Corpus (30% + Govt matching)', 'Life Insurance ₹48 Lakh', 'Ration in Kind (Free food)', 'Free Accommodation', 'Risk & Hardship Allowance', 'Dress/Kit Allowance', 'Travel Allowance', 'Free Medical'],
    postWiseSalary: [
      { post: 'Agniveer Year 1', payLevel: 'Custom', basicPay: '₹30,000' },
      { post: 'Agniveer Year 2', payLevel: 'Custom', basicPay: '₹33,000' },
      { post: 'Agniveer Year 3', payLevel: 'Custom', basicPay: '₹36,500' },
      { post: 'Agniveer Year 4', payLevel: 'Custom', basicPay: '₹40,000' },
      { post: 'Seva Nidhi (lump sum at exit)', payLevel: 'Corpus', basicPay: '~₹11.71 Lakh' },
    ],
  },
  faqs: [
    { question: 'What is the in-hand salary of Agniveer?', answer: '₹21,000 in Year 1 (after 30% Seva Nidhi deduction), increasing to ₹28,000 in Year 4.' },
    { question: 'What is Seva Nidhi?', answer: 'A tax-free lump sum of ~₹11.71 lakh paid after 4 years. Comprises employee contribution (30% of salary) + government matching + interest.' },
    { question: 'Is there life insurance for Agniveers?', answer: 'Yes, ₹48 lakh non-contributory life insurance by the government during the 4-year service.' },
    { question: 'What happens after 4 years?', answer: 'Up to 25% are retained in regular service (15+ years). Others get Seva Nidhi, skill certificate, and priority in government jobs.' },
    { question: 'Do retained Agniveers get regular Army salary?', answer: 'Yes, Agniveers absorbed into regular service transition to standard armed forces pay scales with full career benefits.' },
  ],
  relatedExams: RELATED,
};

const cutoffCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'agniveer-cutoff', pageType: 'cutoff',
  metaTitle: 'Agniveer Cutoff 2026 — Army/Navy/Air Force Marks',
  metaDescription: 'Agniveer cutoff 2026: Category-wise cut off marks for Army, Navy, and Air Force CEE. Previous year cutoffs with analysis.',
  h1: 'Agniveer Cutoff 2026 — Service-Wise & Category-Wise Cut Off Marks',
  overview: `<p>The <strong>Agniveer Cutoff</strong> is released service-wise — Army, Navy, and Air Force have separate Common Entrance Examinations (CEE) with different cutoffs. Agniveer recruitment has become the primary entry route into the Indian Armed Forces for soldiers/sailors/airmen, replacing the previous recruitment model.</p>

<h3>How Agniveer Cutoff Works</h3>
<ul>
<li><strong>Army Agniveer:</strong> CEE based on trade — General Duty (GD), Technical, Clerk/SKT, Tradesman. Cutoffs vary by trade and rally zone.</li>
<li><strong>Navy Agniveer (SSR/MR):</strong> All India merit based on CBT scores.</li>
<li><strong>Air Force Agniveer:</strong> All India merit — typically highest cutoffs among the three services.</li>
</ul>

<h3>Agniveer Cutoff Trend (2023–2024)</h3>
<p>Being a relatively new scheme (started 2022), limited trend data exists. Army GD cutoffs have stabilized around 55-65 out of 100 marks for General category. Air Force cutoffs are typically 10-15 marks higher due to fewer vacancies and stricter standards.</p>

<h3>Expected Agniveer 2026 Cutoff</h3>
<p>Army GD cutoff is expected at <strong>58–68 out of 100</strong> for General. Air Force: <strong>70–80</strong>. Navy: <strong>62–72</strong>. Focus on Maths and Science for technical trades.</p>`,

  cutoffs: [
    { year: 2024, category: 'General', cutoffScore: '63.50', totalMarks: '100' },
    { year: 2024, category: 'OBC', cutoffScore: '57.25', totalMarks: '100' },
    { year: 2024, category: 'SC', cutoffScore: '48.50', totalMarks: '100' },
    { year: 2024, category: 'ST', cutoffScore: '42.25', totalMarks: '100' },
    { year: 2023, category: 'General', cutoffScore: '58.75', totalMarks: '100' },
    { year: 2023, category: 'OBC', cutoffScore: '52.50', totalMarks: '100' },
    { year: 2023, category: 'SC', cutoffScore: '44.25', totalMarks: '100' },
    { year: 2023, category: 'ST', cutoffScore: '38.50', totalMarks: '100' },
  ],
  faqs: [
    { question: 'What is the expected Agniveer 2026 cutoff?', answer: 'Army GD: 58-68, Navy: 62-72, Air Force: 70-80 out of 100 marks for General category.' },
    { question: 'Is Agniveer cutoff service-wise?', answer: 'Yes, Army, Navy, and Air Force have separate cutoffs. Air Force is typically highest.' },
    { question: 'Is Agniveer cutoff rally/zone-wise?', answer: 'Army cutoffs vary by rally zone and trade. Navy and Air Force are All India merit.' },
    { question: 'Does physical fitness test affect cutoff?', answer: 'Physical test is qualifying. Only CEE (written exam) marks determine cutoff merit.' },
    { question: 'Is Agniveer cutoff increasing?', answer: 'Early trends suggest a gradual increase as more candidates prepare specifically for the Agniveer format.' },
  ],
  relatedExams: RELATED,
};

const ageLimitCfg2: ExamAuthorityConfig = {
  ...COMMON, slug: 'agniveer-age-limit', pageType: 'age-limit',
  metaTitle: 'Agniveer Age Limit 2026 — Service-Wise Requirements',
  metaDescription: 'Agniveer age limit 2026: 17.5-23 years for Army/Navy/Air Force. Service-wise and trade-wise age requirements.',
  h1: 'Agniveer Age Limit 2026 — Service-Wise & Trade-Wise Age Requirements',
  overview: `<p>The <strong>Agniveer Age Limit</strong> varies slightly by service and trade. The general range is 17.5–23 years, but specific trades within each service may have tighter windows. Unlike other government exams, Agniveer has <strong>no category-wise age relaxation</strong> — the same limits apply to all candidates regardless of SC/ST/OBC status.</p>

<h3>Agniveer 2026 Age Limit by Service</h3>
<ul>
<li><strong>Army Agniveer (GD):</strong> 17.5–23 years</li>
<li><strong>Army Agniveer (Technical):</strong> 17.5–23 years</li>
<li><strong>Army Agniveer (Clerk/SKT):</strong> 17.5–23 years</li>
<li><strong>Army Agniveer (Tradesman):</strong> 17.5–23 years</li>
<li><strong>Navy Agniveer (SSR):</strong> 17.5–22.5 years</li>
<li><strong>Navy Agniveer (MR):</strong> 17.5–22.5 years</li>
<li><strong>Air Force Agniveer:</strong> 17.5–21 years</li>
</ul>

<h3>No Category-Wise Relaxation</h3>
<p>Similar to NDA, Agniveer maintains uniform age standards across all categories. This is a defence forces norm — combat readiness requires young, physically fit recruits regardless of social background.</p>

<p>The 5.5-year window (17.5–23 for Army) allows candidates multiple attempts. Recruitment rallies are held regularly. Use our <a href="/govt-job-age-calculator">Age Calculator</a> to verify your eligibility.</p>

<h3>Key Points</h3>
<ul>
<li>Air Force has the tightest window: only 3.5 years (17.5–21)</li>
<li>Army has the widest window: 5.5 years (17.5–23)</li>
<li>Must be unmarried at the time of joining</li>
<li>Age is calculated as per the date specified in the recruitment notification</li>
</ul>`,

  eligibility: `<h3>Age Summary</h3>
<ul>
<li><strong>Army:</strong> 17.5–23 years</li>
<li><strong>Navy:</strong> 17.5–22.5 years</li>
<li><strong>Air Force:</strong> 17.5–21 years</li>
<li><strong>No relaxation</strong> for any category</li>
</ul>`,
  faqs: [
    { question: 'What is the age limit for Agniveer?', answer: 'Army: 17.5-23, Navy: 17.5-22.5, Air Force: 17.5-21. No category-wise relaxation.' },
    { question: 'Why is Air Force age limit lower?', answer: 'Air Force requires younger recruits for specialized technical training and has stricter physical/medical standards.' },
    { question: 'Is there age relaxation for SC/ST?', answer: 'No, defence forces maintain uniform age standards. Same limits for all categories.' },
    { question: 'Can I apply for both Army and Air Force?', answer: 'Yes, if you meet both age limits. Many candidates apply for multiple services simultaneously.' },
    { question: 'What if I am 23 years and 1 day?', answer: 'You would be ineligible for Army Agniveer. The age limit is strictly enforced.' },
  ],
  relatedExams: RELATED,
};

export const AGNIVEER_CONFIGS: ExamAuthorityConfig[] = [notification, syllabus, examPatternCfg, eligibilityCfg, salaryCfg, cutoffCfg2, ageLimitCfg2];
