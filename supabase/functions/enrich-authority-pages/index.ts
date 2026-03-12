import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = data.claims.sub as string;
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI API
// ═══════════════════════════════════════════════════════════════════════════════

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

interface PageContent {
  slug: string;
  examName?: string;
  conductingBody?: string;
  year?: number;
  existingOverview?: string;
  existingWordCount?: number;
  existingSections?: string[];
}

function buildNotificationPrompt(page: PageContent): string {
  return `You are a government exam content specialist for India. Write enrichment content for the "${page.examName || page.slug}" notification page.

RULES:
- Total output must be 1500-1800 words
- Write in clear, factual English. No filler. No generic career advice.
- Every section must be specific to ${page.examName || page.slug}
- Reference the conducting body: ${page.conductingBody || 'the official recruitment authority'}
- Year context: ${page.year || 2026}
- Do NOT repeat: "government jobs are a great career option" or similar generic statements

OUTPUT FORMAT — Return valid JSON with these keys:
{
  "overview": "300-450 word overview specific to this exam/recruitment",
  "eligibility": "150-250 words on eligibility criteria specific to this exam",
  "ageLimit": "150-200 words on age limits with category-wise relaxation",
  "selectionProcess": "150-250 words on the complete selection process",
  "salary": "150-200 words on salary structure and pay scale",
  "applicationProcess": "100-150 words on how to apply step-by-step",
  "preparationTips": "200-300 words with exam-specific preparation strategy",
  "faq": [
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"}
  ]
}

Existing overview for reference (enrich, don't duplicate): ${(page.existingOverview || '').substring(0, 500)}

Return ONLY the JSON object, no markdown fences.`;
}

function buildSyllabusPrompt(page: PageContent): string {
  return `You are a government exam content specialist for India. Write enrichment content for the "${page.examName || page.slug}" syllabus page.

RULES:
- Total output must be 1500-1800 words
- Be specific to ${page.examName}. Reference actual subjects and topics.
- Conducting body: ${page.conductingBody || 'official authority'}
- No generic study advice. Every tip must reference this exam's pattern.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "200-300 word overview of the syllabus structure",
  "tierWiseSyllabus": "300-450 words breaking down syllabus by exam stages/tiers",
  "subjectWiseBreakdown": "300-400 words with subject-wise topic details",
  "importantTopics": "200-250 words on high-weightage topics based on previous years",
  "recommendedBooks": "150-200 words listing specific books per subject",
  "preparationStrategy": "200-250 words on subject-wise preparation approach",
  "faq": [
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"}
  ]
}

Return ONLY the JSON object, no markdown fences.`;
}

function buildExamPatternPrompt(page: PageContent): string {
  return `You are a government exam content specialist for India. Write enrichment content for the "${page.examName || page.slug}" exam pattern page.

RULES:
- Total 1500-1800 words. Specific to ${page.examName}.
- Conducting body: ${page.conductingBody || 'official authority'}
- Include actual marking scheme numbers where known.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "200-300 words on the exam structure overview",
  "stageWisePattern": "300-400 words detailing each exam stage/tier",
  "markingScheme": "200-250 words on marks distribution and negative marking",
  "durationAndSections": "150-200 words on time allotted per section",
  "difficultyInsights": "200-250 words on difficulty trends from recent years",
  "normalization": "150-200 words explaining normalization if applicable, or scoring methodology",
  "timeManagement": "200-250 words on time management strategy specific to this exam pattern",
  "faq": [
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"}
  ]
}

Return ONLY the JSON object, no markdown fences.`;
}

function buildPYPPrompt(page: PageContent): string {
  return `You are a government exam content specialist for India. Write enrichment content for the "${page.examName || page.slug}" previous year papers page.

RULES:
- Total 1500-1800 words. Specific to ${page.examName}.
- Reference actual year-wise paper availability and patterns.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "200-300 words on the value of solving previous year papers for this exam",
  "topicTrends": "300-400 words analyzing topic trends across recent years",
  "difficultyAnalysis": "200-300 words comparing difficulty levels year-wise",
  "subjectWeightage": "200-300 words on which subjects carry highest question counts",
  "preparationInsights": "200-300 words on how to use PYPs effectively for this exam",
  "faq": [
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"},
    {"question": "...", "answer": "80-120 word answer"}
  ]
}

Return ONLY the JSON object, no markdown fences.`;
}

