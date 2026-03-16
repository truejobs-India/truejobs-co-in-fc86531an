/**
 * Board Result SEO Landing Page Utilities
 * Deterministic slug generation, variant mapping, internal link building.
 */

// ═══════════════════════════════════════════════════════════════
// Exception map for board abbreviations
// ═══════════════════════════════════════════════════════════════

const BOARD_ABBR_EXCEPTIONS: Record<string, string> = {
  'Government of India': 'nic',
  'National Institute of Open Schooling': 'nios',
};

// ═══════════════════════════════════════════════════════════════
// Variant mapping
// ═══════════════════════════════════════════════════════════════

const VARIANT_SUFFIXES: Record<string, string> = {
  'Class 10': 'class-10',
  'Class 12': 'class-12',
  'Class X': 'class-10',
  'Class XII': 'class-12',
  '10th': 'class-10',
  '12th': 'class-12',
  'Supplementary': 'supplementary',
  'Compartment': 'supplementary',
  'Revaluation': 'revaluation',
  'Re-evaluation': 'revaluation',
  'Rechecking': 'revaluation',
};

/**
 * Extract board abbreviation from board name.
 * Uses last parenthetical, splits on `/`, takes first segment, lowercases.
 */
export function extractBoardAbbr(boardName: string): string {
  // Check exception map first
  for (const [key, abbr] of Object.entries(BOARD_ABBR_EXCEPTIONS)) {
    if (boardName.includes(key)) return abbr;
  }

  // Extract last parenthetical
  const matches = boardName.match(/\(([^)]+)\)/g);
  if (matches && matches.length > 0) {
    const last = matches[matches.length - 1];
    const inner = last.replace(/[()]/g, '').trim();
    // Split on `/` and take first segment
    const abbr = inner.split('/')[0].trim().toLowerCase();
    return abbr.replace(/[^a-z0-9]/g, '');
  }

  // Fallback: first 4 letters of board name
  return boardName.replace(/[^a-zA-Z]/g, '').substring(0, 6).toLowerCase();
}

/**
 * Map board name to result variant based on suffix after last ` - `.
 */
export function mapVariant(boardName: string): string {
  const dashIdx = boardName.lastIndexOf(' - ');
  if (dashIdx === -1) return 'main';

  const suffix = boardName.substring(dashIdx + 3).trim();

  for (const [pattern, variant] of Object.entries(VARIANT_SUFFIXES)) {
    if (suffix.toLowerCase().includes(pattern.toLowerCase())) {
      return variant;
    }
  }

  return 'main';
}

/**
 * Generate deterministic slug from state, board name.
 * Format: {state}-{abbr}-{variant}-result
 */
export function generateSlug(stateUt: string, boardName: string): string {
  const state = stateUt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const abbr = extractBoardAbbr(boardName);
  const variant = mapVariant(boardName);
  const parts = [state, abbr];
  if (variant !== 'main') parts.push(variant);
  parts.push('result');
  return parts.join('-');
}

/**
 * Get the variant for a board name.
 */
export function getVariant(boardName: string): string {
  return mapVariant(boardName);
}

/**
 * Build internal link map for a set of rows.
 * Groups by state and variant to create cross-links.
 */
export interface BoardResultRow {
  state_ut: string;
  board_name: string;
  result_url: string;
  official_board_url: string;
  seo_intro_text?: string;
  slug?: string;
  variant?: string;
}

export interface InternalLink {
  slug: string;
  title: string;
  type: 'same-state' | 'same-variant' | 'related';
}

export function buildInternalLinkMap(rows: BoardResultRow[]): Map<string, InternalLink[]> {
  const linkMap = new Map<string, InternalLink[]>();

  const enrichedRows = rows.map(r => ({
    ...r,
    slug: r.slug || generateSlug(r.state_ut, r.board_name),
    variant: r.variant || mapVariant(r.board_name),
  }));

  for (const row of enrichedRows) {
    const links: InternalLink[] = [];

    // Same state, different variant/board
    const sameState = enrichedRows.filter(r =>
      r.state_ut === row.state_ut && r.slug !== row.slug
    ).slice(0, 4);
    for (const r of sameState) {
      links.push({ slug: r.slug!, title: r.board_name, type: 'same-state' });
    }

    // Same variant, different state
    const sameVariant = enrichedRows.filter(r =>
      r.variant === row.variant && r.state_ut !== row.state_ut
    ).slice(0, 4);
    for (const r of sameVariant) {
      links.push({ slug: r.slug!, title: `${r.state_ut} - ${r.board_name}`, type: 'same-variant' });
    }

    linkMap.set(row.slug!, links.slice(0, 12));
  }

  return linkMap;
}

