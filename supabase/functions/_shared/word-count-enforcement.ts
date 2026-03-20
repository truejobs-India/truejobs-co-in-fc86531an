/**
 * Shared word-count enforcement module for all enrichment flows.
 * Provides: clean text word counting, dynamic token budgets,
 * standardized prompt instructions, 3-state validation, and correction prompts.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type WordCountStatus = 'pass' | 'warn' | 'fail';

export interface WordCountValidation {
  targetWordCount: number;
  actualWordCount: number;
  maxTokensRequested: number;
  minPass: number;   // target * 0.85
  maxPass: number;   // target * 1.15
  minWarn: number;   // target * 0.75
  maxWarn: number;   // target * 1.25
  status: WordCountStatus;
  deviation: number; // percentage, negative = under, positive = over
}

// ═══════════════════════════════════════════════════════════════
// CLEAN TEXT WORD COUNTING
// ═══════════════════════════════════════════════════════════════

/**
 * Count words from HTML by stripping tags, decoding entities, and counting visible text only.
 * Does NOT count alt text, attribute values, or invisible markup.
 */
export function countWordsFromHtml(html: string): number {
  if (!html || typeof html !== 'string') return 0;

  // Strip all HTML tags (including their attributes — no alt text leaks)
  let text = html.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&#\d+;/gi, ' '); // numeric entities → space

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  if (!text) return 0;

  // Split on whitespace and count non-empty tokens
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// ═══════════════════════════════════════════════════════════════
// DYNAMIC TOKEN BUDGET
// ═══════════════════════════════════════════════════════════════

/**
 * Compute an appropriate maxTokens value based on target word count and model.
 * Each model has different output token ceilings — this prevents silent truncation.
 */
export function computeMaxTokens(targetWordCount: number, modelId: string): number {
  const target = Math.max(targetWordCount, 300);

  // Model-specific hard ceilings (real output limits)
  switch (modelId) {
    case 'nova-pro':
      // Nova Pro hard output limit is 5120 tokens
      return Math.min(target * 2, 5120);

    case 'nova-premier':
      // Nova Premier hard output limit is ~10000 tokens
      return Math.min(target * 2, 10000);

    case 'claude-sonnet':
    case 'claude':
      // Claude can do more but gets slow — cap at 8192 to avoid platform timeouts
      return Math.min(Math.ceil(target * 2.5), 8192);

    case 'groq':
      // Groq (Llama) has reasonable limits
      return Math.min(Math.ceil(target * 2.5), 8192);

    case 'mistral':
      // Mistral via Bedrock
      return Math.min(Math.ceil(target * 2), 16384);

    case 'gemini':
    case 'gemini-flash':
    case 'gemini-pro':
    case 'vertex-flash':
    case 'vertex-pro':
      // Gemini models: use tighter budget (2x instead of 2.5x) to prevent over-generation
      return Math.min(target * 2, 16384);

    case 'lovable-gemini':
    case 'gpt5':
    case 'gpt5-mini':
    case 'openai':
      return Math.min(Math.ceil(target * 2), 16384);

    default:
      return Math.min(Math.ceil(target * 2), 8192);
  }
}

// ═══════════════════════════════════════════════════════════════
// STANDARDIZED WORD COUNT PROMPT INSTRUCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Build a standardized STRICT word count instruction block for AI prompts.
 * For Nova models, adds extra reinforcement since they tend to under-generate.
 */
export function buildWordCountInstruction(target: number, modelId?: string): string {
  const min85 = Math.round(target * 0.85);
  const max115 = Math.round(target * 1.15);

  let instruction = `STRICT Word count target: ${target} words. Do NOT exceed ${max115} words. Do NOT write fewer than ${min85} words. Currently your output must be approximately ${target} words long.`;

  // Nova-specific reinforcement — these models tend to stop early
  if (modelId === 'nova-pro' || modelId === 'nova-premier') {
    instruction += `\nYou have a strict budget. Your response MUST be approximately ${target} words. Do NOT stop writing early. Keep generating content until you reach ${min85} words at minimum.`;
  }

  // Gemini-specific — tends to over-generate
  if (modelId === 'gemini' || modelId === 'gemini-flash' || modelId === 'gemini-pro' ||
      modelId === 'vertex-flash' || modelId === 'vertex-pro' || modelId === 'lovable-gemini') {
    instruction += `\nDo NOT over-generate. Stop writing at approximately ${target} words. If you have written ${max115} words, STOP immediately.`;
  }

  return instruction;
}

// ═══════════════════════════════════════════════════════════════
// 3-STATE WORD COUNT VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validate word count against target with 3-state result:
 * - pass: 85% to 115% of target
 * - warn: 75% to 125% of target (but outside pass range)
 * - fail: outside 75% to 125% of target
 */
export function validateWordCount(html: string, target: number, maxTokensRequested?: number): WordCountValidation {
  const actual = countWordsFromHtml(html);
  const minPass = Math.round(target * 0.85);
  const maxPass = Math.round(target * 1.15);
  const minWarn = Math.round(target * 0.75);
  const maxWarn = Math.round(target * 1.25);

  const deviation = target > 0 ? ((actual - target) / target) * 100 : 0;

  let status: WordCountStatus;
  if (actual >= minPass && actual <= maxPass) {
    status = 'pass';
  } else if (actual >= minWarn && actual <= maxWarn) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  return {
    targetWordCount: target,
    actualWordCount: actual,
    maxTokensRequested: maxTokensRequested || 0,
    minPass,
    maxPass,
    minWarn,
    maxWarn,
    status,
    deviation: Math.round(deviation * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// CORRECTION PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * Build a correction prompt for a single retry when word count is in 'fail' state.
 * Returns the prompt string. Caller decides whether to invoke.
 */
export function buildCorrectionPrompt(
  originalHtml: string,
  target: number,
  actual: number,
  direction: 'expand' | 'trim',
): string {
  if (direction === 'expand') {
    return `You are a professional content editor. The following article is too short.

Current word count: ${actual} words.
Required word count: ${target} words (minimum ${Math.round(target * 0.85)} words).

EXPAND the article to exactly ${target} words by:
- Adding depth and detail to existing sections
- Adding practical examples, tips, or context
- Expanding thin paragraphs
- Adding relevant subsections under existing H2 headings

Do NOT change the topic, structure, or remove existing content.
Do NOT add filler, repetition, or fabricated statistics.
Output ONLY the full expanded article as valid HTML.
No JSON wrappers, no markdown, no code blocks, no explanations.

Article to expand:
${originalHtml}`;
  } else {
    return `You are a professional content editor. The following article is too long.

Current word count: ${actual} words.
Required word count: ${target} words (maximum ${Math.round(target * 1.15)} words).

TRIM the article to exactly ${target} words by:
- Removing redundancy and repetition
- Tightening verbose paragraphs
- Removing the least essential subsections
- Making sentences more concise

Do NOT change the topic, structure, or core information.
Output ONLY the full trimmed article as valid HTML.
No JSON wrappers, no markdown, no code blocks, no explanations.

Article to trim:
${originalHtml}`;
  }
}
