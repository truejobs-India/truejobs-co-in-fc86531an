export interface NearMePageConfig {
  slug: string;
  /** Exact H1 */
  h1: string;
  /** SEO title (≤60 chars) */
  title: string;
  /** Meta description (≤160 chars) */
  metaDescription: string;
  /** Tags shown below H1 */
  tags: string[];
  /** employmentType for schema */
  employmentType: string;
  /** Industry for schema */
  industry: string;
  /** Intro paragraph – first 2 lines must contain "near me" */
  intro: string;
  /** Job description paragraphs */
  descriptionParagraphs: string[];
  /** Job highlights bullets */
  highlights: string[];
  /** Eligibility bullets */
  eligibility: string[];
  /** Example locations text */
  locationExamples: string;
}

export const NEAR_ME_PAGES: NearMePageConfig[] = [
  {
    slug: 'commission-based-jobs-near-me',
    h1: 'Commission Based Jobs Near Me',
    title: 'Commission Based Jobs Near Me | High Income – TrueJobs',
    metaDescription: 'Find commission-based jobs near your location. Earn high income with flexible hours. No age limit. Free registration on TrueJobs. Apply now!',
    tags: ['Commission Based', 'High Income', 'Flexible Hours'],
    employmentType: 'FULL_TIME',
    industry: 'Sales & Insurance',
    intro: 'Looking for commission-based jobs near you? TrueJobs connects you with verified, high-earning commission roles in your city and nearby locations — from insurance advisory to direct sales.',
    descriptionParagraphs: [
      'Commission-based roles let you earn based on your performance — the harder you work, the more you earn. These positions are ideal for self-motivated professionals who prefer flexibility over a fixed salary.',
      'Roles include Insurance Advisor, Sales Consultant, Business Development Executive, and Financial Advisor positions across leading MNC companies. You work independently with full support and training from the employer.',
      'Whether you are a fresher, experienced professional, career switcher, or retiree, commission-based jobs offer unlimited earning potential without the constraints of a traditional 9-to-5.',
    ],
    highlights: [
      'No age limit — open to all',
      'High earning potential based on performance',
      'Flexible or hybrid working model',
      'Training and onboarding support provided',
      'Opportunities with reputed insurance and sales companies',
    ],
    eligibility: [
      'Freshers and experienced candidates welcome',
      'Basic communication and interpersonal skills',
      'Willingness to work in client-facing roles',
      'Smartphone and internet access preferred',
    ],
    locationExamples: 'Jobs available near Lucknow, Noida, Patna, Kolkata, Bhopal, Kanpur, Varanasi, and surrounding areas.',
  },
  {
    slug: 'work-from-home-jobs-near-me',
    h1: 'Work From Home Jobs Near Me',
    title: 'Work From Home Jobs Near Me | Remote Roles – TrueJobs',
    metaDescription: 'Explore work-from-home jobs near you. Digital, telecalling, and insurance advisory roles. Perfect for students and homemakers. Free registration.',
    tags: ['Work From Home', 'Remote', 'Flexible'],
    employmentType: 'FULL_TIME',
    industry: 'Digital & Insurance',
    intro: 'Searching for work-from-home jobs near you? TrueJobs lists verified remote and hybrid opportunities that match your location, skills, and schedule — apply for free in minutes.',
    descriptionParagraphs: [
      'Remote and hybrid work is no longer a luxury — it is the future. TrueJobs partners with companies offering genuine work-from-home opportunities in telecalling, insurance advisory, digital marketing, data entry, and customer support.',
      'These roles are perfect for students, homemakers, retirees, and anyone looking to earn from the comfort of their home while maintaining flexibility. Most positions provide full training and onboarding.',
      'All you need is a smartphone or laptop, a stable internet connection, and the motivation to build a rewarding career without a daily commute.',
    ],
    highlights: [
      'No commute — work from anywhere',
      'Flexible hours and scheduling',
      'Suitable for students, homemakers, and retirees',
      'Training and onboarding support provided',
      'Opportunities with trusted companies',
    ],
    eligibility: [
      'Freshers and experienced candidates welcome',
      'Basic computer and communication skills',
      'Smartphone or laptop with internet access',
      'Self-motivated individuals with time management skills',
    ],
    locationExamples: 'Remote roles available for candidates in Lucknow, Noida, Patna, Kolkata, Bhopal, and all across India.',
  },
  {
    slug: 'freshers-jobs-near-me',
    h1: 'Freshers Jobs Near Me',
    title: 'Freshers Jobs Near Me | No Experience Needed – TrueJobs',
    metaDescription: 'Find freshers jobs near your location. No prior experience required. Training provided. Start your career today with TrueJobs. Free registration.',
    tags: ['Freshers', 'Entry Level', 'Training Provided'],
    employmentType: 'FULL_TIME',
    industry: 'Multiple Industries',
    intro: 'Looking for freshers jobs near you? TrueJobs helps fresh graduates and first-time job seekers find verified entry-level opportunities in their city — with free registration and fast onboarding.',
    descriptionParagraphs: [
      'Starting your career can be overwhelming, but TrueJobs makes it simple. We connect freshers with employers who value potential over experience, offering full training and mentorship programs.',
      'Available roles include Insurance Advisor, Customer Support Executive, Sales Trainee, Digital Marketing Assistant, and more. Many positions offer a combination of stipend and performance-based incentives.',
      'Whether you have just completed your 12th, graduation, or post-graduation, these roles are designed to give you hands-on industry experience and a clear career growth path.',
    ],
    highlights: [
      'No prior experience required',
      'Full training and onboarding provided',
      'Career growth and mentorship opportunities',
      'Flexible working options available',
      'Opportunities with leading companies',
    ],
    eligibility: [
      'Recent graduates and freshers welcome',
      'Minimum qualification: 12th pass or above',
      'Good communication skills preferred',
      'Willingness to learn and grow in a professional environment',
    ],
    locationExamples: 'Fresher-friendly jobs available near Lucknow, Noida, Kanpur, Patna, Kolkata, Bhopal, and nearby areas.',
  },
  {
    slug: 'part-time-jobs-near-me',
    h1: 'Part Time Jobs Near Me',
    title: 'Part Time Jobs Near Me | Flexible Hours – TrueJobs',
    metaDescription: 'Discover part-time jobs near your area. Flexible hours, side income. Ideal for students and working professionals. Free registration on TrueJobs.',
    tags: ['Part Time', 'Flexible Hours', 'Side Income'],
    employmentType: 'PART_TIME',
    industry: 'Sales & Services',
    intro: 'Need part-time jobs near you? TrueJobs connects you with flexible, location-relevant opportunities that fit around your existing schedule — earn a side income without sacrificing your commitments.',
    descriptionParagraphs: [
      'Part-time jobs offer the perfect balance between earning and personal commitments. Whether you are a student, homemaker, or working professional, TrueJobs has roles that let you work on your own terms.',
      'Available part-time positions include Insurance Advisory, Telecalling, Field Sales, Data Entry, and Survey roles. Many offer a mix of location-based and remote work to maximize your flexibility.',
      'Earn a meaningful side income working just a few hours a day. Most positions require no prior experience and provide training to help you succeed from day one.',
    ],
    highlights: [
      'Flexible working hours',
      'Ideal for side income alongside studies or full-time work',
      'No age limit — open to all',
      'Training support provided',
      'Mix of remote and on-location opportunities',
    ],
    eligibility: [
      'Students, homemakers, and professionals welcome',
      'Basic communication skills required',
      'Willingness to work flexible hours',
      'Smartphone with internet access',
    ],
    locationExamples: 'Part-time opportunities near Lucknow, Noida, Varanasi, Patna, Kolkata, Bhopal, and surrounding cities.',
  },
  {
    slug: 'entry-level-jobs-near-me',
    h1: 'Entry Level Jobs Near Me',
    title: 'Entry Level Jobs Near Me | Start Your Career – TrueJobs',
    metaDescription: 'Find entry-level jobs near you. No experience needed. Training and growth opportunities. Register free on TrueJobs and start your career today.',
    tags: ['Entry Level', 'Career Start', 'Growth'],
    employmentType: 'FULL_TIME',
    industry: 'Multiple Industries',
    intro: 'Searching for entry-level jobs near you? TrueJobs matches new professionals with nearby employers offering training, mentorship, and real career growth — all with free registration.',
    descriptionParagraphs: [
      'Entry-level positions are your gateway to a professional career. TrueJobs works with employers across insurance, sales, finance, and technology sectors who actively hire candidates with little or no prior experience.',
      'These roles focus on skill-building, with structured training programs and clear promotion pathways. You will gain real-world experience while earning a competitive income from day one.',
      'Positions include Junior Insurance Advisor, Trainee Sales Executive, Customer Relationship Associate, and more. Many roles offer performance-based bonuses on top of base compensation.',
    ],
    highlights: [
      'No prior work experience needed',
      'Structured training and mentorship programs',
      'Clear career growth and promotion pathways',
      'Performance-based bonuses and incentives',
      'Opportunities with established companies',
    ],
    eligibility: [
      'Freshers and career changers welcome',
      'Minimum qualification: 12th pass or graduate',
      'Strong willingness to learn and adapt',
      'Good communication and interpersonal skills',
    ],
    locationExamples: 'Entry-level positions near Lucknow, Noida, Kanpur, Patna, Kolkata, Bhopal, Varanasi, and more.',
  },
  {
    slug: 'insurance-jobs-near-me',
    h1: 'Insurance Jobs Near Me',
    title: 'Insurance Jobs Near Me | Top Companies – TrueJobs',
    metaDescription: 'Apply for insurance jobs near your location. Commission-based, flexible roles with leading companies. Freshers welcome. Free registration on TrueJobs.',
    tags: ['Insurance', 'Commission Based', 'MNC Companies'],
    employmentType: 'FULL_TIME',
    industry: 'Insurance',
    intro: 'Looking for insurance jobs near you? TrueJobs connects you with verified insurance advisor, consultant, and agent opportunities at leading companies in your city and nearby areas.',
    descriptionParagraphs: [
      'The insurance industry in India is booming, and companies are actively hiring advisors, consultants, and agents across every city and district. TrueJobs makes it easy to find and apply for these roles near your location.',
      'Insurance jobs offer high earning potential through commissions, along with flexible working hours and the chance to build a long-term client base. Roles are available with top MNC and domestic insurance brands.',
      'Whether you want to work in life insurance, health insurance, or general insurance, TrueJobs has opportunities that match your interest, location, and experience level.',
    ],
    highlights: [
      'No age limit — open to all candidates',
      'High commission-based earnings',
      'Flexible and hybrid working models',
      'Full training and certification support',
      'Work with top insurance brands in India',
    ],
    eligibility: [
      'Freshers and experienced professionals welcome',
      'Minimum qualification: 12th pass or above',
      'Good communication and relationship-building skills',
      'Willingness to work in a client-facing advisory role',
    ],
    locationExamples: 'Insurance roles available near Lucknow, Noida, Kanpur, Patna, Kolkata, Bhopal, and across India.',
  },
  {
    slug: 'insurance-advisor-jobs-near-me',
    h1: 'Insurance Advisor Jobs Near Me',
    title: 'Insurance Advisor Jobs Near Me | Apply Free – TrueJobs',
    metaDescription: 'Find insurance advisor jobs near your city. Work with top MNC insurers. High commissions, no age limit. Training provided. Apply free on TrueJobs.',
    tags: ['Insurance Advisor', 'Commission Based', 'Training Provided'],
    employmentType: 'FULL_TIME',
    industry: 'Insurance',
    intro: 'Searching for insurance advisor jobs near you? TrueJobs matches you with verified insurance advisor and consultant positions at leading companies in your city and nearby locations.',
    descriptionParagraphs: [
      'Insurance advisors play a critical role in helping individuals and families secure their financial future. As an Insurance Advisor, you will guide clients through selecting the right life, health, or general insurance policies based on their needs.',
      'TrueJobs partners with leading MNC and domestic insurance companies to bring you the best advisor opportunities near your location. These roles offer high commissions, flexible schedules, and long-term career growth.',
      'No prior insurance experience is needed — employers provide comprehensive training, IRDA certification support, and ongoing mentorship to help you build a successful advisory career.',
    ],
    highlights: [
      'No age limit — open to everyone',
      'High earning potential with unlimited commissions',
      'Hybrid working model (Office + Online)',
      'IRDA training and certification support',
      'Opportunity to work with India\'s top insurance companies',
    ],
    eligibility: [
      'Freshers and experienced candidates welcome',
      'Minimum qualification: 12th pass or above',
      'Strong communication and interpersonal skills',
      'Willingness to work in a client-facing advisory role',
    ],
    locationExamples: 'Insurance advisor roles near Lucknow, Noida, Kanpur, Varanasi, Patna, Kolkata, Bhopal, and nearby areas.',
  },
  // ── Expanded near-me pages ──
  {
    slug: 'sales-jobs-near-me', h1: 'Sales Jobs Near Me', title: 'Sales Jobs Near Me | High Earning – TrueJobs', metaDescription: 'Find sales jobs near your location. B2B, B2C, and direct sales roles. High incentives. Free registration on TrueJobs.', tags: ['Sales', 'High Incentives', 'Growth'], employmentType: 'FULL_TIME', industry: 'Sales & Marketing',
    intro: 'Looking for sales jobs near you? TrueJobs connects you with verified sales positions in your city — from field sales to enterprise B2B roles.',
    descriptionParagraphs: ['Sales roles offer the highest earning potential among entry-level positions. TrueJobs lists opportunities across FMCG, insurance, real estate, and tech sectors.', 'Roles include Sales Executive, Business Development Manager, and Area Sales Manager with training provided.'],
    highlights: ['High incentive-based earnings', 'Training provided', 'Growth to management roles', 'Opportunities across industries'], eligibility: ['Graduates preferred', 'Good communication skills', 'Target-oriented mindset'], locationExamples: 'Sales jobs near Delhi, Mumbai, Bangalore, Pune, Hyderabad, and all major cities.'
  },
  {
    slug: 'data-entry-jobs-near-me', h1: 'Data Entry Jobs Near Me', title: 'Data Entry Jobs Near Me | Work From Home – TrueJobs', metaDescription: 'Find data entry jobs near you. Office and remote roles. No experience needed. Free registration on TrueJobs.', tags: ['Data Entry', 'No Experience', 'Flexible'], employmentType: 'FULL_TIME', industry: 'Back Office & IT',
    intro: 'Searching for data entry jobs near you? TrueJobs lists verified data entry, typing, and back office positions in your area — apply for free.',
    descriptionParagraphs: ['Data entry roles are ideal for candidates with basic computer skills. Many positions offer work-from-home options.', 'Roles include Data Entry Operator, MIS Executive, and Back Office Assistant.'],
    highlights: ['No prior experience needed', 'Work-from-home options available', 'Regular fixed hours', 'Basic computer skills sufficient'], eligibility: ['12th pass or graduate', 'Typing speed 25+ WPM', 'Basic MS Office knowledge'], locationExamples: 'Data entry jobs near Delhi, Mumbai, Bangalore, Kolkata, and across India.'
  },
  {
    slug: 'customer-service-jobs-near-me', h1: 'Customer Service Jobs Near Me', title: 'Customer Service Jobs Near Me – TrueJobs', metaDescription: 'Find customer service and support jobs near you. BPO, helpdesk, and CRM roles. Free registration on TrueJobs.', tags: ['Customer Service', 'Support', 'Helpdesk'], employmentType: 'FULL_TIME', industry: 'BPO & Services',
    intro: 'Looking for customer service jobs near you? TrueJobs lists verified customer support, helpdesk, and CRM roles in your city.',
    descriptionParagraphs: ['Customer service is one of the most accessible careers, offering clear growth paths from executive to manager.', 'Roles span inbound/outbound calls, chat support, email support, and client relationship management.'],
    highlights: ['Freshers welcome', 'Professional work environment', 'Clear career progression', 'Communication skill development'], eligibility: ['Graduate preferred', 'Good English/Hindi communication', 'Basic computer skills'], locationExamples: 'Customer service jobs near Bangalore, Hyderabad, Delhi NCR, Mumbai, Pune, and more.'
  },
  {
    slug: 'accounting-jobs-near-me', h1: 'Accounting Jobs Near Me', title: 'Accounting Jobs Near Me | Finance Roles – TrueJobs', metaDescription: 'Find accounting and finance jobs near you. Tally, GST, and bookkeeping roles. Free registration on TrueJobs.', tags: ['Accounting', 'Finance', 'Tally'], employmentType: 'FULL_TIME', industry: 'Finance & Accounting',
    intro: 'Searching for accounting jobs near you? TrueJobs connects you with verified accounting, bookkeeping, and finance positions.',
    descriptionParagraphs: ['Accounting professionals are in demand across every industry. From GST filing to audit, roles offer stable careers.', 'Positions include Accountant, Tax Consultant, Audit Associate, and Finance Executive.'],
    highlights: ['Stable career with growth', 'CA/CMA preferred but not mandatory', 'Opportunities in every industry', 'GST knowledge valued'], eligibility: ['B.Com or M.Com preferred', 'Tally/SAP knowledge', 'GST filing knowledge helpful'], locationExamples: 'Accounting jobs near Mumbai, Delhi, Chennai, Kolkata, Pune, and across India.'
  },
  {
    slug: 'teaching-jobs-near-me', h1: 'Teaching Jobs Near Me', title: 'Teaching Jobs Near Me | Schools & EdTech – TrueJobs', metaDescription: 'Find teaching jobs near you. School, college, and online teaching roles. B.Ed holders welcome. Free registration on TrueJobs.', tags: ['Teaching', 'Education', 'Tutoring'], employmentType: 'FULL_TIME', industry: 'Education',
    intro: 'Looking for teaching jobs near you? TrueJobs lists verified teaching positions at schools, colleges, coaching centers, and EdTech platforms.',
    descriptionParagraphs: ['Teaching careers offer job satisfaction and stability. Both offline and online teaching roles are growing.', 'Positions include School Teacher, Private Tutor, Online Educator, and Coaching Faculty.'],
    highlights: ['B.Ed/M.Ed holders preferred', 'Online teaching options', 'Government and private school roles', 'EdTech platform opportunities'], eligibility: ['B.Ed for school teaching', 'Subject expertise required', 'Good communication skills', 'UGC NET for college teaching'], locationExamples: 'Teaching jobs near Delhi, Lucknow, Jaipur, Pune, Bangalore, and across India.'
  },
  {
    slug: 'hr-jobs-near-me', h1: 'HR Jobs Near Me', title: 'HR Jobs Near Me | Recruitment & Payroll – TrueJobs', metaDescription: 'Find HR jobs near you. Recruitment, payroll, and HR generalist roles. Free registration on TrueJobs.', tags: ['HR', 'Recruitment', 'Payroll'], employmentType: 'FULL_TIME', industry: 'Human Resources',
    intro: 'Searching for HR jobs near you? TrueJobs connects you with verified HR, recruitment, and people operations positions.',
    descriptionParagraphs: ['HR is a core function in every organization. Roles span recruitment, employee engagement, compliance, and learning & development.', 'Positions include HR Executive, Recruiter, Payroll Specialist, and HR Business Partner.'],
    highlights: ['Available in every industry', 'MBA HR preferred', 'People-oriented career', 'Clear growth to CHRO'], eligibility: ['MBA HR or equivalent', 'Good interpersonal skills', 'Knowledge of labor laws helpful'], locationExamples: 'HR jobs near Mumbai, Delhi, Bangalore, Hyderabad, Pune, and all major cities.'
  },
  {
    slug: 'driver-jobs-near-me', h1: 'Driver Jobs Near Me', title: 'Driver Jobs Near Me | Car & Commercial – TrueJobs', metaDescription: 'Find driver jobs near you. Car, truck, and delivery driver roles. Valid license required. Free registration on TrueJobs.', tags: ['Driver', 'Transportation', 'Delivery'], employmentType: 'FULL_TIME', industry: 'Transportation & Logistics',
    intro: 'Looking for driver jobs near you? TrueJobs lists verified driver positions for cars, trucks, cabs, and commercial vehicles.',
    descriptionParagraphs: ['Driver jobs offer immediate employment with competitive pay. Ola, Uber, fleet companies, and corporates hire regularly.', 'Roles include Personal Driver, Cab Driver, Delivery Driver, and Commercial Vehicle Driver.'],
    highlights: ['Immediate joining', 'Flexible hours for cab drivers', 'No formal education required', 'High demand in metro cities'], eligibility: ['Valid driving license required', 'Clean driving record', 'Knowledge of city routes', 'Commercial license for heavy vehicles'], locationExamples: 'Driver jobs near Delhi, Mumbai, Bangalore, Chennai, Kolkata, and across India.'
  },
  {
    slug: 'medical-jobs-near-me', h1: 'Medical & Healthcare Jobs Near Me', title: 'Medical Jobs Near Me | Hospital & Pharma – TrueJobs', metaDescription: 'Find medical and healthcare jobs near you. Doctor, nurse, pharmacist, and lab technician roles. Free registration on TrueJobs.', tags: ['Medical', 'Healthcare', 'Hospital'], employmentType: 'FULL_TIME', industry: 'Healthcare',
    intro: 'Looking for medical jobs near you? TrueJobs connects you with verified healthcare positions at hospitals, clinics, and pharma companies.',
    descriptionParagraphs: ['Healthcare is India\'s fastest-growing sector. Hospitals, clinics, diagnostics labs, and pharma companies hire continuously.', 'Roles include Doctor, Nurse, Pharmacist, Lab Technician, Hospital Admin, and Medical Coder.'],
    highlights: ['High job security', 'Growing sector', 'Recession-proof career', 'Multiple specializations available'], eligibility: ['Relevant medical qualification', 'MBBS/BDS/B.Sc Nursing/B.Pharm as applicable', 'License/registration required'], locationExamples: 'Medical jobs near Delhi, Mumbai, Chennai, Bangalore, Hyderabad, and all cities.'
  },
  {
    slug: 'marketing-jobs-near-me', h1: 'Marketing Jobs Near Me', title: 'Marketing Jobs Near Me | Digital & Brand – TrueJobs', metaDescription: 'Find marketing jobs near you. Digital marketing, brand management, and content roles. Free registration on TrueJobs.', tags: ['Marketing', 'Digital', 'Brand'], employmentType: 'FULL_TIME', industry: 'Marketing & Advertising',
    intro: 'Searching for marketing jobs near you? TrueJobs lists verified digital marketing, brand management, and content marketing positions.',
    descriptionParagraphs: ['Marketing careers combine creativity with analytics. Digital marketing has exploded job opportunities across all cities.', 'Roles include Digital Marketing Executive, SEO Specialist, Social Media Manager, and Brand Manager.'],
    highlights: ['Creative career path', 'High demand for digital skills', 'Freelance options available', 'MBA Marketing preferred for brand roles'], eligibility: ['Graduate with marketing interest', 'Google Ads/Analytics certification helpful', 'Portfolio for creative roles'], locationExamples: 'Marketing jobs near Mumbai, Delhi, Bangalore, Hyderabad, Pune, and more.'
  },
  {
    slug: 'construction-jobs-near-me', h1: 'Construction Jobs Near Me', title: 'Construction Jobs Near Me | Civil & Site – TrueJobs', metaDescription: 'Find construction jobs near you. Site engineer, foreman, and civil engineering roles. Free registration on TrueJobs.', tags: ['Construction', 'Civil', 'Site Engineer'], employmentType: 'FULL_TIME', industry: 'Construction & Real Estate',
    intro: 'Looking for construction jobs near you? TrueJobs lists verified site engineer, foreman, and construction management positions.',
    descriptionParagraphs: ['India\'s construction boom is creating massive employment. Infrastructure projects, housing, and smart cities drive demand.', 'Roles include Site Engineer, Project Manager, Quantity Surveyor, Safety Officer, and Civil Supervisor.'],
    highlights: ['Massive infrastructure spending', 'Career growth to project management', 'Government and private projects', 'PMP certification valued'], eligibility: ['Civil engineering degree preferred', 'Diploma holders for supervisor roles', 'AutoCAD/Revit skills helpful'], locationExamples: 'Construction jobs near Delhi NCR, Mumbai, Hyderabad, Bangalore, Pune, and across India.'
  },
  {
    slug: 'security-guard-jobs-near-me', h1: 'Security Guard Jobs Near Me', title: 'Security Guard Jobs Near Me – TrueJobs', metaDescription: 'Find security guard jobs near you. Corporate, residential, and event security roles. Free registration on TrueJobs.', tags: ['Security', 'Guard', 'Immediate Joining'], employmentType: 'FULL_TIME', industry: 'Security Services',
    intro: 'Searching for security guard jobs near you? TrueJobs lists verified security positions at corporate offices, malls, and residential complexes.',
    descriptionParagraphs: ['Security services employ millions across India. Roles range from corporate security to event security and personal protection.', 'Positions include Security Guard, Supervisor, CCTV Operator, and Security Manager.'],
    highlights: ['Immediate joining', 'No high education required', 'Overtime pay available', 'Growth to supervisor/manager roles'], eligibility: ['10th/12th pass minimum', 'Physical fitness required', 'Ex-servicemen preferred', 'Clean background check'], locationExamples: 'Security guard jobs near Delhi, Mumbai, Bangalore, Chennai, Kolkata, and all cities.'
  },
  {
    slug: 'warehouse-jobs-near-me', h1: 'Warehouse Jobs Near Me', title: 'Warehouse Jobs Near Me | Logistics – TrueJobs', metaDescription: 'Find warehouse jobs near you. Picker, packer, and warehouse supervisor roles. Free registration on TrueJobs.', tags: ['Warehouse', 'Logistics', 'E-commerce'], employmentType: 'FULL_TIME', industry: 'Logistics & E-commerce',
    intro: 'Looking for warehouse jobs near you? TrueJobs connects you with verified warehouse positions at Amazon, Flipkart, and logistics companies.',
    descriptionParagraphs: ['E-commerce has created massive warehouse employment. Roles offer regular hours and clear career paths.', 'Positions include Warehouse Associate, Picker/Packer, Inventory Controller, and Warehouse Manager.'],
    highlights: ['E-commerce giants hiring constantly', 'Regular work hours', 'Growth to supervisory roles', 'PF and ESI benefits'], eligibility: ['10th/12th pass minimum', 'Physical fitness for handling roles', 'Basic literacy required', 'Forklift license a plus'], locationExamples: 'Warehouse jobs near Delhi NCR, Mumbai, Bangalore, Hyderabad, Chennai, and logistics hubs.'
  },
  {
    slug: 'housekeeping-jobs-near-me', h1: 'Housekeeping Jobs Near Me', title: 'Housekeeping Jobs Near Me | Hotels & Corporate – TrueJobs', metaDescription: 'Find housekeeping jobs near you. Hotel, corporate, and hospital housekeeping roles. Free registration on TrueJobs.', tags: ['Housekeeping', 'Hotel', 'Cleaning'], employmentType: 'FULL_TIME', industry: 'Hospitality & Services',
    intro: 'Searching for housekeeping jobs near you? TrueJobs lists verified housekeeping positions at hotels, hospitals, and corporate offices.',
    descriptionParagraphs: ['Housekeeping is essential in hospitality, healthcare, and corporate sectors. Career growth to executive housekeeper is well-defined.', 'Positions include Room Attendant, Housekeeper, Cleaning Supervisor, and Executive Housekeeper.'],
    highlights: ['Immediate joining available', 'Hotels, hospitals, and offices hiring', 'Growth to supervisory roles', 'Free meals in many positions'], eligibility: ['No high education required', 'Attention to detail', 'Physical fitness', 'Hospitality training preferred'], locationExamples: 'Housekeeping jobs near Delhi, Mumbai, Goa, Bangalore, Chennai, Jaipur, and tourist cities.'
  },
];

/** Get all Near Me page slugs for sitemap / GSC export */
export function getAllNearMeSlugs(): string[] {
  return NEAR_ME_PAGES.map((p) => p.slug);
}
