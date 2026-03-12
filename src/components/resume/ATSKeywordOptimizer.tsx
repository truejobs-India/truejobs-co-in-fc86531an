import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Target,
  TrendingUp,
  Copy,
  Check,
  Lightbulb,
  Plus
} from 'lucide-react';

interface ATSKeyword {
  keyword: string;
  category: string;
  priority: string;
  reason: string;
}

interface SkillGap {
  skill: string;
  importance: string;
  suggestion: string;
}

interface ATSAnalysis {
  mustHaveKeywords: ATSKeyword[];
  niceToHaveKeywords: ATSKeyword[];
  currentMatches: string[];
  keywordDensityTips: string[];
  industryTerms: string[];
  actionVerbs: string[];
  skillGaps: SkillGap[];
  optimizedHeadline: string;
  overallATSScore: number;
}

interface ATSKeywordOptimizerProps {
  onAddSkills?: (skills: string[]) => void;
}

export function ATSKeywordOptimizer({ onAddSkills }: ATSKeywordOptimizerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ATSAnalysis | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  const analyzeKeywords = async () => {
    if (!jobDescription.trim()) {
      toast({ title: 'Please enter a job description', variant: 'destructive' });
      return;
    }
    if (!user) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'ats_keywords',
          userId: user.id,
          data: {
            jobTitle,
            company,
            jobDescription
          }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Parse the JSON response
      let parsed: ATSAnalysis;
      try {
        const cleanResponse = data.response.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response:', data.response);
        throw new Error('Failed to parse keyword analysis');
      }

      setAnalysis(parsed);
      toast({ title: 'Keyword analysis complete!' });
    } catch (error) {
      console.error('ATS analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze keywords',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copied to clipboard!' });
  };

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyword)) {
        newSet.delete(keyword);
      } else {
        newSet.add(keyword);
      }
      return newSet;
    });
  };

  const addSelectedToProfile = async () => {
    if (selectedKeywords.size === 0) {
      toast({ title: 'Please select keywords to add', variant: 'destructive' });
      return;
    }

    if (!profile) return;

    try {
      const existingSkills = profile.skills || [];
      const newSkills = [...new Set([...existingSkills, ...Array.from(selectedKeywords)])];

      const { error } = await supabase
        .from('profiles')
        .update({ skills: newSkills })
        .eq('id', profile.id);

      if (error) throw error;

      onAddSkills?.(Array.from(selectedKeywords));
      setSelectedKeywords(new Set());
      toast({ title: `Added ${selectedKeywords.size} keywords to your profile!` });
    } catch (error) {
      console.error('Error adding skills:', error);
      toast({
        title: 'Error',
        description: 'Failed to add keywords to profile',
        variant: 'destructive'
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'technical': return '💻';
      case 'soft': return '🤝';
      case 'industry': return '🏢';
      case 'tool': return '🔧';
      default: return '📌';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>ATS Keyword Optimizer</CardTitle>
            <CardDescription>
              Analyze job descriptions and get keyword suggestions to beat ATS systems
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ats-job-title">Job Title</Label>
              <Input
                id="ats-job-title"
                placeholder="e.g. Senior Software Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ats-company">Company</Label>
              <Input
                id="ats-company"
                placeholder="e.g. Google"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ats-job-desc">Job Description *</Label>
            <Textarea
              id="ats-job-desc"
              placeholder="Paste the complete job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
            />
          </div>
          <Button onClick={analyzeKeywords} disabled={isAnalyzing} className="w-full">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Keywords...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Analyze for ATS Keywords
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        {analysis && (
          <ScrollArea className="h-[500px]">
            <div className="space-y-6 pr-4">
              {/* ATS Score */}
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border">
                <p className="text-sm text-muted-foreground mb-2">Current ATS Compatibility</p>
                <p className={`text-5xl font-bold ${getScoreColor(analysis.overallATSScore)}`}>
                  {analysis.overallATSScore}%
                </p>
                <Progress value={analysis.overallATSScore} className="mt-4 h-2" />
              </div>

              {/* Optimized Headline */}
              {analysis.optimizedHeadline && (
                <div className="p-4 rounded-lg border bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Suggested ATS-Optimized Headline
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(analysis.optimizedHeadline, 'headline')}
                    >
                      {copied === 'headline' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm font-medium">{analysis.optimizedHeadline}</p>
                </div>
              )}

              {/* Current Matches */}
              {analysis.currentMatches.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Keywords Already in Your Profile ({analysis.currentMatches.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.currentMatches.map((keyword, idx) => (
                      <Badge key={idx} className="bg-green-100 text-green-700 border-green-200">
                        ✓ {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Must-Have Keywords */}
              {analysis.mustHaveKeywords.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Must-Have Keywords
                    </h3>
                    {selectedKeywords.size > 0 && (
                      <Button size="sm" onClick={addSelectedToProfile}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add {selectedKeywords.size} to Profile
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {analysis.mustHaveKeywords.map((kw, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleKeyword(kw.keyword)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedKeywords.has(kw.keyword)
                            ? 'border-primary bg-primary/10'
                            : 'hover:border-muted-foreground/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{getCategoryIcon(kw.category)}</span>
                            <span className="font-medium">{kw.keyword}</span>
                            <Badge variant="outline" className={`text-xs ${getPriorityColor(kw.priority)}`}>
                              {kw.priority}
                            </Badge>
                          </div>
                          {selectedKeywords.has(kw.keyword) && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{kw.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nice-to-Have Keywords */}
              {analysis.niceToHaveKeywords.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Nice-to-Have Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.niceToHaveKeywords.map((kw, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`cursor-pointer transition-all ${
                          selectedKeywords.has(kw.keyword)
                            ? 'border-primary bg-primary/10'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => toggleKeyword(kw.keyword)}
                      >
                        {getCategoryIcon(kw.category)} {kw.keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Verbs */}
              {analysis.actionVerbs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Powerful Action Verbs for This Role
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.actionVerbs.map((verb, idx) => (
                      <Badge key={idx} variant="secondary">
                        {verb}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Industry Terms */}
              {analysis.industryTerms.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    Industry-Specific Terms
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.industryTerms.map((term, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`cursor-pointer ${
                          selectedKeywords.has(term) ? 'border-primary bg-primary/10' : ''
                        }`}
                        onClick={() => toggleKeyword(term)}
                      >
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Skill Gaps */}
              {analysis.skillGaps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Skill Gaps to Address
                  </h3>
                  <div className="space-y-2">
                    {analysis.skillGaps.map((gap, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-amber-800">{gap.skill}</span>
                          <Badge variant="outline" className={getPriorityColor(gap.importance)}>
                            {gap.importance}
                          </Badge>
                        </div>
                        <p className="text-sm text-amber-700">{gap.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              {analysis.keywordDensityTips.length > 0 && (
                <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Keyword Optimization Tips
                  </h3>
                  <ul className="space-y-2">
                    {analysis.keywordDensityTips.map((tip, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
