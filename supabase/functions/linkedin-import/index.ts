import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const requestSchema = z.object({
  linkedinUrl: z.string()
    .min(1, "LinkedIn URL is required")
    .max(500, "URL too long")
    .refine((url) => {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.includes('linkedin.com');
      } catch {
        return false;
      }
    }, "Please provide a valid LinkedIn profile URL"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT and extract user ID
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - no auth token provided' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = claimsData.claims.sub;
    console.log("Authenticated user:", authenticatedUserId);

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = requestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { linkedinUrl } = parseResult.data;

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format URL properly
    let formattedUrl = linkedinUrl.trim();
    if (!formattedUrl.startsWith("http")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping LinkedIn profile:", formattedUrl);

    // Scrape LinkedIn profile with Firecrawl
    let scrapeResponse: Response | null = null;
    for (let _attempt = 1; _attempt <= 3; _attempt++) {
      scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ["markdown"],
          onlyMainContent: false,
          waitFor: 5000,
          timeout: 60000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
          },
          actions: [
            { type: "wait", milliseconds: 3000 },
            { type: "scroll", direction: "down", amount: 800 },
            { type: "wait", milliseconds: 2000 },
          ],
        }),
      });
      if (scrapeResponse.ok) break;
      console.warn(`LinkedIn scrape attempt ${_attempt} failed (status ${scrapeResponse.status})`);
      if (_attempt < 3) await new Promise(r => setTimeout(r, _attempt * 5000));
    }

    const scrapeData = await scrapeResponse!.json();

    if (!scrapeResponse!.ok || !scrapeData.success) {
      console.error("Firecrawl error:", scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: scrapeData.error || "Failed to scrape LinkedIn profile. The profile may be private or unavailable." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

    if (!markdown || markdown.length < 100) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not extract profile data. The profile may be private or require login." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraped markdown length:", markdown.length);

    const limitedMarkdown = markdown.substring(0, 15000);

    // Use Vertex AI Gemini to parse the LinkedIn data into structured format
    const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');

    const parsePrompt = `You are an expert at parsing LinkedIn profile data. Extract structured information from the provided markdown content of a LinkedIn profile. Return ONLY valid JSON, no markdown code blocks.\n\nParse this LinkedIn profile markdown and extract the following information. Return ONLY valid JSON:\n\n${limitedMarkdown.substring(0, 8000)}\n\nReturn this exact JSON structure (use null for missing fields):\n{\n  "full_name": "Person's full name",\n  "headline": "Their professional headline/title",\n  "location": "Their location",\n  "bio": "About/summary section text",\n  "skills": ["skill1", "skill2", "skill3"],\n  "experience": [\n    {\n      "job_title": "Title",\n      "company_name": "Company",\n      "location": "Location or null",\n      "start_date": "YYYY-MM or null",\n      "end_date": "YYYY-MM or null",\n      "is_current": false,\n      "description": "Description or null"\n    }\n  ],\n  "education": [\n    {\n      "institution": "School name",\n      "degree": "Degree type",\n      "field_of_study": "Field or null",\n      "start_date": "YYYY-MM or null",\n      "end_date": "YYYY-MM or null"\n    }\n  ],\n  "linkedin_url": "${formattedUrl}"\n}`;

    const aiResponse = await callGeminiDirect('gemini-2.5-flash', parsePrompt, 60_000, {
      maxOutputTokens: 2048,
      temperature: 0.3,
    });

    // Parse the JSON response
    let profileData;
    try {
      const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, "").trim();
      profileData = JSON.parse(cleanResponse);
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse extracted profile data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully parsed LinkedIn profile");

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: profileData 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in linkedin-import:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
