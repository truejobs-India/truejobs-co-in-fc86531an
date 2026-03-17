/**
 * DuplicateReviewPanel — Shows duplicate matches from the relational duplicate_matches table.
 * UI labels use "Board Name Match" / "Near Board Name Match" — not "Title Match".
 * Matching uses board_name — not display_title, meta_title, or custom_pages.title.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DuplicateMatch } from './useBatchPipeline';

interface Props {
  batchId: string;
  onRunDetection: (batchId: string) => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  exact_slug_match: 'Exact Slug',
  exact_board_name_match: 'Exact Board Name',
  near_board_name_match: 'Near Board Name',
  exact_result_url_match: 'Result URL',
  exact_official_url_match: 'Official URL',
  exact_structured_field_identity: 'Structured Identity',
  same_board_variant_fields: 'Board+Variant',
  possible_overlap: 'Possible Overlap',
};

const ACTION_COLORS: Record<string, string> = {
  delete_new: 'bg-red-100 text-red-800',
  skip_new: 'bg-yellow-100 text-yellow-800',
  update_existing: 'bg-blue-100 text-blue-800',
  review: 'bg-orange-100 text-orange-800',
  keep: 'bg-green-100 text-green-800',
};

export function DuplicateReviewPanel({ batchId, onRunDetection }: Props) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    // Get row IDs for this batch
    const { data: rows } = await supabase
      .from('board_result_batch_rows')
      .select('id')
      .eq('batch_id', batchId)
      .is('deleted_at', null);

    if (rows && rows.length > 0) {
      const rowIds = rows.map(r => r.id);
      const { data } = await supabase
        .from('duplicate_matches')
        .select('*')
        .in('batch_row_id', rowIds)
        .order('confidence', { ascending: false });
      setMatches((data as any[]) || []);
    } else {
      setMatches([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMatches(); }, [batchId]);

  const handleRun = async () => {
    setDetecting(true);
    await onRunDetection(batchId);
    await fetchMatches();
    setDetecting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Duplicate Review
            <Badge variant="outline">{matches.length} matches</Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleRun} disabled={detecting}>
            {detecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {detecting ? 'Scanning…' : 'Run Detection'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No duplicates found. Run detection to scan.</p>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[m.duplicate_type] || m.duplicate_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.matched_slug && <span className="font-mono">/{m.matched_slug}</span>}
                      {m.matched_title && <span className="block text-muted-foreground truncate max-w-[200px]">{m.matched_title}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.confidence >= 0.9 ? 'destructive' : 'secondary'}>
                        {(m.confidence * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[m.recommended_action] || ''}>
                        {m.recommended_action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
