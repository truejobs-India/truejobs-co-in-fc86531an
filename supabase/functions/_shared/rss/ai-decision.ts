/**
 * RSS AI Decision Layer — Mistral Large via AWS Bedrock
 * 
 * Two decision points:
 *   Stage One: before Firecrawl — should we enrich? how?
 *   Stage Two: after Firecrawl  — is the enriched content useful?
 * 
 * Banding logic:
 *   Band 1: deterministic only (skip AI)
 *   Band 2: AI-assisted (call Mistral)
 *   On failure: fall back to deterministic rules
 */

import { awsSigV4Fetch } from '../bedrock-nova.ts';

// ── Constants ──

const MISTRAL_MODEL_ID = 'mistral.mistral-large-2407-v1:0';
const BEDROCK_REGION = 'us-west-2';
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.1;
const TIMEOUT_MS = 30_000;
const MIN_SUBSTANTIVE_CONTENT = 200;
const STAGE_TWO_EXCERPT_LENGTH = 500;

// ── Types ──

export interface StageOneOutput {
  should_use_firecrawl: boolean;
  crawl_target: 'none' | 'page' | 'pdf';
  queue_priority: 'urgent' | 'normal' | 'low' | 'ignore';
  should_queue_for_review: boolean;
  should_skip_as_low_value: boolean;
  reason_code: string;
  reason_text: string;
  confidence: number;
}

export interface StageTwoOutput {
  is_useful_after_enrichment: boolean;
  likely_content_type: 'vacancy' | 'result' | 'admit_card' | 'answer_key' | 'exam' | 'counselling' | 'document_update' | 'other';
  queue_priority: 'urgent' | 'normal' | 'low' | 'ignore';
  should_queue_for_review: boolean;
  should_retry_firecrawl: boolean;
  reason_code: string;
  reason_text: string;
  confidence: number;
}

export type BandResult = {
  band: 'band_1_low' | 'band_1_high' | 'band_2';
  reason: string;
};

export interface AiDecisionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  model: string;
}

// ── Banding Logic ──

export function computeBand(item: Record<string, unknown>, force = false): BandResult {
  if (force) {
    return { band: 'band_2', reason: 'manual_force' };
  }

  const relevance = item.relevance_level as string;
  const summary = (item.item_summary as string) || '';
  const title = (item.item_title as string) || '';
  const hasPdf = !!(item.first_pdf_url);
  const linkedPdfs = (item.linked_pdf_urls as string[]) || [];
  const hasLinkedPdfs = linkedPdfs.length > 0;

  // Band 1 Low: obvious low-value — skip AI and Firecrawl
  if (relevance === 'Low' && !hasPdf && !hasLinkedPdfs && summary.length >= 80) {
    return { band: 'band_1_low', reason: 'low_relevance_sufficient_summary' };
  }

  // Band 1 High: obvious high-value with enough context — deterministic proceed
  if (relevance === 'High' && summary.length >= 150 && !hasPdf && !hasLinkedPdfs) {
    return { band: 'band_1_high', reason: 'high_relevance_strong_summary' };
  }

  // Band 2: everything else needs AI
  let reason = 'uncertain';
  if (relevance === 'Medium') reason = 'medium_relevance';
  else if (relevance === 'High' && summary.length < 150) reason = 'high_relevance_weak_summary';
  else if (hasPdf || hasLinkedPdfs) reason = 'pdf_importance_unclear';
  else if (title.length < 30) reason = 'ambiguous_title';

  return { band: 'band_2', reason };
}

// ── Stage One ──

