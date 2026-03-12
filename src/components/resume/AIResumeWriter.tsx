import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { showErrorModal } from '@/components/ui/error-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResumeTemplates } from './ResumeTemplates';
// jsPDF is dynamically imported to reduce initial bundle size
import { 
  Sparkles, 
  FileText, 
  Briefcase, 
  GraduationCap, 
  Loader2, 
  Copy, 
  Check,
  MessageSquare,
  Send,
  Download,
  Users,
  HelpCircle,
  LayoutTemplate
} from 'lucide-react';

export function AIResumeWriter() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  // Summary generation
  const [summary, setSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Experience improvement
  const [expJobTitle, setExpJobTitle] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [improvedExp, setImprovedExp] = useState('');
  const [isImprovingExp, setIsImprovingExp] = useState(false);
  
  // Cover letter
  const [clJobTitle, setClJobTitle] = useState('');
  const [clCompany, setClCompany] = useState('');
  const [clJobDescription, setClJobDescription] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);
  
  // Interview prep
  const [intJobTitle, setIntJobTitle] = useState('');
  const [intCompany, setIntCompany] = useState('');
  const [intJobDescription, setIntJobDescription] = useState('');
  const [interviewQuestions, setInterviewQuestions] = useState('');
  const [isGeneratingInt, setIsGeneratingInt] = useState(false);
  
  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  
  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copied to clipboard!' });
  };

  const generateSummary = async () => {
    if (!user) return;
    setIsGeneratingSummary(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: { action: 'generate_summary', userId: user.id }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setSummary(data.response);
      toast({ title: 'Summary generated!' });
    } catch (error) {
      showErrorModal(
        error instanceof Error ? error.message : 'Failed to generate summary',
        'Generation Failed'
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const improveExperience = async () => {
    if (!expJobTitle || !expCompany) {
      showErrorModal('Please fill in job title and company', 'Missing Information');
      return;
    }
    setIsImprovingExp(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'improve_experience',
          data: {
            jobTitle: expJobTitle,
            company: expCompany,
            description: expDescription
          }
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setImprovedExp(data.response);
      toast({ title: 'Experience improved!' });
    } catch (error) {
      showErrorModal(
        error instanceof Error ? error.message : 'Failed to improve experience',
        'Improvement Failed'
      );
    } finally {
      setIsImprovingExp(false);
    }
  };

  const generateCoverLetter = async () => {
    if (!clJobTitle || !clCompany) {
      showErrorModal('Please fill in job title and company', 'Missing Information');
      return;
    }
    if (!user) return;
    setIsGeneratingCL(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'generate_cover_letter',
          userId: user.id,
          data: {
            jobTitle: clJobTitle,
            company: clCompany,
            jobDescription: clJobDescription
          }
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setCoverLetter(data.response);
      toast({ title: 'Cover letter generated!' });
    } catch (error) {
      showErrorModal(
        error instanceof Error ? error.message : 'Failed to generate cover letter',
        'Generation Failed'
      );
    } finally {
      setIsGeneratingCL(false);
    }
  };

  const generateInterviewPrep = async () => {
    if (!intJobTitle || !intCompany) {
      showErrorModal('Please fill in job title and company', 'Missing Information');
      return;
    }
    if (!user) return;
    setIsGeneratingInt(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'interview_prep',
          userId: user.id,
          data: {
            jobTitle: intJobTitle,
            company: intCompany,
            jobDescription: intJobDescription
          }
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setInterviewQuestions(data.response);
      toast({ title: 'Interview prep generated!' });
    } catch (error) {
      showErrorModal(
        error instanceof Error ? error.message : 'Failed to generate interview prep',
        'Generation Failed'
      );
    } finally {
      setIsGeneratingInt(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    setIsChatting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'chat',
          data: { message: chatMessage }
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setChatResponse(data.response);
    } catch (error) {
      showErrorModal(
        error instanceof Error ? error.message : 'Failed to get response',
        'Chat Error'
      );
    } finally {
      setIsChatting(false);
    }
  };

  const exportToPDF = async (type: 'summary' | 'cover-letter' | 'interview') => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPos = 20;

    // Header styling
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Blue color

    if (type === 'summary') {
      doc.text('Professional Summary', margin, yPos);
      yPos += 15;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      const lines = doc.splitTextToSize(summary, maxWidth);
      doc.text(lines, margin, yPos);
      
      doc.save(`${profile?.full_name || 'resume'}_summary.pdf`);
      toast({ title: 'Summary exported to PDF!' });
    } else if (type === 'cover-letter') {
      doc.text('Cover Letter', margin, yPos);
      yPos += 15;
      
      // Add date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(new Date().toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }), margin, yPos);
      yPos += 10;
      
      // Add company info
      if (clCompany) {
        doc.text(clCompany, margin, yPos);
        yPos += 5;
      }
      if (clJobTitle) {
        doc.text(`Position: ${clJobTitle}`, margin, yPos);
        yPos += 10;
      }
      
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(coverLetter, maxWidth);
      doc.text(lines, margin, yPos);
      
      doc.save(`cover_letter_${clCompany?.replace(/\s+/g, '_') || 'company'}.pdf`);
      toast({ title: 'Cover letter exported to PDF!' });
    } else if (type === 'interview') {
      doc.text('Interview Preparation', margin, yPos);
      yPos += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${intJobTitle} at ${intCompany}`, margin, yPos);
      yPos += 15;
      
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      
      // Split questions into pages
      const lines = doc.splitTextToSize(interviewQuestions, maxWidth);
      const lineHeight = 6;
      const pageHeight = doc.internal.pageSize.getHeight();
      
      lines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        
        // Bold for question headers
        if (line.startsWith('**Question')) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(37, 99, 235);
          doc.text(line.replace(/\*\*/g, ''), margin, yPos);
        } else if (line.startsWith('**Answer')) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);
          doc.text(line.replace(/\*\*/g, ''), margin, yPos);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.text(line, margin, yPos);
        }
        yPos += lineHeight;
      });
      
      doc.save(`interview_prep_${intCompany?.replace(/\s+/g, '_') || 'company'}.pdf`);
      toast({ title: 'Interview prep exported to PDF!' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>AI Resume Writer</CardTitle>
            <CardDescription>
              Powered by AI to help you create professional resumes, cover letters, and prepare for interviews
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="templates" className="text-xs sm:text-sm">
              <LayoutTemplate className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="experience" className="text-xs sm:text-sm">
              <Briefcase className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Experience</span>
            </TabsTrigger>
            <TabsTrigger value="cover-letter" className="text-xs sm:text-sm">
              <GraduationCap className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Cover Letter</span>
            </TabsTrigger>
            <TabsTrigger value="interview" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Interview</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm">
              <MessageSquare className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Ask AI</span>
            </TabsTrigger>
          </TabsList>

          {/* Resume Templates */}
          <TabsContent value="templates">
            <ResumeTemplates />
          </TabsContent>

          {/* Professional Summary */}
          <TabsContent value="summary" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Generate a professional summary based on your profile, experience, and skills.
                Make sure your profile is complete for the best results.
              </p>
              <Button onClick={generateSummary} disabled={isGeneratingSummary}>
                {isGeneratingSummary ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
            
            {summary && (
              <div className="space-y-2">
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={6}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(summary, 'summary')}
                  >
                    {copied === 'summary' ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToPDF('summary')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Experience Improvement */}
          <TabsContent value="experience" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp-title">Job Title</Label>
                  <Input
                    id="exp-title"
                    placeholder="e.g. Software Engineer"
                    value={expJobTitle}
                    onChange={(e) => setExpJobTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-company">Company</Label>
                  <Input
                    id="exp-company"
                    placeholder="e.g. TCS"
                    value={expCompany}
                    onChange={(e) => setExpCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-desc">Current Description (optional)</Label>
                <Textarea
                  id="exp-desc"
                  placeholder="Paste your current job description or leave blank for AI to create one..."
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={improveExperience} disabled={isImprovingExp}>
                {isImprovingExp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Improve with AI
                  </>
                )}
              </Button>
            </div>
            
            {improvedExp && (
              <div className="relative">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">AI Improved</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(improvedExp, 'exp')}
                    >
                      {copied === 'exp' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{improvedExp}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Cover Letter */}
          <TabsContent value="cover-letter" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cl-title">Job Title</Label>
                  <Input
                    id="cl-title"
                    placeholder="e.g. Senior Developer"
                    value={clJobTitle}
                    onChange={(e) => setClJobTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cl-company">Company</Label>
                  <Input
                    id="cl-company"
                    placeholder="e.g. Infosys"
                    value={clCompany}
                    onChange={(e) => setClCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cl-desc">Job Description (optional)</Label>
                <Textarea
                  id="cl-desc"
                  placeholder="Paste the job description for a more tailored cover letter..."
                  value={clJobDescription}
                  onChange={(e) => setClJobDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={generateCoverLetter} disabled={isGeneratingCL}>
                {isGeneratingCL ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Cover Letter
                  </>
                )}
              </Button>
            </div>
            
            {coverLetter && (
              <div className="space-y-2">
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={12}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(coverLetter, 'cl')}
                  >
                    {copied === 'cl' ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToPDF('cover-letter')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Interview Prep */}
          <TabsContent value="interview" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">AI Interview Coach</p>
                  <p className="text-sm text-muted-foreground">
                    Get personalized interview questions and model answers based on your profile and the job you're applying for.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="int-title">Job Title</Label>
                  <Input
                    id="int-title"
                    placeholder="e.g. Full Stack Developer"
                    value={intJobTitle}
                    onChange={(e) => setIntJobTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-company">Company</Label>
                  <Input
                    id="int-company"
                    placeholder="e.g. Wipro"
                    value={intCompany}
                    onChange={(e) => setIntCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="int-desc">Job Description (optional)</Label>
                <Textarea
                  id="int-desc"
                  placeholder="Paste the job description for more relevant questions..."
                  value={intJobDescription}
                  onChange={(e) => setIntJobDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={generateInterviewPrep} disabled={isGeneratingInt}>
                {isGeneratingInt ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Generate Interview Prep
                  </>
                )}
              </Button>
            </div>
            
            {interviewQuestions && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">5 Interview Questions with Answers</Badge>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(interviewQuestions, 'interview')}
                    >
                      {copied === 'interview' ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToPDF('interview')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[400px] rounded-lg border p-4">
                  <div className="prose prose-sm max-w-none">
                    {interviewQuestions.split(/(\*\*Question \d+:.*?\*\*)/g).map((part, index) => {
                      if (part.startsWith('**Question')) {
                        return (
                          <h4 key={index} className="text-primary font-semibold mt-4 first:mt-0">
                            {part.replace(/\*\*/g, '')}
                          </h4>
                        );
                      }
                      return part.split(/(\*\*Answer:\*\*)/g).map((subPart, subIndex) => {
                        if (subPart === '**Answer:**') {
                          return <p key={`${index}-${subIndex}`} className="font-semibold text-sm mt-2">Answer:</p>;
                        }
                        return <p key={`${index}-${subIndex}`} className="text-sm text-muted-foreground whitespace-pre-wrap">{subPart}</p>;
                      });
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          {/* Chat with AI */}
          <TabsContent value="chat" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">
                Ask our AI career coach anything about resumes, interviews, or job applications!
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setChatMessage("How can I make my resume stand out?")}
                >
                  Make resume stand out
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setChatMessage("What are common resume mistakes to avoid?")}
                >
                  Common mistakes
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setChatMessage("How should I explain a career gap?")}
                >
                  Career gaps
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setChatMessage("Tips for negotiating salary?")}
                >
                  Salary negotiation
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask anything about resumes, cover letters, or job applications..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                rows={2}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <Button onClick={sendChatMessage} disabled={isChatting || !chatMessage.trim()}>
                {isChatting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {chatResponse && (
              <div className="relative bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">AI Response</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(chatResponse, 'chat')}
                  >
                    {copied === 'chat' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{chatResponse}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}