function buildStatePrompt(page: PageContent): string {
  const stateName = page.examName || page.slug.replace('govt-jobs-', '').replace(/-/g, ' ');
  return `You are a government jobs content specialist for India. Write unique enrichment content for the "${stateName}" state government jobs page.

RULES:
- Total 1500-1800 words. MUST be unique to ${stateName}.
- Reference the ACTUAL State Public Service Commission name for ${stateName}
- Reference real state-level recruiting bodies, departments, and boards
- Do NOT use generic text that could apply to any state
- Include state-specific exam names and recruitment processes

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "300-450 words unique overview of government jobs in ${stateName} with actual PSC name and major bodies",
  "majorRecruitingBodies": "200-300 words listing the state's PSC, SSC equivalent, police board, education board with actual names",
  "popularStateExams": "200-300 words on popular state-level competitive exams specific to ${stateName}",
  "importantDepartments": "200-250 words on major state government departments actively recruiting",
  "applicationGuidance": "150-200 words on how to find and apply for ${stateName} state jobs",
  "faq": [
    {"question": "...", "answer": "80-120 word answer specific to ${stateName}"},
    {"question": "...", "answer": "80-120 word answer specific to ${stateName}"},
    {"question": "...", "answer": "80-120 word answer specific to ${stateName}"},
    {"question": "...", "answer": "80-120 word answer specific to ${stateName}"},
    {"question": "...", "answer": "80-120 word answer specific to ${stateName}"}
  ]
}

Return ONLY the JSON object, no markdown fences.`;
}

