import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to pick random item from array
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Common skill keywords for matching
const skillKeywords: Record<string, string[]> = {
  frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'tailwind', 'next.js', 'frontend', 'front-end', 'ui', 'ux'],
  backend: ['node', 'python', 'java', 'golang', 'go', 'ruby', 'php', 'backend', 'back-end', 'api', 'server', 'database', 'sql', 'mongodb', 'postgresql'],
  fullstack: ['fullstack', 'full-stack', 'full stack', 'mern', 'mean'],
  mobile: ['android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'mobile'],
  devops: ['devops', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'jenkins', 'terraform'],
  data: ['data', 'machine learning', 'ml', 'ai', 'analytics', 'python', 'pandas', 'tensorflow', 'pytorch', 'data scientist', 'data analyst'],
  design: ['design', 'figma', 'sketch', 'ui/ux', 'graphic', 'creative', 'designer'],
  qa: ['qa', 'testing', 'automation', 'selenium', 'quality', 'test engineer'],
  product: ['product manager', 'product owner', 'pm', 'scrum', 'agile'],
  hr: ['hr', 'human resources', 'recruiter', 'talent', 'hiring'],
  marketing: ['marketing', 'seo', 'content', 'digital marketing', 'social media'],
  sales: ['sales', 'business development', 'bd', 'account manager'],
};

// Location keywords
const locationKeywords: Record<string, string[]> = {
  bangalore: ['bangalore', 'bengaluru', 'blr'],
  mumbai: ['mumbai', 'bombay'],
  delhi: ['delhi', 'ncr', 'gurgaon', 'gurugram', 'noida'],
  hyderabad: ['hyderabad', 'hyd'],
  chennai: ['chennai', 'madras'],
  pune: ['pune'],
  kolkata: ['kolkata', 'calcutta'],
  remote: ['remote', 'work from home', 'wfh', 'anywhere'],
  ahmedabad: ['ahmedabad'],
  jaipur: ['jaipur'],
};

// Experience level keywords
const experienceKeywords: Record<string, string[]> = {
  fresher: ['fresher', 'entry level', 'entry-level', 'graduate', 'no experience', '0 years', 'beginner', 'trainee', 'fresh graduate'],
  junior: ['junior', '1 year', '2 years', '1-2 years', '0-2 years'],
  mid: ['mid', 'intermediate', '3 years', '4 years', '5 years', '3-5 years', 'mid-level'],
  senior: ['senior', 'sr', 'lead', '6 years', '7 years', '8 years', '5+ years', '6+ years', 'experienced'],
  executive: ['executive', 'director', 'vp', 'head', 'chief', 'cto', 'ceo', 'manager', '10+ years'],
};

// Job type keywords
const jobTypeKeywords: Record<string, string[]> = {
  full_time: ['full time', 'full-time', 'permanent', 'regular'],
  part_time: ['part time', 'part-time'],
  contract: ['contract', 'freelance', 'contractor'],
  internship: ['internship', 'intern', 'trainee'],
  remote: ['remote', 'work from home', 'wfh'],
};

// Conversation patterns
const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings|namaste|hola|sup|yo|hii+|heyy+)/i;
const thankYouPatterns = /^(thanks|thank you|thx|ty|appreciated|thank u|tysm|thanks a lot|cheers)/i;
const helpPatterns = /(help|how|what can you do|capabilities|guide me|assist)/i;
const byePatterns = /(bye|goodbye|see you|talk later|gotta go|cya|later)/i;
const affirmativePatterns = /^(yes|yeah|yep|sure|okay|ok|yup|definitely|absolutely)/i;

// Response templates
const greetings = [
  "Hey there! 👋 I'm your job search buddy. Tell me what you're looking for - skills, location, experience level - and I'll find the best matches!",
  "Hello! 😊 Ready to find your dream job? Just tell me what kind of role you're interested in, and I'll search our database for you!",
  "Hi! 👋 Great to see you! I'm here to help you discover amazing opportunities. What kind of work are you passionate about?",
  "Hey! 🎯 Let's find you the perfect job. Share your skills, preferred location, or the type of role you're after!",
  "Hello there! 💼 Excited to help you on your job search journey. What brings you here today?",
];

