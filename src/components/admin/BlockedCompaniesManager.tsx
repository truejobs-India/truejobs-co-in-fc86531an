import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Search, ShieldBan, ShieldOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface BlockedCompany {
  id: string;
  normalized_name: string;
  original_name: string;
  aliases: string[];
  website_domain: string | null;
  reason: string;
  blocked_by: string | null;
  created_at: string;
  is_active: boolean;
}

export function BlockedCompaniesManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<BlockedCompany[]>([]);
  const [filtered, setFiltered] = useState<BlockedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unblockTarget, setUnblockTarget] = useState<BlockedCompany | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);

  useEffect(() => { fetchBlocked(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(items);
    } else {
      const q = search.toLowerCase();
      setFiltered(items.filter(b =>
        b.normalized_name.includes(q) ||
        b.original_name.toLowerCase().includes(q) ||
        (b.website_domain && b.website_domain.toLowerCase().includes(q))
      ));
    }
  }, [search, items]);

  const fetchBlocked = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('blocked_companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load blocked companies', variant: 'destructive' });
    } else {
      setItems((data as BlockedCompany[]) || []);
    }
    setIsLoading(false);
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setIsUnblocking(true);

    const { error } = await supabase
      .from('blocked_companies')
      .update({ is_active: false })
      .eq('id', unblockTarget.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to unblock company', variant: 'destructive' });
    } else {
      toast({ title: 'Company Unblocked', description: `${unblockTarget.original_name} can now re-register.` });
      setItems(prev => prev.map(b => b.id === unblockTarget.id ? { ...b, is_active: false } : b));
    }
    setIsUnblocking(false);
    setUnblockTarget(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-destructive" />
            Blocked Companies ({items.filter(b => b.is_active).length} active)
          </CardTitle>
          <CardDescription>
            Companies permanently removed and blocked from re-registering across all sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search blocked..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? 'No matches' : 'No blocked companies yet'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{b.original_name}</div>
                          {b.aliases.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Aliases: {b.aliases.join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.website_domain || '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {b.reason}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(b.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.is_active ? 'destructive' : 'secondary'}>
                          {b.is_active ? 'Blocked' : 'Unblocked'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {b.is_active && (
                          <Button variant="outline" size="sm" onClick={() => setUnblockTarget(b)}>
                            <ShieldOff className="h-4 w-4 mr-1" />
                            Unblock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!unblockTarget} onOpenChange={() => setUnblockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unblock Company</DialogTitle>
            <DialogDescription>
              This will allow <strong>{unblockTarget?.original_name}</strong> to re-register on the platform.
              This does NOT restore previously deleted data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblockTarget(null)}>Cancel</Button>
            <Button onClick={handleUnblock} disabled={isUnblocking}>
              {isUnblocking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldOff className="h-4 w-4 mr-1" />}
              Confirm Unblock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