function getPromptForType(pageType: string, page: PageContent): string {
  switch (pageType) {
    case 'notification': return buildNotificationPrompt(page);
    case 'syllabus': return buildSyllabusPrompt(page);
    case 'exam-pattern': return buildExamPatternPrompt(page);
    case 'pyp': return buildPYPPrompt(page);
    case 'state': return buildStatePrompt(page);
    default: return buildNotificationPrompt(page);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function computeQualityScore(enrichmentData: Record<string, unknown>): {
  wordScore: number;
  sectionScore: number;
  uniquenessScore: number;
  internalLinkScore: number;
  totalWords: number;
  sectionCount: number;
} {
  let totalWords = 0;
  let sectionCount = 0;

  for (const [key, value] of Object.entries(enrichmentData)) {
    if (key === 'faq' && Array.isArray(value)) {
      for (const faq of value) {
        totalWords += countWords(faq.question || '') + countWords(faq.answer || '');
      }
      sectionCount += 1;
    } else if (typeof value === 'string') {
      totalWords += countWords(value);
      sectionCount += 1;
    }
  }

  const wordScore = totalWords >= 1500 ? 10 : totalWords >= 1000 ? 7 : totalWords >= 500 ? 4 : 2;
  const sectionScore = sectionCount >= 7 ? 10 : sectionCount >= 5 ? 7 : sectionCount >= 3 ? 4 : 2;
  const uniquenessScore = 8;
  const internalLinkScore = 3;

  return { wordScore, sectionScore, uniquenessScore, internalLinkScore, totalWords, sectionCount };
}

function generateInternalLinks(pageType: string, slug: string): string[] {
  const links: string[] = [];

  if (pageType === 'notification') {
    const base = slug.replace(/-notification$/, '');
    links.push(`/${base}-syllabus`, `/${base}-exam-pattern`, `/${base}-salary`);
    links.push('/govt-job-age-calculator', '/govt-salary-calculator');
  } else if (pageType === 'syllabus') {
    const base = slug.replace(/-syllabus$/, '');
    links.push(`/${base}-notification`, `/${base}-exam-pattern`);
  } else if (pageType === 'exam-pattern') {
    const base = slug.replace(/-exam-pattern$/, '');
    links.push(`/${base}-notification`, `/${base}-syllabus`);
  } else if (pageType === 'pyp') {
    links.push('/sarkari-jobs');
  } else if (pageType === 'state') {
    links.push('/sarkari-jobs', '/ssc-jobs', '/railway-jobs', '/banking-jobs');
  }

  return links.slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function simpleHash(text: string): string {
  let hash = 0;
  const str = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

async function checkDuplicates(
  svc: ReturnType<typeof createClient>,
  enrichmentData: Record<string, unknown>,
  currentSlug: string,
): Promise<string[]> {
  const flags: string[] = [];
  const overview = typeof enrichmentData.overview === 'string' ? enrichmentData.overview : '';
  if (!overview) return flags;

  const newHash = simpleHash(overview);

  const { data: existing } = await svc
    .from('content_enrichments')
    .select('page_slug, enrichment_data')
    .neq('page_slug', currentSlug)
    .limit(100);

  if (existing) {
    for (const row of existing) {
      const existingOverview = (row.enrichment_data as Record<string, unknown>)?.overview;
      if (typeof existingOverview === 'string') {
        const existingHash = simpleHash(existingOverview);
        if (existingHash === newHash) {
          flags.push(`DUPLICATE_RISK: Overview similar to ${row.page_slug}`);
        }
      }
    }
  }

  return flags;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSERT HELPERS (using insert_enrichment_version RPC)
// ═══════════════════════════════════════════════════════════════════════════════

async function insertVersion(
  svc: ReturnType<typeof createClient>,
  params: {
    slug: string;
    pageType: string;
    enrichmentData: Record<string, unknown>;
    status: string;
    sectionsAdded: string[];
    internalLinks: string[];
    qualityScore: Record<string, number>;
    flags: string[];
    wordCount: number;
    sectionCount: number;
    failureReason?: string | null;
  },
): Promise<{ version: number | null; error: string | null }> {
  const { data, error } = await svc.rpc('insert_enrichment_version', {
    p_page_slug: params.slug,
    p_page_type: params.pageType,
    p_enrichment_data: params.enrichmentData,
    p_status: params.status,
    p_sections_added: params.sectionsAdded,
    p_internal_links_added: params.internalLinks,
    p_quality_score: params.qualityScore,
    p_flags: params.flags,
    p_current_word_count: params.wordCount,
    p_current_section_count: params.sectionCount,
    p_failure_reason: params.failureReason ?? null,
  });

  if (error) return { version: null, error: error.message };
  return { version: data as number, error: null };
}

async function insertFailedRow(
  svc: ReturnType<typeof createClient>,
  slug: string,
  pageType: string,
  failureReason: string,
  wordCount: number,
): Promise<void> {
  try {
    await insertVersion(svc, {
      slug,
      pageType,
      enrichmentData: {},
      status: 'failed',
      sectionsAdded: [],
      internalLinks: [],
      qualityScore: {},
      flags: [],
      wordCount,
      sectionCount: 0,
      failureReason,
    });
  } catch {
    console.error(`Failed to persist failure row for ${slug}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractJson(raw: string): Record<string, unknown> {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    cleaned = cleaned.substring(first, last + 1);
  }
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { slugs, pageType, currentContent } = await req.json() as {
      slugs: string[];
      pageType: string;
      currentContent: PageContent[];
    };

    if (!slugs || slugs.length === 0 || slugs.length > 8) {
      return new Response(JSON.stringify({ error: 'Batch size must be 1-8 slugs' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const results = new Array<{
      slug: string;
      status: string;
      sectionsAdded: string[];
      qualityScore: Record<string, number>;
      flags: string[];
      totalWords: number;
      failureReason?: string;
      version?: number;
    }>(slugs.length);

    async function processSlug(index: number) {
      const slug = slugs[index];
      const pageInfo = currentContent?.find((c: { slug: string }) => c.slug === slug) || { slug };
      const existingWordCount = (pageInfo as { existingWordCount?: number }).existingWordCount || 0;

      // ── Step 1: Call Gemini ──
      let rawResponse: string;
      try {
        const prompt = getPromptForType(pageType, pageInfo);
        rawResponse = await callGemini(prompt, GEMINI_API_KEY);
      } catch (geminiErr) {
        const reason = `GEMINI_ERROR: ${geminiErr instanceof Error ? geminiErr.message : 'Unknown'}`;
        await insertFailedRow(svc, slug, pageType, reason, existingWordCount);
        results[index] = {
          slug, status: 'failed', sectionsAdded: [], qualityScore: {},
          flags: [], totalWords: 0, failureReason: reason,
        };
        return;
      }

      // ── Step 2: Parse JSON ──
      let enrichmentData: Record<string, unknown>;
      try {
        enrichmentData = extractJson(rawResponse);
      } catch (parseErr) {
        const snippet = rawResponse.substring(0, 300).replace(/\n/g, '\\n');
        const reason = `PARSE_ERROR: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON'} | raw[0..300]: ${snippet}`;
        await insertFailedRow(svc, slug, pageType, reason, existingWordCount);
        results[index] = {
          slug, status: 'failed', sectionsAdded: [], qualityScore: {},
          flags: [], totalWords: 0, failureReason: reason,
        };
        return;
      }

      // ── Step 3: Quality scoring ──
      const quality = computeQualityScore(enrichmentData);
      const internalLinks = generateInternalLinks(pageType, slug);
      const dupFlags = await checkDuplicates(svc, enrichmentData, slug);
      const allFlags: string[] = [...dupFlags];

      if (quality.totalWords < 500) {
        allFlags.push('LOW_WORD_COUNT: Generated content below 500 words');
      } else if (quality.totalWords < 1000) {
        allFlags.push('MODERATE_WORD_COUNT: Content between 500-1000 words, below 1500 target');
      }

      const sectionsAdded = Object.keys(enrichmentData).filter(k => {
        if (k === 'faq') return Array.isArray(enrichmentData[k]) && (enrichmentData[k] as unknown[]).length > 0;
        return typeof enrichmentData[k] === 'string' && (enrichmentData[k] as string).length > 50;
      });

      const qualityScore = {
        wordScore: quality.wordScore,
        sectionScore: quality.sectionScore,
        uniquenessScore: quality.uniquenessScore,
        internalLinkScore: quality.internalLinkScore,
      };

      // ── Step 4: Insert via RPC ──
      const { version, error: insertError } = await insertVersion(svc, {
        slug,
        pageType,
        enrichmentData,
        status: 'draft',
        sectionsAdded,
        internalLinks,
        qualityScore,
        flags: allFlags,
        wordCount: quality.totalWords,
        sectionCount: quality.sectionCount,
      });

      if (insertError) {
        const reason = `DB_ERROR: ${insertError}`;
        await insertFailedRow(svc, slug, pageType, reason, existingWordCount);
        allFlags.push(reason);
        results[index] = {
          slug, status: 'failed', sectionsAdded, qualityScore,
          flags: allFlags, totalWords: quality.totalWords, failureReason: reason,
        };
      } else {
        results[index] = {
          slug,
          status: allFlags.length > 0 ? 'flagged' : 'success',
          sectionsAdded,
          qualityScore,
          flags: allFlags,
          totalWords: quality.totalWords,
          version: version ?? undefined,
        };
      }
    }

    const CONCURRENCY = 3;

    for (let i = 0; i < slugs.length; i += CONCURRENCY) {
      const indices = Array.from(
        { length: Math.min(CONCURRENCY, slugs.length - i) },
        (_, offset) => i + offset
      );
      await Promise.all(indices.map(processSlug));
      if (i + CONCURRENCY < slugs.length) await delay(1000);
    }

    const report = {
      batchSize: slugs.length,
      pagesEnriched: results.filter(r => r.status === 'success' || r.status === 'flagged').length,
      pagesFailed: results.filter(r => r.status === 'failed').length,
      totalSectionsAdded: results.reduce((sum, r) => sum + r.sectionsAdded.length, 0),
      averageWordCount: Math.round(results.reduce((sum, r) => sum + r.totalWords, 0) / results.length),
      flaggedPages: results.filter(r => r.flags.length > 0).map(r => r.slug),
      results,
    };

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('enrich-authority-pages error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
