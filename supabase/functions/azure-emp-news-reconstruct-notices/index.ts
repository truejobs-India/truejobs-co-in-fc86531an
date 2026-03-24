import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract employer-like name from first lines of text
function extractEmployerName(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    // Match all-caps org names
    if (line === line.toUpperCase() && line.length > 5 && line.length < 150) {
      // Skip if it's a generic header
      if (/^(employment\s*news|rozgar\s*samachar|government\s*of\s*india)/i.test(line)) continue;
      return line;
    }
    // Match named orgs
    if (/^(Government|Ministry|Department|Office|Commission|Board|University|Institute|Corporation|Authority|Council|Directorate|National|Central|Indian|State|Public|Defence|Army|Navy|Air|Rail|Bank|Reserve|Insurance|Postal|Tele|Atomic|Space|Oil|Steel|Coal|Power|Water|Forest|Health|Education)/i.test(line) && line.length < 200) {
      return line;
    }
  }
  return null;
}

function extractNoticeTitle(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const first = lines[0];
    if (first.length < 200) return first;
    return first.substring(0, 197) + '...';
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await serviceClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
  }

  try {
    const { issue_id } = await req.json();
    if (!issue_id) throw new Error("issue_id required");

    // Guard: fragments must exist
    const { data: fragments, error: fragErr } = await serviceClient
      .from("azure_emp_news_fragments")
      .select("*")
      .eq("issue_id", issue_id)
      .order("page_no", { ascending: true })
      .order("fragment_index", { ascending: true });

    if (fragErr) throw new Error(`Failed to load fragments: ${fragErr.message}`);
    if (!fragments || fragments.length === 0) {
      throw new Error("No fragments found. Run 'Build Fragments' first.");
    }

    // Delete existing reconstructed notices (idempotent)
    // First delete draft jobs linked to notices for this issue
    await serviceClient.from("azure_emp_news_draft_jobs").delete().eq("issue_id", issue_id);
    await serviceClient.from("azure_emp_news_reconstructed_notices").delete().eq("issue_id", issue_id);

    // Update status
    await serviceClient.from("azure_emp_news_issues")
      .update({ reconstruction_status: "processing" })
      .eq("id", issue_id);

    // Build notice groups by following continuation chains
    const visited = new Set<string>();
    const noticeGroups: Array<{ fragments: typeof fragments; hasExplicitContinuation: boolean }> = [];

    for (const frag of fragments) {
      const fragKey = `${frag.page_no}-${frag.fragment_index}`;
      if (visited.has(fragKey)) continue;

      // Skip if this fragment continues from another (it'll be picked up by that chain)
      if (frag.continuation_from_page != null) {
        // Check if the source fragment exists
        const sourceExists = fragments.some(f =>
          f.page_no === frag.continuation_from_page &&
          f.continuation_to_page === frag.page_no
        );
        if (sourceExists) continue; // Will be merged via the source chain
      }

      // Start a new group from this fragment
      const group: typeof fragments = [];
      let hasExplicit = false;
      let current = frag;

      while (current) {
        const key = `${current.page_no}-${current.fragment_index}`;
        if (visited.has(key)) break;
        visited.add(key);
        group.push(current);

        if (current.continuation_to_page != null) {
          hasExplicit = true;
          // Find continuation target on the target page
          const targetPage = current.continuation_to_page;
          const target = fragments.find(f =>
            f.page_no === targetPage &&
            (f.continuation_from_page === current!.page_no || f.fragment_index === 0)
          );
          current = target || null as any;
        } else {
          current = null as any;
        }
      }

      if (group.length > 0) {
        noticeGroups.push({ fragments: group, hasExplicitContinuation: hasExplicit });
      }
    }

    // Also handle any unvisited fragments (orphans)
    for (const frag of fragments) {
      const key = `${frag.page_no}-${frag.fragment_index}`;
      if (!visited.has(key)) {
        visited.add(key);
        noticeGroups.push({ fragments: [frag], hasExplicitContinuation: false });
      }
    }

    // Create reconstructed notices
    const notices: any[] = [];
    for (let i = 0; i < noticeGroups.length; i++) {
      const { fragments: groupFrags, hasExplicitContinuation } = noticeGroups[i];
      const mergedText = groupFrags.map(f => f.cleaned_text || f.raw_text).join("\n\n---\n\n");
      const startPage = Math.min(...groupFrags.map(f => f.page_no));
      const endPage = Math.max(...groupFrags.map(f => f.page_no));
      const firstFrag = groupFrags[0];

      const employerName = extractEmployerName(mergedText);
      const noticeTitle = extractNoticeTitle(mergedText);

      // Confidence scoring
      let confidence = 1.0;
      if (groupFrags.length > 1) {
        confidence = hasExplicitContinuation ? 0.9 : 0.7;
      }
      // Lower confidence if all unknown type
      const types = groupFrags.map(f => f.fragment_type);
      if (types.every((t: string) => t === 'unknown')) confidence *= 0.6;

      const noticeKey = `p${startPage}-f${firstFrag.fragment_index}`;

      notices.push({
        issue_id,
        notice_key: noticeKey,
        start_page: startPage,
        end_page: endPage,
        notice_title: noticeTitle,
        employer_name: employerName,
        merged_text: mergedText,
        merged_blocks_json: groupFrags.map(f => ({
          page_no: f.page_no,
          fragment_index: f.fragment_index,
          fragment_type: f.fragment_type,
          fragment_id: f.id,
        })),
        reconstruction_confidence: Math.round(confidence * 100) / 100,
        ai_status: "pending",
      });
    }

    if (notices.length > 0) {
      const { error: insertErr } = await serviceClient.from("azure_emp_news_reconstructed_notices").insert(notices);
      if (insertErr) throw new Error(`Notice insert failed: ${insertErr.message}`);
    }

    // Update issue
    await serviceClient.from("azure_emp_news_issues")
      .update({
        reconstruction_status: "completed",
        ai_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", issue_id);

    // Count types
    const jobCount = notices.filter(n => {
      const blocks = n.merged_blocks_json as any[];
      return blocks.some((b: any) => b.fragment_type === 'job_notice');
    }).length;

    return new Response(JSON.stringify({
      success: true,
      notices_created: notices.length,
      job_notices: jobCount,
      editorial_other: notices.length - jobCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("reconstruct-notices error:", e);
    await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      .from("azure_emp_news_issues")
      .update({ reconstruction_status: "failed" })
      .eq("id", (await req.clone().json().catch(() => ({}))).issue_id || "");
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
