import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Continuation pattern regexes
const CONTINUATION_TO_RE = /(?:contd?\.?\s*on\s*page|continued\s*on\s*page|contd?\.\s*on\s*p(?:age)?\.?)\s*(\d+)/i;
const CONTINUATION_FROM_RE = /(?:contd?\.?\s*from\s*page|continued\s*from\s*page|contd?\.\s*from\s*p(?:age)?\.?)\s*(\d+)/i;

// Job-related keywords for fragment classification
const JOB_KEYWORDS = /\b(vacancy|vacancies|recruitment|post|qualification|last\s*date|apply|application|eligible|selection|walk[\s-]*in|interview|appointment|engagement|deputation|contractual|advertisement\s*no|advt\.?\s*no|notification\s*no)\b/i;
const ADMISSION_KEYWORDS = /\b(admission|enrollment|enrolment|semester|academic\s*session|entrance\s*exam|counselling|merit\s*list)\b/i;
const ADVERTISEMENT_KEYWORDS = /\b(advt|advertisement|commercial|tender|notice\s*inviting|empanelment|e[\s-]*procurement|quotation)\b/i;
const EDITORIAL_KEYWORDS = /\b(editorial|article|opinion|feature\s*story|success\s*story|perspective|column)\b/i;

function classifyFragment(text: string): string {
  const t = text.toLowerCase();
  if (JOB_KEYWORDS.test(t)) return 'job_notice';
  if (ADMISSION_KEYWORDS.test(t)) return 'admission';
  if (EDITORIAL_KEYWORDS.test(t)) return 'editorial';
  if (ADVERTISEMENT_KEYWORDS.test(t)) return 'advertisement';
  return 'unknown';
}

function isHeadingLike(text: string): boolean {
  if (!text || text.length > 200) return false;
  const trimmed = text.trim();
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 5 && trimmed.length < 150) return true;
  if (/^(Government|Ministry|Department|Office|Commission|Board|University|Institute|Corporation|Authority|Council|Directorate)\s/i.test(trimmed)) return true;
  if (/^(No\.\s|Advt\.?\s|Advertisement\s|Notification\s)/i.test(trimmed)) return true;
  return false;
}

function detectContinuation(text: string): { to_page: number | null; from_page: number | null; hint: string | null } {
  let to_page: number | null = null;
  let from_page: number | null = null;
  const hints: string[] = [];
  
  const toMatch = CONTINUATION_TO_RE.exec(text);
  if (toMatch) {
    to_page = parseInt(toMatch[1], 10);
    hints.push(`continued on page ${to_page}`);
  }
  
  const fromMatch = CONTINUATION_FROM_RE.exec(text);
  if (fromMatch) {
    from_page = parseInt(fromMatch[1], 10);
    hints.push(`continued from page ${from_page}`);
  }
  
  return {
    to_page,
    from_page,
    hint: hints.length > 0 ? hints.join('; ') : null,
  };
}

interface AzureParagraph {
  content: string;
  role?: string;
  boundingRegions?: Array<{ pageNumber: number; polygon: number[] }>;
}

function extractParagraphs(resultJson: any): AzureParagraph[] {
  const analyzeResult = resultJson?.analyzeResult;
  if (!analyzeResult) return [];
  
  // Prefer paragraphs, fall back to pages content
  if (analyzeResult.paragraphs && Array.isArray(analyzeResult.paragraphs)) {
    return analyzeResult.paragraphs;
  }
  
  // Fallback: split content by double newlines
  if (analyzeResult.content) {
    return analyzeResult.content.split(/\n{2,}/).filter((s: string) => s.trim()).map((s: string) => ({
      content: s.trim(),
    }));
  }
  
  return [];
}

