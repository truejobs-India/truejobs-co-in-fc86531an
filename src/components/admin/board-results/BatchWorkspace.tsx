/**
 * BatchWorkspace — Filterable table of rows for selected batch.
 * Shows workflow_status, duplicate_status, validation_status, word count, actions.
 * Supports row selection checkboxes and target word count for bulk enrichment.
 */
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Sparkles, Wrench, Globe, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { BatchRowActions } from './BatchRowActions';
import { ImageGenerationPanel, type ImageTarget } from '@/components/admin/ImageGenerationPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import type { BatchRow, WorkflowFilter, ImportBatch } from './useBatchPipeline';

interface Props {
  batch: ImportBatch | null;
  rows: BatchRow[];
  filter: WorkflowFilter;
  filterCounts: Record<WorkflowFilter, number>;
  onFilterChange: (f: WorkflowFilter) => void;
  loading: boolean;
  aiModel: string;
  onEnrich: (row: BatchRow, targetWordCount?: number) => Promise<boolean>;
  onFixSeo: (row: BatchRow) => Promise<boolean>;
  onEdit: (row: BatchRow) => void;
  onView: (row: BatchRow) => void;
  onPublish: (rowId: string) => Promise<boolean>;
  onSkip: (rowId: string) => Promise<boolean>;
  onDelete: (rowId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  enriched: 'bg-blue-100 text-blue-800',
  seo_fixed: 'bg-indigo-100 text-indigo-800',
  ready_to_publish: 'bg-cyan-100 text-cyan-800',
  published: 'bg-green-100 text-green-800',
  skipped: 'bg-yellow-100 text-yellow-800',
  deleted: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  review_needed: 'bg-orange-100 text-orange-800',
};

const FILTERS: { key: WorkflowFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'enriched', label: 'Enriched' },
  { key: 'seo_fixed', label: 'SEO Fixed' },
  { key: 'published', label: 'Published' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'invalid', label: 'Invalid' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'failed', label: 'Failed' },
  { key: 'review_needed', label: 'Review' },
  { key: 'deleted', label: 'Deleted' },
];

const WORD_COUNT_PRESETS = [800, 1000, 1200, 1500, 1800, 2000, 2500];