const helpResponses = [
  "I'm here to make your job search easier! Just tell me:\n\n🛠️ **Skills** - What you're good at (React, Python, etc.)\n📍 **Location** - Where you want to work\n📊 **Experience** - Your level (Fresher, Senior, etc.)\n💰 **Salary** - Your expectations (like 10-15 LPA)\n\nFor example: *\"React developer jobs in Bangalore\"*",
  "Happy to help! Here's what I can do:\n\n• Find jobs matching your skills\n• Filter by location and experience\n• Search by salary range\n• Show remote opportunities\n\nJust describe your ideal role, like: *\"Senior Python jobs in Mumbai, 20+ LPA\"*",
  "Think of me as your personal job matchmaker! 🎯 Tell me about:\n\n• Your technical skills\n• Preferred work location\n• Experience level\n• Salary expectations\n\nI'll dig through our listings and find the gems for you!",
];

const thankYouResponses = [
  "You're welcome! 😊 Best of luck with your applications. Feel free to search again anytime!",
  "Happy to help! 🌟 Wishing you all the best. Come back whenever you need more job recommendations!",
  "Anytime! 💪 Go crush those interviews! I'm here if you need anything else.",
  "My pleasure! 🎉 Hope you land something amazing. Rooting for you!",
  "Glad I could help! 🚀 You've got this. Let me know if you want to explore more opportunities!",
];

const byeResponses = [
  "Goodbye! 👋 Best of luck with your job search. Come back anytime!",
  "See you later! 🌟 Hope you find something amazing!",
  "Take care! 💼 Wishing you success in your career journey!",
  "Bye for now! 🎯 Good luck out there!",
];

const noResultsResponses = [
  "Hmm, I couldn't find exact matches for that search. 🤔 A few suggestions:\n\n• Try different skill keywords\n• Consider nearby cities or remote options\n• Broaden your experience range\n\nWhat else would you like to try?",
  "No perfect matches this time, but don't worry! 💡 You could:\n\n• Use alternative skill names\n• Check out remote positions\n• Adjust your location preference\n\nWant to search with different criteria?",
  "I came up empty on that one! 😅 Here's what might help:\n\n• Different keywords (e.g., 'JS' instead of 'JavaScript')\n• More flexible location\n• Wider experience range\n\nLet's try again - what else are you interested in?",
];

const needMoreInfoResponses = [
  "I'd love to help you find the right job! 🎯 Could you share a bit more?\n\n• What's your area of expertise?\n• Any location preferences?\n• Experience level?\n\nFor example: *\"Frontend developer jobs in Pune\"*",
  "Tell me more about what you're looking for! 💭\n\n• What skills do you have?\n• Where would you like to work?\n• What's your experience level?\n\nTry something like: *\"Data analyst roles in Hyderabad for freshers\"*",
  "Let's narrow it down! 🔍 Share with me:\n\n• Your key skills or role type\n• Preferred city or remote?\n• Years of experience\n\nExample: *\"Senior DevOps engineer, remote, 15+ LPA\"*",
];

const foundJobsIntros = [
  "Great news! 🎉 I found **{count} job{s}** that {match_text}. Here are the top picks:",
  "Awesome! 🚀 Discovered **{count} opportunity{ies}** for you. Check these out:",
  "Perfect! 💼 There are **{count} position{s}** that might be just right. Take a look:",
  "Exciting! ✨ Found **{count} role{s}** matching your criteria. Here's what I've got:",
  "Nice! 🎯 **{count} job{s}** lined up for you. Let me show you the best ones:",
];

const jobMatchReasons = [
  "Looks like a solid match for your profile!",
  "This one aligns well with what you described.",
  "Could be a great fit based on your requirements.",
  "Matches several of your criteria nicely.",
  "Worth checking out!",
];

