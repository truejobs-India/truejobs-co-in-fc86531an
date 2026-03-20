/**
 * rss-ai-process — AI processing pipeline for RSS items.
 * Actions: analyse, enrich, generate-image, seo-check
 * Each action processes an array of rss_item_ids with per-row isolation.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// AI MODEL DISPATCHER — reuses project-standard pattern
// ═══════════════════════════════════════════════════════════════

const GATEWAY_MODELS: Record<string, string> = {
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gpt5': 'openai/gpt-5',
  'gpt5-mini': 'openai/gpt-5-mini',
  'mistral': 'google/gemini-2.5-flash',
  'lovable-gemini': 'google/gemini-2.5-flash',
};

const IMAGE_MODELS: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
};

async function callTextAI(model: string, prompt: string): Promise<string> {
  // Direct API models first
  if (model === 'gemini' || model === 'gemini-flash') {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`);
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }

  if (model === 'groq') {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 8192 }),
    });
    if (!resp.ok) throw new Error(`Groq error: ${resp.status}`);
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  if (model === 'claude-sonnet' || model === 'claude') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!resp.ok) throw new Error(`Claude error: ${resp.status}`);
    const data = await resp.json();
    return data?.content?.[0]?.text || '';
  }

  if (model === 'vertex-flash' || model === 'vertex-pro') {
    const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
    const vertexModel = model === 'vertex-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    return callVertexGemini(vertexModel, prompt, 90_000, { maxOutputTokens: 8192, temperature: 0.5 });
  }

  if (model === 'nova-pro' || model === 'nova-premier') {
    const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
    return callBedrockNova(model, prompt, { maxTokens: 8192, temperature: 0.5 });
  }

  // Fallback: Lovable Gateway
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const gatewayModel = GATEWAY_MODELS[model] || 'google/gemini-2.5-flash';
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: gatewayModel, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 8192 }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) throw new Error('Rate limit exceeded, please try again later');
    if (resp.status === 402) throw new Error('Payment required, please add credits');
    throw new Error(`AI Gateway error (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callImageAI(model: string, prompt: string): Promise<{ base64: string; mimeType: string }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const gatewayModel = IMAGE_MODELS[model] || 'google/gemini-2.5-flash-image';

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: gatewayModel,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) throw new Error('IMAGE_GEN_RATE_LIMITED');
    if (resp.status === 402) throw new Error('IMAGE_GEN_QUOTA_EXCEEDED');
    throw new Error(`Image generation failed (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  const imageData = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageData) throw new Error('No image returned from AI gateway');
  const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data format');
  return { base64: match[2], mimeType: match[1] };
}

// ═══════════════════════════════════════════════════════════════
// JSON PARSING — 4-level recovery
// ═══════════════════════════════════════════════════════════════

function parseJsonSafe(raw: string): Record<string, unknown> | null {
  // Level 1: Direct parse
  try { return JSON.parse(raw); } catch {}
  // Level 2: Extract JSON block
  const blockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (blockMatch) { try { return JSON.parse(blockMatch[1].trim()); } catch {} }
  // Level 3: Find { ... } 
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch {} }
  // Level 4: Return as plain text wrapper
  return { raw_text: raw };
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildAnalysePrompt(item: any): string {
  return `You are a content analyst for TrueJobs.co.in, an Indian government jobs and education services portal.

Analyse this RSS item and provide a structured assessment for editorial decision-making.

SOURCE DATA:
- Title: ${item.item_title || 'N/A'}
- Summary: ${(item.item_summary || '').substring(0, 3000)}
- Content: ${(item.item_content || '').substring(0, 2000)}
- Link: ${item.item_link || 'N/A'}
- Categories: ${(item.categories || []).join(', ') || 'None'}
- Source: ${item.source_name || 'Unknown'}
- Item Type: ${item.item_type || 'unknown'}
- Primary Domain: ${item.primary_domain || 'general_alerts'}
- Display Group: ${item.display_group || 'General Alerts'}
- Published: ${item.published_at || 'Unknown'}
- PDF URL: ${item.first_pdf_url || 'None'}

Return ONLY valid JSON with these fields:
{
  "publish_recommended": true/false,
  "confidence_level": "high"/"medium"/"low",
  "content_type": "job_notification"/"exam_update"/"result"/"admit_card"/"scholarship"/"certificate"/"policy"/"general",
  "suggested_primary_domain": "jobs"/"education_services"/"exam_updates"/"public_services"/"policy_updates"/"general_alerts",
  "suggested_item_type": "recruitment"/"vacancy"/"exam"/"admit_card"/"result"/"answer_key"/"syllabus"/"scholarship"/"certificate"/"marksheet"/"school_service"/"university_service"/"document_service"/"policy"/"circular"/"notification"/"signal"/"unknown",
  "suggested_category": "string",
  "suggested_title": "Clean, SEO-friendly title in English",
  "suggested_slug": "url-safe-slug",
  "key_entities": ["organization names", "exam names", "department names"],
  "important_dates": [{"label": "Last Date", "date": "2025-01-15"}],
  "important_links": [{"label": "Apply Link", "url": "..."}],
  "missing_information": ["list of important missing details"],
  "ambiguity_flags": ["any unclear or potentially misleading content"],
  "needs_manual_review": true/false,
  "suggested_next_action": "enrich"/"skip"/"needs_source_check"/"needs_pdf_review",
  "analysis_notes": "Brief editorial notes"
}

Be factual. Do not fabricate dates, links, or eligibility details not present in the source. Flag missing information clearly.`;
}

function buildEnrichPrompt(item: any, analysisOutput: any, wordLimit: number): string {
  const analysis = analysisOutput || {};
  return `You are a senior content writer for TrueJobs.co.in, an Indian government jobs and education services portal.

Create structured, factual, informational content based on this RSS item. Use ONLY information present in the source data. Do NOT fabricate dates, eligibility criteria, links, or official claims.

SOURCE DATA:
- Title: ${item.item_title || 'N/A'}
- Summary: ${(item.item_summary || '').substring(0, 3000)}
- Content: ${(item.item_content || '').substring(0, 3000)}
- Link: ${item.item_link || 'N/A'}
- Categories: ${(item.categories || []).join(', ') || 'None'}
- Item Type: ${item.item_type || 'unknown'}
- Primary Domain: ${item.primary_domain || 'general_alerts'}
- PDF URL: ${item.first_pdf_url || 'None'}

${analysis.analysis_notes ? `ANALYSIS NOTES: ${analysis.analysis_notes}` : ''}
${analysis.key_entities ? `KEY ENTITIES: ${JSON.stringify(analysis.key_entities)}` : ''}
${analysis.important_dates ? `IMPORTANT DATES: ${JSON.stringify(analysis.important_dates)}` : ''}

STRICT Word count target: ${wordLimit} words. Do NOT exceed ${Math.round(wordLimit * 1.15)} words.
${wordLimit <= 500 ? 'Keep sections brief and skip subsections.' : ''}

Return ONLY valid JSON:
{
  "cleaned_title": "Clean English title for publishing",
  "short_intro": "2-3 sentence introduction",
  "article_body": "Full article in HTML with proper h2/h3 headings",
  "summary_points": ["key point 1", "key point 2"],
  "important_dates": [{"label": "string", "date": "string"}],
  "eligibility_summary": "If applicable, else null",
  "how_to_apply": "If applicable, else null",
  "important_links": [{"label": "string", "url": "string"}],
  "faq_block": [{"question": "string", "answer": "string"}],
  "seo_title": "SEO-optimized title under 60 chars",
  "meta_description": "Meta description under 160 chars",
  "canonical_suggestion": "URL or null",
  "tags": ["tag1", "tag2"],
  "excerpt": "Short excerpt under 200 chars",
  "internal_linking_suggestions": ["related topic slugs"],
  "schema_suggestion": "JobPosting/Article/FAQPage/none"
}

Write clean, factual, informational content suitable for Indian government job seekers. No spam, no hype, no hallucinated facts.`;
}

function buildImagePrompt(item: any, enrichOutput: any): string {
  const title = enrichOutput?.cleaned_title || item.item_title || 'Government Update';
  const domain = item.primary_domain || 'general_alerts';
  
  let scene = '';
  switch (domain) {
    case 'jobs':
      scene = 'Scene: A confident young Indian professional in formal attire looking at a job notification board or laptop. Modern office or government building background. Aspirational, clean.';
      break;
    case 'education_services':
      scene = 'Scene: Indian students in a modern educational setting, studying or receiving certificates. Clean, bright academic environment.';
      break;
    case 'exam_updates':
      scene = 'Scene: Indian students preparing for competitive exams, studying with books and laptops. Focused, determined expressions. Study room or library setting.';
      break;
    default:
      scene = 'Scene: Modern Indian government services context, clean and professional. Citizens interacting with digital services or official notices.';
  }

  return `Photorealistic, premium editorial photograph for an Indian government services news article titled "${title}". ${scene} Natural lighting, sharp focus, realistic proportions. No text, no watermarks, no logos, no Hindi text, no embedded text of any kind. Clean, professional, AdSense-safe. Wide 16:9 composition suitable for a hero banner.`;
}

function buildSeoCheckPrompt(item: any, enrichOutput: any, imageUrl: string | null): string {
  const enrich = enrichOutput || {};
  return `You are an SEO specialist for TrueJobs.co.in. Evaluate this content for on-page SEO readiness.

CONTENT:
- Title: ${enrich.seo_title || enrich.cleaned_title || item.item_title || 'N/A'}
- Meta Description: ${enrich.meta_description || 'Not set'}
- Slug: ${enrich.canonical_suggestion || 'Not set'}
- Article Body Length: ${(enrich.article_body || '').length} chars
- Tags: ${(enrich.tags || []).join(', ') || 'None'}
- Excerpt: ${enrich.excerpt || 'Not set'}
- FAQ Count: ${(enrich.faq_block || []).length}
- Has Cover Image: ${imageUrl ? 'Yes' : 'No'}
- Schema Suggestion: ${enrich.schema_suggestion || 'None'}
- Domain: ${item.primary_domain || 'general_alerts'}

Return ONLY valid JSON:
{
  "seo_passed": true/false,
  "seo_score": 0-100,
  "seo_title_status": "good"/"warning"/"error",
  "seo_title_note": "string",
  "meta_description_status": "good"/"warning"/"error",
  "meta_description_note": "string",
  "canonical_status": "good"/"warning"/"missing",
  "slug_status": "good"/"warning"/"error",
  "slug_note": "string",
  "heading_status": "good"/"warning"/"error",
  "image_status": "good"/"missing",
  "image_alt_suggestion": "string or null",
  "internal_linking_status": "good"/"needs_improvement",
  "schema_status": "ready"/"needs_work"/"not_applicable",
  "seo_issues": ["issue1", "issue2"],
  "seo_fixes": ["fix1", "fix2"],
  "thin_content_risk": true/false,
  "duplication_risk": "low"/"medium"/"high",
  "over_optimization_risk": "low"/"medium"/"high",
  "adsense_safe": true/false,
  "recommended_final_actions": ["action1", "action2"]
}`;
}

// ═══════════════════════════════════════════════════════════════
// STORAGE UPLOAD
// ═══════════════════════════════════════════════════════════════

async function uploadToStorage(adminClient: any, base64: string, mimeType: string, itemId: string): Promise<string> {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filePath = `rss-covers/${itemId}-${Date.now()}.${ext}`;
  const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([imageBytes], { type: mimeType });

  const { error } = await adminClient.storage
    .from('blog-assets')
    .upload(filePath, blob, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);
  return urlData.publicUrl;
}

// ═══════════════════════════════════════════════════════════════
// ENSURE AI PROCESSING ROW EXISTS
// ═══════════════════════════════════════════════════════════════

async function ensureProcessingRow(client: any, itemId: string): Promise<string> {
  const { data: existing } = await client
    .from('rss_ai_processing')
    .select('id')
    .eq('rss_item_id', itemId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await client
    .from('rss_ai_processing')
    .insert({ rss_item_id: itemId })
    .select('id')
    .single();

  if (error) {
    // Race condition — try select again
    if (error.code === '23505') {
      const { data: retry } = await client
        .from('rss_ai_processing')
        .select('id')
        .eq('rss_item_id', itemId)
        .single();
      if (retry) return retry.id;
    }
    throw error;
  }
  return created.id;
}

// ═══════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleAnalyse(
  client: any,
  itemIds: string[],
  model: string,
  skipCompleted: boolean,
): Promise<any[]> {
  const results: any[] = [];

  for (const itemId of itemIds) {
    try {
      const procId = await ensureProcessingRow(client, itemId);

      // Check skip
      if (skipCompleted) {
        const { data: proc } = await client.from('rss_ai_processing').select('analysis_status').eq('id', procId).single();
        if (proc?.analysis_status === 'completed') {
          results.push({ itemId, status: 'skipped' });
          continue;
        }
      }

      // Mark running
      await client.from('rss_ai_processing').update({
        analysis_status: 'running', analysis_error: null, analysis_model: model,
      }).eq('id', procId);

      // Fetch item with source name
      const { data: item } = await client.from('rss_items').select('*').eq('id', itemId).single();
      if (!item) { results.push({ itemId, status: 'error', error: 'Item not found' }); continue; }

      // Get source name
      const { data: source } = await client.from('rss_sources').select('source_name').eq('id', item.rss_source_id).maybeSingle();
      item.source_name = source?.source_name || 'Unknown';

      const prompt = buildAnalysePrompt(item);
      const raw = await callTextAI(model, prompt);
      const parsed = parseJsonSafe(raw);

      await client.from('rss_ai_processing').update({
        analysis_status: 'completed',
        analysis_output: parsed,
        analysis_run_at: new Date().toISOString(),
        analysis_error: null,
      }).eq('id', procId);

      results.push({ itemId, status: 'completed' });
    } catch (e: any) {
      const procId = await ensureProcessingRow(client, itemId).catch(() => null);
      if (procId) {
        await client.from('rss_ai_processing').update({
          analysis_status: 'failed',
          analysis_error: e.message?.substring(0, 500),
          analysis_run_at: new Date().toISOString(),
        }).eq('id', procId);
      }
      results.push({ itemId, status: 'error', error: e.message?.substring(0, 200) });
    }
  }
  return results;
}

async function handleEnrich(
  client: any,
  itemIds: string[],
  model: string,
  wordLimit: number,
  skipCompleted: boolean,
): Promise<any[]> {
  const results: any[] = [];

  for (const itemId of itemIds) {
    try {
      const procId = await ensureProcessingRow(client, itemId);

      if (skipCompleted) {
        const { data: proc } = await client.from('rss_ai_processing').select('enrichment_status').eq('id', procId).single();
        if (proc?.enrichment_status === 'completed') {
          results.push({ itemId, status: 'skipped' });
          continue;
        }
      }

      await client.from('rss_ai_processing').update({
        enrichment_status: 'running', enrichment_error: null, enrichment_model: model, enrichment_word_limit: wordLimit,
      }).eq('id', procId);

      const { data: item } = await client.from('rss_items').select('*').eq('id', itemId).single();
      if (!item) { results.push({ itemId, status: 'error', error: 'Item not found' }); continue; }

      // Get analysis output if available
      const { data: proc } = await client.from('rss_ai_processing').select('analysis_output').eq('rss_item_id', itemId).single();

      const prompt = buildEnrichPrompt(item, proc?.analysis_output, wordLimit);
      const raw = await callTextAI(model, prompt);
      const parsed = parseJsonSafe(raw);

      await client.from('rss_ai_processing').update({
        enrichment_status: 'completed',
        enrichment_output: parsed,
        enrichment_run_at: new Date().toISOString(),
        enrichment_error: null,
      }).eq('id', procId);

      results.push({ itemId, status: 'completed' });
    } catch (e: any) {
      const procId = await ensureProcessingRow(client, itemId).catch(() => null);
      if (procId) {
        await client.from('rss_ai_processing').update({
          enrichment_status: 'failed',
          enrichment_error: e.message?.substring(0, 500),
          enrichment_run_at: new Date().toISOString(),
        }).eq('id', procId);
      }
      results.push({ itemId, status: 'error', error: e.message?.substring(0, 200) });
    }
  }
  return results;
}

async function handleGenerateImage(
  client: any,
  itemIds: string[],
  model: string,
  skipCompleted: boolean,
): Promise<any[]> {
  const results: any[] = [];

  for (const itemId of itemIds) {
    try {
      const procId = await ensureProcessingRow(client, itemId);

      if (skipCompleted) {
        const { data: proc } = await client.from('rss_ai_processing').select('image_status, cover_image_url').eq('id', procId).single();
        if (proc?.image_status === 'completed' && proc?.cover_image_url) {
          results.push({ itemId, status: 'skipped' });
          continue;
        }
      }

      await client.from('rss_ai_processing').update({
        image_status: 'running', image_error: null, image_model: model,
      }).eq('id', procId);

      const { data: item } = await client.from('rss_items').select('*').eq('id', itemId).single();
      if (!item) { results.push({ itemId, status: 'error', error: 'Item not found' }); continue; }

      const { data: proc } = await client.from('rss_ai_processing').select('enrichment_output').eq('rss_item_id', itemId).single();

      const prompt = buildImagePrompt(item, proc?.enrichment_output);
      const { base64, mimeType } = await callImageAI(model, prompt);
      const publicUrl = await uploadToStorage(client, base64, mimeType, itemId);

      await client.from('rss_ai_processing').update({
        image_status: 'completed',
        cover_image_url: publicUrl,
        image_prompt_used: prompt.substring(0, 1000),
        image_run_at: new Date().toISOString(),
        image_error: null,
      }).eq('id', procId);

      results.push({ itemId, status: 'completed', cover_image_url: publicUrl });
    } catch (e: any) {
      const procId = await ensureProcessingRow(client, itemId).catch(() => null);
      if (procId) {
        await client.from('rss_ai_processing').update({
          image_status: 'failed',
          image_error: e.message?.substring(0, 500),
          image_run_at: new Date().toISOString(),
        }).eq('id', procId);
      }
      results.push({ itemId, status: 'error', error: e.message?.substring(0, 200) });
      // Circuit breaker for quota errors
      if (e.message?.includes('QUOTA_EXCEEDED') || e.message?.includes('RATE_LIMITED')) break;
    }
  }
  return results;
}

async function handleSeoCheck(
  client: any,
  itemIds: string[],
  model: string,
  skipCompleted: boolean,
): Promise<any[]> {
  const results: any[] = [];

  for (const itemId of itemIds) {
    try {
      const procId = await ensureProcessingRow(client, itemId);

      if (skipCompleted) {
        const { data: proc } = await client.from('rss_ai_processing').select('seo_check_status').eq('id', procId).single();
        if (proc?.seo_check_status === 'completed') {
          results.push({ itemId, status: 'skipped' });
          continue;
        }
      }

      await client.from('rss_ai_processing').update({
        seo_check_status: 'running', seo_error: null, seo_model: model,
      }).eq('id', procId);

      const { data: item } = await client.from('rss_items').select('*').eq('id', itemId).single();
      if (!item) { results.push({ itemId, status: 'error', error: 'Item not found' }); continue; }

      const { data: proc } = await client.from('rss_ai_processing').select('enrichment_output, cover_image_url').eq('rss_item_id', itemId).single();

      const prompt = buildSeoCheckPrompt(item, proc?.enrichment_output, proc?.cover_image_url);
      const raw = await callTextAI(model, prompt);
      const parsed = parseJsonSafe(raw);

      const seoScore = typeof parsed?.seo_score === 'number' ? parsed.seo_score : null;

      await client.from('rss_ai_processing').update({
        seo_check_status: 'completed',
        seo_output: parsed,
        seo_score: seoScore,
        seo_run_at: new Date().toISOString(),
        seo_error: null,
      }).eq('id', procId);

      results.push({ itemId, status: 'completed', seo_score: seoScore });
    } catch (e: any) {
      const procId = await ensureProcessingRow(client, itemId).catch(() => null);
      if (procId) {
        await client.from('rss_ai_processing').update({
          seo_check_status: 'failed',
          seo_error: e.message?.substring(0, 500),
          seo_run_at: new Date().toISOString(),
        }).eq('id', procId);
      }
      results.push({ itemId, status: 'error', error: e.message?.substring(0, 200) });
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);
    
    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) return jsonResponse({ error: 'Admin role required' }, 403);

    const body = await req.json();
    const { action, item_ids, model, word_limit, skip_completed } = body;

    if (!action) return jsonResponse({ error: 'Missing action' }, 400);
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return jsonResponse({ error: 'item_ids array required' }, 400);
    }

    // Cap at 50 items per request
    const ids = item_ids.slice(0, 50);
    const aiModel = model || 'gemini-flash';
    const skip = skip_completed !== false;

    let results: any[];

    switch (action) {
      case 'analyse':
        results = await handleAnalyse(adminClient, ids, aiModel, skip);
        break;
      case 'enrich':
        results = await handleEnrich(adminClient, ids, aiModel, word_limit || 800, skip);
        break;
      case 'generate-image':
        results = await handleGenerateImage(adminClient, ids, aiModel, skip);
        break;
      case 'seo-check':
        results = await handleSeoCheck(adminClient, ids, aiModel, skip);
        break;
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    const completed = results.filter(r => r.status === 'completed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    return jsonResponse({
      success: true,
      action,
      total: ids.length,
      completed,
      skipped,
      errors,
      results,
    });
  } catch (e: any) {
    console.error('rss-ai-process error:', e);
    return jsonResponse({ error: e.message || 'Internal error' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