/**
 * Get target word count based on variant.
 */
export function getTargetWordCount(variant: string): number {
  switch (variant) {
    case 'main': return 1800;
    case 'class-10': return 1500;
    case 'class-12': return 1500;
    case 'supplementary': return 1200;
    case 'revaluation': return 1000;
    default: return 1500;
  }
}

/**
 * Auto-select representative sample rows for preview generation.
 * Rules: first national+main, first state+main, first class-specific, first supplementary, first revaluation.
 */
export function autoSelectSamples(rows: BoardResultRow[]): number[] {
  const indices: number[] = [];
  const enriched = rows.map((r, i) => ({ ...r, idx: i, variant: mapVariant(r.board_name) }));

  // First national-level main
  const nationalMain = enriched.find(r => r.state_ut.toLowerCase().includes('india') && r.variant === 'main');
  if (nationalMain) indices.push(nationalMain.idx);

  // First state-level main (not national)
  const stateMain = enriched.find(r => !r.state_ut.toLowerCase().includes('india') && r.variant === 'main' && !indices.includes(r.idx));
  if (stateMain) indices.push(stateMain.idx);

  // First class-10
  const class10 = enriched.find(r => r.variant === 'class-10' && !indices.includes(r.idx));
  if (class10) indices.push(class10.idx);

  // First class-12
  const class12 = enriched.find(r => r.variant === 'class-12' && !indices.includes(r.idx));
  if (class12) indices.push(class12.idx);

  // First supplementary
  const supp = enriched.find(r => r.variant === 'supplementary' && !indices.includes(r.idx));
  if (supp) indices.push(supp.idx);

  // First revaluation
  const reval = enriched.find(r => r.variant === 'revaluation' && !indices.includes(r.idx));
  if (reval) indices.push(reval.idx);

  // Fill up to 5 if we don't have enough
  if (indices.length < 5) {
    for (let i = 0; i < enriched.length && indices.length < 5; i++) {
      if (!indices.includes(i)) indices.push(i);
    }
  }

  return indices.slice(0, 5);
}

/**
 * Parse a POSSIBLE_CONFLICT qa_note into structured data.
 */
export interface ConflictInfo {
  existing_page_id: string;
  existing_slug: string;
  existing_batch: string;
  existing_title: string;
  match_type: string;
  new_slug: string;
}

export function parseConflictNote(note: string): ConflictInfo | null {
  if (!note.startsWith('POSSIBLE_CONFLICT|')) return null;
  const parts = note.substring('POSSIBLE_CONFLICT|'.length).split('|');
  const data: Record<string, string> = {};
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0) {
      data[part.substring(0, colonIdx)] = part.substring(colonIdx + 1);
    }
  }
  if (!data.existing_page_id || !data.existing_slug || !data.new_slug) return null;
  return {
    existing_page_id: data.existing_page_id,
    existing_slug: data.existing_slug,
    existing_batch: data.existing_batch || '',
    existing_title: data.existing_title || '',
    match_type: data.match_type || '',
    new_slug: data.new_slug,
  };
}

/**
 * Build a POSSIBLE_CONFLICT note string with stable keys.
 */
export function buildConflictNote(info: ConflictInfo): string {
  return [
    'POSSIBLE_CONFLICT',
    `existing_page_id:${info.existing_page_id}`,
    `existing_slug:${info.existing_slug}`,
    `existing_batch:${info.existing_batch}`,
    `existing_title:${info.existing_title}`,
    `match_type:${info.match_type}`,
    `new_slug:${info.new_slug}`,
  ].join('|');
}

/**
 * Build a CONFLICT_RESOLVED note string.
 */
export function buildConflictResolvedNote(action: 'updated' | 'skipped', existingSlug: string): string {
  return `CONFLICT_RESOLVED|action:${action}|existing_slug:${existingSlug}|resolved_at:${new Date().toISOString()}`;
}
