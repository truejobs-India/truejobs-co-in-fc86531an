import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { Contest, ContestEntry, TargetAudience, EngagementStatus } from '@/types/engagement';
import { Plus, Trash2, Eye, Share2, Trophy, Loader2, Award } from 'lucide-react';
import { format } from 'date-fns';

interface ContestWithEntries extends Contest {
  entry_count?: number;
}

export function ContestsManager() {
  const { toast } = useToast();
  const [contests, setContests] = useState<ContestWithEntries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContest, setSelectedContest] = useState<ContestWithEntries | null>(null);
  const [showEntries, setShowEntries] = useState(false);
  const [contestEntries, setContestEntries] = useState<(ContestEntry & { profile?: { full_name: string; email: string } })[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rules: '',
    prizes: '',
    target_audience: 'all' as TargetAudience,
    starts_at: '',
    ends_at: '',
    max_entries: '',
  });

  useEffect(() => {
    fetchContests();
  }, []);

  const fetchContests = async () => {
    try {
      const { data: contestsData, error } = await supabase
        .from('contests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const contestsWithCounts = await Promise.all(
        (contestsData || []).map(async (contest) => {
          const { count } = await supabase
            .from('contest_entries')
            .select('id', { count: 'exact', head: true })
            .eq('contest_id', contest.id);
          return { ...contest, entry_count: count || 0 } as ContestWithEntries;
        })
      );

      setContests(contestsWithCounts);
    } catch (error) {
      console.error('Error fetching contests:', error);
      toast({ title: 'Error', description: 'Failed to load contests', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('contests')
        .insert({
          title: formData.title,
          description: formData.description || null,
          rules: formData.rules || null,
          prizes: formData.prizes || null,
          target_audience: formData.target_audience,
          starts_at: formData.starts_at || null,
          ends_at: formData.ends_at || null,
          max_entries: formData.max_entries ? parseInt(formData.max_entries) : null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({ title: 'Success', description: 'Contest created successfully' });
      setIsDialogOpen(false);
      resetForm();
      fetchContests();
    } catch (error) {
      console.error('Error creating contest:', error);
      toast({ title: 'Error', description: 'Failed to create contest', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (contestId: string, newStatus: EngagementStatus) => {
    try {
      const { error } = await supabase
        .from('contests')
        .update({ status: newStatus })
        .eq('id', contestId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Contest status updated' });
      fetchContests();
    } catch (error) {
      console.error('Error updating contest:', error);
      toast({ title: 'Error', description: 'Failed to update contest', variant: 'destructive' });
    }
  };

  const handleDelete = async (contestId: string) => {
    if (!confirm('Are you sure you want to delete this contest?')) return;

    try {
      const { error } = await supabase.from('contests').delete().eq('id', contestId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Contest deleted' });
      fetchContests();
    } catch (error) {
      console.error('Error deleting contest:', error);
      toast({ title: 'Error', description: 'Failed to delete contest', variant: 'destructive' });
    }
  };

  const viewEntries = async (contest: ContestWithEntries) => {
    setSelectedContest(contest);
    try {
      const { data: entries, error } = await supabase
        .from('contest_entries')
        .select('*')
        .eq('contest_id', contest.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile info for each entry
      const entriesWithProfiles = await Promise.all(
        (entries || []).map(async (entry) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', entry.user_id)
            .single();
          return { ...entry, profile };
        })
      );

      setContestEntries(entriesWithProfiles);
      setShowEntries(true);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast({ title: 'Error', description: 'Failed to load entries', variant: 'destructive' });
    }
  };

  const markWinner = async (entryId: string, isWinner: boolean) => {
    try {
      const { error } = await supabase
        .from('contest_entries')
        .update({ is_winner: isWinner })
        .eq('id', entryId);

      if (error) throw error;
      
      setContestEntries(prev => 
        prev.map(e => e.id === entryId ? { ...e, is_winner: isWinner } : e)
      );
      toast({ title: 'Success', description: isWinner ? 'Winner marked' : 'Winner status removed' });
    } catch (error) {
      console.error('Error updating winner:', error);
      toast({ title: 'Error', description: 'Failed to update winner', variant: 'destructive' });
    }
  };

  const shareResults = async (contestId: string) => {
    try {
      const { error } = await supabase
        .from('contests')
        .update({ 
          is_results_public: true, 
          results_shared_at: new Date().toISOString() 
        })
        .eq('id', contestId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Results shared with participants' });
      fetchContests();
    } catch (error) {
      console.error('Error sharing results:', error);
      toast({ title: 'Error', description: 'Failed to share results', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      rules: '',
      prizes: '',
      target_audience: 'all',
      starts_at: '',
      ends_at: '',
      max_entries: '',
    });
  };

  const getStatusBadge = (status: EngagementStatus) => {
    const variants: Record<EngagementStatus, string> = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
      archived: 'bg-yellow-100 text-yellow-800',
    };
    return <Badge className={variants[status]}>{status}</Badge>;
  };

  const getAudienceBadge = (audience: TargetAudience) => {
    const labels: Record<TargetAudience, string> = {
      candidate: 'Candidates',
      employer: 'HR/Employers',
      all: 'Everyone',
    };
    return <Badge variant="outline">{labels[audience]}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Contests Manager
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Contest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Contest</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Contest name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this contest about?"
                />
              </div>
              <div>
                <Label>Rules</Label>
                <Textarea
                  value={formData.rules}
                  onChange={(e) => setFormData(prev => ({ ...prev, rules: e.target.value }))}
                  placeholder="Contest rules and guidelines"
                />
              </div>
              <div>
                <Label>Prizes</Label>
                <Textarea
                  value={formData.prizes}
                  onChange={(e) => setFormData(prev => ({ ...prev, prizes: e.target.value }))}
                  placeholder="What can winners earn?"
                />
              </div>
              <div>
                <Label>Target Audience</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, target_audience: v as TargetAudience }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="candidate">Candidates Only</SelectItem>
                    <SelectItem value="employer">HR/Employers Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Max Entries (optional)</Label>
                <Input
                  type="number"
                  value={formData.max_entries}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_entries: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Contest
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {contests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No contests created yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contests.map((contest) => (
                <TableRow key={contest.id}>
                  <TableCell className="font-medium">{contest.title}</TableCell>
                  <TableCell>{getAudienceBadge(contest.target_audience)}</TableCell>
                  <TableCell>
                    <Select
                      value={contest.status}
                      onValueChange={(v) => handleStatusChange(contest.id, v as EngagementStatus)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{contest.entry_count}</TableCell>
                  <TableCell>{format(new Date(contest.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => viewEntries(contest)} title="View Entries">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => shareResults(contest.id)}
                        title="Share Results"
                        disabled={contest.is_results_public}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contest.id)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Entries Dialog */}
        <Dialog open={showEntries} onOpenChange={setShowEntries}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Contest Entries: {selectedContest?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {contestEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No entries yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Submission</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contestEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.profile?.full_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{entry.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entry.submission_text || entry.submission_url || 'No submission'}
                        </TableCell>
                        <TableCell>{entry.score ?? '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant={entry.is_winner ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => markWinner(entry.id, !entry.is_winner)}
                          >
                            <Award className="h-4 w-4 mr-1" />
                            {entry.is_winner ? 'Winner' : 'Mark Winner'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
