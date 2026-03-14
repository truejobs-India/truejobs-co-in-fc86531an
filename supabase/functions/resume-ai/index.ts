import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// STRICT COMPLIANCE: Max tokens limit 800-1000
const MAX_TOKENS = 900;

// Use external Gemini API as primary AI provider
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── AWS Bedrock Converse API Support ─────────────────────────────────────────

async function hmacSha256B(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256B(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const BEDROCK_MODELS = [
  { id: "us.anthropic.claude-3-5-sonnet-20240620-v1:0", label: "Claude 3.5 Sonnet" },
  { id: "anthropic.claude-3-haiku-20240307-v1:0", label: "Claude 3 Haiku" },
  { id: "mistral.mixtral-8x7b-instruct-v0:1", label: "Mixtral 8x7B" },
  { id: "amazon.titan-text-lite-v1", label: "Titan Text Lite" },
];

const BEDROCK_RETRY_DELAYS = [0, 2000, 5000];

async function callBedrockConverseRaw(
  modelId: string, systemPrompt: string, userPrompt: string,
  accessKey: string, secretKey: string, region: string,
): Promise<string> {
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const url = `https://${host}/model/${modelId}/converse`;
  const canonicalUri = `/model/${modelId.replace(/:/g, "%3A").replace(/ /g, "%20")}/converse`;

  const body = JSON.stringify({
    messages: [{ role: "user", content: [{ text: userPrompt }] }],
    system: [{ text: systemPrompt }],
    inferenceConfig: { maxTokens: MAX_TOKENS, temperature: 0.3, topP: 0.9 },
  });

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const credentialScope = `${dateStamp}/${region}/bedrock/aws4_request`;
  const payloadHash = await sha256B(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256B(canonicalRequest)}`;

  const enc = new TextEncoder();
  let sk = await hmacSha256B(enc.encode(`AWS4${secretKey}`), dateStamp);
  sk = await hmacSha256B(sk, region);
  sk = await hmacSha256B(sk, "bedrock");
  sk = await hmacSha256B(sk, "aws4_request");
  const sig = Array.from(new Uint8Array(await hmacSha256B(sk, stringToSign))).map(b => b.toString(16).padStart(2, "0")).join("");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`Bedrock ${resp.status}: ${errText}`);
    (err as any).status = resp.status;
    throw err;
  }

  const data = await resp.json();
  return data.output?.message?.content?.[0]?.text?.trim() || "";
}

async function callBedrockWithFallback(systemPrompt: string, userPrompt: string): Promise<string> {
  const ak = Deno.env.get("API_NAME");
  const sk = Deno.env.get("API_KEY");
  const region = Deno.env.get("AWS_REGION") || "us-east-1";
  if (!ak || !sk) throw new Error("AWS credentials not configured");

  let lastErr: Error | null = null;
  for (const model of BEDROCK_MODELS) {
    for (let i = 0; i < BEDROCK_RETRY_DELAYS.length; i++) {
      if (BEDROCK_RETRY_DELAYS[i] > 0) await new Promise(r => setTimeout(r, BEDROCK_RETRY_DELAYS[i]));
      try {
        const result = await callBedrockConverseRaw(model.id, systemPrompt, userPrompt, ak, sk, region);
        console.log(`[ResumeAI-Bedrock] Success with ${model.label} attempt ${i + 1}`);
        return result;
      } catch (err: any) {
        lastErr = err;
        console.log(`[ResumeAI-Bedrock] ${model.label} attempt ${i + 1} failed: ${err.message}`);
        if (err.status !== 429 && !(err.status >= 500)) break;
      }
    }
  }
  throw new Error(`All Bedrock models failed: ${lastErr?.message}`);
}

// Input validation schemas
const baseDataSchema = z.object({
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  jobDescription: z.string().max(10000).optional(),
  description: z.string().max(5000).optional(),
  headline: z.string().max(200).optional(),
  currentSkills: z.array(z.string().max(100)).max(50).optional(),
  experienceYears: z.number().min(0).max(100).optional(),
  message: z.string().max(5000).optional(),
  resumeText: z.string().max(50000).optional(),
  // Resume builder data
  fullName: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  careerRole: z.string().max(200).optional(),
  workExperience: z.array(z.object({
    company: z.string().max(200),
    role: z.string().max(200),
    duration: z.string().max(100),
    description: z.string().max(2000),
  })).max(20).optional(),
  education: z.array(z.object({
    institution: z.string().max(200),
    degree: z.string().max(200),
    year: z.string().max(20),
    field: z.string().max(200).optional(),
  })).max(10).optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  projects: z.array(z.object({
    name: z.string().max(200),
    description: z.string().max(1000),
  })).max(10).optional(),
  certifications: z.array(z.string().max(200)).max(20).optional(),
}).passthrough();

const requestSchema = z.object({
  action: z.enum([
    'generate_summary',
    'improve_experience', 
    'generate_skills',
    'generate_cover_letter',
    'interview_prep',
    'chat',
    'score_resume',
    'ats_keywords',
    'analyze_resume',
    'build_resume'
  ]),
  data: baseDataSchema.optional(),
  provider: z.enum(['gemini', 'bedrock']).optional(),
});

// Call external Gemini API (primary AI provider)
async function callGeminiAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        temperature: 0.3,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Generate hash for request to track duplicates
async function generateRequestHash(userId: string, action: string, data: any): Promise<string> {
  const encoder = new TextEncoder();
  const content = JSON.stringify({ userId, action, data: data || {} });
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(content));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// STRICT COMPLIANCE: Check if this exact request has been generated before
async function checkDuplicateGeneration(
  supabase: any,
  userId: string,
  action: string,
  requestHash: string
): Promise<boolean> {
  // For chat action, allow multiple messages
  if (action === 'chat') return false;
  
  const { data: existing } = await supabase
    .from('resume_ai_generations')
    .select('id')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('request_hash', requestHash)
    .limit(1);
  
  return existing && existing.length > 0;
}

// Record the generation for tracking
async function recordGeneration(
  supabase: any,
  userId: string,
  action: string,
  requestHash: string
): Promise<void> {
  if (action === 'chat') return; // Don't track chat messages
  
  await supabase
    .from('resume_ai_generations')
    .insert({
      user_id: userId,
      action,
      request_hash: requestHash
    });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no auth token provided' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    
    if (claimsError || !claimsData?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = claimsData.user.id;

    const rawBody = await req.json();
    const parseResult = requestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, data, provider = 'lovable' } = parseResult.data;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // STRICT COMPLIANCE: Check for duplicate generation
    const requestHash = await generateRequestHash(authenticatedUserId, action, data);
    const isDuplicate = await checkDuplicateGeneration(supabase, authenticatedUserId, action, requestHash);
    
    if (isDuplicate) {
      return new Response(
        JSON.stringify({ 
          error: 'Content already generated for this request. Each resume can only be generated once.',
          code: 'DUPLICATE_GENERATION'
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    // STRICT COMPLIANCE PROMPT: Do not invent data, use only provided information
    const STRICT_COMPLIANCE_RULES = `
STRICT RULES - YOU MUST FOLLOW:
1. Use ONLY the data provided below - do NOT invent, assume, or add any skills, experiences, companies, or qualifications not explicitly stated
2. If information is missing or marked as "Not specified", acknowledge the gap but do NOT fill it with fictional data
3. Output must be ATS-friendly plain text without special formatting, emojis, or decorative characters
4. Be factual and accurate - do not exaggerate or embellish
5. If the provided data is insufficient to generate quality content, indicate what additional information is needed`;

    if (action === "analyze_resume") {
      // AI Resume Checker & Improver - Analyze uploaded resume
      systemPrompt = `You are an expert resume analyzer and career coach. Analyze the provided resume text and suggest specific improvements.
${STRICT_COMPLIANCE_RULES}

CRITICAL: Only suggest improvements to text that actually exists in the resume. Do NOT add new sections or experience that wasn't provided.`;

      const resumeText = data?.resumeText || "";
      if (!resumeText || resumeText.length < 50) {
        return new Response(
          JSON.stringify({ error: 'Resume text is required and must be at least 50 characters' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userPrompt = `Analyze this resume and provide improvement suggestions. Return ONLY valid JSON.

RESUME TEXT:
${resumeText.substring(0, 8000)}

Analyze and return this exact JSON structure:
{
  "overallScore": <0-100 integer>,
  "atsCompatibility": "<High|Medium|Low>",
  "suggestions": [
    {
      "section": "<Professional Summary|Experience|Skills|Education|Formatting>",
      "original": "<exact original text from resume>",
      "improved": "<improved version using only facts from original>",
      "reason": "<why this improvement helps ATS/recruiters>"
    }
  ],
  "missingKeywords": ["<relevant industry keywords to add>"],
  "strengths": ["<what the resume does well>"],
  "criticalIssues": ["<urgent fixes needed>"]
}

Rules for suggestions:
- Only reference text that exists in the resume
- Improvements must use strong action verbs
- Keep improvements ATS-friendly (no tables, graphics, special characters)
- Maximum 8 suggestions
- Focus on impact, metrics, and achievements`;

    } else if (action === "build_resume") {
      // AI Resume Builder - Generate resume from form data
      systemPrompt = `You are an expert resume writer. Generate professional resume content using ONLY the provided data.
${STRICT_COMPLIANCE_RULES}

CRITICAL: Generate content section by section. Do NOT invent any details not provided. Use professional language suitable for the Indian job market.`;

      const formData = data || {};
      
      if (!formData.fullName || !formData.careerRole) {
        return new Response(
          JSON.stringify({ error: 'Full name and career role are required' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const workExpStr = formData.workExperience?.map((exp: any, i: number) => 
        `${i + 1}. ${exp.role} at ${exp.company} (${exp.duration})\n   Description: ${exp.description}`
      ).join("\n") || "No work experience provided";

      const educationStr = formData.education?.map((edu: any, i: number) => 
        `${i + 1}. ${edu.degree}${edu.field ? ` in ${edu.field}` : ""} from ${edu.institution} (${edu.year})`
      ).join("\n") || "No education provided";

      const skillsStr = formData.skills?.join(", ") || "No skills provided";

      const projectsStr = formData.projects?.map((p: any, i: number) => 
        `${i + 1}. ${p.name}: ${p.description}`
      ).join("\n") || "No projects provided";

      const certsStr = formData.certifications?.join(", ") || "No certifications provided";

      userPrompt = `Generate professional resume content for this candidate. Return ONLY valid JSON.

CANDIDATE DATA (use ONLY this information):
- Full Name: ${formData.fullName}
- Email: ${formData.email || "Not provided"}
- Phone: ${formData.phone || "Not provided"}
- Location: ${formData.location || "Not provided"}
- Target Role: ${formData.careerRole}

WORK EXPERIENCE:
${workExpStr}

EDUCATION:
${educationStr}

SKILLS: ${skillsStr}

PROJECTS:
${projectsStr}

CERTIFICATIONS: ${certsStr}

Generate and return this exact JSON structure:
{
  "professionalSummary": "<3-4 sentence summary using only provided experience and skills>",
  "experience": [
    {
      "company": "<company name>",
      "role": "<role>",
      "duration": "<duration>",
      "bullets": ["<strong action verb bullet point 1>", "<bullet 2>", "<bullet 3>"]
    }
  ],
  "skills": {
    "technical": ["<skill>"],
    "soft": ["<skill>"]
  },
  "education": [
    {
      "institution": "<institution>",
      "degree": "<degree>",
      "year": "<year>"
    }
  ],
  "projects": [
    {
      "name": "<project name>",
      "description": "<concise 1-2 sentence description>"
    }
  ],
  "certifications": ["<certification>"]
}

Rules:
- Use strong action verbs (Developed, Implemented, Led, Optimized)
- Keep bullet points concise and impactful
- Do NOT add experience or skills not in the provided data
- Output must be ATS-friendly`;

    } else if (action === "generate_summary") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authenticatedUserId)
        .single();

      const { data: experience } = await supabase
        .from("experience")
        .select("*")
        .eq("profile_id", profile?.id)
        .order("start_date", { ascending: false });

      const { data: education } = await supabase
        .from("education")
        .select("*")
        .eq("profile_id", profile?.id)
        .order("start_date", { ascending: false });

      systemPrompt = `You are an expert resume writer. Generate ATS-friendly professional summaries using ONLY the provided candidate data.
${STRICT_COMPLIANCE_RULES}`;

      userPrompt = `Generate a professional resume summary (3-4 sentences, plain text only) using ONLY this candidate data:

CANDIDATE DATA (use only this information):
- Name: ${profile?.full_name || "Not specified"}
- Headline: ${profile?.headline || "Not specified"}
- Skills: ${profile?.skills?.join(", ") || "Not specified"}
- Experience Years: ${profile?.experience_years || "Not specified"}
- Location: ${profile?.location || "Not specified"}

WORK EXPERIENCE:
${experience?.length ? experience.map((exp: any) => `- ${exp.job_title} at ${exp.company_name} (${exp.start_date || "N/A"} - ${exp.is_current ? "Present" : exp.end_date || "N/A"})`).join("\n") : "No work experience provided"}

EDUCATION:
${education?.length ? education.map((edu: any) => `- ${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ""} from ${edu.institution}`).join("\n") : "No education provided"}

Create a factual summary using ONLY the above data. Do not add skills, experiences, or qualifications not listed.`;

    } else if (action === "improve_experience") {
      systemPrompt = `You are an expert resume writer. Improve job descriptions to be more impactful while staying strictly factual.
${STRICT_COMPLIANCE_RULES}`;
      
      userPrompt = `Improve this job experience description for a resume (plain text, 3-5 bullet points):

PROVIDED DATA (use only this):
- Job Title: ${data?.jobTitle || "Not specified"}
- Company: ${data?.company || "Not specified"}
- Original Description: ${data?.description || "No description provided"}

Rewrite using strong action verbs. Do NOT add duties, achievements, or responsibilities not mentioned in the original description.`;

    } else if (action === "generate_skills") {
      systemPrompt = `You are a career expert. Suggest skills that are relevant extensions of the candidate's existing skills.
${STRICT_COMPLIANCE_RULES}`;
      
      userPrompt = `Based on this profile, suggest additional skills that naturally complement their existing skillset:

PROVIDED DATA:
- Current Role/Headline: ${data?.headline || "Not specified"}
- Current Skills: ${data?.currentSkills?.join(", ") || "None listed"}
- Experience Years: ${data?.experienceYears || "Not specified"}

Suggest 10-15 skills that are:
1. Logical extensions of their current skills
2. Appropriate for their experience level
3. In-demand in the job market

Return as a comma-separated plain text list. Do not suggest skills unrelated to their current profile.`;

    } else if (action === "generate_cover_letter") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authenticatedUserId)
        .single();

      systemPrompt = `You are an expert cover letter writer. Write professional cover letters using only provided candidate data.
${STRICT_COMPLIANCE_RULES}`;

      userPrompt = `Write a cover letter using ONLY this data:

CANDIDATE DATA:
- Name: ${profile?.full_name || "Not specified"}
- Skills: ${profile?.skills?.join(", ") || "Not specified"}
- Experience Years: ${profile?.experience_years || "Not specified"}
- Headline: ${profile?.headline || "Not specified"}

JOB DATA:
- Title: ${data?.jobTitle || "Not specified"}
- Company: ${data?.company || "Not specified"}
- Description: ${data?.jobDescription || "Not provided"}

Write a 3-4 paragraph professional cover letter in plain text. Reference only the skills and experience provided above.`;

    } else if (action === "interview_prep") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authenticatedUserId)
        .single();

      const { data: experience } = await supabase
        .from("experience")
        .select("*")
        .eq("profile_id", profile?.id)
        .order("start_date", { ascending: false })
        .limit(3);

      systemPrompt = `You are an interview coach. Generate questions and model answers based strictly on the candidate's actual profile.
${STRICT_COMPLIANCE_RULES}`;

      userPrompt = `Generate 5 interview questions with model answers based strictly on this candidate data:

CANDIDATE DATA:
- Name: ${profile?.full_name || "Not specified"}
- Skills: ${profile?.skills?.join(", ") || "Not specified"}
- Experience Years: ${profile?.experience_years || "Not specified"}
- Headline: ${profile?.headline || "Not specified"}
- Experience:
${experience?.length ? experience.map((exp: any) => `  - ${exp.job_title} at ${exp.company_name}`).join("\n") : "  - No experience listed"}

JOB DATA:
- Title: ${data?.jobTitle || "Not specified"}
- Company: ${data?.company || "Not specified"}

Generate exactly 5 questions with answers that reference ONLY the candidate's actual listed experience and skills. Plain text format.`;

    } else if (action === "chat") {
      systemPrompt = `You are a professional resume and career coach. Provide specific, actionable advice based on facts.
${STRICT_COMPLIANCE_RULES}`;
      
      userPrompt = data?.message || "Hello";

    } else if (action === "score_resume") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authenticatedUserId)
        .single();

      const { data: experience } = await supabase
        .from("experience")
        .select("*")
        .eq("profile_id", profile?.id)
        .order("start_date", { ascending: false });

      const { data: education } = await supabase
        .from("education")
        .select("*")
        .eq("profile_id", profile?.id)
        .order("start_date", { ascending: false });

      systemPrompt = `You are an ATS analyzer. Score resumes objectively based on provided data match with job requirements.
${STRICT_COMPLIANCE_RULES}`;

      userPrompt = `Analyze this resume against the job description:

RESUME DATA:
- Name: ${profile?.full_name || "Not specified"}
- Headline: ${profile?.headline || "Not specified"}
- Summary: ${profile?.bio || "Not provided"}
- Skills: ${profile?.skills?.join(", ") || "Not specified"}
- Experience Years: ${profile?.experience_years || "Not specified"}
- Location: ${profile?.location || "Not specified"}

WORK EXPERIENCE:
${experience?.length ? experience.map((exp: any) => `- ${exp.job_title} at ${exp.company_name} (${exp.start_date || "N/A"} - ${exp.is_current ? "Present" : exp.end_date || "N/A"})\n  ${exp.description || "No description"}`).join("\n") : "No experience listed"}

EDUCATION:
${education?.length ? education.map((edu: any) => `- ${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ""} from ${edu.institution}`).join("\n") : "No education listed"}

JOB REQUIREMENTS:
- Title: ${data?.jobTitle || "Not specified"}
- Company: ${data?.company || "Not specified"}
- Description: ${data?.jobDescription || "Not provided"}

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "categories": {
    "skillsMatch": {"score": <0-100>, "feedback": "<feedback>"},
    "experienceMatch": {"score": <0-100>, "feedback": "<feedback>"},
    "educationMatch": {"score": <0-100>, "feedback": "<feedback>"},
    "keywordsMatch": {"score": <0-100>, "feedback": "<feedback>"},
    "presentationQuality": {"score": <0-100>, "feedback": "<feedback>"}
  },
  "missingKeywords": ["<keyword>"],
  "strengths": ["<strength>"],
  "improvements": ["<improvement>"],
  "atsCompatibility": "<High|Medium|Low>",
  "recommendedActions": ["<action>"]
}`;

    } else if (action === "ats_keywords") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authenticatedUserId)
        .single();

      systemPrompt = `You are an ATS keyword specialist. Analyze job descriptions and identify keyword gaps based on the candidate's actual profile.
${STRICT_COMPLIANCE_RULES}`;

      userPrompt = `Identify ATS keywords for this candidate:

CANDIDATE PROFILE:
- Headline: ${profile?.headline || "Not specified"}
- Current Skills: ${profile?.skills?.join(", ") || "Not specified"}
- Summary: ${profile?.bio || "Not provided"}

JOB REQUIREMENTS:
- Title: ${data?.jobTitle || "Not specified"}
- Company: ${data?.company || "Not specified"}
- Description: ${data?.jobDescription || "Not provided"}

Return ONLY valid JSON:
{
  "mustHaveKeywords": [{"keyword": "<keyword>", "category": "<technical|soft|industry|tool>", "priority": "<critical|high|medium>", "reason": "<reason>"}],
  "niceToHaveKeywords": [{"keyword": "<keyword>", "category": "<category>", "priority": "<medium|low>", "reason": "<reason>"}],
  "currentMatches": ["<matching keywords>"],
  "keywordDensityTips": ["<tip>"],
  "industryTerms": ["<term>"],
  "actionVerbs": ["<verb>"],
  "skillGaps": [{"skill": "<skill>", "importance": "<critical|high|medium>", "suggestion": "<suggestion>"}],
  "optimizedHeadline": "<suggested headline>",
  "overallATSScore": <0-100>
}`;

    } else {
      throw new Error("Invalid action");
    }

    // Call AI provider (Gemini primary, Bedrock fallback)
    const aiResponse = provider === 'bedrock'
      ? await callBedrockWithFallback(systemPrompt, userPrompt)
      : await callGeminiAI(systemPrompt, userPrompt);

    // STRICT COMPLIANCE: Record this generation to prevent unlimited regeneration
    await recordGeneration(supabase, authenticatedUserId, action, requestHash);

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in resume-ai:", error);
    
    if (error instanceof Error && error.message.includes("Rate limit")) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
