/**
 * BatchRowActions — Per-row action buttons: Enrich, Fix SEO, Edit, View, Publish, Update Live Page, Skip, Delete.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sparkles, Wrench, Pencil, Eye, Globe, RefreshCw, SkipForward, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
import type { BatchRow } from './useBatchPipeline';

interface Props {
  row: BatchRow;
  aiModel: string;
  onEnrich: (row: BatchRow, targetWordCount?: number) => Promise<boolean>;
  onFixSeo: (row: BatchRow) => Promise<boolean>;
  onEdit: (row: BatchRow) => void;
  onView: (row: BatchRow) => void;
  onPublish: (rowId: string) => Promise<boolean>;
  onSkip: (rowId: string) => Promise<boolean>;
  onDelete: (rowId: string) => void;
}

export function BatchRowActions({ row, aiModel, onEnrich, onFixSeo, onEdit, onView, onPublish, onSkip, onDelete }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const wrap = (action: string, fn: () => Promise<any>) => async () => {
    setBusy(action);
    try { await fn(); } finally { setBusy(null); }
  };

  const isPublished = row.workflow_status === 'published';
  const isOutOfSync = isPublished && row.published_at && row.updated_at > row.published_at;
  const hasContent = !!row.content && row.content.length > 100;

  return (
    <div className="flex items-center gap-1">
      {/* Primary action: Enrich or Publish */}
      {!isPublished && !hasContent && (
        <Button size="sm" variant="outline" disabled={!!busy} onClick={wrap('enrich', () => onEnrich(row))} title="Enrich">
          {busy === 'enrich' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        </Button>
      )}
      {hasContent && !isPublished && (
        <Button size="sm" variant="default" disabled={!!busy} onClick={wrap('publish', () => onPublish(row.id))} title="Publish">
          {busy === 'publish' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
        </Button>
      )}
      {isOutOfSync && (
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={wrap('update', () => onPublish(row.id))} title="Update Live Page">
          {busy === 'update' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      )}

      {/* Secondary actions in dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost"><MoreHorizontal className="h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {hasContent && (
            <DropdownMenuItem onClick={wrap('enrich', () => onEnrich(row))} disabled={!!busy}>
              <Sparkles className="h-3 w-3 mr-2" /> Re-Enrich
            </DropdownMenuItem>
          )}
          {hasContent && (
            <DropdownMenuItem onClick={wrap('seo', () => onFixSeo(row))} disabled={!!busy}>
              <Wrench className="h-3 w-3 mr-2" /> Fix SEO
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Pencil className="h-3 w-3 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onView(row)}>
            <Eye className="h-3 w-3 mr-2" /> View Preview
          </DropdownMenuItem>
          {!isPublished && (
            <DropdownMenuItem onClick={wrap('skip', () => onSkip(row.id))} disabled={!!busy}>
              <SkipForward className="h-3 w-3 mr-2" /> Skip
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onDelete(row.id)} className="text-destructive">
            <Trash2 className="h-3 w-3 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
