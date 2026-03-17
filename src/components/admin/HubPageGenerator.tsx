/**
 * HubPageGenerator — Admin tool to generate State-level and Board-level hub pages
 * from existing result-landing pages in the database.
 */
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, CheckCircle, XCircle, Globe, MapPin, Image as ImageIcon, Zap,
} from 'lucide-react';

interface HubRow {
  key: string;               // state slug or state+board slug
  type: 'state' | 'board';
  state_ut: string;
  board_name?: string;
  resultCount: number;
  hasHeroImage: boolean;
  hasBoardLogo: boolean;
  status: 'idle' | 'generating-image' | 'done' | 'error';
  imageUrl?: string;
  logoUrl?: string;
  error?: string;
}

export function HubPageGenerator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [imageModel, setImageModel] = useState(() => getLastUsedModel('image', 'gemini-flash-image'));
  const [hubs, setHubs] = useState<HubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<Set<string>>(new Set());

  // Scan existing result-landing pages to derive hub structure
  const scanHubs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_pages')
        .select('state_ut, board_name, cover_image_url, slug')
        .eq('page_type', 'result-landing')
        .eq('is_published', true)
        .order('state_ut');

      if (error) throw error;

      // Group by state, then by board within state
      const stateMap = new Map<string, { boards: Map<string, { count: number; hasImage: boolean }>; count: number; hasImage: boolean }>();
      
      for (const row of (data || []) as any[]) {
        const state = row.state_ut || 'Unknown';
        if (!stateMap.has(state)) {
          stateMap.set(state, { boards: new Map(), count: 0, hasImage: false });
        }
        const stateEntry = stateMap.get(state)!;
        stateEntry.count++;
        if (row.cover_image_url) stateEntry.hasImage = true;

        const board = row.board_name || 'Unknown Board';
        if (!stateEntry.boards.has(board)) {
          stateEntry.boards.set(board, { count: 0, hasImage: false });
        }
        const boardEntry = stateEntry.boards.get(board)!;
        boardEntry.count++;
        if (row.cover_image_url) boardEntry.hasImage = true;
      }

      const hubRows: HubRow[] = [];
      for (const [state, stateData] of stateMap) {
        const stateSlug = state.toLowerCase().replace(/\s+/g, '-');
        hubRows.push({
          key: `state-${stateSlug}`,
          type: 'state',
          state_ut: state,
          resultCount: stateData.count,
          hasHeroImage: stateData.hasImage,
          hasBoardLogo: false,
          status: 'idle',
        });

        for (const [board, boardData] of stateData.boards) {
          hubRows.push({
            key: `board-${stateSlug}-${board.toLowerCase().replace(/\s+/g, '-')}`,
            type: 'board',
            state_ut: state,
            board_name: board,
            resultCount: boardData.count,
            hasHeroImage: boardData.hasImage,
            hasBoardLogo: false,
            status: 'idle',
          });
        }
      }

      setHubs(hubRows);
      toast({ title: `Found ${stateMap.size} states, ${hubRows.filter(h => h.type === 'board').length} boards` });
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Generate image for a hub page
  const generateHubImage = useCallback(async (hub: HubRow, purpose: 'hero' | 'board-logo') => {
    setGenerating(prev => new Set(prev).add(`${hub.key}-${purpose}`));
    setHubs(prev => prev.map(h => h.key === hub.key ? { ...h, status: 'generating-image' } : h));

    try {
      const { data, error } = await supabase.functions.invoke('generate-board-result-image', {
        body: {
          imageModel,
          pageType: purpose === 'board-logo' ? 'board-logo' : hub.type,
          slug: hub.key,
          state_ut: hub.state_ut,
          board_name: hub.board_name || '',
          variant: '',
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Image generation failed');

      setHubs(prev => prev.map(h => {
        if (h.key !== hub.key) return h;
        return {
          ...h,
          status: 'done',
          ...(purpose === 'hero' ? { imageUrl: data.imageUrl, hasHeroImage: true } : { logoUrl: data.imageUrl, hasBoardLogo: true }),
        };
      }));

      toast({ title: `${purpose === 'hero' ? 'Hero image' : 'Board logo'} generated`, description: `Model: ${data.model}` });
    } catch (e: any) {
      setHubs(prev => prev.map(h => h.key === hub.key ? { ...h, status: 'error', error: e.message } : h));
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(prev => { const n = new Set(prev); n.delete(`${hub.key}-${purpose}`); return n; });
    }
  }, [imageModel, toast]);

  const stateHubs = hubs.filter(h => h.type === 'state');
  const boardHubs = hubs.filter(h => h.type === 'board');

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Hub Page Generator
          </h3>
          <p className="text-sm text-muted-foreground">
            Generate hero images and board logos for state &amp; board hub pages from existing result pages
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <AiModelSelector value={imageModel} onValueChange={setImageModel} capability="image" triggerClassName="w-[180px]" size="sm" />
          <Button onClick={scanHubs} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            Scan Published Pages
          </Button>
        </div>
      </div>

      {hubs.length > 0 && (
        <>
          {/* Stats */}
          <div className="flex gap-3">
            <Badge variant="outline" className="text-xs">{stateHubs.length} States</Badge>
            <Badge variant="outline" className="text-xs">{boardHubs.length} Boards</Badge>
            <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 text-xs">
              {hubs.reduce((s, h) => s + h.resultCount, 0)} total result pages
            </Badge>
          </div>

          {/* State Hubs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">State Hub Pages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="w-20 text-center">Results</TableHead>
                    <TableHead className="w-20 text-center">Hero</TableHead>
                    <TableHead className="w-16 text-center">Status</TableHead>
                    <TableHead className="text-right w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateHubs.map(hub => (
                    <TableRow key={hub.key}>
                      <TableCell className="text-sm font-medium">{hub.state_ut}</TableCell>
                      <TableCell className="text-center text-xs">{hub.resultCount}</TableCell>
                      <TableCell className="text-center text-xs">
                        {hub.hasHeroImage ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hub.status === 'generating-image' && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />}
                        {hub.status === 'done' && <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />}
                        {hub.status === 'error' && <XCircle className="h-4 w-4 text-destructive mx-auto" />}
                        {hub.status === 'idle' && <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            disabled={generating.has(`${hub.key}-hero`)}
                            onClick={() => generateHubImage(hub, 'hero')}
                          >
                            <ImageIcon className="h-3 w-3 mr-1" /> Hero
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => window.open(`/results/${hub.state_ut.toLowerCase().replace(/\s+/g, '-')}`, '_blank')}
                          >
                            <Globe className="h-3 w-3 mr-1" /> View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Board Hubs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Board Hub Pages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Board</TableHead>
                    <TableHead className="w-20 text-center">Results</TableHead>
                    <TableHead className="w-16 text-center">Hero</TableHead>
                    <TableHead className="w-16 text-center">Logo</TableHead>
                    <TableHead className="w-16 text-center">Status</TableHead>
                    <TableHead className="text-right w-48">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boardHubs.map(hub => (
                    <TableRow key={hub.key}>
                      <TableCell className="text-xs text-muted-foreground">{hub.state_ut}</TableCell>
                      <TableCell className="text-sm font-medium">{hub.board_name}</TableCell>
                      <TableCell className="text-center text-xs">{hub.resultCount}</TableCell>
                      <TableCell className="text-center text-xs">
                        {hub.hasHeroImage ? <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {hub.hasBoardLogo ? <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {hub.status === 'generating-image' && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />}
                        {hub.status === 'done' && <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />}
                        {hub.status === 'error' && <XCircle className="h-4 w-4 text-destructive mx-auto" />}
                        {hub.status === 'idle' && <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            disabled={generating.has(`${hub.key}-hero`)}
                            onClick={() => generateHubImage(hub, 'hero')}
                          >
                            <ImageIcon className="h-3 w-3 mr-1" /> Hero
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            disabled={generating.has(`${hub.key}-board-logo`)}
                            onClick={() => generateHubImage(hub, 'board-logo')}
                          >
                            🏛️ Logo
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => {
                              const stateSlug = hub.state_ut.toLowerCase().replace(/\s+/g, '-');
                              const boardSlug = (hub.board_name || '').toLowerCase().replace(/\s+/g, '-');
                              window.open(`/results/${stateSlug}/${boardSlug}`, '_blank');
                            }}
                          >
                            <Globe className="h-3 w-3 mr-1" /> View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {hubs.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No hubs discovered yet</p>
            <p className="text-sm mt-1">Click "Scan Published Pages" to discover state &amp; board hubs from your published result pages.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