export async function runStageOne(item: Record<string, unknown>): Promise<AiDecisionResult<StageOneOutput>> {
  const payload = {
    title: (item.item_title as string) || '',
    summary: ((item.item_summary as string) || '').substring(0, 300),
    link: (item.item_link as string) || '',
    item_type: (item.item_type as string) || 'unknown',
    relevance_level: (item.relevance_level as string) || 'Low',
    primary_domain: (item.primary_domain as string) || 'general_alerts',
    has_pdf: !!(item.first_pdf_url),
    linked_pdf_count: ((item.linked_pdf_urls as string[]) || []).length,
    categories: ((item.categories as string[]) || []).slice(0, 5),
  };

  const systemPrompt = `You are a content routing engine for a government jobs and education portal. Analyze the RSS item and decide routing. Return ONLY valid JSON matching this exact schema:
{"should_use_firecrawl":boolean,"crawl_target":"none"|"page"|"pdf","queue_priority":"urgent"|"normal"|"low"|"ignore","should_queue_for_review":boolean,"should_skip_as_low_value":boolean,"reason_code":"string","reason_text":"string","confidence":number}
Rules:
- confidence must be 0.0 to 1.0
- crawl_target "pdf" only if has_pdf is true
- urgent priority only for active recruitment with deadlines
- Return ONLY the JSON object, no markdown, no explanation`;

  const userPrompt = `Analyze this RSS item:\n${JSON.stringify(payload, null, 2)}`;

  try {
    const raw = await callMistral(systemPrompt, userPrompt);
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      return { success: false, error: `Invalid JSON from Mistral: ${raw.substring(0, 200)}`, model: MISTRAL_MODEL_ID };
    }
    const validation = validateStageOneOutput(parsed);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.error}. Raw: ${raw.substring(0, 200)}`, model: MISTRAL_MODEL_ID };
    }
    return { success: true, data: parsed as StageOneOutput, model: MISTRAL_MODEL_ID };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e), model: MISTRAL_MODEL_ID };
  }
}

// ── Stage Two ──

export function hasSubstantiveContent(markdown: string | null): boolean {
  if (!markdown) return false;

  // Strip common boilerplate patterns
  let cleaned = markdown
    .replace(/cookie|privacy policy|terms of service|navigation|menu|sidebar|footer|header/gi, '')
    .replace(/accept all|reject all|manage preferences/gi, '')
    .replace(/\[.*?\]\(.*?\)/g, '') // remove markdown links
    .replace(/#+\s*/g, '') // remove heading markers
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length >= MIN_SUBSTANTIVE_CONTENT;
}

export async function runStageTwo(
  item: Record<string, unknown>,
  markdown: string
): Promise<AiDecisionResult<StageTwoOutput>> {
  const excerpt = markdown.substring(0, STAGE_TWO_EXCERPT_LENGTH).trim();

  const payload = {
    title: (item.item_title as string) || '',
    source_url: (item.firecrawl_source_url as string) || (item.item_link as string) || '',
    content_type: (item.item_type as string) || 'unknown',
    relevance_level: (item.relevance_level as string) || 'Low',
    excerpt,
    markdown_length: markdown.length,
    pdf_mode: (item.firecrawl_pdf_mode as string) || null,
  };

  const systemPrompt = `You are a content quality evaluator for a government jobs and education portal. Assess the enriched content excerpt and decide its usefulness. Return ONLY valid JSON matching this exact schema:
{"is_useful_after_enrichment":boolean,"likely_content_type":"vacancy"|"result"|"admit_card"|"answer_key"|"exam"|"counselling"|"document_update"|"other","queue_priority":"urgent"|"normal"|"low"|"ignore","should_queue_for_review":boolean,"should_retry_firecrawl":boolean,"reason_code":"string","reason_text":"string","confidence":number}
Rules:
- confidence must be 0.0 to 1.0
- should_retry_firecrawl only if content seems truncated or garbled
- Return ONLY the JSON object, no markdown, no explanation`;

  const userPrompt = `Evaluate this enriched content:\n${JSON.stringify(payload, null, 2)}`;

  try {
    const raw = await callMistral(systemPrompt, userPrompt);
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      return { success: false, error: `Invalid JSON from Mistral: ${raw.substring(0, 200)}`, model: MISTRAL_MODEL_ID };
    }
    const validation = validateStageTwoOutput(parsed);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.error}. Raw: ${raw.substring(0, 200)}`, model: MISTRAL_MODEL_ID };
    }
    return { success: true, data: parsed as StageTwoOutput, model: MISTRAL_MODEL_ID };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e), model: MISTRAL_MODEL_ID };
  }
}

