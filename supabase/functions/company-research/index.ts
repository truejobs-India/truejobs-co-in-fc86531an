import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyResearch {
  overview: string;
  culture: string;
  recentNews: string[];
  keyPeople: string[];
  products: string[];
  competitors: string[];
  benefits: string[];
  interviewTips: string[];
  fetchedAt: string;
}

// Input validation schema
const requestSchema = z.object({
  companyName: z.string()
    .min(1, "Company name is required")
    .max(200, "Company name too long")
    .trim(),
  jobTitle: z.string().max(200).optional(),
  companyWebsite: z.string()
    .max(500)
    .refine((url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, "Invalid website URL")
    .optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - no auth token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = requestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companyName, jobTitle, companyWebsite } = parseResult.data;

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    let scrapedContent = '';

    // Try to scrape company website if Firecrawl is available
    if (firecrawlApiKey && companyWebsite) {
      try {
        let formattedUrl = companyWebsite.trim();
        if (!formattedUrl.startsWith('http')) {
          formattedUrl = `https://${formattedUrl}`;
        }
        
        console.log('Scraping company website:', formattedUrl);
        
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          scrapedContent = scrapeData.data?.markdown || scrapeData.markdown || '';
          scrapedContent = scrapedContent.substring(0, 10000);
          console.log('Scraped content length:', scrapedContent.length);
        }
      } catch (scrapeError) {
        console.error('Scraping error:', scrapeError);
      }
    }

    // Also try to search for recent news
    let newsContent = '';
    if (firecrawlApiKey) {
      try {
        console.log('Searching for company news:', companyName);
        
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${companyName} company news recent`,
            limit: 5,
            tbs: 'qdr:m',
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.data) {
            newsContent = searchData.data
              .map((item: any) => `- ${String(item.title || '').substring(0, 100)}: ${String(item.description || '').substring(0, 200)}`)
              .join('\n');
          }
        }
      } catch (searchError) {
        console.error('Search error:', searchError);
      }
    }

    console.log('Generating company research with Vertex AI');

    const prompt = `You are a career research assistant. Analyze the following information about "${companyName}" and provide comprehensive research for a job seeker applying for a "${jobTitle || 'position'}" role.

${scrapedContent ? `COMPANY WEBSITE CONTENT:\n${scrapedContent.substring(0, 8000)}` : ''}

${newsContent ? `RECENT NEWS:\n${newsContent}` : ''}

Based on the above information (and your general knowledge if limited info is available), provide a JSON response with the following structure:
{
  "overview": "A 2-3 paragraph company overview including mission, size, industry, and what makes them unique",
  "culture": "Description of company culture, values, work environment, and employee experience",
  "recentNews": ["Array of 3-5 recent news items or developments about the company"],
  "keyPeople": ["Array of key leadership/executives with their roles"],
  "products": ["Array of main products, services, or offerings"],
  "competitors": ["Array of 3-5 main competitors in their industry"],
  "benefits": ["Array of known employee benefits and perks"],
  "interviewTips": ["Array of 5-7 specific tips for interviewing at this company based on their culture and values"]
}

Respond ONLY with valid JSON. Be specific and actionable with interview tips.`;

    const fullPrompt = `You are a career research assistant that provides comprehensive company research in JSON format.\n\n${prompt}`;

    const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
    const content = await callGeminiDirect('gemini-2.5-flash', fullPrompt, 60_000, {
      maxOutputTokens: 3000,
      temperature: 0.3,
    });

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const research: CompanyResearch = {
      ...JSON.parse(jsonMatch[0]),
      fetchedAt: new Date().toISOString(),
    };

    console.log('Company research generated successfully');

    return new Response(
      JSON.stringify({ success: true, data: research }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in company research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate research';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
