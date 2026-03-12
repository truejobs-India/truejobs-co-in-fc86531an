import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { showErrorModal } from '@/components/ui/error-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Award,
  Zap,
  FileSearch,
  Lightbulb
} from 'lucide-react';

interface ScoreDetails {
  overallScore: number;
  categories: {
    skillsMatch: { score: number; feedback: string };
    experienceMatch: { score: number; feedback: string };
    educationMatch: { score: number; feedback: string };
    keywordsMatch: { score: number; feedback: string };
    presentationQuality: { score: number; feedback: string };
  };
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  atsCompatibility: string;
  recommendedActions: string[];
}

export function ResumeScoring() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scoreDetails, setScoreDetails] = useState<ScoreDetails | null>(null);

  const analyzeResume = async () => {
    if (!jobTitle || !company) {
      showErrorModal('Please fill in job title and company', 'Missing Information');
      return;
    }
    if (!user) return;
    
    setIsAnalyzing(true);
    setScoreDetails(null);

    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'score_resume',
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
      let parsed: ScoreDetails;
      try {
        // Remove any markdown code blocks if present
        const cleanResponse = data.response.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response:', data.response);
        throw new Error('Failed to parse score results');
      }

      setScoreDetails(parsed);
      toast({ title: 'Resume analyzed successfully!' });
    } catch (error) {
      console.error('Score error:', error);
      showErrorModal(
        error instanceof Error ? error.message : 'Failed to analyze resume',
        'Analysis Failed'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getATSBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Resume Scoring</CardTitle>
            <CardDescription>
              Analyze your resume against job descriptions to see how well you match
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="score-job-title">Job Title *</Label>
              <Input
                id="score-job-title"
                placeholder="e.g. Senior Software Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score-company">Company *</Label>
              <Input
                id="score-company"
                placeholder="e.g. Google"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="score-job-desc">Job Description (recommended for accurate scoring)</Label>
            <Textarea
              id="score-job-desc"
              placeholder="Paste the full job description here for the most accurate analysis..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={5}
            />
          </div>
          <Button onClick={analyzeResume} disabled={isAnalyzing} className="w-full">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Resume...
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4 mr-2" />
                Analyze My Resume
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        {scoreDetails && (
          <ScrollArea className="h-[500px]">
            <div className="space-y-6 pr-4">
              {/* Overall Score */}
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border">
                <p className="text-sm text-muted-foreground mb-2">Overall Match Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(scoreDetails.overallScore)}`}>
                  {scoreDetails.overallScore}%
                </p>
                <Badge className={`mt-3 ${getATSBadgeColor(scoreDetails.atsCompatibility)}`}>
                  ATS Compatibility: {scoreDetails.atsCompatibility}
                </Badge>
              </div>

              {/* Category Scores */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Detailed Scores
                </h3>
                
                {Object.entries(scoreDetails.categories).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={`font-medium ${getScoreColor(value.score)}`}>{value.score}%</span>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`absolute inset-y-0 left-0 ${getScoreBarColor(value.score)} rounded-full transition-all duration-500`}
                        style={{ width: `${value.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{value.feedback}</p>
                  </div>
                ))}
              </div>

              {/* Missing Keywords */}
              {scoreDetails.missingKeywords.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Missing Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {scoreDetails.missingKeywords.map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Consider adding these keywords to improve your ATS score
                  </p>
                </div>
              )}

              {/* Strengths */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Your Strengths
                </h3>
                <ul className="space-y-2">
                  {scoreDetails.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Zap className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvements */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {scoreDetails.improvements.map((improvement, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Actions */}
              <div className="space-y-3 bg-primary/5 rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Recommended Actions
                </h3>
                <ol className="space-y-2 list-decimal list-inside">
                  {scoreDetails.recommendedActions.map((action, idx) => (
                    <li key={idx} className="text-sm">{action}</li>
                  ))}
                </ol>
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
