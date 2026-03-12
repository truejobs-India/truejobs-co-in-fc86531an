import type { IndustryJobPageConfig } from './types';

export function getIndustryJobConfig(slug: string): IndustryJobPageConfig | undefined {
  return INDUSTRY_JOBS_DATA.find(i => i.slug === slug);
}

export function getAllIndustryJobSlugs(): string[] {
  return INDUSTRY_JOBS_DATA.map(i => i.slug);
}

export const INDUSTRY_JOBS_DATA: IndustryJobPageConfig[] = [
  {
    industry: 'Healthcare',
    slug: 'healthcare-jobs',
    h1: 'Latest Healthcare Jobs in India – Apply Now',
    metaTitle: 'Healthcare Jobs India 2026 – Doctor, Nurse & Pharma',
    metaDescription: 'Find healthcare jobs in India. Doctor, nurse, pharmacist, and medical technology openings across hospitals and pharma companies. Apply on TrueJobs.',
    introContent: `
      <h2>Healthcare Industry Overview in India</h2>
      <p>India's healthcare industry is one of the fastest-growing sectors, valued at over $370 billion and projected to reach $640 billion by 2030. The sector encompasses hospitals, pharmaceuticals, medical devices, diagnostics, health insurance, and telemedicine. Post-pandemic investment has accelerated growth with the government's Ayushman Bharat scheme providing coverage to 500 million people, creating massive demand for healthcare professionals across the country.</p>
      <p>India is the world's largest producer of generic medicines, supplying 20% of global demand. The pharmaceutical manufacturing hub spanning Gujarat, Maharashtra, Telangana, and Himachal Pradesh employs millions. The hospital sector, led by chains like Apollo, Fortis, Max Healthcare, Narayana Health, and Manipal, is expanding rapidly into tier-2 and tier-3 cities, creating employment opportunities beyond metro areas.</p>
      <h3>Key Roles in Healthcare</h3>
      <p>The healthcare sector offers diverse career paths. Clinical roles include doctors, nurses, pharmacists, physiotherapists, and lab technicians. Non-clinical roles encompass hospital administration, medical coding, health IT, pharmaceutical sales, clinical research, and healthcare marketing. The telemedicine revolution has created new categories including remote patient monitoring, digital health platform management, and AI-assisted diagnostics.</p>
      <h3>Salary Landscape</h3>
      <p>Healthcare salaries vary widely by specialization and experience. MBBS doctors earn ₹6–15 LPA in hospitals, while specialists can command ₹20–80 LPA or more. Nurses earn ₹2.5–6 LPA, pharmacists ₹2–5 LPA. Pharmaceutical sales representatives earn ₹3–8 LPA with incentives. Healthcare IT professionals earn ₹4–15 LPA. Clinical research associates earn ₹4–10 LPA. Hospital administrators can earn ₹8–25 LPA at senior levels.</p>
      <h3>Growth Opportunities</h3>
      <p>The sector is experiencing unprecedented growth. AI and machine learning applications in diagnostics and drug discovery are creating new tech-healthcare hybrid roles. Medical tourism is growing with India attracting patients from Africa, Middle East, and South Asia. Mental health awareness has created demand for psychologists, counselors, and wellness professionals. The elderly care segment is emerging as India's demographic profile shifts.</p>
      <h3>How to Build a Healthcare Career</h3>
      <p>Clinical careers require specific medical qualifications (MBBS, B.Sc Nursing, B.Pharm, etc.). Non-clinical healthcare careers welcome graduates with MBA in Healthcare, MHA, or specialized certifications in medical coding, clinical research, or health informatics. Pharma sales is accessible with a science graduate degree. Digital health startups welcome tech professionals with healthcare domain interest. Register on TrueJobs to discover verified healthcare job openings across India.</p>
    `,
    keyRoles: ['Doctor', 'Nurse', 'Pharmacist', 'Lab Technician', 'Hospital Administrator', 'Medical Coder', 'Clinical Research Associate', 'Pharma Sales Rep'],
    salaryRange: [
      { role: 'Doctor (MBBS)', range: '₹6–15 LPA' },
      { role: 'Specialist Doctor', range: '₹20–80 LPA' },
      { role: 'Nurse', range: '₹2.5–6 LPA' },
      { role: 'Pharmacist', range: '₹2–5 LPA' },
      { role: 'Hospital Administrator', range: '₹5–25 LPA' },
    ],
    growthTrends: [
      'Telemedicine and digital health platforms growing rapidly',
      'AI-assisted diagnostics creating new tech-health roles',
      'Hospital chains expanding to tier-2 and tier-3 cities',
      'Mental health professionals in increasing demand',
      'Medical tourism driving premium healthcare employment',
    ],
    faqItems: [
      { question: 'What healthcare jobs are in demand in India?', answer: 'Nurses, pharmacists, medical coders, clinical research associates, and healthcare IT professionals are in high demand. Specialist doctors and telemedicine practitioners are also increasingly sought after.' },
      { question: 'Can non-medical graduates work in healthcare?', answer: 'Yes, healthcare offers many non-clinical roles including hospital administration, medical coding, pharma sales, health IT, and clinical data management that welcome graduates from various backgrounds.' },
      { question: 'What is the salary for nurses in India?', answer: 'Nurses in India earn ₹2.5–6 LPA depending on experience and hospital type. ICU and critical care nurses, and those in metro cities, earn at the higher end.' },
    ],
    topCities: ['jobs-in-delhi', 'jobs-in-mumbai', 'jobs-in-bangalore', 'jobs-in-chennai', 'jobs-in-hyderabad'],
    relatedCategories: ['fresher-jobs', 'remote-jobs'],
    filterKeywords: ['healthcare', 'hospital', 'medical', 'doctor', 'nurse', 'pharma', 'clinical'],
  },
  {
    industry: 'Banking & Finance',
    slug: 'banking-finance-jobs',
    h1: 'Latest Banking & Finance Jobs in India – Apply Now',
    metaTitle: 'Banking & Finance Jobs India 2026 – BFSI Careers',
    metaDescription: 'Find banking and finance jobs in India. PO, clerk, analyst, and fintech openings. Apply on TrueJobs.',
    introContent: `
      <h2>Banking & Finance Industry in India</h2>
      <p>India's Banking, Financial Services, and Insurance (BFSI) sector is one of the largest employers in the country, contributing nearly 14% to the GDP. With over 100 scheduled commercial banks, thousands of NBFCs, insurance companies, and the rapidly growing fintech ecosystem, the sector offers massive employment across traditional banking, digital finance, and investment management. India's financial inclusion drive, UPI revolution, and digital banking push have transformed the landscape.</p>
      <p>The sector employs millions across roles from branch banking and customer service to complex financial analysis, risk management, and algorithmic trading. Public sector banks like SBI, PNB, and Bank of Baroda recruit through IBPS and bank-specific exams, while private banks like HDFC, ICICI, Axis, and Kotak recruit through campus placements and direct hiring. The fintech revolution with companies like Paytm, PhonePe, Razorpay, and CRED has created new-age financial technology careers.</p>
      <h3>Career Paths in BFSI</h3>
      <p>Traditional banking roles include Probationary Officers, clerks, specialist officers, and branch managers. Investment banking offers analyst and associate positions in firms like JP Morgan, Goldman Sachs, and ICICI Securities. Insurance companies hire agents, underwriters, actuaries, and claims specialists. The fintech sector employs product managers, data scientists, payment engineers, and compliance professionals. Wealth management and financial planning are growing segments.</p>
      <h3>Salary Overview</h3>
      <p>BFSI salaries range widely. Bank POs earn ₹4–7 LPA, senior managers ₹10–20 LPA. Investment banking analysts earn ₹8–20 LPA with significant bonuses. Insurance roles range from ₹2–10 LPA. Fintech professionals earn ₹5–30 LPA depending on the role and company stage. Chartered Accountants earn ₹7–25 LPA. Financial planners and wealth managers can earn ₹5–20 LPA with commissions.</p>
      <h3>Future of BFSI Careers</h3>
      <p>Digital transformation is reshaping every aspect of financial services. Blockchain, AI-driven credit scoring, open banking APIs, and embedded finance are creating new career categories. Regulatory technology (RegTech) professionals are in demand as compliance requirements grow. Green finance and ESG investing are emerging specializations. Build skills in data analytics, financial modeling, regulatory compliance, and digital payment technologies for long-term career growth in BFSI.</p>
    `,
    keyRoles: ['Bank PO', 'Financial Analyst', 'Insurance Agent', 'Chartered Accountant', 'Fintech Developer', 'Compliance Officer', 'Wealth Manager', 'Actuary'],
    salaryRange: [
      { role: 'Bank PO', range: '₹4–7 LPA' },
      { role: 'Financial Analyst', range: '₹5–15 LPA' },
      { role: 'Investment Banker', range: '₹10–40 LPA' },
      { role: 'CA', range: '₹7–25 LPA' },
      { role: 'Fintech Product Manager', range: '₹12–30 LPA' },
    ],
    growthTrends: [
      'Fintech sector creating thousands of tech-finance hybrid roles',
      'Digital banking reducing traditional branch jobs but creating tech roles',
      'Insurance sector growing post-pandemic with health and life products',
      'UPI and digital payments driving payment technology careers',
      'Regulatory compliance becoming a specialized high-demand career',
    ],
    faqItems: [
      { question: 'How to get a bank job in India?', answer: 'For public banks, clear IBPS PO/Clerk or SBI exams. For private banks, apply through campus placements or direct hiring portals. Banking certifications like JAIIB/CAIIB enhance prospects.' },
      { question: 'Is fintech a good career choice?', answer: 'Yes, fintech is one of the fastest-growing sectors. It combines finance and technology skills, offering high salaries and rapid career growth. India\'s fintech ecosystem is the third-largest globally.' },
      { question: 'What qualifications do I need for finance jobs?', answer: 'B.Com, MBA Finance, CA, CFA, or CFP qualifications are valued. For fintech, a tech degree combined with finance knowledge is ideal. Banking exams require graduation in any discipline.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-chennai', 'jobs-in-hyderabad'],
    relatedCategories: ['bank-jobs', 'finance-jobs', 'it-jobs'],
    filterKeywords: ['banking', 'finance', 'bank', 'financial', 'insurance', 'accounting', 'fintech'],
  },
  {
    industry: 'Retail',
    slug: 'retail-jobs',
    h1: 'Latest Retail Jobs in India – Apply Now',
    metaTitle: 'Retail Jobs India 2026 – Store, E-commerce & Sales',
    metaDescription: 'Find retail jobs in India. Store management, e-commerce, visual merchandising, and sales openings. Apply on TrueJobs.',
    introContent: `
      <h2>Retail Industry in India</h2>
      <p>India's retail industry is the fourth-largest globally, valued at over $950 billion and growing at 10% annually. The sector encompasses organized retail (malls, chain stores, e-commerce) and unorganized retail (local shops, street vendors). Major players like Reliance Retail, DMart, Tata Group, Amazon India, and Flipkart are expanding aggressively, creating millions of jobs across sales, logistics, marketing, and technology. The convergence of online and offline retail (omnichannel) is reshaping career opportunities in the sector.</p>
      <p>E-commerce has transformed Indian retail, creating entirely new job categories in marketplace management, digital marketing, warehouse operations, last-mile delivery, and customer experience. Quick commerce (10-20 minute delivery) by companies like Zepto, Blinkit, and Swiggy Instamart has created a logistics revolution. Meanwhile, organized brick-and-mortar retail continues to expand, with Reliance Retail alone operating over 18,000 stores across India.</p>
      <h3>Career Paths in Retail</h3>
      <p>Retail offers diverse careers from store-level roles (sales associates, cashiers, visual merchandisers) to corporate positions (buying, merchandising, category management, supply chain). E-commerce roles include product listing, digital marketing, SEO, marketplace analytics, and customer experience management. Luxury retail offers specialized careers in brand management and VIP client services. Retail technology roles include POS systems, inventory management software, and retail analytics.</p>
      <h3>Salary Landscape</h3>
      <p>Retail salaries range from entry-level to highly competitive corporate packages. Sales associates earn ₹1.5–3 LPA, store managers ₹3–8 LPA. Category managers and buyers earn ₹8–20 LPA. E-commerce professionals earn ₹4–15 LPA. Retail tech professionals earn ₹5–20 LPA. Visual merchandisers earn ₹3–8 LPA. Senior leadership in retail can command ₹25–60 LPA or more at major chains.</p>
      <h3>Getting Started in Retail</h3>
      <p>Retail is one of the most accessible industries for freshers—no specific degree is required for store-level roles. MBA graduates with retail specialization are sought for management trainee programs. Build skills in inventory management, visual merchandising, customer service, and data analytics. Understanding both online and offline retail dynamics is increasingly important. Register on TrueJobs to find verified retail job opportunities across India.</p>
    `,
    keyRoles: ['Store Manager', 'Sales Associate', 'Visual Merchandiser', 'Category Manager', 'E-commerce Manager', 'Warehouse Manager', 'Retail Analyst', 'Supply Chain Executive'],
    salaryRange: [
      { role: 'Sales Associate', range: '₹1.5–3 LPA' },
      { role: 'Store Manager', range: '₹3–8 LPA' },
      { role: 'Category Manager', range: '₹8–20 LPA' },
      { role: 'E-commerce Manager', range: '₹5–15 LPA' },
      { role: 'Supply Chain Manager', range: '₹6–18 LPA' },
    ],
    growthTrends: [
      'Quick commerce creating massive logistics employment',
      'Omnichannel retail merging online and offline job roles',
      'Reliance Retail, DMart expanding store count aggressively',
      'Retail analytics and data-driven merchandising in demand',
      'D2C brands creating new brand management and marketing roles',
    ],
    faqItems: [
      { question: 'Is retail a good career in India?', answer: 'Yes, India\'s retail sector is growing rapidly with both online and offline channels. Career growth can be fast, especially in e-commerce and organized retail chains. Management roles offer competitive salaries.' },
      { question: 'What skills are needed for retail jobs?', answer: 'Customer service, communication, sales aptitude, inventory management, and basic computer skills. For e-commerce roles, digital marketing, analytics, and platform management skills are essential.' },
      { question: 'Do retail jobs require experience?', answer: 'Entry-level retail positions like sales associates generally don\'t require experience, making it an excellent sector for freshers. Management trainee programs at major chains accept fresh MBA graduates.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-hyderabad', 'jobs-in-chennai'],
    relatedCategories: ['sales-jobs', 'fresher-jobs', 'marketing-jobs'],
    filterKeywords: ['retail', 'store', 'shop', 'e-commerce', 'merchandising', 'sales executive'],
  },
  {
    industry: 'Education',
    slug: 'education-jobs',
    h1: 'Latest Education Jobs in India – Apply Now',
    metaTitle: 'Education Jobs India 2026 – Teaching, EdTech & Admin',
    metaDescription: 'Find education jobs in India. Teaching, EdTech, training, and administration openings. Apply on TrueJobs.',
    introContent: `
      <h2>Education Industry in India</h2>
      <p>India's education sector is the world's largest by student enrollment, with over 1.5 million schools and 50,000 higher education institutions serving 250+ million students. The sector employs over 10 million teachers and millions more in administration, content development, and support services. The EdTech revolution, catalyzed by the pandemic, has created an entirely new employment ecosystem with companies like BYJU'S, Unacademy, Vedantu, PhysicsWallah, and upGrad transforming how education is delivered.</p>
      <p>The New Education Policy (NEP) 2020 is reshaping the landscape with emphasis on skill-based learning, vocational training, and technology integration. This creates new roles in curriculum development, educational technology, assessment design, and teacher training. The coaching and test preparation industry, worth over ₹50,000 crore, employs hundreds of thousands in teaching, content creation, and operations across centers in Kota, Delhi, Hyderabad, and online platforms.</p>
      <h3>Career Paths in Education</h3>
      <p>Traditional teaching roles span from primary school teachers to university professors. EdTech companies hire content creators, product managers, learning designers, video editors, and technology developers. Coaching institutes need subject experts, mentors, and curriculum designers. Corporate training and L&D professionals are valued in all large companies. Education administration and school management is a growing career path. Educational consulting, assessment development, and policy research offer specialized careers.</p>
      <h3>Salary Overview</h3>
      <p>Education salaries vary significantly. Government school teachers earn ₹3–8 LPA. Private school teachers earn ₹2–6 LPA. University professors earn ₹6–20 LPA. EdTech content creators earn ₹4–15 LPA. Star teachers at coaching institutes can earn ₹10–50 LPA or more based on popularity. Corporate trainers earn ₹5–15 LPA. Education administrators at reputed institutions earn ₹6–20 LPA.</p>
      <h3>Building an Education Career</h3>
      <p>B.Ed and M.Ed are required for school teaching in most states. UGC NET is required for university teaching. EdTech companies value subject expertise combined with communication and content creation skills. Video production and online teaching skills are increasingly essential. Build a personal brand on YouTube or social media to enhance career prospects in education. Register on TrueJobs for the latest education sector opportunities.</p>
    `,
    keyRoles: ['Teacher', 'Professor', 'EdTech Content Creator', 'Curriculum Designer', 'Training Manager', 'School Principal', 'Education Consultant', 'Learning Designer'],
    salaryRange: [
      { role: 'Government Teacher', range: '₹3–8 LPA' },
      { role: 'University Professor', range: '₹6–20 LPA' },
      { role: 'EdTech Content Creator', range: '₹4–15 LPA' },
      { role: 'Corporate Trainer', range: '₹5–15 LPA' },
      { role: 'School Principal', range: '₹6–18 LPA' },
    ],
    growthTrends: [
      'EdTech platforms hiring content creators and product managers',
      'NEP 2020 creating demand for vocational and skill trainers',
      'Online coaching and test prep expanding nationally',
      'Corporate L&D becoming a specialized high-paying career',
      'AI in education creating new instructional design roles',
    ],
    faqItems: [
      { question: 'Is teaching a good career in India?', answer: 'Yes, teaching offers stability, social impact, and decent salaries, especially in government positions. EdTech has made teaching more lucrative for subject experts who can create engaging content.' },
      { question: 'How to become a teacher in India?', answer: 'Complete B.Ed (required for school teaching), qualify TET/CTET for government schools, and UGC NET for university positions. Subject expertise and communication skills are essential.' },
      { question: 'What are EdTech career opportunities?', answer: 'EdTech companies hire for content creation, product management, video production, learning design, marketing, and technology development. Subject expertise combined with digital skills is the ideal combination.' },
    ],
    topCities: ['jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-mumbai', 'jobs-in-hyderabad', 'jobs-in-pune'],
    relatedCategories: ['fresher-jobs', 'remote-jobs', 'it-jobs'],
    filterKeywords: ['education', 'teacher', 'teaching', 'professor', 'trainer', 'tutor', 'school', 'coaching'],
  },
  {
    industry: 'Manufacturing',
    slug: 'manufacturing-jobs',
    h1: 'Latest Manufacturing Jobs in India – Apply Now',
    metaTitle: 'Manufacturing Jobs India 2026 – Production & Engineering',
    metaDescription: 'Find manufacturing jobs in India. Production, quality, engineering, and factory management openings. Apply on TrueJobs.',
    introContent: `
      <h2>Manufacturing Industry in India</h2>
      <p>India's manufacturing sector contributes 17% to GDP and is a priority under the government's "Make in India" initiative. The sector employs over 60 million people across automobiles, electronics, textiles, pharmaceuticals, chemicals, steel, and food processing. India is the world's largest two-wheeler manufacturer, fourth-largest automobile market, and a major producer of steel, cement, and chemicals. Government incentives through PLI (Production-Linked Incentive) schemes are attracting global manufacturers to establish Indian operations.</p>
      <p>The manufacturing landscape is transforming with Industry 4.0 technologies—automation, IoT, AI-driven quality control, and smart factories. This creates demand for professionals who bridge traditional manufacturing expertise with digital skills. Major industrial corridors like Delhi-Mumbai Industrial Corridor, Chennai-Bangalore Industrial Corridor, and dedicated manufacturing zones are driving employment growth in both urban and semi-urban areas.</p>
      <h3>Key Manufacturing Sectors</h3>
      <p>Automobile manufacturing is centered in Chennai, Pune, Gurgaon, and Sanand. Electronics manufacturing, boosted by PLI schemes, is growing in Noida, Sri City, and Tamil Nadu. Pharmaceutical manufacturing thrives in Gujarat, Telangana, and Himachal Pradesh. Steel production is concentrated in Jharkhand, Odisha, and Chhattisgarh. Textile manufacturing spans Tamil Nadu, Gujarat, and Maharashtra. Food processing is distributed across agricultural regions nationwide.</p>
      <h3>Salary Landscape</h3>
      <p>Manufacturing salaries depend on industry, role, and location. Production engineers earn ₹3–8 LPA, quality managers ₹4–12 LPA, plant managers ₹8–25 LPA. Automation and robotics specialists earn ₹5–18 LPA. Supply chain managers earn ₹6–20 LPA. ITI and diploma holders earn ₹2–4 LPA at entry level. PSU manufacturing jobs (BHEL, HAL, BEML) offer ₹5–15 LPA with excellent benefits.</p>
      <h3>Future of Manufacturing Careers</h3>
      <p>Smart manufacturing, EV production, semiconductor fabrication, and green manufacturing are emerging high-growth areas. Build skills in automation (PLC/SCADA), quality management (Six Sigma, ISO), CAD/CAM, and IoT for manufacturing. Industry 4.0 certifications add significant value. The PLI-driven electronics manufacturing push is creating thousands of new jobs. Register on TrueJobs for verified manufacturing job openings across India.</p>
    `,
    keyRoles: ['Production Engineer', 'Quality Manager', 'Plant Manager', 'Supply Chain Manager', 'CNC Operator', 'Maintenance Engineer', 'Industrial Designer', 'Safety Officer'],
    salaryRange: [
      { role: 'Production Engineer', range: '₹3–8 LPA' },
      { role: 'Quality Manager', range: '₹4–12 LPA' },
      { role: 'Plant Manager', range: '₹8–25 LPA' },
      { role: 'CNC Operator', range: '₹2–5 LPA' },
      { role: 'Safety Officer', range: '₹3–8 LPA' },
    ],
    growthTrends: [
      'PLI scheme driving electronics and semiconductor manufacturing',
      'EV manufacturing creating new auto industry roles',
      'Industry 4.0 and automation transforming factory jobs',
      'Green manufacturing and sustainability roles emerging',
      'Defense manufacturing (Atmanirbhar Bharat) creating employment',
    ],
    faqItems: [
      { question: 'Is manufacturing a good career choice?', answer: 'Yes, manufacturing offers stable careers with clear growth paths. The Make in India initiative and PLI schemes are creating significant new opportunities, especially in electronics, EV, and defense manufacturing.' },
      { question: 'What qualifications do I need for manufacturing jobs?', answer: 'Engineering degrees (mechanical, electrical, industrial), diplomas, and ITI certifications are valued. Specialized certifications in Six Sigma, PLC, and CAD/CAM enhance career prospects significantly.' },
      { question: 'Which cities are best for manufacturing jobs?', answer: 'Chennai (auto hub), Pune (auto and engineering), Faridabad (manufacturing), Coimbatore (textiles and pumps), Jamshedpur (steel), and Pithampur (pharma and auto) are top manufacturing employment centers.' },
    ],
    topCities: ['jobs-in-chennai', 'jobs-in-pune', 'jobs-in-ahmedabad', 'jobs-in-coimbatore', 'jobs-in-faridabad'],
    relatedCategories: ['engineering-jobs', 'fresher-jobs'],
    filterKeywords: ['manufacturing', 'production', 'factory', 'plant', 'quality', 'assembly', 'industrial'],
  },
  {
    industry: 'E-commerce',
    slug: 'ecommerce-jobs',
    h1: 'Latest E-commerce Jobs in India – Apply Now',
    metaTitle: 'E-commerce Jobs India 2026 – Marketplace, Logistics & Tech',
    metaDescription: 'Find e-commerce jobs in India. Marketplace, logistics, warehouse, and tech openings. Apply on TrueJobs.',
    introContent: `
      <h2>E-commerce Industry in India</h2>
      <p>India's e-commerce market is one of the world's fastest-growing, projected to reach $200 billion by 2027. Major platforms like Amazon India, Flipkart, Meesho, Myntra, and Nykaa, along with quick commerce players like Zepto, Blinkit, and Swiggy Instamart, have created millions of jobs across technology, logistics, operations, and customer service. The sector has democratized commerce, enabling millions of small businesses to reach national markets while creating employment opportunities from warehouse workers to data scientists.</p>
      <p>The D2C (Direct-to-Consumer) boom has added another dimension, with thousands of Indian brands building direct digital sales channels. Social commerce through Instagram, WhatsApp, and platforms like Meesho has created micro-entrepreneurship opportunities for millions. The convergence of e-commerce with fintech (Buy Now Pay Later, digital payments) and logistics tech has made this one of the most dynamic employment sectors in India.</p>
      <h3>Career Opportunities</h3>
      <p>E-commerce offers careers across technology (platform development, app engineering, data science), operations (warehouse management, supply chain, inventory), marketing (digital marketing, SEO, social media), customer experience (support, returns management), and business (category management, vendor relations, pricing). Quick commerce has created hyper-local logistics roles. D2C brands need brand managers, performance marketers, and content creators.</p>
      <h3>Salary Overview</h3>
      <p>E-commerce salaries are highly competitive, especially for tech and product roles. Software engineers earn ₹6–25 LPA, data scientists ₹8–30 LPA. Category managers earn ₹8–20 LPA. Warehouse managers earn ₹3–8 LPA. Digital marketing professionals earn ₹4–15 LPA. Delivery executives earn ₹15,000–25,000/month. Product managers at top platforms earn ₹15–40 LPA. Growth marketers and performance marketers are among the highest-paid marketing professionals.</p>
      <h3>Building an E-commerce Career</h3>
      <p>Tech roles require engineering backgrounds with skills in Java, Python, and cloud technologies. Non-tech roles welcome diverse backgrounds—MBA, B.Com, and even arts graduates can build careers in marketing, operations, and vendor management. Build practical experience by running your own small online store. Learn tools like Google Analytics, Facebook Ads Manager, and marketplace seller dashboards. Register on TrueJobs for e-commerce job opportunities across India.</p>
    `,
    keyRoles: ['E-commerce Manager', 'Warehouse Manager', 'Delivery Executive', 'Data Scientist', 'Category Manager', 'Digital Marketing Manager', 'Supply Chain Analyst', 'Product Manager'],
    salaryRange: [
      { role: 'Software Engineer', range: '₹6–25 LPA' },
      { role: 'Category Manager', range: '₹8–20 LPA' },
      { role: 'Warehouse Manager', range: '₹3–8 LPA' },
      { role: 'Digital Marketing Manager', range: '₹5–15 LPA' },
      { role: 'Product Manager', range: '₹15–40 LPA' },
    ],
    growthTrends: [
      'Quick commerce hiring massively for logistics and delivery',
      'D2C brands creating new brand and marketing careers',
      'AI/ML in recommendation engines and pricing optimization',
      'Social commerce platforms creating community manager roles',
      'Cross-border e-commerce opening international trade careers',
    ],
    faqItems: [
      { question: 'Is e-commerce a good career field?', answer: 'Absolutely. E-commerce is one of India\'s fastest-growing sectors with diverse career opportunities from tech to logistics. The industry offers competitive salaries and rapid career progression.' },
      { question: 'What skills are needed for e-commerce jobs?', answer: 'Depends on the role—tech roles need programming, data roles need analytics, marketing roles need digital marketing skills, and operations roles need supply chain management. All roles benefit from understanding online consumer behavior.' },
      { question: 'Can freshers get e-commerce jobs?', answer: 'Yes, entry-level positions in customer service, warehouse operations, content management, and junior marketing are accessible to freshers. Management trainee programs at major platforms also accept fresh graduates.' },
    ],
    topCities: ['jobs-in-bangalore', 'jobs-in-delhi', 'jobs-in-mumbai', 'jobs-in-hyderabad', 'jobs-in-gurgaon'],
    relatedCategories: ['it-jobs', 'sales-jobs', 'marketing-jobs'],
    filterKeywords: ['ecommerce', 'e-commerce', 'online', 'marketplace', 'flipkart', 'amazon', 'delivery'],
  },
  {
    industry: 'Automobile',
    slug: 'automobile-jobs',
    h1: 'Latest Automobile Jobs in India – Apply Now',
    metaTitle: 'Automobile Jobs India 2026 – Auto, EV & Engineering',
    metaDescription: 'Find automobile jobs in India. Automotive engineering, EV, design, and manufacturing openings. Apply on TrueJobs.',
    introContent: `
      <h2>Automobile Industry in India</h2>
      <p>India's automobile industry is the world's third-largest by sales volume, contributing 7.1% to GDP and providing direct and indirect employment to over 37 million people. The industry spans passenger vehicles, commercial vehicles, two-wheelers, three-wheelers, and the rapidly growing electric vehicle segment. Major manufacturers include Maruti Suzuki, Tata Motors, Mahindra, Hyundai, and Hero MotoCorp, while global OEMs like Toyota, Honda, and MG have significant Indian operations.</p>
      <p>The EV revolution is transforming the industry with companies like Tata Motors, Ola Electric, Ather Energy, and numerous startups investing heavily in electric vehicle development, battery technology, and charging infrastructure. India's target of 30% EV penetration by 2030 is creating entirely new career paths in battery engineering, EV powertrain design, charging network management, and sustainable mobility solutions.</p>
      <h3>Career Paths</h3>
      <p>The auto industry offers careers in vehicle design, production engineering, quality control, supply chain management, R&D, sales and marketing, and after-sales service. EV-specific roles include battery management system engineers, electric powertrain designers, and charging infrastructure developers. Autonomous driving and connected vehicle technologies are creating software-heavy roles in traditional auto companies. Auto component manufacturing employs millions in tier-1 and tier-2 supplier companies.</p>
      <h3>Salary Overview</h3>
      <p>Automobile engineering freshers earn ₹3–6 LPA, experienced design engineers ₹8–18 LPA. Production managers earn ₹5–15 LPA. R&D specialists in EV technology earn ₹8–25 LPA. Auto sales managers earn ₹4–12 LPA. Quality engineers earn ₹3–8 LPA. Senior leadership at OEMs can command ₹30–80 LPA.</p>
      <h3>Industry Future</h3>
      <p>EV transition, connected vehicles, shared mobility, and autonomous driving are the four megatrends shaping auto careers. Build skills in embedded systems, battery technology, automotive software, and EV powertrain engineering. Traditional mechanical engineering skills combined with electronics and software knowledge create the ideal profile. Register on TrueJobs for automobile industry job openings across India.</p>
    `,
    keyRoles: ['Automotive Engineer', 'Production Manager', 'Quality Engineer', 'EV Battery Engineer', 'Auto Sales Manager', 'R&D Specialist', 'Supply Chain Manager', 'Vehicle Designer'],
    salaryRange: [
      { role: 'Automotive Engineer', range: '₹3–10 LPA' },
      { role: 'Production Manager', range: '₹5–15 LPA' },
      { role: 'EV R&D Engineer', range: '₹8–25 LPA' },
      { role: 'Quality Engineer', range: '₹3–8 LPA' },
      { role: 'Auto Sales Manager', range: '₹4–12 LPA' },
    ],
    growthTrends: [
      'EV manufacturing creating new engineering and tech roles',
      'Battery technology and charging infra hiring specialists',
      'Connected car software development growing rapidly',
      'Auto component PLI scheme driving supplier employment',
      'Shared mobility platforms hiring operations and tech talent',
    ],
    faqItems: [
      { question: 'Is automobile engineering a good career?', answer: 'Yes, especially with the EV transition creating demand for engineers who combine mechanical knowledge with electronics and software skills. India\'s growing auto market ensures long-term career opportunities.' },
      { question: 'What are EV career opportunities?', answer: 'EV careers include battery engineering, electric powertrain design, charging infrastructure development, BMS programming, and sustainable mobility planning. These are among the highest-paying engineering roles.' },
      { question: 'Which cities are best for auto industry jobs?', answer: 'Chennai (India\'s Detroit), Pune, Gurgaon/Manesar, Sanand (Gujarat), and Faridabad are the major automobile manufacturing hubs with the most employment opportunities.' },
    ],
    topCities: ['jobs-in-chennai', 'jobs-in-pune', 'jobs-in-gurgaon', 'jobs-in-faridabad', 'jobs-in-ahmedabad'],
    relatedCategories: ['engineering-jobs', 'sales-jobs', 'fresher-jobs'],
    filterKeywords: ['automobile', 'automotive', 'car', 'vehicle', 'EV', 'motor', 'auto'],
  },
  {
    industry: 'Hospitality & Tourism',
    slug: 'hospitality-tourism-jobs',
    h1: 'Latest Hospitality & Tourism Jobs in India – Apply Now',
    metaTitle: 'Hospitality & Tourism Jobs India 2026 – Hotel & Travel',
    metaDescription: 'Find hospitality and tourism jobs in India. Hotel management, travel, and food service openings. Apply on TrueJobs.',
    introContent: `
      <h2>Hospitality & Tourism Industry in India</h2>
      <p>India's tourism and hospitality sector is a $275 billion industry contributing nearly 10% to GDP and employing over 40 million people. The sector encompasses hotels, restaurants, travel agencies, airlines, cruise lines, adventure tourism, medical tourism, and the rapidly growing online travel segment. India's diverse cultural heritage, 40 UNESCO World Heritage sites, varied geography from Himalayas to beaches, and growing business travel make it one of the world's most promising tourism markets.</p>
      <p>Major hotel chains like Taj, Oberoi, ITC Hotels, Marriott, and Hyatt are expanding across India, creating management and operational roles. Budget hotel chains like OYO and Treebo have democratized hospitality employment. The food and beverage industry, including restaurants, cloud kitchens, and food delivery platforms, has created millions of jobs. Online travel agencies like MakeMyTrip, Yatra, and Cleartrip employ thousands in tech and operations.</p>
      <h3>Career Opportunities</h3>
      <p>Front-of-house roles include receptionists, concierge, restaurant managers, and guest relations. Back-of-house includes chefs, housekeeping, maintenance, and F&B operations. Travel industry roles cover travel agents, tour operators, airline crew, and destination management. Specialized careers include revenue management, hospitality marketing, event management, and luxury brand management. The food tech revolution has created roles in cloud kitchen management, delivery logistics, and food app development.</p>
      <h3>Salary Trends</h3>
      <p>Hotel management freshers earn ₹2–4 LPA, experienced managers ₹6–15 LPA. Executive chefs at luxury hotels earn ₹10–30 LPA. Travel agents earn ₹2–6 LPA. Airlines crew earn ₹3–10 LPA. Revenue managers at hotel chains earn ₹8–20 LPA. General managers at premium properties earn ₹20–50 LPA. Tips and service charges can significantly supplement base salaries in premium establishments.</p>
      <h3>Career Growth Tips</h3>
      <p>Hotel management degrees from IHM institutes are the traditional entry path. However, the industry increasingly values experience and personality. Learn multiple languages for better guest interaction. Certifications in revenue management, food safety, and hospitality technology add value. Build expertise in digital marketing for hospitality. Consider niche segments like adventure tourism, wellness tourism, or MICE (Meetings, Incentives, Conferences, Events) for specialized careers. Register on TrueJobs for hospitality and tourism openings.</p>
    `,
    keyRoles: ['Hotel Manager', 'Executive Chef', 'Travel Agent', 'Restaurant Manager', 'Event Manager', 'Revenue Manager', 'Tour Guide', 'Airline Crew'],
    salaryRange: [
      { role: 'Hotel Management Trainee', range: '₹2–4 LPA' },
      { role: 'Restaurant Manager', range: '₹3–10 LPA' },
      { role: 'Executive Chef', range: '₹8–30 LPA' },
      { role: 'Travel Agent', range: '₹2.5–6 LPA' },
      { role: 'Hotel GM', range: '₹15–50 LPA' },
    ],
    growthTrends: [
      'Domestic tourism booming with improved infrastructure',
      'Cloud kitchens and food delivery creating new restaurant careers',
      'Medical and wellness tourism growing rapidly',
      'Adventure and experiential tourism opening niche roles',
      'Hotel tech (revenue management, PMS) becoming specialized career',
    ],
    faqItems: [
      { question: 'Is hospitality a good career in India?', answer: 'Yes, India\'s growing tourism market offers excellent career opportunities. Premium hotels and travel companies offer competitive salaries, international exposure, and rapid career growth for dedicated professionals.' },
      { question: 'What qualification is needed for hotel jobs?', answer: 'Hotel Management degree from IHM or equivalent is ideal. However, many roles accept graduates with hospitality certifications. Personality, communication skills, and guest service orientation matter most.' },
      { question: 'Which cities are best for hospitality careers?', answer: 'Goa, Mumbai, Delhi, Jaipur, Udaipur, Bangalore, and Kerala are top destinations for hospitality careers with luxury hotels, restaurants, and tourism operations.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-jaipur', 'jobs-in-kochi'],
    relatedCategories: ['fresher-jobs', 'sales-jobs'],
    filterKeywords: ['hotel', 'hospitality', 'tourism', 'restaurant', 'travel', 'chef', 'food'],
  },
  {
    industry: 'Real Estate',
    slug: 'real-estate-jobs',
    h1: 'Latest Real Estate Jobs in India – Apply Now',
    metaTitle: 'Real Estate Jobs India 2026 – Property, Construction & Sales',
    metaDescription: 'Find real estate jobs in India. Property sales, construction management, and architecture openings. Apply on TrueJobs.',
    introContent: `
      <h2>Real Estate Industry in India</h2>
      <p>India's real estate sector is the second-largest employer after agriculture, contributing 7-8% to GDP and expected to reach a market size of $1 trillion by 2030. The sector encompasses residential, commercial, retail, hospitality, and industrial real estate, with major developers like DLF, Godrej Properties, Prestige Group, Brigade, and Lodha driving organized development. Government initiatives like RERA, Smart Cities Mission, and PMAY (affordable housing) have brought transparency and growth to the sector.</p>
      <p>The commercial real estate segment is booming with India becoming the world's largest flexible office space market. Data center construction is driving industrial real estate. Residential demand, particularly in the affordable and mid-segment, continues to grow. PropTech companies like NoBroker, Housing.com, and 99acres have created technology-driven careers in real estate. The construction technology and green building movements are adding new dimensions to employment.</p>
      <h3>Career Paths</h3>
      <p>Real estate offers careers in sales (property consultants, channel partners), construction management (project managers, site engineers), architecture and design, property management, real estate finance (valuation, investment analysis), and PropTech. RERA compliance has created regulatory and legal roles. Green building certification (LEED, IGBC) is a growing specialization. Real estate marketing, particularly digital marketing for property sales, is a high-growth area.</p>
      <h3>Salary Overview</h3>
      <p>Real estate sales executives earn ₹2–5 LPA base plus commissions (top performers earn ₹10–30 LPA). Construction project managers earn ₹6–18 LPA. Architects earn ₹3–15 LPA. Real estate valuers earn ₹4–12 LPA. Property managers earn ₹3–8 LPA. Senior leadership at developers earn ₹25–60 LPA. Commission-based roles offer unlimited earning potential.</p>
      <h3>Getting Started</h3>
      <p>Civil engineering, architecture, and MBA in Real Estate are the traditional qualifications. However, sales roles are open to graduates from any background with strong communication skills. RERA agent registration is required for property sales. Learn about property law, valuation methods, and construction technology. Digital marketing skills are increasingly valuable for property marketing roles. Register on TrueJobs for real estate career opportunities.</p>
    `,
    keyRoles: ['Property Consultant', 'Construction Manager', 'Architect', 'Real Estate Analyst', 'Property Manager', 'Site Engineer', 'Interior Designer', 'Real Estate Marketer'],
    salaryRange: [
      { role: 'Property Consultant', range: '₹2–5 LPA + Commission' },
      { role: 'Construction Manager', range: '₹6–18 LPA' },
      { role: 'Architect', range: '₹3–15 LPA' },
      { role: 'Real Estate Analyst', range: '₹5–15 LPA' },
      { role: 'Site Engineer', range: '₹3–8 LPA' },
    ],
    growthTrends: [
      'Commercial real estate and co-working spaces expanding',
      'PropTech companies hiring tech talent for real estate platforms',
      'Green building and sustainability creating new roles',
      'Data center construction driving industrial real estate',
      'RERA compliance creating regulatory and legal positions',
    ],
    faqItems: [
      { question: 'Is real estate a good career?', answer: 'Yes, particularly in sales where top performers earn very well through commissions. Construction management, architecture, and PropTech also offer excellent career paths with India\'s growing urban development.' },
      { question: 'Do I need a license to sell property?', answer: 'Yes, RERA agent registration is required in most states for property sales. The process involves an application to your state RERA authority with required documents and fees.' },
      { question: 'What skills are needed for real estate?', answer: 'Strong communication and negotiation for sales roles. Technical skills (AutoCAD, project management) for construction. Financial analysis and valuation for advisory roles. Digital marketing for property marketing.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-bangalore', 'jobs-in-delhi', 'jobs-in-hyderabad', 'jobs-in-pune'],
    relatedCategories: ['sales-jobs', 'engineering-jobs'],
    filterKeywords: ['real estate', 'property', 'construction', 'builder', 'architect', 'housing'],
  },
  {
    industry: 'Telecom',
    slug: 'telecom-jobs',
    h1: 'Latest Telecom Jobs in India – Apply Now',
    metaTitle: 'Telecom Jobs India 2026 – Network, 5G & Tower',
    metaDescription: 'Find telecom jobs in India. Network engineering, 5G, tower operations, and sales openings. Apply on TrueJobs.',
    introContent: `
      <h2>Telecom Industry in India</h2>
      <p>India's telecom sector is the world's second-largest by subscribers with over 1.15 billion connections. Major operators Jio, Airtel, and Vodafone Idea employ hundreds of thousands directly and millions indirectly through tower companies, equipment vendors, and service providers. The 5G rollout across India is creating massive employment in network planning, installation, optimization, and 5G application development. The industry's contribution to digital India—enabling e-commerce, fintech, EdTech, and remote work—makes it foundational to the broader economy.</p>
      <p>Tower companies like Indus Towers and ATC India manage over 200,000 cell towers requiring ongoing maintenance and upgrades. Equipment vendors like Ericsson, Nokia, Samsung, and emerging Indian companies like Tejas Networks hire engineers and project managers. The convergence of telecom with IT, cloud computing, and IoT is creating new career paths. Satellite communications, with OneWeb and ISRO's GSAT program, are adding another dimension to the telecom employment landscape.</p>
      <h3>Career Paths</h3>
      <p>Network engineering (RF planning, optimization, core network), tower operations (site acquisition, construction, maintenance), sales and distribution (enterprise sales, retail, channel management), and technology development (software-defined networking, 5G applications, VoLTE). Customer experience roles include contact center management and digital customer service. Emerging roles include edge computing specialists, IoT solution architects, and private 5G network designers for enterprises.</p>
      <h3>Salary Overview</h3>
      <p>Network engineers earn ₹3–10 LPA, senior RF planners ₹8–18 LPA. Tower technicians earn ₹2–5 LPA. Telecom sales managers earn ₹4–12 LPA. 5G specialists earn ₹8–25 LPA. Enterprise solution architects earn ₹12–30 LPA. Tower operations managers earn ₹5–12 LPA. The industry offers good career stability and growth as India's digital infrastructure continues to expand.</p>
      <h3>Future Outlook</h3>
      <p>5G, IoT, edge computing, and satellite broadband are the growth drivers. Build skills in 5G NR technology, cloud-native networking, network automation, and cybersecurity. Certifications from Cisco (CCNA/CCNP), Huawei (HCIP), and Nokia are valued. Understanding of AI/ML applications in network optimization is a differentiator. The industry offers stable employment with clear career progression paths.</p>
    `,
    keyRoles: ['Network Engineer', 'RF Planning Engineer', 'Tower Technician', 'Telecom Sales Manager', '5G Specialist', 'Solution Architect', 'NOC Engineer', 'Field Engineer'],
    salaryRange: [
      { role: 'Network Engineer', range: '₹3–10 LPA' },
      { role: 'RF Planning Engineer', range: '₹5–15 LPA' },
      { role: '5G Specialist', range: '₹8–25 LPA' },
      { role: 'Telecom Sales Manager', range: '₹4–12 LPA' },
      { role: 'Solution Architect', range: '₹12–30 LPA' },
    ],
    growthTrends: [
      '5G rollout creating massive network deployment employment',
      'Enterprise 5G and private networks opening new market',
      'IoT connectivity creating solution design roles',
      'Satellite broadband (OneWeb, ISRO) adding new career paths',
      'Network automation and AI-ops transforming operations',
    ],
    faqItems: [
      { question: 'Is telecom a good career in India?', answer: 'Yes, India\'s ongoing 5G rollout and digital infrastructure expansion ensure strong employment demand. The industry offers stable careers with clear growth paths from technical to management roles.' },
      { question: 'What qualifications are needed for telecom jobs?', answer: 'Electronics/telecom engineering degrees are ideal. Certifications from Cisco, Huawei, or Nokia add significant value. For non-technical roles, management or marketing backgrounds are accepted.' },
      { question: 'What is the impact of 5G on telecom jobs?', answer: '5G is creating thousands of new jobs in network planning, deployment, optimization, and application development. It\'s also driving demand for edge computing, IoT, and private network specialists.' },
    ],
    topCities: ['jobs-in-delhi', 'jobs-in-mumbai', 'jobs-in-bangalore', 'jobs-in-gurgaon', 'jobs-in-hyderabad'],
    relatedCategories: ['it-jobs', 'engineering-jobs', 'sales-jobs'],
    filterKeywords: ['telecom', 'network', 'tower', '5G', 'mobile', 'broadband', 'communication'],
  },
  {
    industry: 'Media & Entertainment',
    slug: 'media-entertainment-jobs',
    h1: 'Latest Media & Entertainment Jobs in India – Apply Now',
    metaTitle: 'Media & Entertainment Jobs India 2026 – Content & Digital',
    metaDescription: 'Find media and entertainment jobs in India. Content creation, journalism, OTT, and digital media openings. Apply on TrueJobs.',
    introContent: `
      <h2>Media & Entertainment Industry in India</h2>
      <p>India's Media & Entertainment (M&E) industry is valued at over $28 billion and growing at 8-9% annually, making it one of the world's most vibrant entertainment markets. The sector spans television, digital media, film (Bollywood, regional cinema), print, radio, gaming, animation, and OTT platforms. The explosion of digital content consumption, with over 450 million OTT subscribers and growing, has created unprecedented demand for content creators, technicians, and digital media professionals.</p>
      <p>OTT platforms like Netflix, Amazon Prime Video, Disney+ Hotstar, JioCinema, and regional players are investing billions in original Indian content, creating massive employment in production, post-production, and content development. YouTube India's 500+ million user base has created a creator economy supporting independent content creators, editors, and production teams. Digital advertising growth is driving demand for digital marketing, programmatic advertising, and content strategy professionals.</p>
      <h3>Career Opportunities</h3>
      <p>Content creation (writers, directors, producers, actors), production (camera, sound, lighting, editing), post-production (VFX, animation, color grading), journalism (print, digital, broadcast), digital marketing, social media management, and content strategy. The gaming industry is hiring designers, developers, and esports professionals. Podcast production and audio content are emerging segments. Data-driven roles in audience analytics, content recommendation, and programmatic advertising are growing rapidly.</p>
      <h3>Salary Overview</h3>
      <p>Media salaries vary enormously. Journalists earn ₹3–10 LPA, senior editors ₹10–25 LPA. Content writers earn ₹2.5–8 LPA. Video editors earn ₹3–12 LPA. VFX artists earn ₹4–15 LPA. Social media managers earn ₹3–10 LPA. Digital marketing managers earn ₹6–18 LPA. Film directors and producers' earnings vary widely from project to project. Successful YouTubers and content creators can earn ₹5–50 LPA or more.</p>
      <h3>Building a Media Career</h3>
      <p>Mass communication and journalism degrees are traditional paths. However, the digital era values portfolio and skills over formal qualifications. Build a strong online presence through YouTube, Instagram, or a blog. Learn video production, editing (Premiere Pro, Final Cut), and digital marketing. Understanding analytics and audience behavior is crucial. The industry rewards creativity, persistence, and the ability to adapt to rapidly changing platforms and formats.</p>
    `,
    keyRoles: ['Content Creator', 'Journalist', 'Video Editor', 'VFX Artist', 'Social Media Manager', 'Digital Marketing Manager', 'Producer', 'Game Designer'],
    salaryRange: [
      { role: 'Journalist', range: '₹3–10 LPA' },
      { role: 'Video Editor', range: '₹3–12 LPA' },
      { role: 'VFX Artist', range: '₹4–15 LPA' },
      { role: 'Social Media Manager', range: '₹3–10 LPA' },
      { role: 'Digital Marketing Manager', range: '₹6–18 LPA' },
    ],
    growthTrends: [
      'OTT platforms investing heavily in original Indian content',
      'Creator economy on YouTube and Instagram growing rapidly',
      'Gaming and esports industry creating design and tech roles',
      'AI-generated content tools creating new production workflows',
      'Regional language content demand driving localized hiring',
    ],
    faqItems: [
      { question: 'Is media a good career field?', answer: 'Yes, especially in digital media which is growing rapidly. Content creation, video production, and digital marketing offer excellent opportunities. The key is building a strong portfolio and adapting to platform trends.' },
      { question: 'What skills are needed for media jobs?', answer: 'Writing, video production and editing, photography, social media management, digital marketing, and analytics. Technical skills in tools like Adobe Creative Suite, and understanding of platform algorithms are valuable.' },
      { question: 'Can I build a media career without a degree?', answer: 'Yes, the media industry increasingly values skills and portfolio over formal education. Building a strong online presence through content creation can be more valuable than a traditional media degree.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-hyderabad', 'jobs-in-noida'],
    relatedCategories: ['marketing-jobs', 'it-jobs', 'fresher-jobs'],
    filterKeywords: ['media', 'entertainment', 'content', 'journalist', 'editor', 'video', 'creative'],
  },
  {
    industry: 'Energy',
    slug: 'energy-jobs',
    h1: 'Latest Energy Jobs in India – Apply Now',
    metaTitle: 'Energy Jobs India 2026 – Renewable, Oil & Power',
    metaDescription: 'Find energy jobs in India. Renewable energy, oil & gas, power generation, and solar openings. Apply on TrueJobs.',
    introContent: `
      <h2>Energy Industry in India</h2>
      <p>India's energy sector is undergoing the largest transformation in its history as the country targets 500 GW of renewable energy capacity by 2030. The sector encompasses traditional power generation (thermal, hydro, nuclear), oil and gas (ONGC, IOCL, BPCL, GAIL), renewable energy (solar, wind, green hydrogen), and power distribution. India is the world's third-largest energy consumer and has committed to net-zero emissions by 2070, creating massive employment in both traditional and clean energy sectors.</p>
      <p>The renewable energy segment is the fastest-growing, with India adding 15-20 GW of solar capacity annually. Companies like Adani Green, Tata Power, ReNew, and international players like Engie and Total are hiring aggressively. The green hydrogen mission targets 5 million tonnes of production by 2030, creating an entirely new industrial value chain. Traditional energy companies (NTPC, ONGC, Coal India) continue to hire while transitioning their portfolios toward cleaner energy.</p>
      <h3>Career Paths</h3>
      <p>Power generation (plant engineers, operators), renewable energy (solar engineers, wind farm managers, green hydrogen specialists), oil and gas (petroleum engineers, refinery operators, pipeline engineers), power distribution (electrical engineers, smart grid specialists), and energy consulting. Emerging roles include carbon credit analysts, ESG specialists, battery storage engineers, and EV charging infrastructure managers. Energy data analytics and grid modernization create tech-energy hybrid careers.</p>
      <h3>Salary Overview</h3>
      <p>PSU energy jobs (ONGC, NTPC, IOCL) offer ₹6–20 LPA with excellent benefits. Solar engineers earn ₹3–10 LPA, wind energy professionals ₹4–15 LPA. Petroleum engineers earn ₹5–25 LPA. Power plant engineers earn ₹4–15 LPA. Green hydrogen specialists command ₹8–25 LPA given the nascent sector's talent scarcity. Energy consultants earn ₹6–20 LPA. Senior roles in energy companies can reach ₹30–60 LPA.</p>
      <h3>Career Advice</h3>
      <p>Electrical, mechanical, and chemical engineering are the primary qualifications. Specialized courses in solar energy, wind energy, and sustainability management add value. GATE is essential for PSU recruitment. Certifications in solar PV design, energy auditing (BEE), and sustainability (LEED AP) are valuable. The sector offers excellent long-term career prospects given India's massive energy transition investments. Register on TrueJobs for energy sector job openings.</p>
    `,
    keyRoles: ['Solar Engineer', 'Power Plant Engineer', 'Petroleum Engineer', 'Electrical Engineer', 'Wind Farm Manager', 'Energy Auditor', 'Green Hydrogen Specialist', 'Grid Engineer'],
    salaryRange: [
      { role: 'PSU Engineer (NTPC/ONGC)', range: '₹6–20 LPA' },
      { role: 'Solar Engineer', range: '₹3–10 LPA' },
      { role: 'Petroleum Engineer', range: '₹5–25 LPA' },
      { role: 'Energy Consultant', range: '₹6–20 LPA' },
      { role: 'Green Hydrogen Specialist', range: '₹8–25 LPA' },
    ],
    growthTrends: [
      'Solar energy capacity addition creating installation and maintenance jobs',
      'Green hydrogen mission opening entirely new career paths',
      'Battery storage and grid modernization hiring specialists',
      'Carbon credit and ESG consulting becoming mainstream',
      'Oil and gas companies transitioning portfolios, hiring clean energy talent',
    ],
    faqItems: [
      { question: 'Is renewable energy a good career?', answer: 'Excellent career choice. India\'s target of 500 GW renewable capacity by 2030 ensures sustained demand for solar, wind, and green hydrogen professionals. The sector offers competitive salaries and meaningful work.' },
      { question: 'How to get a PSU energy job?', answer: 'Qualify through GATE for companies like NTPC, ONGC, IOCL, GAIL, and BPCL. These offer some of the best-paying and most secure engineering careers in India with excellent benefits.' },
      { question: 'What qualifications are needed for energy sector?', answer: 'Electrical, mechanical, or chemical engineering degrees are ideal. Specialized certifications in solar PV, wind energy, energy auditing (BEE), or sustainability (LEED AP) enhance career prospects significantly.' },
    ],
    topCities: ['jobs-in-delhi', 'jobs-in-mumbai', 'jobs-in-ahmedabad', 'jobs-in-hyderabad', 'jobs-in-chennai'],
    relatedCategories: ['engineering-jobs', 'fresher-jobs'],
    filterKeywords: ['energy', 'power', 'solar', 'renewable', 'oil', 'gas', 'electrical', 'green'],
  },

  // ── Pharma ──
  {
    industry: 'Pharma',
    slug: 'pharma-jobs',
    h1: 'Latest Pharma Jobs in India – Apply Now',
    metaTitle: 'Pharma Jobs India 2026 – Pharmaceutical & Drug Manufacturing',
    metaDescription: 'Find pharma jobs in India. Drug manufacturing, R&D, quality control, and regulatory affairs openings. Apply on TrueJobs.',
    introContent: `
      <h2>Pharmaceutical Industry in India</h2>
      <p>India is the "Pharmacy of the World," supplying 60% of global vaccines and 20% of the world's generic medicines. The Indian pharmaceutical industry is valued at $50+ billion and growing at 10-12% annually. Major companies like Sun Pharma, Dr. Reddy's, Cipla, Lupin, Aurobindo, and Biocon lead the sector. The industry spans drug formulation, API manufacturing, clinical research, regulatory affairs, and pharmaceutical marketing. India's pharma clusters in Hyderabad, Ahmedabad, Mumbai, Baddi (HP), and Sikkim create region-specific employment hubs.</p>
      <p>The biosimilars market is a major growth area where Indian companies are building global competitiveness. Contract research and manufacturing organizations (CROs/CMOs) are expanding as global pharma outsources to India. Quality control and regulatory compliance are critical functions given stringent US FDA and WHO standards. Digital pharma—using AI for drug discovery, telemedicine integration, and supply chain digitization—is creating new career categories.</p>
      <h3>Career Paths</h3>
      <p>R&D (drug discovery, formulation development), manufacturing (production, quality control, QA), regulatory affairs (CDSCO, US FDA compliance), clinical research (CRAs, data managers), pharmaceutical marketing (medical representatives, product managers), pharmacovigilance, and supply chain management. B.Pharm and M.Pharm are the primary qualifications.</p>
      <h3>Salary Overview</h3>
      <p>B.Pharm freshers earn ₹2.5–4 LPA. Medical representatives earn ₹3–8 LPA with incentives. QC/QA analysts earn ₹3–8 LPA. R&D scientists earn ₹5–15 LPA. Regulatory affairs specialists earn ₹5–15 LPA. Senior management in top pharma companies earns ₹25–60 LPA.</p>
      <h3>Career Advice</h3>
      <p>B.Pharm/M.Pharm from reputed institutions provides the best foundation. For manufacturing, target pharma clusters in Hyderabad, Baddi, or Ahmedabad. Regulatory affairs is a high-growth specialization. Clinical research offers global career mobility. Pharmaceutical marketing is accessible with science graduates. Register on TrueJobs for pharma sector openings.</p>
    `,
    keyRoles: ['Pharmacist', 'Medical Representative', 'QC Analyst', 'R&D Scientist', 'Regulatory Affairs Specialist', 'Clinical Research Associate', 'Production Manager', 'Drug Safety Associate'],
    salaryRange: [
      { role: 'Medical Representative', range: '₹3–8 LPA' },
      { role: 'QC/QA Analyst', range: '₹3–8 LPA' },
      { role: 'R&D Scientist', range: '₹5–15 LPA' },
      { role: 'Regulatory Affairs', range: '₹5–15 LPA' },
      { role: 'Production Manager', range: '₹6–18 LPA' },
    ],
    growthTrends: [
      'Biosimilars creating new R&D and manufacturing jobs',
      'Contract research organizations expanding in India',
      'Digital pharma and AI drug discovery emerging',
      'Quality compliance roles growing with regulatory scrutiny',
      'Pharma marketing evolving with digital channels',
    ],
    faqItems: [
      { question: 'Is pharma a good career in India?', answer: 'Excellent. India\'s position as the world\'s pharmacy ensures sustained demand. The sector offers diverse careers from manufacturing to marketing to research with competitive salaries.' },
      { question: 'What qualifications are needed?', answer: 'B.Pharm/M.Pharm for core roles. B.Sc/M.Sc in Chemistry or Microbiology for QC/R&D. MBA for pharma marketing management. Clinical research requires additional certifications.' },
    ],
    topCities: ['jobs-in-hyderabad', 'jobs-in-mumbai', 'jobs-in-ahmedabad', 'jobs-in-bangalore', 'jobs-in-pune'],
    relatedCategories: ['engineering-jobs', 'sales-jobs', 'fresher-jobs'],
    filterKeywords: ['pharma', 'pharmaceutical', 'drug', 'medicine', 'pharmacy', 'formulation', 'medical representative'],
  },

  // ── FMCG ──
  {
    industry: 'FMCG',
    slug: 'fmcg-jobs',
    h1: 'Latest FMCG Jobs in India – Apply Now',
    metaTitle: 'FMCG Jobs India 2026 – Consumer Goods & Retail Careers',
    metaDescription: 'Find FMCG jobs in India. Sales, marketing, supply chain, and production roles in consumer goods. Apply on TrueJobs.',
    introContent: `
      <h2>FMCG Industry in India</h2>
      <p>India's Fast-Moving Consumer Goods (FMCG) sector is the fourth-largest in the world, valued at over $110 billion. Companies like Hindustan Unilever, ITC, Nestlé, Procter & Gamble, Dabur, Marico, Godrej, and Britannia are among India's most admired employers. The sector spans food and beverages, personal care, home care, healthcare OTC products, and tobacco. FMCG companies are known for structured career development, strong brands, and competitive compensation.</p>
      <p>The sector's sales and distribution network is India's most extensive, reaching 10+ million retail outlets including remote rural areas. Direct-to-consumer (D2C) brands have disrupted traditional FMCG, creating new career opportunities in e-commerce, performance marketing, and digital supply chains. Rural India's growing consumption is the biggest growth driver, with FMCG companies expanding deeper into tier-3/4/5 markets.</p>
      <h3>Career Paths</h3>
      <p>Sales (sales officer → area manager → regional manager → VP sales), marketing (brand executive → brand manager → marketing director → CMO), supply chain, manufacturing (production → plant manager), R&D (food technology, formulation), finance, and HR. FMCG management trainee programs are among the most competitive in India.</p>
      <h3>Salary Overview</h3>
      <p>Management trainees at top FMCG companies earn ₹8–15 LPA. Sales officers earn ₹4–8 LPA. Brand managers earn ₹15–30 LPA. Supply chain managers earn ₹10–25 LPA. Senior leadership (VP+) can earn ₹50–1.5 Cr. FMCG salaries are among the highest in traditional industries.</p>
      <h3>Career Advice</h3>
      <p>MBA from top B-schools is the primary entry for management roles. Engineering + MBA for supply chain and production. Sales roles are accessible with any graduation. Build skills in digital marketing, data analytics, and D2C strategies. Register on TrueJobs for FMCG opportunities.</p>
    `,
    keyRoles: ['Sales Officer', 'Brand Manager', 'Area Sales Manager', 'Supply Chain Manager', 'Production Manager', 'Trade Marketing Manager', 'R&D Scientist', 'Category Manager'],
    salaryRange: [
      { role: 'Sales Officer', range: '₹4–8 LPA' },
      { role: 'Brand Manager', range: '₹15–30 LPA' },
      { role: 'Supply Chain Manager', range: '₹10–25 LPA' },
      { role: 'Plant Manager', range: '₹15–30 LPA' },
      { role: 'Management Trainee (Top FMCG)', range: '₹8–15 LPA' },
    ],
    growthTrends: [
      'D2C brands disrupting traditional FMCG distribution',
      'Rural consumption driving sales force expansion',
      'Digital marketing transforming brand management',
      'Sustainable packaging creating green jobs',
      'Health and wellness products as fastest-growing category',
    ],
    faqItems: [
      { question: 'How to get into FMCG companies?', answer: 'Top FMCG companies recruit primarily from premier B-schools for management roles. Sales roles are accessible with graduation. Build strong communication, analytical, and leadership skills.' },
      { question: 'Is FMCG a good career?', answer: 'Excellent. FMCG companies offer structured career growth, competitive salaries, strong brands on your resume, and extensive training. The sector is recession-resistant.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-chennai', 'jobs-in-kolkata'],
    relatedCategories: ['sales-jobs', 'marketing-jobs', 'fresher-jobs'],
    filterKeywords: ['FMCG', 'consumer goods', 'HUL', 'ITC', 'Nestlé', 'sales officer', 'brand manager'],
  },

  // ── Construction ──
  {
    industry: 'Construction',
    slug: 'construction-jobs',
    h1: 'Latest Construction Jobs in India – Apply Now',
    metaTitle: 'Construction Jobs India 2026 – Civil, Site & Infrastructure',
    metaDescription: 'Find construction jobs in India. Civil engineering, site management, and infrastructure roles. Apply on TrueJobs.',
    introContent: `
      <h2>Construction Industry in India</h2>
      <p>India's construction industry is the second-largest employer after agriculture, valued at $738 billion and projected to become the world's third-largest construction market. The sector encompasses residential housing, commercial real estate, infrastructure (highways, bridges, metros), industrial construction, and smart city development. Companies like L&T, Shapoorji Pallonji, Tata Projects, Afcons, and Dilip Buildcon lead the organized sector.</p>
      <p>The government's massive infrastructure push—Bharatmala (highways), Sagarmala (ports), Smart Cities Mission, PMAY (housing), bullet train, and metro expansion—ensures sustained construction employment for decades. The sector employs about 70 million workers including engineers, architects, project managers, skilled tradespeople, and laborers. Green building, prefabricated construction, and BIM (Building Information Modeling) are modernizing the industry.</p>
      <h3>Career Paths</h3>
      <p>Site engineer → project engineer → project manager → general manager → VP Projects. Specialized paths: structural engineer, quantity surveyor, safety officer, quality engineer, estimation engineer, planning engineer, and construction manager. Architecture offers parallel career progression.</p>
      <h3>Salary Overview</h3>
      <p>Civil engineering freshers earn ₹3–5 LPA. Site engineers earn ₹4–8 LPA. Project managers earn ₹10–25 LPA. Senior leadership at L&T, Tata Projects earn ₹30–70 LPA. Highway and metro projects often include site allowances adding 20-30% to base salary.</p>
      <h3>Career Advice</h3>
      <p>Civil engineering degree is the primary entry point. AutoCAD, Revit, and BIM skills are increasingly essential. Safety certifications (NEBOSH, IOSH) add value. Construction management MBA combines technical and business skills. Register on TrueJobs for construction and infrastructure jobs.</p>
    `,
    keyRoles: ['Civil Engineer', 'Project Manager', 'Site Engineer', 'Quantity Surveyor', 'Safety Officer', 'Architect', 'Estimation Engineer', 'Planning Engineer'],
    salaryRange: [
      { role: 'Site Engineer (Fresher)', range: '₹3–5 LPA' },
      { role: 'Project Manager', range: '₹10–25 LPA' },
      { role: 'Quantity Surveyor', range: '₹5–12 LPA' },
      { role: 'Safety Officer', range: '₹4–10 LPA' },
      { role: 'Construction Director', range: '₹25–50 LPA' },
    ],
    growthTrends: [
      'Infrastructure mega-projects ensuring decades of employment',
      'Green building and sustainable construction growing',
      'BIM adoption creating tech-construction hybrid roles',
      'Prefab and modular construction emerging in India',
      'Smart city projects integrating IoT and construction',
    ],
    faqItems: [
      { question: 'Is construction engineering a good career?', answer: 'Excellent long-term prospects. India\'s infrastructure development ensures sustained demand for civil engineers and construction professionals. Government projects offer stable, well-paying careers.' },
      { question: 'What skills are needed beyond civil engineering?', answer: 'AutoCAD, Revit, BIM software, project management (PMP certification), safety certifications (NEBOSH), and estimation/quantity surveying skills enhance career prospects significantly.' },
    ],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-hyderabad', 'jobs-in-chennai'],
    relatedCategories: ['engineering-jobs', 'fresher-jobs'],
    filterKeywords: ['construction', 'civil', 'site engineer', 'building', 'infrastructure', 'project manager', 'architect'],
  },

  // ── Expanded industries ──
  {
    industry: 'Hospitality & Tourism', slug: 'hospitality-tourism-industry-jobs', h1: 'Latest Hospitality & Tourism Industry Jobs in India – Apply Now', metaTitle: 'Hospitality & Tourism Jobs India 2026 – Hotel, Travel & Events', metaDescription: 'Find hospitality and tourism industry jobs in India. Hotels, restaurants, travel agencies, and event management roles. Apply on TrueJobs.',
    introContent: '<h2>Hospitality & Tourism Industry in India</h2><p>India\'s tourism and hospitality industry contributes 10% to GDP and is among the largest employers. With 100+ million international and domestic tourists, the sector spans hotels, restaurants, airlines, travel agencies, and event management. Premium hotel chains and budget hospitality are both expanding rapidly.</p>',
    keyRoles: ['Hotel Manager', 'Chef', 'Travel Agent', 'Event Planner', 'Front Desk', 'F&B Manager', 'Tour Guide', 'Revenue Manager'],
    salaryRange: [{ role: 'Front Desk', range: '₹2–4 LPA' }, { role: 'Chef', range: '₹3–12 LPA' }, { role: 'Hotel GM', range: '₹15–40 LPA' }],
    growthTrends: ['Luxury tourism expanding', 'Medical tourism growing', 'Homestay and experiential travel creating micro-entrepreneurship', 'MICE events driving corporate hospitality'],
    faqItems: [{ question: 'Is hotel management a good career?', answer: 'Yes, it offers global career mobility, free accommodation, and clear growth from trainee to general manager.' }],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-goa', 'jobs-in-jaipur', 'jobs-in-bangalore'],
    relatedCategories: ['hospitality-jobs', 'fresher-jobs'], filterKeywords: ['hospitality', 'tourism', 'hotel', 'travel', 'restaurant', 'chef', 'tour']
  },
  {
    industry: 'Agriculture & Food Processing', slug: 'agriculture-food-industry-jobs', h1: 'Latest Agriculture & Food Processing Industry Jobs in India – Apply Now', metaTitle: 'Agriculture & Food Jobs India 2026 – AgriTech & Processing', metaDescription: 'Find agriculture and food processing industry jobs in India. AgriTech, farming, and food production roles. Apply on TrueJobs.',
    introContent: '<h2>Agriculture & Food Processing Industry in India</h2><p>Agriculture employs 42% of India\'s workforce and the food processing sector adds $200+ billion. India is the world\'s largest producer of milk, pulses, and spices. AgriTech startups, organic farming, and food safety are creating modern career paths beyond traditional farming.</p>',
    keyRoles: ['Agricultural Officer', 'Food Technologist', 'Quality Controller', 'AgriTech Manager', 'Farm Manager', 'Supply Chain Specialist'],
    salaryRange: [{ role: 'Agriculture Officer', range: '₹3–8 LPA' }, { role: 'Food Technologist', range: '₹4–12 LPA' }, { role: 'AgriTech PM', range: '₹8–20 LPA' }],
    growthTrends: ['AgriTech attracting VC funding', 'Organic food industry growing 25% YoY', 'Food safety (FSSAI) creating compliance roles', 'Cold chain logistics expanding'],
    faqItems: [{ question: 'What are modern agriculture careers?', answer: 'AgriTech product management, precision agriculture, food safety auditing, agricultural finance, and drone-based farming are emerging careers.' }],
    topCities: ['jobs-in-delhi', 'jobs-in-hyderabad', 'jobs-in-pune', 'jobs-in-lucknow', 'jobs-in-ahmedabad'],
    relatedCategories: ['agriculture-jobs', 'logistics-jobs'], filterKeywords: ['agriculture', 'food processing', 'farming', 'agri', 'FMCG', 'dairy']
  },
  {
    industry: 'E-commerce & Digital', slug: 'ecommerce-digital-industry-jobs', h1: 'Latest E-commerce & Digital Industry Jobs in India – Apply Now', metaTitle: 'E-commerce Jobs India 2026 – Amazon, Flipkart & D2C', metaDescription: 'Find e-commerce and digital industry jobs in India. Marketplace, D2C, and digital commerce roles. Apply on TrueJobs.',
    introContent: '<h2>E-commerce & Digital Industry in India</h2><p>India\'s e-commerce market is projected to reach $400 billion by 2030. Amazon, Flipkart, Meesho, and thousands of D2C brands drive employment across technology, marketing, logistics, and customer experience. Quick commerce (Blinkit, Zepto, Swiggy Instamart) has added another layer of employment.</p>',
    keyRoles: ['Marketplace Manager', 'Digital Marketing Manager', 'Catalog Manager', 'Warehouse Manager', 'Customer Experience Lead', 'D2C Brand Manager'],
    salaryRange: [{ role: 'Catalog Executive', range: '₹2.5–5 LPA' }, { role: 'Category Manager', range: '₹8–20 LPA' }, { role: 'VP E-commerce', range: '₹30–70 LPA' }],
    growthTrends: ['Quick commerce creating thousands of roles', 'D2C brands growing 50% YoY', 'Social commerce via Instagram/WhatsApp expanding', 'AI-driven personalization roles emerging'],
    faqItems: [{ question: 'What jobs does e-commerce create?', answer: 'Technology, digital marketing, logistics, warehouse operations, customer service, and category management roles across all levels.' }],
    topCities: ['jobs-in-bangalore', 'jobs-in-delhi', 'jobs-in-mumbai', 'jobs-in-hyderabad', 'jobs-in-pune'],
    relatedCategories: ['it-jobs', 'marketing-jobs', 'logistics-jobs'], filterKeywords: ['ecommerce', 'e-commerce', 'online', 'marketplace', 'D2C', 'digital commerce']
  },
  {
    industry: 'Aerospace & Defence', slug: 'aerospace-defence-industry-jobs', h1: 'Latest Aerospace & Defence Industry Jobs in India – Apply Now', metaTitle: 'Aerospace & Defence Jobs India 2026 – DRDO, HAL & ISRO', metaDescription: 'Find aerospace and defence industry jobs in India. ISRO, DRDO, HAL, and private defence contractor roles. Apply on TrueJobs.',
    introContent: '<h2>Aerospace & Defence Industry in India</h2><p>India\'s defence budget exceeds ₹5.9 lakh crore, and the "Make in India" initiative is localizing defence manufacturing. ISRO, DRDO, HAL, BEL, and private players like L&T Defence, Tata Advanced Systems, and Adani Defence are hiring. Space tech startups (Skyroot, Agnikul) add to the ecosystem.</p>',
    keyRoles: ['Aerospace Engineer', 'Defence Scientist', 'Test Pilot', 'Systems Engineer', 'Avionics Engineer', 'Quality Inspector'],
    salaryRange: [{ role: 'DRDO Scientist B', range: '₹6–10 LPA' }, { role: 'HAL Engineer', range: '₹5–12 LPA' }, { role: 'Senior Aerospace', range: '₹15–35 LPA' }],
    growthTrends: ['Private defence manufacturing growing', 'Space tech startups hiring', 'Drone technology creating new roles', 'India becoming top-5 defence exporter'],
    faqItems: [{ question: 'How to get into ISRO or DRDO?', answer: 'GATE score for ISRO, DRDO SET exam, or campus placements from IITs/NITs. Aerospace/mechanical engineering preferred.' }],
    topCities: ['jobs-in-bangalore', 'jobs-in-hyderabad', 'jobs-in-delhi', 'jobs-in-chennai'],
    relatedCategories: ['engineering-jobs', 'government-jobs'], filterKeywords: ['aerospace', 'defence', 'defense', 'ISRO', 'DRDO', 'HAL', 'military']
  },
  {
    industry: 'Renewable Energy', slug: 'renewable-energy-industry-jobs', h1: 'Latest Renewable Energy Industry Jobs in India – Apply Now', metaTitle: 'Renewable Energy Jobs India 2026 – Solar, Wind & Green', metaDescription: 'Find renewable energy industry jobs in India. Solar, wind, green hydrogen, and sustainability roles. Apply on TrueJobs.',
    introContent: '<h2>Renewable Energy Industry in India</h2><p>India targets 500 GW of renewable energy capacity by 2030. Solar and wind energy are creating hundreds of thousands of green jobs in installation, manufacturing, project management, and R&D. Companies like Adani Green, Tata Power Solar, ReNew, and Suzlon are major employers. Green hydrogen is the next frontier.</p>',
    keyRoles: ['Solar Engineer', 'Wind Turbine Technician', 'Project Manager', 'Sustainability Consultant', 'Energy Auditor', 'EV Charging Specialist'],
    salaryRange: [{ role: 'Solar Installer', range: '₹2–4 LPA' }, { role: 'Energy Engineer', range: '₹5–15 LPA' }, { role: 'VP Sustainability', range: '₹25–50 LPA' }],
    growthTrends: ['Solar installation jobs growing 30% YoY', 'Green hydrogen pilot projects starting', 'ESG compliance creating sustainability roles', 'EV infrastructure development'],
    faqItems: [{ question: 'Is renewable energy a good career?', answer: 'Excellent long-term prospects. India\'s climate commitments ensure sustained growth in solar, wind, and green hydrogen employment.' }],
    topCities: ['jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-hyderabad', 'jobs-in-ahmedabad', 'jobs-in-chennai'],
    relatedCategories: ['engineering-jobs'], filterKeywords: ['renewable energy', 'solar', 'wind', 'green energy', 'sustainability', 'clean energy']
  },
  {
    industry: 'EdTech & Learning', slug: 'edtech-industry-jobs', h1: 'Latest EdTech Industry Jobs in India – Apply Now', metaTitle: 'EdTech Jobs India 2026 – Online Learning & Curriculum', metaDescription: 'Find EdTech industry jobs in India. Online learning, curriculum design, and education technology roles. Apply on TrueJobs.',
    introContent: '<h2>EdTech Industry in India</h2><p>India\'s EdTech sector is the second-largest globally, with companies like BYJU\'S, Unacademy, upGrad, Vedantu, and PhysicsWallah employing thousands. Despite industry consolidation, the fundamental demand for technology-enabled learning continues. Content creation, product management, sales, and engineering roles drive employment.</p>',
    keyRoles: ['Content Creator', 'EdTech Product Manager', 'Learning Designer', 'Counselor', 'Video Producer', 'Subject Matter Expert'],
    salaryRange: [{ role: 'Content Creator', range: '₹3–8 LPA' }, { role: 'Product Manager', range: '₹12–30 LPA' }, { role: 'VP Content', range: '₹20–50 LPA' }],
    growthTrends: ['Upskilling platforms growing', 'AI tutoring creating new product roles', 'Government Digital University initiatives', 'B2B EdTech expanding'],
    faqItems: [{ question: 'Is EdTech still hiring after layoffs?', answer: 'Yes, profitable EdTech companies continue hiring. The sector has matured with sustainable business models replacing hypergrowth.' }],
    topCities: ['jobs-in-bangalore', 'jobs-in-delhi', 'jobs-in-mumbai', 'jobs-in-hyderabad'],
    relatedCategories: ['it-jobs', 'teaching-jobs', 'marketing-jobs'], filterKeywords: ['edtech', 'education technology', 'online learning', 'e-learning', 'LMS']
  },
  {
    industry: 'Insurance', slug: 'insurance-industry-jobs', h1: 'Latest Insurance Industry Jobs in India – Apply Now', metaTitle: 'Insurance Jobs India 2026 – Agent, Underwriter & Actuary', metaDescription: 'Find insurance industry jobs in India. Agent, underwriter, actuary, and claims processing roles. Apply on TrueJobs.',
    introContent: '<h2>Insurance Industry in India</h2><p>India\'s insurance sector is growing at 15%+ annually, with penetration still low compared to global standards — indicating massive growth potential. Life insurance (LIC, HDFC Life, SBI Life, ICICI Prudential) and general insurance (ICICI Lombard, HDFC ERGO, Bajaj Allianz) companies employ millions. InsurTech startups (PolicyBazaar, Acko, Digit) are modernizing distribution.</p>',
    keyRoles: ['Insurance Advisor', 'Underwriter', 'Actuary', 'Claims Manager', 'Relationship Manager', 'InsurTech Developer', 'Branch Manager'],
    salaryRange: [{ role: 'Insurance Advisor', range: '₹2–10 LPA (commission)' }, { role: 'Underwriter', range: '₹5–15 LPA' }, { role: 'Actuary', range: '₹15–50 LPA' }],
    growthTrends: ['Health insurance post-pandemic growth', 'InsurTech disrupting distribution', 'IRDAI regulatory changes creating compliance roles', 'Micro-insurance for rural markets expanding'],
    faqItems: [{ question: 'How to start an insurance career?', answer: 'Get IRDAI license for advisory. For corporate roles, B.Com/MBA with insurance specialization. Actuary (IFOA/IAI) is the premium path.' }],
    topCities: ['jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-hyderabad', 'jobs-in-bangalore', 'jobs-in-chennai'],
    relatedCategories: ['sales-jobs', 'finance-jobs'], filterKeywords: ['insurance', 'life insurance', 'health insurance', 'general insurance', 'actuary', 'underwriter']
  },
  {
    industry: 'Gaming & Animation', slug: 'gaming-animation-industry-jobs', h1: 'Latest Gaming & Animation Industry Jobs in India – Apply Now', metaTitle: 'Gaming & Animation Jobs India 2026 – Game Dev & VFX', metaDescription: 'Find gaming and animation industry jobs in India. Game development, VFX, and 3D animation roles. Apply on TrueJobs.',
    introContent: '<h2>Gaming & Animation Industry in India</h2><p>India\'s gaming industry is projected to reach $8.6 billion by 2027, growing at 30%+ annually. Mobile gaming dominates with MPL, Dream11, and WinZO. VFX and animation studios serve Hollywood and Bollywood. Companies like Ubisoft, EA, Zynga, Moonfrog, and Indian studios employ thousands in game design, development, art, and QA.</p>',
    keyRoles: ['Game Developer', '3D Animator', 'VFX Artist', 'Game Designer', 'QA Tester', 'Unity Developer', 'Character Artist'],
    salaryRange: [{ role: 'Junior Game Dev', range: '₹3–6 LPA' }, { role: 'Senior Dev/Artist', range: '₹8–20 LPA' }, { role: 'Lead/Director', range: '₹20–45 LPA' }],
    growthTrends: ['Mobile gaming revenue surging', 'VFX outsourcing to India growing', 'AR/VR creating new opportunities', 'Game streaming and esports as careers'],
    faqItems: [{ question: 'How to get into the gaming industry?', answer: 'Learn Unity/Unreal Engine, build a game portfolio, participate in game jams. Art skills for 3D/2D artist roles. CS degree for game programming.' }],
    topCities: ['jobs-in-bangalore', 'jobs-in-hyderabad', 'jobs-in-pune', 'jobs-in-mumbai', 'jobs-in-chennai'],
    relatedCategories: ['it-jobs', 'graphic-design-jobs'], filterKeywords: ['gaming', 'game developer', 'animation', 'VFX', '3D artist', 'game design', 'Unity']
  },
  {
    industry: 'Textile & Garment', slug: 'textile-garment-industry-jobs', h1: 'Latest Textile & Garment Industry Jobs in India – Apply Now', metaTitle: 'Textile & Garment Jobs India 2026 – Fashion & Manufacturing', metaDescription: 'Find textile and garment industry jobs in India. Fashion design, textile manufacturing, and export roles. Apply on TrueJobs.',
    introContent: '<h2>Textile & Garment Industry in India</h2><p>India\'s textile industry is valued at $250+ billion, employing over 45 million people — the second-largest employer after agriculture. The sector spans cotton farming, spinning, weaving, garment manufacturing, fashion design, and export. Major clusters include Tirupur (knitwear), Surat (synthetics), Ludhiana (woolen), and Mumbai/Delhi (fashion design). India supplies 6% of global textile trade.</p>',
    keyRoles: ['Fashion Designer', 'Textile Engineer', 'Merchandiser', 'Quality Controller', 'Export Manager', 'Pattern Maker', 'Production Manager'],
    salaryRange: [{ role: 'Garment Worker', range: '₹1.5–3 LPA' }, { role: 'Fashion Designer', range: '₹3–12 LPA' }, { role: 'Export Manager', range: '₹6–20 LPA' }],
    growthTrends: ['Sustainable fashion creating new roles', 'Technical textiles growing', 'India as global sourcing alternative to China', 'E-commerce enabling D2C fashion brands'],
    faqItems: [{ question: 'What careers exist in textiles beyond manufacturing?', answer: 'Fashion design, merchandising, textile technology, quality assurance, export management, sustainable fashion consulting, and fashion marketing.' }],
    topCities: ['jobs-in-surat', 'jobs-in-mumbai', 'jobs-in-delhi', 'jobs-in-bangalore', 'jobs-in-chennai'],
    relatedCategories: ['manufacturing-jobs', 'graphic-design-jobs'], filterKeywords: ['textile', 'garment', 'fashion', 'apparel', 'fabric', 'weaving', 'knitting']
  },
  {
    industry: 'Mining & Metals', slug: 'mining-metals-industry-jobs', h1: 'Latest Mining & Metals Industry Jobs in India – Apply Now', metaTitle: 'Mining & Metals Jobs India 2026 – Mining Engineer & Metallurgy', metaDescription: 'Find mining and metals industry jobs in India. Mining engineer, metallurgist, and mineral processing roles. Apply on TrueJobs.',
    introContent: '<h2>Mining & Metals Industry in India</h2><p>India is a top-5 global producer of iron ore, coal, bauxite, and chromite. Mining companies like Coal India, NMDC, Tata Steel, JSW, Hindalco, and Vedanta employ hundreds of thousands. The sector offers high-paying engineering and management roles with remote site allowances. Green mining and sustainable extraction are creating modern specializations.</p>',
    keyRoles: ['Mining Engineer', 'Metallurgist', 'Geologist', 'Safety Officer', 'Plant Manager', 'Environmental Officer', 'Surveyor'],
    salaryRange: [{ role: 'Mining Engineer', range: '₹4–12 LPA' }, { role: 'Senior Engineer', range: '₹10–25 LPA' }, { role: 'Plant Head', range: '₹25–50 LPA' }],
    growthTrends: ['Critical minerals mining expansion for EV batteries', 'Coal India modernization', 'Green mining practices creating environmental roles', 'Deep-sea mining R&D starting'],
    faqItems: [{ question: 'Is mining engineering a good career?', answer: 'Yes, mining offers high salaries with site allowances. Coal India, NMDC, and private companies offer excellent packages and job security.' }],
    topCities: ['jobs-in-delhi', 'jobs-in-ranchi', 'jobs-in-bhubaneswar', 'jobs-in-raipur', 'jobs-in-hyderabad'],
    relatedCategories: ['engineering-jobs'], filterKeywords: ['mining', 'metals', 'steel', 'iron ore', 'coal', 'metallurgy', 'mineral']
  },
];