const closingMessages = [
  "\n\nWant me to search with different filters, or tell you more about any of these?",
  "\n\nShould I look for something else, or would you like details on any position?",
  "\n\nInterested in more options? Just let me know what else to search for!",
  "\n\nNeed me to refine the search or explore other opportunities?",
  "\n\nFeel free to ask for more jobs or different criteria!",
];

const moreJobsNote = [
  "\n\n_...plus {remaining} more matches available!_",
  "\n\n_There are {remaining} additional positions I can show you._",
  "\n\n_Found {remaining} more that might interest you too!_",
];

function extractKeywords(message: string): {
  skills: string[];
  locations: string[];
  experienceLevels: string[];
  jobTypes: string[];
  salaryMin?: number;
  salaryMax?: number;
} {
  const lowerMessage = message.toLowerCase();
  
  const skills: string[] = [];
  const locations: string[] = [];
  const experienceLevels: string[] = [];
  const jobTypes: string[] = [];

  // Extract skills
  for (const [category, keywords] of Object.entries(skillKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        skills.push(category);
        break;
      }
    }
  }

  // Extract locations
  for (const [location, keywords] of Object.entries(locationKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        locations.push(location);
        break;
      }
    }
  }

  // Extract experience levels
  for (const [level, keywords] of Object.entries(experienceKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        experienceLevels.push(level);
        break;
      }
    }
  }

  // Extract job types
  for (const [type, keywords] of Object.entries(jobTypeKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        jobTypes.push(type);
        break;
      }
    }
  }

  // Extract salary expectations (in LPA format)
  let salaryMin: number | undefined;
  let salaryMax: number | undefined;
  
  const salaryMatch = lowerMessage.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:lpa|lakhs?|l)/i);
  if (salaryMatch) {
    salaryMin = parseInt(salaryMatch[1]) * 100000;
    salaryMax = parseInt(salaryMatch[2]) * 100000;
  } else {
    const singleSalaryMatch = lowerMessage.match(/(\d+)\s*(?:\+)?\s*(?:lpa|lakhs?|l)/i);
    if (singleSalaryMatch) {
      salaryMin = parseInt(singleSalaryMatch[1]) * 100000;
    }
  }

  return { skills, locations, experienceLevels, jobTypes, salaryMin, salaryMax };
}

