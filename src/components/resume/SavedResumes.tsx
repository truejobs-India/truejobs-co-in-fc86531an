import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FolderOpen, 
  Plus, 
  Loader2, 
  Trash2, 
  Star, 
  StarOff,
  FileText,
  Calendar,
  Target,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SavedResume {
  id: string;
  user_id: string;
  name: string;
  template_style: string;
  custom_summary: string | null;
  custom_skills: string[] | null;
  target_job_title: string | null;
  target_company: string | null;
  score: number | null;
  score_details: Record<string, unknown> | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface SavedResumesProps {
  onSelectResume?: (resume: SavedResume) => void;
}

export function SavedResumes({ onSelectResume }: SavedResumesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // New resume form
  const [newResumeName, setNewResumeName] = useState('');
  const [newResumeTemplate, setNewResumeTemplate] = useState('professional');
  const [newResumeJobTitle, setNewResumeJobTitle] = useState('');
  const [newResumeCompany, setNewResumeCompany] = useState('');

  useEffect(() => {
    if (user) {
      fetchResumes();
    }
  }, [user]);

  const fetchResumes = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('saved_resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setResumes((data || []) as SavedResume[]);
    } catch (error) {
      console.error('Error fetching resumes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load saved resumes',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createResume = async () => {
    if (!user || !newResumeName.trim()) {
      toast({ title: 'Please enter a resume name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('saved_resumes')
        .insert({
          user_id: user.id,
          name: newResumeName.trim(),
          template_style: newResumeTemplate,
          target_job_title: newResumeJobTitle || null,
          target_company: newResumeCompany || null,
          is_default: resumes.length === 0 // First resume is default
        })
        .select()
        .single();

      if (error) throw error;

      setResumes(prev => [data as SavedResume, ...prev]);
      setIsDialogOpen(false);
      setNewResumeName('');
      setNewResumeJobTitle('');
      setNewResumeCompany('');
      
      toast({ title: 'Resume version created!' });
    } catch (error) {
      console.error('Error creating resume:', error);
      toast({
        title: 'Error',
        description: 'Failed to create resume',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteResume = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_resumes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setResumes(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Resume deleted' });
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete resume',
        variant: 'destructive'
      });
    }
  };

  const toggleDefault = async (id: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from('saved_resumes')
        .update({ is_default: false })
        .eq('user_id', user?.id);

      // Then set the new default
      const { error } = await supabase
        .from('saved_resumes')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      setResumes(prev => prev.map(r => ({
        ...r,
        is_default: r.id === id
      })));
      
      toast({ title: 'Default resume updated' });
    } catch (error) {
      console.error('Error updating default:', error);
      toast({
        title: 'Error',
        description: 'Failed to update default resume',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTemplateColor = (style: string) => {
    switch (style) {
      case 'professional': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'modern': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'minimal': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'creative': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Saved Resumes</CardTitle>
              <CardDescription>
                Manage multiple resume versions for different applications
              </CardDescription>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Version
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Resume Version</DialogTitle>
                <DialogDescription>
                  Create a new resume version tailored for a specific job application
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="resume-name">Resume Name *</Label>
                  <Input
                    id="resume-name"
                    placeholder="e.g. Google SWE Resume"
                    value={newResumeName}
                    onChange={(e) => setNewResumeName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="resume-template">Template Style</Label>
                  <Select value={newResumeTemplate} onValueChange={setNewResumeTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="target-job">Target Job Title</Label>
                    <Input
                      id="target-job"
                      placeholder="e.g. Software Engineer"
                      value={newResumeJobTitle}
                      onChange={(e) => setNewResumeJobTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target-company">Target Company</Label>
                    <Input
                      id="target-company"
                      placeholder="e.g. Google"
                      value={newResumeCompany}
                      onChange={(e) => setNewResumeCompany(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createResume} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Resume'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {resumes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No saved resumes yet</p>
            <p className="text-sm mt-1">Create your first resume version to get started</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                    resume.is_default ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => onSelectResume?.(resume)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{resume.name}</h4>
                          {resume.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Default
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-xs ${getTemplateColor(resume.template_style)}`}>
                            {resume.template_style}
                          </Badge>
                          
                          {resume.target_job_title && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {resume.target_job_title}
                              {resume.target_company && ` @ ${resume.target_company}`}
                            </span>
                          )}
                          
                          {resume.score && (
                            <Badge 
                              variant="outline" 
                              className={
                                resume.score >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                                resume.score >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }
                            >
                              Score: {resume.score}%
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Updated {formatDate(resume.updated_at)}
                        </p>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          toggleDefault(resume.id);
                        }}>
                          {resume.is_default ? (
                            <>
                              <StarOff className="h-4 w-4 mr-2" />
                              Remove Default
                            </>
                          ) : (
                            <>
                              <Star className="h-4 w-4 mr-2" />
                              Set as Default
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteResume(resume.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
