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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Poll, PollOption, TargetAudience, EngagementStatus } from '@/types/engagement';
import { Plus, Trash2, Eye, Share2, BarChart3, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';

interface PollWithOptions extends Poll {
  poll_options: PollOption[];
  response_count?: number;
}

export function PollsManager() {
  const { toast } = useToast();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<PollWithOptions | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [pollResults, setPollResults] = useState<{ option_id: string; option_text: string; count: number }[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_audience: 'all' as TargetAudience,
    starts_at: '',
    ends_at: '',
    options: ['', ''],
  });

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const { data: pollsData, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch options and response counts for each poll
      const pollsWithDetails = await Promise.all(
        (pollsData || []).map(async (poll) => {
          const [optionsResult, responsesResult] = await Promise.all([
            supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('display_order'),
            supabase.from('poll_responses').select('id', { count: 'exact', head: true }).eq('poll_id', poll.id),
          ]);
          return {
            ...poll,
            poll_options: optionsResult.data || [],
            response_count: responsesResult.count || 0,
          } as PollWithOptions;
        })
      );

      setPolls(pollsWithDetails);
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast({ title: 'Error', description: 'Failed to load polls', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || formData.options.filter(o => o.trim()).length < 2) {
      toast({ title: 'Error', description: 'Title and at least 2 options are required', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          title: formData.title,
          description: formData.description || null,
          target_audience: formData.target_audience,
          starts_at: formData.starts_at || null,
          ends_at: formData.ends_at || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Create options
      const optionsToInsert = formData.options
        .filter(o => o.trim())
        .map((option, index) => ({
          poll_id: poll.id,
          option_text: option.trim(),
          display_order: index,
        }));

      const { error: optionsError } = await supabase
        .from('poll_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      toast({ title: 'Success', description: 'Poll created successfully' });
      setIsDialogOpen(false);
      resetForm();
      fetchPolls();
    } catch (error) {
      console.error('Error creating poll:', error);
      toast({ title: 'Error', description: 'Failed to create poll', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (pollId: string, newStatus: EngagementStatus) => {
    try {
      const { error } = await supabase
        .from('polls')
        .update({ status: newStatus })
        .eq('id', pollId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Poll status updated' });
      fetchPolls();
    } catch (error) {
      console.error('Error updating poll:', error);
      toast({ title: 'Error', description: 'Failed to update poll', variant: 'destructive' });
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll?')) return;

    try {
      const { error } = await supabase.from('polls').delete().eq('id', pollId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Poll deleted' });
      fetchPolls();
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast({ title: 'Error', description: 'Failed to delete poll', variant: 'destructive' });
    }
  };

  const viewResults = async (poll: PollWithOptions) => {
    setSelectedPoll(poll);
    try {
      const { data: responses, error } = await supabase
        .from('poll_responses')
        .select('option_id')
        .eq('poll_id', poll.id);

      if (error) throw error;

      const counts: Record<string, number> = {};
      responses?.forEach(r => {
        counts[r.option_id] = (counts[r.option_id] || 0) + 1;
      });

      const results = poll.poll_options.map(opt => ({
        option_id: opt.id,
        option_text: opt.option_text,
        count: counts[opt.id] || 0,
      }));

      setPollResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Error fetching results:', error);
      toast({ title: 'Error', description: 'Failed to load results', variant: 'destructive' });
    }
  };

  const shareResults = async (pollId: string) => {
    try {
      const { error } = await supabase
        .from('polls')
        .update({ 
          is_results_public: true, 
          results_shared_at: new Date().toISOString() 
        })
        .eq('id', pollId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Results shared with participants' });
      fetchPolls();
    } catch (error) {
      console.error('Error sharing results:', error);
      toast({ title: 'Error', description: 'Failed to share results', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      target_audience: 'all',
      starts_at: '',
      ends_at: '',
      options: ['', ''],
    });
  };

  const addOption = () => {
    setFormData(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }));
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
      employer: 'Employers',
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
          <BarChart3 className="h-5 w-5" />
          Polls Manager
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Poll
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Poll</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="What's your poll question?"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
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
                    <SelectItem value="employer">Employers Only</SelectItem>
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
                <Label>Options *</Label>
                <div className="space-y-2 mt-2">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      {formData.options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Poll
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {polls.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No polls created yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polls.map((poll) => (
                <TableRow key={poll.id}>
                  <TableCell className="font-medium">{poll.title}</TableCell>
                  <TableCell>{getAudienceBadge(poll.target_audience)}</TableCell>
                  <TableCell>
                    <Select
                      value={poll.status}
                      onValueChange={(v) => handleStatusChange(poll.id, v as EngagementStatus)}
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
                  <TableCell>{poll.response_count}</TableCell>
                  <TableCell>{format(new Date(poll.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => viewResults(poll)} title="View Results">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => shareResults(poll.id)}
                        title="Share Results"
                        disabled={poll.is_results_public}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(poll.id)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Results Dialog */}
        <Dialog open={showResults} onOpenChange={setShowResults}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Poll Results: {selectedPoll?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {pollResults.map((result) => {
                const total = pollResults.reduce((sum, r) => sum + r.count, 0);
                const percentage = total > 0 ? Math.round((result.count / total) * 100) : 0;
                return (
                  <div key={result.option_id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{result.option_text}</span>
                      <span>{result.count} votes ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {pollResults.length === 0 && (
                <p className="text-center text-muted-foreground">No responses yet</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