export function BatchWorkspace({
  batch, rows, filter, filterCounts, onFilterChange, loading,
  aiModel, onEnrich, onFixSeo, onEdit, onView, onPublish, onSkip, onDelete,
}: Props) {
  const { toast } = useToast();
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [targetWordCount, setTargetWordCount] = useState<number | null>(null);
  const [customWordCount, setCustomWordCount] = useState('');

  const activeRows = batch ? rows.filter(r => !r.deleted_at) : [];
  const draftRows = batch ? rows.filter(r => r.workflow_status === 'draft' && !r.deleted_at) : [];
  const enrichedRows = rows.filter(r => ['enriched', 'seo_fixed'].includes(r.workflow_status) && !r.deleted_at);
  const unpublishedReady = rows.filter(r => r.workflow_status !== 'published' && r.content && r.content.length > 100 && !r.deleted_at);

  // Selected rows helpers
  const selectedActiveRows = rows.filter(r => selectedRows.has(r.id) && !r.deleted_at);
  const selectedDrafts = selectedActiveRows.filter(r => r.workflow_status === 'draft');
  const selectedEnriched = selectedActiveRows.filter(r => ['enriched', 'seo_fixed'].includes(r.workflow_status));
  const selectedPublishable = selectedActiveRows.filter(r => r.workflow_status !== 'published' && r.content && r.content.length > 100);
  const allSelected = activeRows.length > 0 && activeRows.every(r => selectedRows.has(r.id));

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(activeRows.map(r => r.id)));
    }
  };

  const selectByStatus = (status: string) => {
    const ids = rows.filter(r => r.workflow_status === status && !r.deleted_at).map(r => r.id);
    setSelectedRows(new Set(ids));
  };

  const wordCountValue = targetWordCount
    ? (WORD_COUNT_PRESETS.includes(targetWordCount) ? String(targetWordCount) : 'custom')
    : 'auto';

  const runBulk = async (label: string, targetRows: BatchRow[], fn: (row: BatchRow) => Promise<boolean>) => {
    if (targetRows.length === 0) return;
    setBulkAction(label);
    setBulkProgress({ done: 0, total: targetRows.length });
    for (let i = 0; i < targetRows.length; i++) {
      await fn(targetRows[i]);
      setBulkProgress({ done: i + 1, total: targetRows.length });
    }
    setBulkAction(null);
  };

  // Determine rows for enrichment: selected drafts if any, else all drafts
  const enrichTargetRows = selectedDrafts.length > 0 ? selectedDrafts : draftRows;
  const seoTargetRows = selectedEnriched.length > 0 ? selectedEnriched : enrichedRows;
  const publishTargetRows = selectedPublishable.length > 0 ? selectedPublishable : unpublishedReady;

  // Build image targets from selected rows (or all enriched if none selected)
  const imageTargetRows = selectedActiveRows.length > 0
    ? selectedActiveRows.filter(r => r.content && r.content.length > 100)
    : rows.filter(r => r.content && r.content.length > 100 && !r.deleted_at);

  const imageTargets: ImageTarget[] = useMemo(() => imageTargetRows.map(r => ({
    id: r.id,
    title: r.display_title || `${r.board_name} Result ${new Date().getFullYear()} - ${r.state_ut}`,
    slug: r.slug,
    content: r.content || '',
    category: 'Board Results',
    tags: r.tags,
    cover_image_url: (r as any).cover_image_url || null,
    featured_image_alt: (r as any).featured_image_alt || null,
  })), [imageTargetRows]);

  const handleImageCoverGenerated = async (targetId: string, url: string, alt: string) => {
    await supabase.from('board_result_batch_rows').update({
      enriched_content: { cover_image_url: url, featured_image_alt: alt },
    } as any).eq('id', targetId);
  };

  const handleImageInlineGenerated = async (targetId: string, newContent: string, _articleImages: any) => {
    const wordCount = newContent.split(/\s+/).filter(Boolean).length;
    await supabase.from('board_result_batch_rows').update({
      content: newContent, word_count: wordCount,
    } as any).eq('id', targetId);
  };

  if (!batch) return <p className="text-sm text-muted-foreground text-center py-8">Select a batch to view its workspace</p>;

  return (
    <div className="space-y-3">
      {/* Batch info bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-mono font-medium">Batch #{batch.batch_number}</span>
        <span className="text-muted-foreground truncate max-w-[200px]">{batch.source_file_name}</span>
        <Badge variant="outline">{batch.total_rows} rows</Badge>
        <Badge className="bg-green-100 text-green-800">{batch.published_count} published</Badge>
        <Badge className="bg-blue-100 text-blue-800">{batch.enriched_count} enriched</Badge>
        {batch.failed_count > 0 && <Badge variant="destructive">{batch.failed_count} failed</Badge>}
      </div>

      {/* Target Word Count + Selection Controls */}
      <div className="flex flex-wrap items-center gap-3 p-2 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Target Words:</span>
          <Select
            value={wordCountValue}
            onValueChange={(v) => {
              if (v === 'auto') setTargetWordCount(null);
              else if (v === 'custom') setTargetWordCount(Number(customWordCount) || 1500);
              else setTargetWordCount(Number(v));
            }}
          >
            <SelectTrigger className="w-[130px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (by variant)</SelectItem>
              {WORD_COUNT_PRESETS.map(n => (
                <SelectItem key={n} value={String(n)}>{n} words</SelectItem>
              ))}
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {wordCountValue === 'custom' && (
            <Input
              type="number"
              min={500}
              max={5000}
              className="w-[80px] h-7 text-xs"
              value={customWordCount}
              onChange={e => {
                setCustomWordCount(e.target.value);
                const n = Number(e.target.value);
                if (n >= 500 && n <= 5000) setTargetWordCount(n);
              }}
              placeholder="1500"
            />
          )}
        </div>

        <div className="border-l h-5 mx-1" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Select:</span>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={toggleAll}>
            {allSelected ? 'None' : 'All'}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => selectByStatus('draft')}>
            Drafts
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => selectByStatus('enriched')}>
            Enriched
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => selectByStatus('failed')}>
            Failed
          </Button>
          {selectedRows.size > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {selectedRows.size} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg bg-muted/30">
        <span className="text-xs font-semibold text-muted-foreground">Bulk Actions:</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          disabled={!!bulkAction || enrichTargetRows.length === 0}
          onClick={() => runBulk('Enriching', enrichTargetRows, (row) => onEnrich(row, targetWordCount || undefined))}
        >
          <Sparkles className="h-3 w-3" />
          Enrich {selectedDrafts.length > 0 ? 'Selected' : 'All'} Drafts ({enrichTargetRows.length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          disabled={!!bulkAction || seoTargetRows.length === 0}
          onClick={() => runBulk('Fixing SEO', seoTargetRows, onFixSeo)}
        >
          <Wrench className="h-3 w-3" />
          Fix SEO {selectedEnriched.length > 0 ? 'Selected' : 'All'} ({seoTargetRows.length})
        </Button>
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1"
          disabled={!!bulkAction || publishTargetRows.length === 0}
          onClick={() => runBulk('Publishing', publishTargetRows, (row) => onPublish(row.id))}
        >
          <Globe className="h-3 w-3" />
          Publish {selectedPublishable.length > 0 ? 'Selected' : 'All'} Ready ({publishTargetRows.length})
        </Button>
        {bulkAction && (
          <Badge variant="secondary" className="text-xs animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            {bulkAction} {bulkProgress.done}/{bulkProgress.total}
          </Badge>
        )}
        {targetWordCount && (
          <Badge variant="outline" className="text-[10px] h-5">
            Target: {targetWordCount}w
          </Badge>
        )}
      </div>

      {/* Image Generation Panel */}
      <ImageGenerationPanel
        targets={imageTargets}
        onCoverGenerated={handleImageCoverGenerated}
        onInlineGenerated={handleImageInlineGenerated}
        sectionLabel={`Board Results Batch #${batch.batch_number}`}
      />

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {FILTERS.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'ghost'}
            className="text-xs h-7"
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
            {filterCounts[f.key] > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{filterCounts[f.key]}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 text-sm text-muted-foreground">No rows match this filter</p>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    className="h-3.5 w-3.5"
                  />
                </TableHead>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Board</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dup</TableHead>
                <TableHead>Words</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const isOutOfSync = row.workflow_status === 'published' && row.published_at && row.updated_at > row.published_at;
                return (
                  <TableRow key={row.id} className={row.deleted_at ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(row.id)}
                        onCheckedChange={() => toggleRow(row.id)}
                        className="h-3.5 w-3.5"
                        disabled={!!row.deleted_at}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.row_index + 1}</TableCell>
                    <TableCell className="text-xs max-w-[80px] truncate">{row.state_ut}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{row.board_name}</TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[120px] truncate">
                      {row.slug}
                      {row.published_page_id && (
                        <span className="text-green-600 ml-1">✓</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_COLORS[row.workflow_status] || ''}`}>
                        {row.workflow_status}
                      </Badge>
                      {isOutOfSync && (
                        <Badge className="ml-1 text-[10px] bg-amber-100 text-amber-800">
                          <RefreshCw className="h-2 w-2 mr-0.5" />out-of-sync
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.duplicate_status !== 'unchecked' && row.duplicate_status !== 'clean' && (
                        <Badge variant="destructive" className="text-[10px]">{row.duplicate_count}</Badge>
                      )}
                      {row.duplicate_status === 'clean' && <span className="text-green-600 text-xs">✓</span>}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{row.word_count || 0}</TableCell>
                    <TableCell className="text-right">
                      <BatchRowActions
                        row={row}
                        aiModel={aiModel}
                        onEnrich={onEnrich}
                        onFixSeo={onFixSeo}
                        onEdit={onEdit}
                        onView={onView}
                        onPublish={onPublish}
                        onSkip={onSkip}
                        onDelete={onDelete}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
