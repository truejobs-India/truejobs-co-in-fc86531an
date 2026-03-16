/**
 * BoardResultGenerator — Admin UI for XLSX-driven board result page generation.
 * Handles: upload, validation, conflict detection, batch generation, QA, publish, hub pages.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { HubPageGenerator } from '@/components/admin/HubPageGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { getModelSpeed } from '@/lib/aiModels';
import { scoreCustomPage, type QualityBreakdown } from '@/lib/pageQualityScorer';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  generateSlug, extractBoardAbbr, mapVariant, getTargetWordCount,
  autoSelectSamples, buildInternalLinkMap, buildConflictNote,
  buildConflictResolvedNote, parseConflictNote, type BoardResultRow,
  type ConflictInfo,
} from '@/lib/boardResultUtils';
import * as XLSX from 'xlsx';
import {
  Upload, Loader2, CheckCircle, XCircle, AlertTriangle, Eye,
  FileSpreadsheet, Zap, RotateCcw, Globe, ChevronDown, ChevronUp,
  ExternalLink, Square,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ParsedRow extends BoardResultRow {
  slug: string;
  variant: string;
  board_abbr: string;
  valid: boolean;
  errors: string[];
  rowIndex: number;
}

interface BatchRow extends ParsedRow {
  status: 'queued' | 'generating' | 'success' | 'failed' | 'skipped';
  error?: string;
  pageId?: string;
  quality?: QualityBreakdown;
  qa_notes: string[];
  conflictInfo?: ConflictInfo;
}

type Phase = 'upload' | 'preview' | 'generating' | 'qa';

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export function BoardResultGenerator() {
  const { toast } = useToast();
  const { user } = useAuth();

  const STORAGE_KEY = 'board-result-generator-state';

  // Restore persisted state on mount
  const restored = useRef(false);
  const getInitialState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  };
  const initial = useRef(getInitialState());

  const [phase, setPhase] = useState<Phase>(initial.current?.phase === 'preview' ? 'preview' : 'upload');
  const [aiModel, setAiModel] = useState(initial.current?.aiModel || 'gemini-flash');
  const [imageModel, setImageModel] = useState(initial.current?.imageModel || 'gemini-flash-image');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>(initial.current?.parsedRows || []);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const abortRef = useRef(false);
  const [fileName, setFileName] = useState(initial.current?.fileName || '');
  const [conflictDialog, setConflictDialog] = useState<{ index: number; info: ConflictInfo } | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'conflicts' | 'failed' | 'low-quality'>('all');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [targetWordCount, setTargetWordCount] = useState<number | null>(initial.current?.targetWordCount || null);
  const [imageGenLoading, setImageGenLoading] = useState<Set<number>>(new Set());
  const [storedFileUrl, setStoredFileUrl] = useState<string | null>(initial.current?.storedFileUrl || null);
  const [storedFilePath, setStoredFilePath] = useState<string | null>(initial.current?.storedFilePath || null);

  // Persist parsed rows, fileName, phase, word count, image model, and file URL to localStorage
  useEffect(() => {
    if (parsedRows.length > 0 && (phase === 'preview' || phase === 'generating' || phase === 'qa')) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          parsedRows,
          fileName,
          phase: phase === 'generating' ? 'preview' : phase === 'qa' ? 'preview' : phase,
          aiModel,
          imageModel,
          targetWordCount,
          storedFileUrl,
          storedFilePath,
        }));
      } catch { /* quota exceeded, ignore */ }
    }
  }, [parsedRows, fileName, phase, aiModel, imageModel, targetWordCount, storedFileUrl, storedFilePath]);

  // ── Generate image for a page ──
  const generateImageForPage = useCallback(async (index: number) => {
    const row = batchRows[index];
    if (!row.pageId) return;

    setImageGenLoading(prev => new Set(prev).add(index));
    try {
      const { data, error } = await supabase.functions.invoke('generate-board-result-image', {
        body: {
          imageModel,
          pageType: 'result-landing',
          slug: row.slug,
          state_ut: row.state_ut,
          board_name: row.board_name,
          variant: row.variant,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Image generation failed');

      // Update the page with the cover image
      await supabase.from('custom_pages').update({
        cover_image_url: data.imageUrl,
        featured_image_alt: `${row.board_name} result - ${row.state_ut}`,
      } as any).eq('id', row.pageId);

      toast({ title: `Image generated`, description: `Model: ${data.model}, ${data.elapsedMs}ms` });
    } catch (e: any) {
      toast({ title: 'Image generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setImageGenLoading(prev => { const n = new Set(prev); n.delete(index); return n; });
    }
  }, [batchRows, imageModel, toast]);

  // ── File Upload & Parse ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    // Upload file to storage for persistence
    const uploadToStorage = async (f: File) => {
      try {
        const filePath = `board-result-files/${Date.now()}-${f.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('blog-assets')
          .upload(filePath, f, { contentType: f.type, upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('blog-assets').getPublicUrl(filePath);
          setStoredFileUrl(urlData.publicUrl);
          setStoredFilePath(filePath);
        }
      } catch { /* ignore storage errors */ }
    };

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        const rows: ParsedRow[] = json.map((row, i) => {
          const errors: string[] = [];
          const state_ut = (row['state_ut'] || row['State/UT'] || row['state'] || '').trim();
          const board_name = (row['board_name'] || row['Board Name'] || row['board'] || '').trim();
          const result_url = (row['result_url'] || row['Result URL'] || '').trim();
          const official_board_url = (row['official_board_url'] || row['Official Board URL'] || '').trim();
          const seo_intro_text = (row['seo_intro_text'] || row['SEO Intro'] || '').trim();

          if (!state_ut) errors.push('Missing state_ut');
          if (!board_name) errors.push('Missing board_name');
          if (!result_url) errors.push('Missing result_url');
          else if (!/^https?:\/\//.test(result_url)) errors.push('Invalid result_url (must start with http)');
          if (!official_board_url) errors.push('Missing official_board_url');
          else if (!/^https?:\/\//.test(official_board_url)) errors.push('Invalid official_board_url');

          const variant = mapVariant(board_name);
          const board_abbr = extractBoardAbbr(board_name);
          const slug = state_ut && board_name ? generateSlug(state_ut, board_name) : '';

          return {
            state_ut, board_name, result_url, official_board_url, seo_intro_text,
            slug, variant, board_abbr,
            valid: errors.length === 0,
            errors,
            rowIndex: i,
          };
        });

        // Check intra-file duplicate slugs
        const slugCounts = new Map<string, number[]>();
        rows.forEach((r, i) => {
          if (r.slug) {
            const existing = slugCounts.get(r.slug) || [];
            existing.push(i);
            slugCounts.set(r.slug, existing);
          }
        });
        slugCounts.forEach((indices, slug) => {
          if (indices.length > 1) {
            indices.forEach(i => {
              rows[i].errors.push(`Duplicate slug "${slug}" in rows ${indices.map(x => x + 1).join(', ')}`);
              rows[i].valid = false;
            });
          }
        });

        setParsedRows(rows);
        setPhase('preview');
        toast({ title: `Parsed ${rows.length} rows from ${file.name}` });

        // Upload to storage in background
        uploadToStorage(file);
      } catch (err: any) {
        toast({ title: 'Parse error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  // ── Cross-batch conflict detection ──
  const checkConflicts = useCallback(async (rows: ParsedRow[]): Promise<BatchRow[]> => {
    // Query existing pages with matching page_type
    const slugs = rows.filter(r => r.valid).map(r => r.slug);
    const { data: existingPages } = await supabase
      .from('custom_pages')
      .select('id, slug, title, state_ut, board_name, result_variant, import_batch_id')
      .in('slug', slugs);

    const existingBySlug = new Map<string, any>();
    (existingPages || []).forEach(p => existingBySlug.set(p.slug, p));

    // Also check by state_ut + board_name + result_variant
    const { data: matchByFields } = await supabase
      .from('custom_pages')
      .select('id, slug, title, state_ut, board_name, result_variant, import_batch_id')
      .not('state_ut', 'is', null)
      .not('result_variant', 'is', null);

    const fieldMatchMap = new Map<string, any>();
    (matchByFields || []).forEach(p => {
      const key = `${p.state_ut}|${p.board_name}|${p.result_variant}`;
      fieldMatchMap.set(key, p);
    });

    return rows.map(r => {
      const qa_notes: string[] = [];
      let conflictInfo: ConflictInfo | undefined;

      if (r.valid) {
        // Check slug collision
        const existing = existingBySlug.get(r.slug);
        if (existing) {
          conflictInfo = {
            existing_page_id: existing.id,
            existing_slug: existing.slug,
            existing_batch: existing.import_batch_id || '',
            existing_title: existing.title,
            match_type: 'slug',
            new_slug: r.slug,
          };
          qa_notes.push(buildConflictNote(conflictInfo));
        } else {
          // Check field match
          const fieldKey = `${r.state_ut}|${r.board_name}|${r.variant}`;
          const fieldMatch = fieldMatchMap.get(fieldKey);
          if (fieldMatch) {
            conflictInfo = {
              existing_page_id: fieldMatch.id,
              existing_slug: fieldMatch.slug,
              existing_batch: fieldMatch.import_batch_id || '',
              existing_title: fieldMatch.title,
              match_type: 'state_ut+board_name+result_variant',
              new_slug: r.slug,
            };
            qa_notes.push(buildConflictNote(conflictInfo));
          }
        }
      }

      return {
        ...r,
        status: r.valid ? 'queued' as const : 'skipped' as const,
        qa_notes,
        conflictInfo,
      };
    });
  }, []);

  // ── Core generation logic for a set of row indices ──
  const generateRows = useCallback(async (rowIndices: number[], rows: BatchRow[], currentBatchId: string) => {
    const validRows = rows.filter(r => r.valid);
    const linkMap = buildInternalLinkMap(validRows);
    let completedCount = rows.filter(r => r.status === 'success').length;
    let failedCount = rows.filter(r => r.status === 'failed').length;

    for (const i of rowIndices) {
      if (abortRef.current) break;

      setBatchRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));

      try {
        const row = rows[i];
        const siblingLinks = linkMap.get(row.slug) || [];
        const sibSlugs = siblingLinks.map(l => l.slug);

        const { data, error } = await supabase.functions.invoke('generate-custom-page', {
          body: {
            action: 'generate-result',
            state_ut: row.state_ut,
            board_name: row.board_name,
            board_abbr: row.board_abbr,
            result_url: row.result_url,
            official_board_url: row.official_board_url,
            seo_intro: row.seo_intro_text || '',
            variant: row.variant,
            target_word_count: targetWordCount || getTargetWordCount(row.variant),
            sibling_slugs: sibSlugs,
            aiModel,
          },
        });

        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Generation failed');

        const d = data.data;
        const pagePayload = {
          title: d.title || row.board_name,
          slug: row.slug,
          content: d.content || '',
          excerpt: d.excerpt || null,
          meta_title: d.meta_title || null,
          meta_description: d.meta_description || null,
          category: 'Board Results',
          tags: d.suggested_tags || [],
          faq_schema: d.faq_items || [],
          word_count: d.word_count || 0,
          reading_time: Math.ceil((d.word_count || 300) / 200),
          page_type: 'result-landing',
          status: 'draft',
          ai_model_used: aiModel,
          ai_generated_at: new Date().toISOString(),
          author_id: user!.id,
          state_ut: row.state_ut,
          board_name: row.board_name,
          result_url: row.result_url,
          official_board_url: row.official_board_url,
          result_variant: row.variant,
          import_batch_id: currentBatchId,
          source_row_index: row.rowIndex,
          generation_metadata: {
            current: { model: aiModel, generated_at: new Date().toISOString(), sections_present: d.sections_present || [] },
            history: [],
          },
          qa_notes: row.qa_notes,
          internal_links: siblingLinks,
          source_payload: {
            state_ut: row.state_ut, board_name: row.board_name,
            result_url: row.result_url, official_board_url: row.official_board_url,
            seo_intro_text: row.seo_intro_text,
          },
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('custom_pages')
          .upsert(pagePayload as any, { onConflict: 'slug' })
          .select('id')
          .single();

        if (insertErr) throw new Error(insertErr.message);

        const quality = scoreCustomPage({
          content: d.content || '', meta_title: d.meta_title,
          meta_description: d.meta_description, excerpt: d.excerpt,
          faq_schema: d.faq_items, tags: d.suggested_tags,
        });

        const qaIssues: string[] = [...row.qa_notes];
        const targetWc = getTargetWordCount(row.variant);
        if ((d.word_count || 0) < targetWc * 0.7) qaIssues.push(`Word count ${d.word_count} below target ${targetWc}`);
        if ((d.faq_items || []).length < 8) qaIssues.push(`Only ${(d.faq_items || []).length} FAQs (need ≥8)`);
        if (!d.has_disclaimer) qaIssues.push('Missing disclaimer section');
        if (!d.has_cta) qaIssues.push('Missing CTA section');
        if ((d.meta_title || '').length > 60) qaIssues.push('Meta title > 60 chars');
        if ((d.meta_description || '').length > 160) qaIssues.push('Meta description > 160 chars');
        if ((d.section_count || 0) < 10) qaIssues.push(`Only ${d.section_count} sections (need ≥10)`);

        completedCount++;
        setBatchRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'success', pageId: inserted?.id, quality, qa_notes: qaIssues } : r
        ));
      } catch (e: any) {
        failedCount++;
        setBatchRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'failed', error: e.message } : r
        ));
      }

      await supabase.from('import_batches').update({
        completed_count: completedCount,
        failed_count: failedCount,
      } as any).eq('id', currentBatchId);
    }

    return { completedCount, failedCount };
  }, [aiModel, user, targetWordCount]);

  // ── Start batch generation ──
  const startGeneration = useCallback(async (onlySelected = false) => {
    if (!user) return;
    abortRef.current = false;
    setIsStopping(false);
    setIsRunning(true);

    // Create batch
    const rowsToUse = onlySelected
      ? parsedRows.filter((_, i) => selectedRows.has(i) && parsedRows[i].valid)
      : parsedRows.filter(r => r.valid);

    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .insert({
        source_file_name: fileName,
        total_rows: rowsToUse.length,
        started_by: user.id,
        status: 'in_progress',
      } as any)
      .select('id')
      .single();

    if (batchErr || !batch) {
      toast({ title: 'Failed to create batch', description: batchErr?.message, variant: 'destructive' });
      setIsRunning(false);
      return;
    }
    setBatchId(batch.id);

    // Check conflicts
    const bRows = await checkConflicts(parsedRows);
    setBatchRows(bRows);
    setPhase('generating');

    // Determine which indices to generate
    const indicesToGenerate = onlySelected
      ? Array.from(selectedRows).filter(i => bRows[i]?.valid && bRows[i]?.status !== 'skipped').sort((a, b) => a - b)
      : bRows.map((r, i) => ({ r, i })).filter(({ r }) => r.status === 'queued').map(({ i }) => i);

    const { completedCount, failedCount } = await generateRows(indicesToGenerate, bRows, batch.id);

    await supabase.from('import_batches').update({
      status: abortRef.current ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      completed_count: completedCount,
      failed_count: failedCount,
    } as any).eq('id', batch.id);

    setIsRunning(false);
    setIsStopping(false);
    setPhase('qa');
    setSelectedRows(new Set());
    toast({ title: 'Generation complete', description: `${completedCount} success, ${failedCount} failed` });
  }, [parsedRows, user, aiModel, fileName, checkConflicts, toast, generateRows, selectedRows]);

  // ── Remove a single row from parsed list ──
  const removeRow = useCallback((rowIndex: number) => {
    setParsedRows(prev => {
      const updated = prev.filter(r => r.rowIndex !== rowIndex);
      // Also remove from batchRows if present
      setBatchRows(bRows => bRows.filter(r => r.rowIndex !== rowIndex));
      setSelectedRows(sel => {
        const next = new Set(sel);
        next.delete(rowIndex);
        return next;
      });
      if (updated.length === 0) {
        setPhase('upload');
        localStorage.removeItem(STORAGE_KEY);
      }
      return updated;
    });
    toast({ title: 'Row removed' });
  }, [toast]);

  // ── Download stored file ──
  const downloadFile = useCallback(() => {
    if (storedFileUrl) {
      window.open(storedFileUrl, '_blank');
    }
  }, [storedFileUrl]);

  // ── Remove stored file from storage ──
  const removeStoredFile = useCallback(async () => {
    if (storedFilePath) {
      await supabase.storage.from('blog-assets').remove([storedFilePath]);
    }
    setStoredFileUrl(null);
    setStoredFilePath(null);
    localStorage.removeItem(STORAGE_KEY);
    setParsedRows([]);
    setBatchRows([]);
    setBatchId(null);
    setFileName('');
    setPhase('upload');
    setSelectedRows(new Set());
    setTargetWordCount(null);
    toast({ title: 'File removed' });
  }, [storedFilePath, toast]);

  // ── Bulk generate images for selected rows ──
  const bulkGenerateImages = useCallback(async () => {
    const indices = Array.from(selectedRows).filter(i => {
      const row = batchRows[i];
      return row?.status === 'success' && row?.pageId;
    });
    if (indices.length === 0) {
      toast({ title: 'No eligible pages selected', description: 'Select generated pages first', variant: 'destructive' });
      return;
    }
    toast({ title: `Generating images for ${indices.length} pages…` });
    for (const idx of indices) {
      if (abortRef.current) break;
      await generateImageForPage(idx);
    }
    toast({ title: `Bulk image generation complete` });
  }, [selectedRows, batchRows, generateImageForPage, toast]);

  // ── Retry all failed rows ──
  const retryAllFailed = useCallback(async () => {
    if (!user || !batchId) return;
    const failedIndices = batchRows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === 'failed')
      .map(({ i }) => i);

    if (failedIndices.length === 0) {
      toast({ title: 'No failed pages to retry' });
      return;
    }

    abortRef.current = false;
    setIsStopping(false);
    setIsRunning(true);
    setPhase('generating');

    // Reset failed rows to queued
    setBatchRows(prev => prev.map((r, i) =>
      failedIndices.includes(i) ? { ...r, status: 'queued', error: undefined } : r
    ));

    const currentRows = batchRows.map((r, i) =>
      failedIndices.includes(i) ? { ...r, status: 'queued' as const, error: undefined } : r
    );

    const { completedCount, failedCount } = await generateRows(failedIndices, currentRows, batchId);

    await supabase.from('import_batches').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_count: completedCount,
      failed_count: failedCount,
    } as any).eq('id', batchId);

    setIsRunning(false);
    setPhase('qa');
    toast({ title: 'Retry complete', description: `${completedCount} success, ${failedCount} still failed` });
  }, [batchRows, batchId, user, generateRows, toast]);

  // ── Resolve conflict ──
  const resolveConflict = async (index: number, action: 'updated' | 'skipped') => {
    const row = batchRows[index];
    if (!row.conflictInfo) return;

    const resolvedNote = buildConflictResolvedNote(action, row.conflictInfo.existing_slug);
    const newNotes = row.qa_notes
      .filter(n => !n.startsWith('POSSIBLE_CONFLICT'))
      .concat(resolvedNote);

    if (action === 'skipped') {
      setBatchRows(prev => prev.map((r, idx) =>
        idx === index ? { ...r, status: 'skipped', qa_notes: newNotes, conflictInfo: undefined } : r
      ));
    } else {
      // Mark for update: will overwrite the existing page
      setBatchRows(prev => prev.map((r, idx) =>
        idx === index ? { ...r, qa_notes: newNotes, conflictInfo: undefined } : r
      ));
    }

    // Update in DB if page exists
    if (row.pageId) {
      await supabase.from('custom_pages').update({ qa_notes: newNotes } as any).eq('id', row.pageId);
    }

    setConflictDialog(null);
    toast({ title: `Conflict ${action}` });
  };

  // ── Publish single page ──
  const publishPage = async (index: number) => {
    const row = batchRows[index];
    if (!row.pageId) return;

    // Validate publish requirements
    const hasSlugConflict = row.qa_notes.some(n => n.includes('SLUG_CONFLICT'));
    const hasUnresolvedConflict = row.qa_notes.some(n => n.startsWith('POSSIBLE_CONFLICT'));

    if (hasSlugConflict) {
      toast({ title: 'Cannot publish', description: 'Slug conflict must be resolved first', variant: 'destructive' });
      return;
    }
    if (hasUnresolvedConflict) {
      toast({ title: 'Cannot publish', description: 'Review and resolve the conflict flag first', variant: 'destructive' });
      return;
    }
    if (!row.slug || !row.board_name || !row.state_ut || !row.result_url || !row.official_board_url) {
      toast({ title: 'Cannot publish', description: 'Missing required fields', variant: 'destructive' });
      return;
    }

    await supabase.from('custom_pages').update({
      is_published: true, status: 'published', published_at: new Date().toISOString(),
    } as any).eq('id', row.pageId);

    // Update batch published count
    if (batchId) {
      const pubCount = batchRows.filter((r, i) => (i === index || r.status === 'success') && r.pageId).length;
      await supabase.from('import_batches').update({ published_count: pubCount } as any).eq('id', batchId);
    }

    setBatchRows(prev => prev.map((r, i) =>
      i === index ? { ...r, status: 'success' } : r
    ));
    toast({ title: `Published: ${row.board_name}` });
  };

  // ── Publish all valid ──
  const publishAllValid = async () => {
    const publishable = batchRows.filter((r, i) =>
      r.status === 'success' && r.pageId &&
      !r.qa_notes.some(n => n.startsWith('POSSIBLE_CONFLICT')) &&
      r.slug && r.board_name && r.state_ut && r.result_url && r.official_board_url
    );

    for (const row of publishable) {
      await supabase.from('custom_pages').update({
        is_published: true, status: 'published', published_at: new Date().toISOString(),
      } as any).eq('id', row.pageId);
    }

    toast({ title: `Published ${publishable.length} pages` });
  };

  // ── Re-generate single ──
  const reGenerate = async (index: number) => {
    const row = batchRows[index];
    if (!row.pageId) return;

    setBatchRows(prev => prev.map((r, i) => i === index ? { ...r, status: 'generating' } : r));

    try {
      const validRows = batchRows.filter(r => r.valid);
      const linkMap = buildInternalLinkMap(validRows);
      const siblingLinks = linkMap.get(row.slug) || [];

      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: {
          action: 'generate-result',
          state_ut: row.state_ut, board_name: row.board_name,
          board_abbr: row.board_abbr, result_url: row.result_url,
          official_board_url: row.official_board_url,
          seo_intro: row.seo_intro_text || '',
          variant: row.variant,
          target_word_count: targetWordCount || getTargetWordCount(row.variant),
          sibling_slugs: siblingLinks.map(l => l.slug),
          aiModel,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed');

      const d = data.data;
      await supabase.from('custom_pages').update({
        content: d.content || '', excerpt: d.excerpt || null,
        meta_title: d.meta_title || null, meta_description: d.meta_description || null,
        faq_schema: d.faq_items || [], word_count: d.word_count || 0,
        ai_model_used: aiModel, ai_generated_at: new Date().toISOString(),
      } as any).eq('id', row.pageId);

      const quality = scoreCustomPage({
        content: d.content || '', meta_title: d.meta_title,
        meta_description: d.meta_description, excerpt: d.excerpt,
        faq_schema: d.faq_items, tags: d.suggested_tags,
      });

      setBatchRows(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'success', quality } : r
      ));
      toast({ title: `Re-generated: ${row.board_name}` });
    } catch (e: any) {
      setBatchRows(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'failed', error: e.message } : r
      ));
      toast({ title: 'Re-generation failed', description: e.message, variant: 'destructive' });
    }
  };

  // ── Stats ──
  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;
  const completed = batchRows.filter(r => r.status === 'success').length;
  const failed = batchRows.filter(r => r.status === 'failed').length;
  const conflicts = batchRows.filter(r => r.qa_notes.some(n => n.startsWith('POSSIBLE_CONFLICT'))).length;
  const lowQuality = batchRows.filter(r => r.quality && r.quality.score < 65).length;
  const progress = batchRows.length > 0 ? ((completed + failed + batchRows.filter(r => r.status === 'skipped').length) / batchRows.length) * 100 : 0;

  // ── Filtered rows ──
  const filteredRows: BatchRow[] = filter === 'all' ? (batchRows.length > 0 ? batchRows : parsedRows.map(r => ({ ...r, status: r.valid ? 'queued' as const : 'skipped' as const, qa_notes: [] as string[] } as BatchRow))) :
    filter === 'conflicts' ? batchRows.filter(r => r.qa_notes?.some(n => n.startsWith('POSSIBLE_CONFLICT'))) :
    filter === 'failed' ? batchRows.filter(r => r.status === 'failed') :
    batchRows.filter(r => r.quality && r.quality.score < 65);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Board Result Pages
          </h3>
          <p className="text-sm text-muted-foreground">
            Upload XLSX to generate SEO-optimized board result landing pages
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" triggerClassName="w-[180px]" />
          <AiModelSelector value={imageModel} onValueChange={setImageModel} capability="image" triggerClassName="w-[180px]" size="sm" />
          
          {/* Word Length Selector */}
          <div className="flex items-center gap-1">
            <Select
              value={targetWordCount ? (![800, 1000, 1200, 1500, 1800, 2000, 2500].includes(targetWordCount) ? 'custom' : String(targetWordCount)) : 'auto'}
              onValueChange={(v) => setTargetWordCount(v === 'auto' ? null : v === 'custom' ? 1500 : Number(v))}
            >
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="Word Count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (by variant)</SelectItem>
                <SelectItem value="800">800 words</SelectItem>
                <SelectItem value="1000">1,000 words</SelectItem>
                <SelectItem value="1200">1,200 words</SelectItem>
                <SelectItem value="1500">1,500 words</SelectItem>
                <SelectItem value="1800">1,800 words</SelectItem>
                <SelectItem value="2000">2,000 words</SelectItem>
                <SelectItem value="2500">2,500 words</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {targetWordCount && ![800, 1000, 1200, 1500, 1800, 2000, 2500].includes(targetWordCount) && (
              <Input
                type="number"
                min={500}
                max={5000}
                step={100}
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(Number(e.target.value) || null)}
                className="w-[90px] h-9 text-xs"
                placeholder="Words"
              />
            )}
          </div>

          {phase !== 'upload' && !isRunning && (
            <>
              <Label htmlFor="xlsx-reupload" className="cursor-pointer">
                <Button asChild variant="outline" size="sm">
                  <span><Upload className="h-3 w-3 mr-1" /> Upload New File</span>
                </Button>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setParsedRows([]);
                  setBatchRows([]);
                  setBatchId(null);
                  setFileName('');
                  setPhase('upload');
                  setSelectedRows(new Set());
                  setTargetWordCount(null);
                }}
              >
                <XCircle className="h-3 w-3 mr-1" /> Clear
              </Button>
            </>
          )}
          <Input
            id="xlsx-reupload"
            type="file"
            accept=".xlsx,.csv,.xls"
            className="hidden"
            onChange={(e) => {
              handleFileUpload(e);
              setBatchRows([]);
              setBatchId(null);
              setSelectedRows(new Set());
            }}
          />
        </div>
      </div>

      {/* ── UPLOAD PHASE ── */}
      {phase === 'upload' && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Upload Board Result Dataset</p>
              <p className="text-sm text-muted-foreground mt-1">
                XLSX or CSV with columns: state_ut, board_name, result_url, official_board_url, seo_intro_text
              </p>
            </div>
            <Label htmlFor="xlsx-upload" className="cursor-pointer">
              <Button asChild variant="default">
                <span><FileSpreadsheet className="h-4 w-4 mr-2" /> Select File</span>
              </Button>
            </Label>
            <Input
              id="xlsx-upload"
              type="file"
              accept=".xlsx,.csv,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </CardContent>
        </Card>
      )}

      {/* ── PREVIEW / QA PHASE ── */}
      {(phase === 'preview' || phase === 'generating' || phase === 'qa') && (
        <>
          {/* Stats bar */}
          <div className="flex flex-wrap gap-3 items-center">
            <Badge variant="outline" className="text-xs">{fileName}</Badge>
            <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 text-xs">
              {validCount} valid
            </Badge>
            {invalidCount > 0 && (
              <Badge variant="destructive" className="text-xs">{invalidCount} invalid</Badge>
            )}
            {conflicts > 0 && (
              <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 text-xs">
                ⚠ {conflicts} conflicts
              </Badge>
            )}
            {lowQuality > 0 && (
              <Badge className="bg-orange-500/20 text-orange-700 border-orange-300 text-xs">
                {lowQuality} low quality
              </Badge>
            )}
            {completed > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-700 text-xs">✓ {completed} generated</Badge>
            )}
            {failed > 0 && (
              <Badge variant="destructive" className="text-xs">✗ {failed} failed</Badge>
            )}
          </div>

          {/* Progress bar */}
          {(phase === 'generating' || phase === 'qa') && batchRows.length > 0 && (
            <Progress value={progress} className="h-2" />
          )}

          {/* Controls */}
          <div className="flex gap-2 items-center flex-wrap">
            {phase === 'preview' && (
              <>
                <Button onClick={() => startGeneration(false)} disabled={validCount === 0}>
                  <Zap className="h-4 w-4 mr-1" /> Generate {validCount} Pages
                </Button>
                {selectedRows.size > 0 && (
                  <Button variant="outline" onClick={() => startGeneration(true)}>
                    <Zap className="h-4 w-4 mr-1" /> Generate {selectedRows.size} Selected
                  </Button>
                )}
              </>
            )}
            {phase === 'generating' && isRunning && (
              <Button
                variant="destructive"
                disabled={isStopping}
                onClick={() => {
                  abortRef.current = true;
                  setIsStopping(true);
                  toast({ title: 'Stopping…', description: 'Will stop after the current page finishes generating.' });
                }}
              >
                {isStopping ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Stopping…</>
                ) : (
                  <><Square className="h-4 w-4 mr-1" /> Stop</>
                )}
              </Button>
            )}
            {phase === 'qa' && (
              <>
                <Button onClick={publishAllValid} disabled={completed === 0}>
                  <Globe className="h-4 w-4 mr-1" /> Publish All Valid
                </Button>
                {failed > 0 && (
                  <Button variant="outline" onClick={retryAllFailed} disabled={isRunning}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Retry {failed} Failed
                  </Button>
                )}
              </>
            )}

            <div className="ml-auto">
              <Select value={filter} onValueChange={v => setFilter(v as any)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({filteredRows.length})</SelectItem>
                  <SelectItem value="conflicts">Conflicts ({conflicts})</SelectItem>
                  <SelectItem value="failed">Failed ({failed})</SelectItem>
                  <SelectItem value="low-quality">Low Quality ({lowQuality})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {phase === 'preview' && (
                      <TableHead className="w-8">
                        <Checkbox
                          checked={selectedRows.size > 0 && parsedRows.filter(r => r.valid).every(r => selectedRows.has(r.rowIndex))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRows(new Set(parsedRows.filter(r => r.valid).map(r => r.rowIndex)));
                            } else {
                              setSelectedRows(new Set());
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Board</TableHead>
                    <TableHead className="w-20">Variant</TableHead>
                    <TableHead className="w-36">Slug</TableHead>
                    <TableHead className="w-16 text-center">Status</TableHead>
                    <TableHead className="w-14 text-center">Score</TableHead>
                    <TableHead className="w-14 text-center">Words</TableHead>
                    <TableHead className="w-10 text-center">Img</TableHead>
                    <TableHead className="w-12 text-center">Issues</TableHead>
                    <TableHead className="text-right w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, displayIdx) => {
                    const realIdx = batchRows.indexOf(row) >= 0 ? batchRows.indexOf(row) : displayIdx;
                    const hasConflict = row.qa_notes?.some(n => n.startsWith('POSSIBLE_CONFLICT'));
                    const conflictData = hasConflict ? parseConflictNote(row.qa_notes.find(n => n.startsWith('POSSIBLE_CONFLICT'))!) : null;
                    const isExpanded = expandedRow === realIdx;
                    const bRow = row as BatchRow;
                    const issueCount = (row.qa_notes?.filter(n => !n.startsWith('CONFLICT_RESOLVED')).length || 0) + (row.errors?.length || 0);

                    return (
                      <>
                        <TableRow
                          key={realIdx}
                          className={
                            hasConflict ? 'bg-amber-50/50 dark:bg-amber-950/10' :
                            !row.valid ? 'bg-destructive/5' :
                            bRow.quality && bRow.quality.score < 65 ? 'bg-orange-50/50 dark:bg-orange-950/10' : ''
                          }
                        >
                          {phase === 'preview' && (
                            <TableCell>
                              <Checkbox
                                disabled={!row.valid}
                                checked={selectedRows.has(row.rowIndex)}
                                onCheckedChange={(checked) => {
                                  setSelectedRows(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(row.rowIndex);
                                    else next.delete(row.rowIndex);
                                    return next;
                                  });
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">{row.rowIndex + 1}</TableCell>
                          <TableCell className="text-sm">{row.state_ut}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={row.board_name}>{row.board_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{row.variant}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[140px]" title={row.slug}>
                            /{row.slug}
                          </TableCell>
                          <TableCell className="text-center">
                            {bRow.status === 'queued' && <span className="text-muted-foreground text-xs">—</span>}
                            {bRow.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />}
                            {bRow.status === 'success' && <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />}
                            {bRow.status === 'failed' && <XCircle className="h-4 w-4 text-destructive mx-auto" />}
                            {bRow.status === 'skipped' && <span className="text-xs text-muted-foreground">skip</span>}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {bRow.quality ? (
                              <span className={bRow.quality.score >= 65 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                {bRow.quality.score}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {bRow.quality ? (
                              <span className={bRow.quality.wordCount >= 1000 ? 'text-emerald-600' : 'text-amber-600'}>
                                {bRow.quality.wordCount.toLocaleString()}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {bRow.status === 'success' ? (
                              imageGenLoading.has(realIdx) ? (
                                <Loader2 className="h-3 w-3 animate-spin mx-auto text-primary" />
                              ) : (
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  title="Generate hero image"
                                  onClick={() => generateImageForPage(realIdx)}
                                >
                                  🖼️
                                </Button>
                              )
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {issueCount > 0 ? (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandedRow(isExpanded ? null : realIdx)}>
                                <span className="text-xs text-amber-600 font-bold">{issueCount}</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {hasConflict && conflictData && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 text-xs text-amber-600 border-amber-300"
                                  onClick={() => setConflictDialog({ index: realIdx, info: conflictData })}
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Review
                                </Button>
                              )}
                              {bRow.status === 'success' && bRow.pageId && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7"
                                    onClick={() => window.open(`/${row.slug}`, '_blank')}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs text-emerald-600 border-emerald-300"
                                    onClick={() => publishPage(realIdx)}
                                  >
                                    <Globe className="h-3 w-3 mr-1" /> Pub
                                  </Button>
                                </>
                              )}
                              {(bRow.status === 'failed' || (bRow.quality && bRow.quality.score < 65)) && bRow.pageId && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reGenerate(realIdx)}>
                                  <RotateCcw className="h-3 w-3 mr-1" /> Retry
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded issues row */}
                        {isExpanded && (
                          <TableRow key={`${realIdx}-issues`}>
                            <TableCell colSpan={phase === 'preview' ? 13 : 12} className="bg-muted/30 py-2 px-4">
                              <div className="space-y-1 text-xs">
                                {row.errors?.map((err, ei) => (
                                  <div key={`e-${ei}`} className="flex items-start gap-1.5 text-destructive">
                                    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                    <span>{err}</span>
                                  </div>
                                ))}
                                {row.qa_notes?.filter(n => !n.startsWith('CONFLICT_RESOLVED')).map((note, ni) => {
                                  const parsed = parseConflictNote(note);
                                  if (parsed) {
                                    return (
                                      <div key={`n-${ni}`} className="flex items-start gap-1.5 text-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                        <div>
                                          <span className="font-medium">Possible Conflict: </span>
                                          A page with matching {parsed.match_type.replace(/\+/g, ' + ')} already exists.
                                          <div className="mt-1 text-muted-foreground">
                                            Existing: <span className="font-mono">/{parsed.existing_slug}</span> — "{parsed.existing_title}"
                                            {parsed.existing_batch && <span> (batch: {parsed.existing_batch.slice(0, 8)}…)</span>}
                                          </div>
                                          <div className="text-muted-foreground">
                                            New: <span className="font-mono">/{parsed.new_slug}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={`n-${ni}`} className="flex items-start gap-1.5 text-amber-600">
                                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                      <span>{note}</span>
                                    </div>
                                  );
                                })}
                                {bRow.status === 'failed' && bRow.error && (
                                  <div className="flex items-start gap-1.5 text-destructive">
                                    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                    <span>Generation error: {bRow.error}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── CONFLICT REVIEW DIALOG ── */}
      <Dialog open={!!conflictDialog} onOpenChange={v => { if (!v) setConflictDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Possible Conflict
            </DialogTitle>
          </DialogHeader>

          {conflictDialog && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  A page with matching <span className="font-medium text-foreground">{conflictDialog.info.match_type.replace(/\+/g, ' + ')}</span> already exists from a different import batch.
                </p>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Existing Page</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Title:</span> {conflictDialog.info.existing_title}</div>
                    <div><span className="text-muted-foreground">Slug:</span> <span className="font-mono text-xs">/{conflictDialog.info.existing_slug}</span></div>
                    <div><span className="text-muted-foreground">Batch:</span> {conflictDialog.info.existing_batch ? conflictDialog.info.existing_batch.slice(0, 8) + '…' : 'N/A'}</div>
                    <div><span className="text-muted-foreground">Page ID:</span> <span className="font-mono text-xs">{conflictDialog.info.existing_page_id.slice(0, 8)}…</span></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">New Row</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">New Slug:</span> <span className="font-mono text-xs">/{conflictDialog.info.new_slug}</span></div>
                    <div><span className="text-muted-foreground">Source Row:</span> #{batchRows[conflictDialog.index]?.rowIndex + 1}</div>
                    <div><span className="text-muted-foreground">Board:</span> {batchRows[conflictDialog.index]?.board_name}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => resolveConflict(conflictDialog.index, 'updated')}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Update Existing Page
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => resolveConflict(conflictDialog.index, 'skipped')}
                >
                  Skip This Row
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── HUB PAGE GENERATOR ── */}
      <HubPageGenerator />
    </div>
  );
}