// ── Mistral Bedrock Caller ──

async function callMistral(systemPrompt: string, userPrompt: string): Promise<string> {
  const host = `bedrock-runtime.${BEDROCK_REGION}.amazonaws.com`;
  const payload = JSON.stringify({
    messages: [
      { role: 'user', content: [{ text: userPrompt }] },
    ],
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    },
  });

  const resp = await Promise.race([
    awsSigV4Fetch(host, `/model/${MISTRAL_MODEL_ID}/converse`, payload, BEDROCK_REGION, 'bedrock'),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Mistral timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    ),
  ]);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`Mistral Bedrock error ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  const text = data?.output?.message?.content?.[0]?.text || '';

  if (!text.trim()) {
    throw new Error('Mistral returned empty response');
  }

  console.log(`[ai-decision] Mistral response length=${text.length}`);
  return text;
}

// ── JSON Parsing & Validation ──

function parseJsonSafe(raw: string): Record<string, unknown> | null {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    }
    // Find JSON object boundaries
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch {
    return null;
  }
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const VALID_CRAWL_TARGETS = ['none', 'page', 'pdf'];
const VALID_QUEUE_PRIORITIES = ['urgent', 'normal', 'low', 'ignore'];
const VALID_CONTENT_TYPES = ['vacancy', 'result', 'admit_card', 'answer_key', 'exam', 'counselling', 'document_update', 'other'];

function validateStageOneOutput(data: Record<string, unknown>): ValidationResult {
  if (typeof data.should_use_firecrawl !== 'boolean') return { valid: false, error: 'should_use_firecrawl must be boolean' };
  if (!VALID_CRAWL_TARGETS.includes(data.crawl_target as string)) return { valid: false, error: `crawl_target must be one of: ${VALID_CRAWL_TARGETS.join(',')}` };
  if (!VALID_QUEUE_PRIORITIES.includes(data.queue_priority as string)) return { valid: false, error: `queue_priority must be one of: ${VALID_QUEUE_PRIORITIES.join(',')}` };
  if (typeof data.should_queue_for_review !== 'boolean') return { valid: false, error: 'should_queue_for_review must be boolean' };
  if (typeof data.should_skip_as_low_value !== 'boolean') return { valid: false, error: 'should_skip_as_low_value must be boolean' };
  if (typeof data.reason_code !== 'string' || !data.reason_code) return { valid: false, error: 'reason_code must be non-empty string' };
  if (typeof data.reason_text !== 'string' || !data.reason_text) return { valid: false, error: 'reason_text must be non-empty string' };
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) return { valid: false, error: 'confidence must be number 0.0–1.0' };
  return { valid: true };
}

function validateStageTwoOutput(data: Record<string, unknown>): ValidationResult {
  if (typeof data.is_useful_after_enrichment !== 'boolean') return { valid: false, error: 'is_useful_after_enrichment must be boolean' };
  if (!VALID_CONTENT_TYPES.includes(data.likely_content_type as string)) return { valid: false, error: `likely_content_type must be one of: ${VALID_CONTENT_TYPES.join(',')}` };
  if (!VALID_QUEUE_PRIORITIES.includes(data.queue_priority as string)) return { valid: false, error: `queue_priority must be one of: ${VALID_QUEUE_PRIORITIES.join(',')}` };
  if (typeof data.should_queue_for_review !== 'boolean') return { valid: false, error: 'should_queue_for_review must be boolean' };
  if (typeof data.should_retry_firecrawl !== 'boolean') return { valid: false, error: 'should_retry_firecrawl must be boolean' };
  if (typeof data.reason_code !== 'string' || !data.reason_code) return { valid: false, error: 'reason_code must be non-empty string' };
  if (typeof data.reason_text !== 'string' || !data.reason_text) return { valid: false, error: 'reason_text must be non-empty string' };
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) return { valid: false, error: 'confidence must be number 0.0–1.0' };
  return { valid: true };
}
