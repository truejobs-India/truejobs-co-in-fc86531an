/**
 * BoardResultPipeline — Main container for the hardened Board Result Pages batch pipeline.
 * Replaces the deprecated BoardResultGenerator monolith.
 *
 * Architecture:
 * - Upload saves parsed rows to DB only (no custom_pages created)
 * - Enrich/Fix SEO update saved batch row drafts
 * - Publish creates live custom_pages via transactional RPC
 * - Post-publish edits require explicit "Update Live Page" action
 */
import { useState } from 'react';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { HubPageGenerator } from '@/components/admin/HubPageGenerator';
import { BatchUploadZone } from './BatchUploadZone';
import { BatchSelector } from './BatchSelector';
import { BatchWorkspace } from './BatchWorkspace';
import { DuplicateReviewPanel } from './DuplicateReviewPanel';
import { RowEditDialog } from './RowEditDialog';
import { RowPreviewDialog } from './RowPreviewDialog';
import { PublishedBatchSections } from './PublishedBatchSections';
import { useBatchPipeline, type BatchRow } from './useBatchPipeline';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

export function BoardResultPipeline() {
  const pipeline = useBatchPipeline();
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'google/gemini-2.5-flash'));

  // Edit/View dialogs
  const [editRow, setEditRow] = useState<BatchRow | null>(null);
  const [viewRow, setViewRow] = useState<BatchRow | null>(null);

  // Delete confirmation
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const handleEdit = (row: BatchRow) => setEditRow(row);
  const handleView = (row: BatchRow) => setViewRow(row);

  const handleSaveEdit = async (rowId: string, updates: Partial<BatchRow>) => {
    const ok = await pipeline.updateRow(rowId, updates);
    if (ok && pipeline.selectedBatchId) await pipeline.afterRowStateChange(pipeline.selectedBatchId);
    return ok;
  };

  const handleDelete = (rowId: string) => { setDeleteRowId(rowId); setDeleteReason(''); };
  const confirmDelete = async () => {
    if (deleteRowId) {
      await pipeline.softDeleteRow(deleteRowId, deleteReason || 'Admin deleted');
      setDeleteRowId(null);
    }
  };

  const handleEnrich = async (row: BatchRow, targetWordCount?: number) => pipeline.enrichRow(row, aiModel, targetWordCount);
  const handleFixSeo = async (row: BatchRow) => pipeline.fixSeoRow(row, aiModel);

  return (
    <div className="space-y-6">
      {/* AI Model Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">AI Model:</span>
        <AiModelSelector value={aiModel} onValueChange={setAiModel} />
      </div>

      {/* Upload Zone */}
      <BatchUploadZone
        onBatchCreated={id => pipeline.setSelectedBatchId(id)}
        createBatch={pipeline.createBatch}
      />

      {/* Batch Selector */}
      <BatchSelector
        batches={pipeline.batches}
        selectedBatchId={pipeline.selectedBatchId}
        onSelect={pipeline.setSelectedBatchId}
      />

      {/* Active Batch Workspace */}
      <BatchWorkspace
        batch={pipeline.selectedBatch}
        rows={pipeline.filteredRows}
        filter={pipeline.filter}
        filterCounts={pipeline.filterCounts}
        onFilterChange={pipeline.setFilter}
        loading={pipeline.rowsLoading}
        aiModel={aiModel}
        onEnrich={handleEnrich}
        onFixSeo={handleFixSeo}
        onEdit={handleEdit}
        onView={handleView}
        onPublish={pipeline.publishRow}
        onSkip={pipeline.skipRow}
        onDelete={handleDelete}
      />

      {/* Duplicate Review Panel */}
      {pipeline.selectedBatchId && (
        <DuplicateReviewPanel
          batchId={pipeline.selectedBatchId}
          onRunDetection={pipeline.runDuplicateDetection}
        />
      )}

      {/* Published Batch Sections */}
      <PublishedBatchSections batches={pipeline.batches} />

      {/* Hub Page Generator */}
      <HubPageGenerator />

      {/* Edit Dialog */}
      <RowEditDialog
        row={editRow}
        open={!!editRow}
        onClose={() => setEditRow(null)}
        onSave={handleSaveEdit}
      />

      {/* Preview Dialog */}
      <RowPreviewDialog
        row={viewRow}
        open={!!viewRow}
        onClose={() => setViewRow(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRowId} onOpenChange={v => !v && setDeleteRowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft Delete Row</AlertDialogTitle>
            <AlertDialogDescription>
              This row will be hidden but recoverable. Enter a reason (optional):
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            placeholder="Reason for deletion…"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
