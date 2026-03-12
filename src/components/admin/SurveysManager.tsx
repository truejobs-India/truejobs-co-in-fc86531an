import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Survey, SurveyQuestion, SurveyResponse, TargetAudience, EngagementStatus } from '@/types/engagement';
import { Plus, Trash2, Eye, Share2, ClipboardList, Loader2, X, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface SurveyWithQuestions extends Survey {
  survey_questions: SurveyQuestion[];
  response_count?: number;
}

type QuestionType = 'text' | 'single_choice' | 'multiple_choice' | 'rating';

interface QuestionFormData {
  question_text: string;
  question_type: QuestionType;
  options: string[];
  is_required: boolean;
}

export function SurveysManager() {
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<SurveyWithQuestions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyWithQuestions | null>(null);
  const [showResponses, setShowResponses] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<(SurveyResponse & { profile?: { full_name: string; email: string } })[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_audience: 'all' as TargetAudience,
    is_paid: false,
    reward_amount: '',
    reward_currency: 'INR',
    starts_at: '',
    ends_at: '',
    questions: [{ question_text: '', question_type: 'text' as QuestionType, options: [], is_required: true }] as QuestionFormData[],
  });

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      const { data: surveysData, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const surveysWithDetails = await Promise.all(
        (surveysData || []).map(async (survey) => {
          const [questionsResult, responsesResult] = await Promise.all([
            supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('display_order'),
            supabase.from('survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', survey.id),
          ]);
          return {
            ...survey,
            survey_questions: questionsResult.data || [],
            response_count: responsesResult.count || 0,
          } as SurveyWithQuestions;
        })
      );

      setSurveys(surveysWithDetails);
    } catch (error) {
      console.error('Error fetching surveys:', error);
      toast({ title: 'Error', description: 'Failed to load surveys', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || formData.questions.filter(q => q.question_text.trim()).length === 0) {
      toast({ title: 'Error', description: 'Title and at least 1 question are required', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert({
          title: formData.title,
          description: formData.description || null,
          target_audience: formData.target_audience,
          is_paid: formData.is_paid,
          reward_amount: formData.is_paid && formData.reward_amount ? parseFloat(formData.reward_amount) : null,
          reward_currency: formData.reward_currency,
          starts_at: formData.starts_at || null,
          ends_at: formData.ends_at || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      // Create questions
      const questionsToInsert = formData.questions
        .filter(q => q.question_text.trim())
        .map((question, index) => ({
          survey_id: survey.id,
          question_text: question.question_text.trim(),
          question_type: question.question_type,
          options: question.options.length > 0 ? question.options : null,
          is_required: question.is_required,
          display_order: index,
        }));

      const { error: questionsError } = await supabase
        .from('survey_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast({ title: 'Success', description: 'Survey created successfully' });
      setIsDialogOpen(false);
      resetForm();
      fetchSurveys();
    } catch (error) {
      console.error('Error creating survey:', error);
      toast({ title: 'Error', description: 'Failed to create survey', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (surveyId: string, newStatus: EngagementStatus) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: newStatus })
        .eq('id', surveyId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Survey status updated' });
      fetchSurveys();
    } catch (error) {
      console.error('Error updating survey:', error);
      toast({ title: 'Error', description: 'Failed to update survey', variant: 'destructive' });
    }
  };

  const handleDelete = async (surveyId: string) => {
    if (!confirm('Are you sure you want to delete this survey?')) return;

    try {
      const { error } = await supabase.from('surveys').delete().eq('id', surveyId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Survey deleted' });
      fetchSurveys();
    } catch (error) {
      console.error('Error deleting survey:', error);
      toast({ title: 'Error', description: 'Failed to delete survey', variant: 'destructive' });
    }
  };

  const viewResponses = async (survey: SurveyWithQuestions) => {
    setSelectedSurvey(survey);
    try {
      const { data: responses, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', survey.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const responsesWithProfiles = await Promise.all(
        (responses || []).map(async (response) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', response.user_id)
            .single();
          return { 
            ...response, 
            answers: response.answers as Record<string, unknown>,
            profile 
          };
        })
      );

      setSurveyResponses(responsesWithProfiles as (SurveyResponse & { profile?: { full_name: string; email: string } })[]);
      setShowResponses(true);
    } catch (error) {
      console.error('Error fetching responses:', error);
      toast({ title: 'Error', description: 'Failed to load responses', variant: 'destructive' });
    }
  };

  const markPaid = async (responseId: string, isPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('survey_responses')
        .update({ 
          is_paid_out: isPaid, 
          paid_at: isPaid ? new Date().toISOString() : null 
        })
        .eq('id', responseId);

      if (error) throw error;
      
      setSurveyResponses(prev => 
        prev.map(r => r.id === responseId ? { ...r, is_paid_out: isPaid, paid_at: isPaid ? new Date().toISOString() : null } : r)
      );
      toast({ title: 'Success', description: isPaid ? 'Marked as paid' : 'Payment status removed' });
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({ title: 'Error', description: 'Failed to update payment status', variant: 'destructive' });
    }
  };

  const shareResults = async (surveyId: string) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ 
          is_results_public: true, 
          results_shared_at: new Date().toISOString() 
        })
        .eq('id', surveyId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Results shared with participants' });
      fetchSurveys();
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
      is_paid: false,
      reward_amount: '',
      reward_currency: 'INR',
      starts_at: '',
      ends_at: '',
      questions: [{ question_text: '', question_type: 'text', options: [], is_required: true }],
    });
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, { question_text: '', question_type: 'text', options: [], is_required: true }],
    }));
  };

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const updateQuestion = (index: number, updates: Partial<QuestionFormData>) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)),
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
          <ClipboardList className="h-5 w-5" />
          Surveys Manager (Paid & Free)
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Survey
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Survey</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Survey title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this survey about?"
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
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_paid}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_paid: checked }))}
                  />
                  <Label>Paid Survey</Label>
                </div>
                {formData.is_paid && (
                  <div className="flex gap-2 flex-1">
                    <Input
                      type="number"
                      value={formData.reward_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, reward_amount: e.target.value }))}
                      placeholder="Reward amount"
                      className="w-32"
                    />
                    <Select
                      value={formData.reward_currency}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, reward_currency: v }))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                <Label>Questions *</Label>
                <div className="space-y-4 mt-2">
                  {formData.questions.map((question, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            value={question.question_text}
                            onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                            placeholder={`Question ${index + 1}`}
                            className="flex-1"
                          />
                          {formData.questions.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeQuestion(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-4">
                          <Select
                            value={question.question_type}
                            onValueChange={(v) => updateQuestion(index, { question_type: v as QuestionType })}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text Answer</SelectItem>
                              <SelectItem value="single_choice">Single Choice</SelectItem>
                              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                              <SelectItem value="rating">Rating (1-5)</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.is_required}
                              onCheckedChange={(checked) => updateQuestion(index, { is_required: checked })}
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                        </div>
                        {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
                          <div className="pl-4">
                            <Label className="text-sm">Options (comma-separated)</Label>
                            <Input
                              value={question.options.join(', ')}
                              onChange={(e) => updateQuestion(index, { 
                                options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                              })}
                              placeholder="Option 1, Option 2, Option 3"
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </div>
              
              <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Survey
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {surveys.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No surveys created yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="font-medium">{survey.title}</TableCell>
                  <TableCell>
                    {survey.is_paid ? (
                      <Badge className="bg-green-100 text-green-800">
                        <DollarSign className="h-3 w-3 mr-1" />
                        Paid ({survey.reward_amount} {survey.reward_currency})
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Free</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getAudienceBadge(survey.target_audience)}</TableCell>
                  <TableCell>
                    <Select
                      value={survey.status}
                      onValueChange={(v) => handleStatusChange(survey.id, v as EngagementStatus)}
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
                  <TableCell>{survey.response_count}</TableCell>
                  <TableCell>{format(new Date(survey.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => viewResponses(survey)} title="View Responses">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => shareResults(survey.id)}
                        title="Share Results"
                        disabled={survey.is_results_public}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(survey.id)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Responses Dialog */}
        <Dialog open={showResponses} onOpenChange={setShowResponses}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Survey Responses: {selectedSurvey?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {surveyResponses.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No responses yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Answers</TableHead>
                      <TableHead>Submitted</TableHead>
                      {selectedSurvey?.is_paid && <TableHead>Payment</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyResponses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{response.profile?.full_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{response.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(response.answers, null, 2)}
                          </pre>
                        </TableCell>
                        <TableCell>{format(new Date(response.created_at), 'MMM d, yyyy')}</TableCell>
                        {selectedSurvey?.is_paid && (
                          <TableCell>
                            <Button
                              variant={response.is_paid_out ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => markPaid(response.id, !response.is_paid_out)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              {response.is_paid_out ? 'Paid' : 'Mark Paid'}
                            </Button>
                          </TableCell>
                        )}
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
