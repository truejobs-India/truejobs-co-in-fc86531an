import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, conversationHistory = [] } = await req.json();

    // Create Supabase client with service role to search jobs
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active jobs from the database
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title, description, location, job_type, experience_level, salary_min, salary_max, skills_required, is_remote, company:companies(name)")
      .eq("status", "active")
      .limit(100);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw new Error("Failed to fetch jobs");
    }

    // Prepare jobs context for AI
    const jobsContext = jobs?.map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company?.name || "Unknown Company",
      location: job.location || "Remote",
      job_type: job.job_type,
      experience_level: job.experience_level,
      salary: job.salary_min && job.salary_max 
        ? `₹${(job.salary_min / 100000).toFixed(1)}L - ₹${(job.salary_max / 100000).toFixed(1)}L` 
        : "Not disclosed",
      skills: job.skills_required?.slice(0, 5).join(", ") || "",
      is_remote: job.is_remote,
    })) || [];

    const systemPrompt = `You are TrueJobs AI, a helpful job search assistant for an Indian job portal. Your role is to help users find relevant jobs from our database.

AVAILABLE JOBS (${jobsContext.length} total):
${JSON.stringify(jobsContext, null, 2)}

INSTRUCTIONS:
1. When users describe what they're looking for, analyze their requirements (skills, experience, location, salary expectations, job type preferences)
2. Match their requirements against the available jobs
3. Recommend the most relevant jobs with brief explanations of why each is a good fit
4. Always include the job ID so users can view the full listing
5. Be conversational and helpful - ask clarifying questions if needed
6. If no exact matches exist, suggest the closest alternatives
7. Format job recommendations clearly with title, company, location, and why it matches
8. Use Indian salary format (LPA - Lakhs Per Annum)
9. Keep responses concise but informative

When recommending jobs, use this format:
**[Job Title]** at [Company]
📍 [Location] | 💼 [Job Type] | 💰 [Salary]
🎯 Why it matches: [brief explanation]
🔗 [View Job](/jobs/[job_id])`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: "user", content: message }
    ];

    // Build a single prompt from messages for Gemini's generateContent API
    const fullPrompt = messages.map(m => `${m.role === 'system' ? '[System]' : m.role === 'user' ? '[User]' : '[Assistant]'}: ${m.content}`).join('\n\n');

    const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
    const aiResponse = await callGeminiDirect('gemini-2.5-flash', fullPrompt, 60_000, {
      maxOutputTokens: 1024,
      temperature: 0.7,
    });

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in job-search-ai:", error);

    if (error instanceof Error && error.message.includes('429')) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
