/**
 * PublishedBatchSections — "Articles Batch 1/2/3…" collapsible sections.
 * Shows published custom_pages grouped by import_batch_id with stable batch_number labels.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ImportBatch } from './useBatchPipeline';

interface PublishedPage {
  id: string;
  title: string;
  slug: string;
  word_count: number;
  published_at: string;
  state_ut: string | null;
  board_name: string | null;
}

interface Props {
  batches: ImportBatch[];
}

export function PublishedBatchSections({ batches }: Props) {
  const publishedBatches = batches.filter(b => b.published_count > 0).sort((a, b) => a.batch_number - b.batch_number);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pages, setPages] = useState<Record<string, PublishedPage[]>>({});

  const toggleBatch = async (batchId: string) => {
    const isOpen = !expanded[batchId];
    setExpanded(prev => ({ ...prev, [batchId]: isOpen }));

    if (isOpen && !pages[batchId]) {
      const { data } = await supabase
        .from('custom_pages')
        .select('id, title, slug, word_count, published_at, state_ut, board_name')
        .eq('import_batch_id', batchId)
        .eq('is_published', true)
        .order('source_row_index', { ascending: true });
      setPages(prev => ({ ...prev, [batchId]: (data as any[]) || [] }));
    }
  };

  if (publishedBatches.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Published Batches</h3>
      {publishedBatches.map(batch => (
        <Card key={batch.id}>
          <CardHeader className="py-2 px-4 cursor-pointer" onClick={() => toggleBatch(batch.id)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {expanded[batch.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Articles Batch {batch.batch_number}
                <span className="text-muted-foreground font-normal text-xs">({batch.source_file_name})</span>
              </CardTitle>
              <Badge className="bg-green-100 text-green-800">{batch.published_count} published</Badge>
            </div>
          </CardHeader>
          {expanded[batch.id] && (
            <CardContent className="pt-0 pb-3 px-4">
              {pages[batch.id] ? (
                <div className="space-y-1">
                  {pages[batch.id].map(pg => (
                    <div key={pg.id} className="flex items-center justify-between py-1 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">/{pg.slug}</span>
                        <span className="text-xs truncate max-w-[300px]">{pg.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{pg.word_count}w</Badge>
                        <a href={`/${pg.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