function isPageFurniture(para: AzureParagraph): boolean {
  const role = para.role?.toLowerCase();
  if (role === 'pageheader' || role === 'pagefooter' || role === 'pagenumber') return true;
  
  const text = para.content.trim();
  // Common Employment News headers/footers
  if (/^employment\s*news/i.test(text) && text.length < 80) return true;
  if (/^rozgar\s*samachar/i.test(text) && text.length < 80) return true;
  if (/^www\.employmentnews\.gov\.in/i.test(text) && text.length < 100) return true;
  if (/^\d+\s*(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(text) && text.length < 60) return true;
  if (/^(EN|davp)\s*\d/i.test(text) && text.length < 40) return true;
  if (/^page\s*\d+$/i.test(text)) return true;
  
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth-first
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userId = claimsData.claims.sub as string;

  // Admin check
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await serviceClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
  }

  try {
    const { issue_id } = await req.json();
    if (!issue_id) throw new Error("issue_id required");

    // Guard: check OCR status
    const { data: issue } = await serviceClient.from("azure_emp_news_issues").select("*").eq("id", issue_id).single();
    if (!issue) throw new Error("Issue not found");
    
    // Check for pending/processing pages
    const { data: pendingPages } = await serviceClient.from("azure_emp_news_pages")
      .select("id").eq("issue_id", issue_id).in("ocr_status", ["pending", "processing"]);
    if (pendingPages && pendingPages.length > 0) {
      throw new Error(`Cannot build fragments: ${pendingPages.length} pages still pending/processing OCR. Complete OCR first.`);
    }

    // Get completed pages
    const { data: pages } = await serviceClient.from("azure_emp_news_pages")
      .select("*").eq("issue_id", issue_id).eq("ocr_status", "completed").order("page_no", { ascending: true });
    if (!pages || pages.length === 0) {
      throw new Error("No completed pages found for this issue");
    }

    // Delete existing fragments (idempotent)
    await serviceClient.from("azure_emp_news_fragments").delete().eq("issue_id", issue_id);

    // Update issue status
    await serviceClient.from("azure_emp_news_issues").update({ reconstruction_status: "processing" }).eq("id", issue_id);

    const allFragments: any[] = [];

    for (const page of pages) {
      const paragraphs = extractParagraphs(page.azure_result_json);
      const contentParagraphs = paragraphs.filter(p => !isPageFurniture(p));
      
      // Save cleaned content on page
      const cleanedContent = contentParagraphs.map(p => p.content).join("\n\n");
      await serviceClient.from("azure_emp_news_pages")
        .update({ cleaned_content: cleanedContent })
        .eq("id", page.id);

      // Group paragraphs into fragments
      let currentGroup: AzureParagraph[] = [];
      const groups: AzureParagraph[][] = [];

      for (let i = 0; i < contentParagraphs.length; i++) {
        const para = contentParagraphs[i];
        const text = para.content.trim();
        if (!text) continue;

        // Start new group on heading-like text (unless first paragraph)
        if (currentGroup.length > 0 && isHeadingLike(text)) {
          groups.push([...currentGroup]);
          currentGroup = [];
        }
        currentGroup.push(para);
      }
      if (currentGroup.length > 0) groups.push(currentGroup);

      // Create fragments from groups
      for (let fi = 0; fi < groups.length; fi++) {
        const group = groups[fi];
        const rawText = group.map(p => p.content).join("\n");
        const fragmentType = classifyFragment(rawText);
        const continuation = detectContinuation(rawText);
        
        // Get bbox from first paragraph's bounding region
        let bbox: any = null;
        const firstWithBbox = group.find(p => p.boundingRegions && p.boundingRegions.length > 0);
        if (firstWithBbox?.boundingRegions) {
          bbox = firstWithBbox.boundingRegions[0];
        }

        allFragments.push({
          issue_id,
          page_id: page.id,
          page_no: page.page_no,
          fragment_index: fi,
          fragment_type: fragmentType,
          raw_text: rawText,
          cleaned_text: rawText, // Same for now; AI cleans later
          bbox,
          continuation_hint: continuation.hint,
          continuation_to_page: continuation.to_page,
          continuation_from_page: continuation.from_page,
          confidence: fragmentType === 'unknown' ? 0.5 : 0.8,
        });
      }
    }

    // Also infer continuation: if last fragment on page ends mid-sentence 
    // and first fragment on next page starts without heading
    for (let i = 0; i < allFragments.length; i++) {
      const frag = allFragments[i];
      if (frag.continuation_to_page) continue; // Already has explicit continuation
      
      const text = frag.raw_text.trim();
      const endsAbruptly = text.length > 30 && !text.endsWith('.') && !text.endsWith(':') && !text.endsWith(';');
      
      if (endsAbruptly) {
        // Find first fragment on next page
        const nextPageNo = frag.page_no + 1;
        const nextPageFirst = allFragments.find(f => f.page_no === nextPageNo && f.fragment_index === 0);
        if (nextPageFirst && !isHeadingLike(nextPageFirst.raw_text.split('\n')[0])) {
          // Likely continuation
          frag.continuation_to_page = nextPageNo;
          frag.continuation_hint = (frag.continuation_hint || '') + (frag.continuation_hint ? '; ' : '') + 'inferred: text continues to next page';
          nextPageFirst.continuation_from_page = frag.page_no;
          nextPageFirst.continuation_hint = (nextPageFirst.continuation_hint || '') + (nextPageFirst.continuation_hint ? '; ' : '') + 'inferred: continues from previous page';
        }
      }
    }

    // Batch insert fragments
    if (allFragments.length > 0) {
      const { error: insertErr } = await serviceClient.from("azure_emp_news_fragments").insert(allFragments);
      if (insertErr) throw new Error(`Fragment insert failed: ${insertErr.message}`);
    }

    // Update issue
    await serviceClient.from("azure_emp_news_issues")
      .update({ reconstruction_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", issue_id);

    return new Response(JSON.stringify({
      success: true,
      fragments_created: allFragments.length,
      pages_processed: pages.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("build-fragments error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
