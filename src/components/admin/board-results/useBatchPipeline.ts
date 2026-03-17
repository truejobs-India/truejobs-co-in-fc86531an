/**
 * useBatchPipeline.ts — Shared hook for the Board Result Batch Pipeline.
 *
 * IMPORTANT DESIGN NOTES:
 * - Duplicate matching uses `board_name` (structured field), NOT display_title, meta_title, or custom_pages.title.
 * - Backend publish RPC handles counter resync atomically. Frontend resync is non-essential redundancy.
 * - Content stored in board_result_batch_rows.content is trusted internal HTML (admin/AI generated only).
 * - updated_at is manually set on every mutation (no DB trigger active).
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ImportBatch {
  id: string;
  batch_number: number;
  source_file_name: string;
  total_rows: number;
  published_count: number;
  enriched_count: number;
  failed_count: number;
  skipped_count: number;
  duplicate_count: number;
  completed_count: number;
  status: string;
  source_file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchRow {
  id: string;
  batch_id: string;
  row_index: number;
  state_ut: string;
  board_name: string;
  result_url: string;
  official_board_url: string;
  slug: string;
  variant: string;
  board_abbr: string;
  is_valid: boolean;
  validation_errors: string[];
  workflow_status: string;
  duplicate_status: string;
  validation_status: string;
  duplicate_count: number;
  top_duplicate_reason: string | null;
  display_title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  content: string;
  word_count: number;
  faq_schema: any;
  tags: string[];
  quality_score: number | null;
  published_page_id: string | null;
  published_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
  source_payload: any;
  enriched_content: any;
  seo_fixes: any;
  seo_intro_text: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateMatch {
  id: string;
  batch_row_id: string;
  duplicate_type: string;
  matched_custom_page_id: string | null;
  matched_batch_row_id: string | null;
  matched_url: string | null;
  matched_title: string | null;
  matched_slug: string | null;
  confidence: number;
  reason: string;
  recommended_action: string;
  created_at: string;
}

export type WorkflowFilter = 'all' | 'draft' | 'enriched' | 'seo_fixed' | 'ready_to_publish' | 'published' | 'duplicates' | 'invalid' | 'skipped' | 'failed' | 'review_needed' | 'deleted';

// ═══════════════════════════════════════════════════════════════
// Board name normalization for duplicate matching
// Uses board_name — not display_title, meta_title, or custom_pages.title
// ═══════════════════════════════════════════════════════════════

export function normalizeBoardName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ═══════════════════════════════════════════════════════════════
// Display title derivation
// ═══════════════════════════════════════════════════════════════

export function deriveDisplayTitle(boardName: string, stateUt: string): string {
  const year = new Date().getFullYear();
  return `${boardName} Result ${year} - ${stateUt}`;
}

// ═══════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════

export function useBatchPipeline() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [filter, setFilter] = useState<WorkflowFilter>('all');

  // ─── Fetch batches ────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .order('batch_number', { ascending: false });
    if (error) { toast({ title: 'Error loading batches', description: error.message, variant: 'destructive' }); }
    else setBatches((data as any[]) || []);
    setLoading(false);
  }, [toast]);

  // ─── Fetch rows for selected batch ─────────────────────────
  const fetchRows = useCallback(async (batchId: string, showDeleted = false) => {
    setRowsLoading(true);
    let query = supabase
      .from('board_result_batch_rows')
      .select('*')
      .eq('batch_id', batchId)
      .order('row_index', { ascending: true });

    if (!showDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;
    if (error) { toast({ title: 'Error loading rows', description: error.message, variant: 'destructive' }); }
    else setRows((data as any[]) || []);
    setRowsLoading(false);
  }, [toast]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => { if (selectedBatchId) fetchRows(selectedBatchId); }, [selectedBatchId, fetchRows]);

  // ─── Helper: resync counters (non-essential redundancy for non-publish mutations) ──
  const afterRowStateChange = useCallback(async (batchId: string) => {
    try {
      await supabase.rpc('resync_batch_counters', { p_batch_id: batchId });
    } catch { /* non-critical */ }
    await fetchBatches();
    await fetchRows(batchId);
  }, [fetchBatches, fetchRows]);

  // ─── Create batch from parsed rows ─────────────────────────
  const createBatch = useCallback(async (
    fileName: string,
    parsedRows: Array<{
      state_ut: string; board_name: string; result_url: string;
      official_board_url: string; slug: string; variant: string;
      board_abbr: string; is_valid: boolean; validation_errors: string[];
      source_payload: any; seo_intro_text?: string;
    }>,
    filePath?: string | null
  ) => {
    // Create import_batch (batch_number auto from sequence)
    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .insert({
        source_file_name: fileName,
        total_rows: parsedRows.length,
        status: 'completed',
        source_file_path: filePath || null,
        started_by: (await supabase.auth.getUser()).data.user?.id || '',
      })
      .select()
      .single();

    if (batchErr || !batch) {
      toast({ title: 'Failed to create batch', description: batchErr?.message, variant: 'destructive' });
      return null;
    }

    // Insert all parsed rows
    const rowInserts = parsedRows.map((r, i) => ({
      batch_id: batch.id,
      row_index: i,
      state_ut: r.state_ut,
      board_name: r.board_name,
      result_url: r.result_url || '',
      official_board_url: r.official_board_url || '',
      slug: r.slug,
      variant: r.variant,
      board_abbr: r.board_abbr,
      is_valid: r.is_valid,
      validation_errors: r.validation_errors,
      source_payload: r.source_payload,
      seo_intro_text: r.seo_intro_text || '',
      workflow_status: r.is_valid ? 'draft' : 'failed',
      validation_status: r.is_valid ? 'valid' : 'invalid',
      duplicate_status: 'unchecked',
      content: '',
      word_count: 0,
    }));

    const { error: rowErr } = await supabase
      .from('board_result_batch_rows')
      .insert(rowInserts as any);

    if (rowErr) {
      toast({ title: 'Failed to save rows', description: rowErr.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Batch saved', description: `${parsedRows.length} rows saved to database` });
    await fetchBatches();
    setSelectedBatchId(batch.id);
    return batch.id;
  }, [toast, fetchBatches]);

  // ─── Update row fields (explicit updated_at) ──────────────
  const updateRow = useCallback(async (rowId: string, updates: Partial<BatchRow>) => {
    const { error } = await supabase
      .from('board_result_batch_rows')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', rowId);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return false; }
    return true;
  }, [toast]);

  // ─── Enrich row ────────────────────────────────────────────
  const enrichRow = useCallback(async (row: BatchRow, aiModel: string) => {
    const action = row.content && row.content.length > 100 ? 'enrich' : 'generate-result';
    const { data, error } = await supabase.functions.invoke('generate-custom-page', {
      body: {
        action,
        slug: row.slug,
        title: row.display_title || row.board_name,
        pageType: 'result-landing',
        state_ut: row.state_ut,
        board_name: row.board_name,
        board_abbr: row.board_abbr,
        result_url: row.result_url,
        official_board_url: row.official_board_url,
        variant: row.variant,
        seo_intro: row.seo_intro_text || '',
        content: row.content || undefined,
        aiModel,
      },
    });

    const result = data?.data || data;
    if (error || !result?.content) {
      await updateRow(row.id, { workflow_status: 'failed', error_message: error?.message || data?.error || 'No content returned' } as any);
      if (selectedBatchId) await afterRowStateChange(selectedBatchId);
      return false;
    }

    const wordCount = (result.content as string).split(/\s+/).filter(Boolean).length;
    const displayTitle = deriveDisplayTitle(row.board_name, row.state_ut);

    await updateRow(row.id, {
      content: result.content,
      meta_title: result.meta_title || result.metaTitle || displayTitle,
      meta_description: result.meta_description || result.metaDescription || '',
      excerpt: result.excerpt || '',
      faq_schema: result.faq_items || result.faqSchema || [],
      tags: result.suggested_tags || result.tags || [],
      word_count: wordCount,
      display_title: result.title || displayTitle,
      workflow_status: 'enriched',
      enriched_content: result,
      error_message: null,
    } as any);

    if (selectedBatchId) await afterRowStateChange(selectedBatchId);
    return true;
  }, [updateRow, afterRowStateChange, selectedBatchId]);

  // ─── Fix SEO ───────────────────────────────────────────────
  const fixSeoRow = useCallback(async (row: BatchRow, aiModel: string) => {
    const { data, error } = await supabase.functions.invoke('generate-custom-page', {
      body: {
        action: 'fix',
        title: row.display_title || row.board_name,
        slug: row.slug,
        content: row.content,
        meta_title: row.meta_title,
        meta_description: row.meta_description,
        excerpt: row.excerpt,
        category: 'Board Results',
        tags: row.tags,
        aiModel,
      },
    });

    if (error || !data) {
      toast({ title: 'SEO fix failed', description: error?.message, variant: 'destructive' });
      return false;
    }

    const updates: any = { seo_fixes: data, workflow_status: 'seo_fixed', updated_at: new Date().toISOString() };
    if (data.content) { updates.content = data.content; updates.word_count = (data.content as string).split(/\s+/).filter(Boolean).length; }
    if (data.metaTitle) updates.meta_title = data.metaTitle;
    if (data.metaDescription) updates.meta_description = data.metaDescription;
    if (data.faqSchema) updates.faq_schema = data.faqSchema;

    await updateRow(row.id, updates);
    if (selectedBatchId) await afterRowStateChange(selectedBatchId);
    return true;
  }, [updateRow, toast, afterRowStateChange, selectedBatchId]);

  // ─── Publish row (backend-authoritative, transactional) ────
  const publishRow = useCallback(async (rowId: string) => {
    const { data, error } = await supabase.rpc('publish_board_result_row', { p_batch_row_id: rowId });
    if (error) { toast({ title: 'Publish failed', description: error.message, variant: 'destructive' }); return false; }
    const result = data as any;
    if (!result?.success) { toast({ title: 'Publish blocked', description: result?.error || 'Unknown error', variant: 'destructive' }); return false; }
    toast({ title: 'Published successfully' });
    // Backend publish RPC handles counter resync atomically. Just refetch.
    await fetchBatches();
    if (selectedBatchId) await fetchRows(selectedBatchId);
    return true;
  }, [toast, fetchBatches, fetchRows, selectedBatchId]);

  // ─── Soft delete ───────────────────────────────────────────
  const softDeleteRow = useCallback(async (rowId: string, reason: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const ok = await updateRow(rowId, {
      deleted_at: new Date().toISOString(),
      deleted_by: userId || null,
      delete_reason: reason,
      workflow_status: 'deleted',
    } as any);
    if (ok && selectedBatchId) await afterRowStateChange(selectedBatchId);
    return ok;
  }, [updateRow, afterRowStateChange, selectedBatchId]);

  // ─── Skip row ──────────────────────────────────────────────
  const skipRow = useCallback(async (rowId: string) => {
    const ok = await updateRow(rowId, { workflow_status: 'skipped' } as any);
    if (ok && selectedBatchId) await afterRowStateChange(selectedBatchId);
    return ok;
  }, [updateRow, afterRowStateChange, selectedBatchId]);

  // ─── Duplicate detection ───────────────────────────────────
  // Matching uses board_name — not display_title, meta_title, or custom_pages.title
  const runDuplicateDetection = useCallback(async (batchId: string) => {
    const batchRows = rows.filter(r => r.batch_id === batchId && !r.deleted_at);
    if (batchRows.length === 0) return;

    // Step 1: Clear existing matches for this batch (rerun semantics)
    const rowIds = batchRows.map(r => r.id);
    for (const rowId of rowIds) {
      await supabase.from('duplicate_matches').delete().eq('batch_row_id', rowId);
    }

    // Step 2: Fetch existing custom_pages for comparison
    const { data: existingPages } = await supabase
      .from('custom_pages')
      .select('id, slug, title, board_name, state_ut, result_variant, result_url, official_board_url')
      .eq('page_type', 'result-landing');

    const pages = existingPages || [];
    const matchInserts: any[] = [];

    for (const row of batchRows) {
      const normalizedBN = normalizeBoardName(row.board_name);

      // Intra-batch: check other rows in same batch
      for (const other of batchRows) {
        if (other.id === row.id) continue;
        if (other.slug === row.slug) {
          matchInserts.push({ batch_row_id: row.id, duplicate_type: 'exact_slug_match', matched_batch_row_id: other.id, matched_slug: other.slug, confidence: 1.0, reason: `Intra-batch slug collision: ${other.slug}`, recommended_action: 'review' });
        }
      }

      // Against existing custom_pages
      for (const pg of pages) {
        // 1. Exact slug match (highest priority)
        if (pg.slug === row.slug) {
          matchInserts.push({ batch_row_id: row.id, duplicate_type: 'exact_slug_match', matched_custom_page_id: pg.id, matched_slug: pg.slug, matched_title: pg.board_name || pg.title, confidence: 1.0, reason: `Slug matches existing page: ${pg.slug}`, recommended_action: 'update_existing' });
          continue; // don't add lower-priority matches for same page
        }

        // 2. Exact result_url match
        if (row.result_url && pg.result_url && row.result_url === pg.result_url) {
          matchInserts.push({ batch_row_id: row.id, duplicate_type: 'exact_result_url_match', matched_custom_page_id: pg.id, matched_slug: pg.slug, matched_url: pg.result_url, matched_title: pg.board_name || pg.title, confidence: 1.0, reason: 'Result URL matches existing page', recommended_action: 'review' });
          continue;
        }

        // 3. Exact official_board_url match
        if (row.official_board_url && pg.official_board_url && row.official_board_url === pg.official_board_url) {
          matchInserts.push({ batch_row_id: row.id, duplicate_type: 'exact_official_url_match', matched_custom_page_id: pg.id, matched_slug: pg.slug, matched_url: pg.official_board_url, matched_title: pg.board_name || pg.title, confidence: 0.95, reason: 'Official board URL matches', recommended_action: 'review' });
          continue;
        }

        // 4. Exact structured field identity (state + board_name + variant)
        if (pg.state_ut === row.state_ut && pg.board_name === row.board_name && pg.result_variant === row.variant) {
          matchInserts.push({ batch_row_id: row.id, duplicate_type: 'exact_structured_field_identity', matched_custom_page_id: pg.id, matched_slug: pg.slug, matched_title: pg.board_name || pg.title, confidence: 0.95, reason: `Same state/board/variant: ${row.state_ut}/${row.board_name}/${row.variant}`, recommended_action: 'update_existing' });
          continue;
        }

        // 5. Exact board_name match (normalized)
        if (pg.board_name && normalizeBoardName(pg.board_name) === normalizedBN) {
          matchInserts.push({ batch_row_id: row.id, duplicate_type: 'exact_board_name_match', matched_custom_page_id: pg.id, matched_slug: pg.slug, matched_title: pg.board_name || pg.title, confidence: 0.9, reason: `Board name match: ${row.board_name}`, recommended_action: 'review' });
          continue;
        }

        // 6. Near board_name match (Jaccard > 0.8)
        if (pg.board_name) {
          const sim = jaccardSimilarity(normalizedBN, normalizeBoardName(pg.board_name));
          if (sim > 0.8) {
            matchInserts.push({ batch_row_id: row.id, duplicate_type: 'near_board_name_match', matched_custom_page_id: pg.id, matched_slug: pg.slug, matched_title: pg.board_name || pg.title, confidence: parseFloat(sim.toFixed(2)), reason: `Near board name match (${(sim * 100).toFixed(0)}% similarity)`, recommended_action: 'review' });
          }
        }
      }
    }

    // Step 3: Insert all matches
    if (matchInserts.length > 0) {
      // Batch insert in chunks of 50
      for (let i = 0; i < matchInserts.length; i += 50) {
        const chunk = matchInserts.slice(i, i + 50);
        await supabase.from('duplicate_matches').insert(chunk);
      }
    }

    // Step 4: Recompute row-level summaries
    for (const row of batchRows) {
      const { data: matches } = await supabase
        .from('duplicate_matches')
        .select('duplicate_type, confidence')
        .eq('batch_row_id', row.id);

      const count = matches?.length || 0;
      const topMatch = matches?.sort((a, b) => (b as any).confidence - (a as any).confidence)[0];
      const dupStatus = count === 0 ? 'clean' : 'possible_duplicate';

      await updateRow(row.id, {
        duplicate_count: count,
        duplicate_status: dupStatus,
        top_duplicate_reason: topMatch ? `${(topMatch as any).duplicate_type} (${(topMatch as any).confidence})` : null,
      } as any);
    }

    await afterRowStateChange(batchId);
    toast({ title: 'Duplicate detection complete', description: `Found ${matchInserts.length} potential matches` });
  }, [rows, updateRow, afterRowStateChange, toast]);

  // ─── Filter rows ───────────────────────────────────────────
  const filteredRows = rows.filter(r => {
    if (filter === 'all') return !r.deleted_at;
    if (filter === 'deleted') return !!r.deleted_at;
    if (filter === 'duplicates') return r.duplicate_status !== 'unchecked' && r.duplicate_status !== 'clean' && !r.deleted_at;
    if (filter === 'invalid') return r.validation_status === 'invalid' && !r.deleted_at;
    return r.workflow_status === filter && !r.deleted_at;
  });

  // ─── Filter counts ────────────────────────────────────────
  const filterCounts = {
    all: rows.filter(r => !r.deleted_at).length,
    draft: rows.filter(r => r.workflow_status === 'draft' && !r.deleted_at).length,
    enriched: rows.filter(r => r.workflow_status === 'enriched' && !r.deleted_at).length,
    seo_fixed: rows.filter(r => r.workflow_status === 'seo_fixed' && !r.deleted_at).length,
    ready_to_publish: rows.filter(r => r.workflow_status === 'ready_to_publish' && !r.deleted_at).length,
    published: rows.filter(r => r.workflow_status === 'published' && !r.deleted_at).length,
    duplicates: rows.filter(r => r.duplicate_status !== 'unchecked' && r.duplicate_status !== 'clean' && !r.deleted_at).length,
    invalid: rows.filter(r => r.validation_status === 'invalid' && !r.deleted_at).length,
    skipped: rows.filter(r => r.workflow_status === 'skipped' && !r.deleted_at).length,
    failed: rows.filter(r => r.workflow_status === 'failed' && !r.deleted_at).length,
    review_needed: rows.filter(r => r.workflow_status === 'review_needed' && !r.deleted_at).length,
    deleted: rows.filter(r => !!r.deleted_at).length,
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId) || null;

  return {
    batches, selectedBatch, selectedBatchId, setSelectedBatchId,
    rows, filteredRows, filter, setFilter, filterCounts,
    loading, rowsLoading,
    fetchBatches, fetchRows, createBatch, updateRow,
    enrichRow, fixSeoRow, publishRow, softDeleteRow, skipRow,
    runDuplicateDetection, afterRowStateChange,
  };
}