function generateResponse(jobs: any[], keywords: ReturnType<typeof extractKeywords>, originalMessage: string): string {
  const trimmedMsg = originalMessage.trim();
  
  // Handle greetings
  if (greetingPatterns.test(trimmedMsg) && trimmedMsg.length < 30) {
    return pick(greetings);
  }

  // Handle thank you
  if (thankYouPatterns.test(trimmedMsg)) {
    return pick(thankYouResponses);
  }

  // Handle goodbye
  if (byePatterns.test(trimmedMsg)) {
    return pick(byeResponses);
  }

  // Handle affirmative with no context
  if (affirmativePatterns.test(trimmedMsg) && trimmedMsg.length < 15) {
    return "Great! 😊 What kind of job would you like me to search for?";
  }

  // Handle help requests
  if (helpPatterns.test(originalMessage) && jobs.length === 0) {
    return pick(helpResponses);
  }

  // No jobs found
  if (jobs.length === 0) {
    if (keywords.skills.length > 0 || keywords.locations.length > 0 || keywords.experienceLevels.length > 0) {
      return pick(noResultsResponses);
    } else {
      return pick(needMoreInfoResponses);
    }
  }

  // Build response with matched jobs
  let response = "";
  
  // Create match text context
  const searchTerms: string[] = [];
  if (keywords.skills.length > 0) searchTerms.push(keywords.skills.join('/'));
  if (keywords.locations.length > 0) searchTerms.push(keywords.locations.join(', '));
  if (keywords.experienceLevels.length > 0) searchTerms.push(keywords.experienceLevels.join('/') + ' level');

  const matchText = searchTerms.length > 0 
    ? `match your ${searchTerms.join(' + ')} search`
    : 'might interest you';

  // Pick intro template and fill in
  let intro = pick(foundJobsIntros);
  intro = intro
    .replace('{count}', jobs.length.toString())
    .replace('{s}', jobs.length > 1 ? 's' : '')
    .replace('{ies}', jobs.length > 1 ? 'ies' : 'y')
    .replace('{match_text}', matchText);
  
  response += intro + "\n\n";

  // Format each job (max 5)
  const displayJobs = jobs.slice(0, 5);
  for (let i = 0; i < displayJobs.length; i++) {
    const job = displayJobs[i];
    const company = job.company?.name || job.company_name || 'Company';
    const location = job.location || (job.is_remote ? 'Remote' : 'Location not specified');
    const jobType = job.job_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Full Time';
    
    let salary = 'Not disclosed';
    if (job.salary_min && job.salary_max) {
      salary = `₹${(job.salary_min / 100000).toFixed(1)}L - ₹${(job.salary_max / 100000).toFixed(1)}L`;
    } else if (job.salary_min) {
      salary = `₹${(job.salary_min / 100000).toFixed(1)}L+`;
    }
    
    response += `**${i + 1}. ${job.title}** at ${company}\n`;
    response += `📍 ${location} | 💼 ${jobType} | 💰 ${salary}\n`;
    
    // Add skills if available (randomize showing)
    if (job.skills_required && job.skills_required.length > 0 && Math.random() > 0.3) {
      response += `🛠️ ${job.skills_required.slice(0, 4).join(', ')}\n`;
    }
    
    response += `🔗 [View Job](/jobs/${job.id})\n\n`;
  }

  // Note about more jobs
  if (jobs.length > 5) {
    const remaining = jobs.length - 5;
    response += pick(moreJobsNote).replace('{remaining}', remaining.toString());
  }

  // Add closing
  response += pick(closingMessages);

  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    const { message } = await req.json();

    // Create Supabase client with service role for data access
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract keywords from message
    const keywords = extractKeywords(message);

    // Build query
    let query = supabase
      .from("jobs")
      .select("id, title, description, location, job_type, experience_level, salary_min, salary_max, skills_required, is_remote, company_name, company:companies(name)")
      .eq("status", "active");

    // Apply filters based on extracted keywords
    if (keywords.locations.includes('remote')) {
      query = query.eq('is_remote', true);
    } else if (keywords.locations.length > 0) {
      const locationFilters = keywords.locations.map(loc => 
        `location.ilike.%${loc}%`
      ).join(',');
      query = query.or(locationFilters);
    }

    if (keywords.experienceLevels.length > 0) {
      query = query.in('experience_level', keywords.experienceLevels);
    }

    if (keywords.jobTypes.length > 0) {
      query = query.in('job_type', keywords.jobTypes);
    }

    if (keywords.salaryMin) {
      query = query.gte('salary_max', keywords.salaryMin);
    }

    // Execute query
    const { data: jobs, error: jobsError } = await query.limit(20);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw new Error("Failed to search jobs");
    }

    // Filter by skills (text search in title, description, skills_required)
    let filteredJobs = jobs || [];
    
    if (keywords.skills.length > 0) {
      const skillTerms = keywords.skills.flatMap(skill => skillKeywords[skill] || [skill]);
      
      filteredJobs = filteredJobs.filter(job => {
        const searchText = `${job.title} ${job.description} ${(job.skills_required || []).join(' ')}`.toLowerCase();
        return skillTerms.some(term => searchText.includes(term));
      });
    }

    // Generate natural language response
    const response = generateResponse(filteredJobs, keywords, message);

    // Add a small delay to simulate "thinking" (80-200ms)
    await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 120));

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in job-search-smart:", error);
    
    const errorResponses = [
      "Oops! Something went sideways. 😅 Could you try rephrasing that? Example: *\"Python jobs in Delhi\"*",
      "Hmm, I hit a snag there. 🤔 Try again with something like: *\"Frontend developer in Mumbai\"*",
      "Sorry, I stumbled! 😓 Let's try again - what kind of role are you looking for?",
    ];
    
    return new Response(
      JSON.stringify({ response: pick(errorResponses) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
