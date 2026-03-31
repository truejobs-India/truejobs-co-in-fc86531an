import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
// jsPDF is dynamically imported to reduce initial bundle size
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Target,
  Shield,
  ArrowRight,
  RefreshCw,
  Info,
  User
} from 'lucide-react';

interface Suggestion {
  section: string;
  original: string;
  improved: string;
  reason: string;
  selected: boolean;
}

interface AnalysisResult {
  overallScore: number;
  atsCompatibility: string;
  suggestions: Suggestion[];
  missingKeywords: string[];
  strengths: string[];
  criticalIssues: string[];
}

export default function ResumeChecker() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, DOC, or DOCX file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 2MB)
    if (selectedFile.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 2MB',
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);
    setAnalysisResult(null);
    setSuggestions([]);

    // Extract text from file
    setIsExtracting(true);
    try {
      const text = await extractTextFromFile(selectedFile);
      setResumeText(text);
      toast({ title: 'Resume uploaded successfully!' });
    } catch (error) {
      toast({
        title: 'Error extracting text',
        description: 'Could not read the file. Please try a different format.',
        variant: 'destructive'
      });
      setFile(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For PDF files, we'll read as text (basic extraction)
    // In production, you might want to use a proper PDF parsing library
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Basic text extraction - for PDFs this is limited
        // For better extraction, consider using pdf.js or a server-side solution
        if (file.type === 'application/pdf') {
          // Extract readable text from PDF binary
          const text = extractTextFromPDFBinary(content);
          resolve(text);
        } else {
          // For DOC/DOCX, extract plain text
          const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          resolve(text);
        }
      };
      reader.onerror = reject;
      
      if (file.type === 'application/pdf') {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const extractTextFromPDFBinary = (binary: string): string => {
    // Basic PDF text extraction - finds text between parentheses in PDF streams
    const textMatches: string[] = [];
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(binary)) !== null) {
      const text = match[1].replace(/\\[0-9]{3}/g, ' ').replace(/\\/g, '');
      if (text.length > 2 && /[a-zA-Z]/.test(text)) {
        textMatches.push(text);
      }
    }
    return textMatches.join(' ').replace(/\s+/g, ' ').trim();
  };

  const analyzeResume = async () => {
    // Wait for auth to fully load if still loading
    if (authLoading) {
      toast({ 
        title: 'Please wait', 
        description: 'Checking authentication status...',
      });
      return;
    }

    // Check if user is logged in via context first
    if (user) {
      // User is already authenticated via context, proceed
    } else {
      // Double-check with fresh session as fallback
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast({ 
          title: 'Please log in to analyze your resume', 
          description: 'You will be redirected to the login page',
          variant: 'destructive' 
        });
        navigate('/login', { state: { from: { pathname: '/tools/resume-checker' } } });
        return;
      }
    }

    if (!resumeText || resumeText.length < 50) {
      toast({ title: 'Resume text is too short for analysis', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'analyze_resume',
          data: { resumeText }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Parse the JSON response
      const cleanResponse = data.response.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);

      // Add selected flag to suggestions
      const suggestionsWithSelection = parsed.suggestions.map((s: any) => ({
        ...s,
        selected: false
      }));

      setAnalysisResult(parsed);
      setSuggestions(suggestionsWithSelection);
      toast({ title: 'Analysis complete!' });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to analyze resume',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSuggestions(prev => prev.map((s, i) => 
      i === index ? { ...s, selected: !s.selected } : s
    ));
  };

  const selectAllSuggestions = () => {
    setSuggestions(prev => prev.map(s => ({ ...s, selected: true })));
  };

  const applySelectedChanges = () => {
    const selectedSuggestions = suggestions.filter(s => s.selected);
    if (selectedSuggestions.length === 0) {
      toast({ title: 'Please select at least one suggestion', variant: 'destructive' });
      return;
    }

    // Apply selected improvements to resume text
    let improvedText = resumeText;
    selectedSuggestions.forEach(suggestion => {
      if (suggestion.original && suggestion.improved) {
        improvedText = improvedText.replace(suggestion.original, suggestion.improved);
      }
    });

    setResumeText(improvedText);
    toast({ title: `Applied ${selectedSuggestions.length} improvement(s)!` });
  };

  const generatePDF = async () => {
    if (!resumeText) return;

    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPos = 20;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Improved Resume', margin, yPos);
      yPos += 15;

      // Content
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);

      const lines = doc.splitTextToSize(resumeText, maxWidth);
      const lineHeight = 5;
      const pageHeight = doc.internal.pageSize.getHeight();

      lines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += lineHeight;
      });

      // Save to storage and get URL
      const pdfBlob = doc.output('blob');
      const fileName = `improved_resume_${Date.now()}.pdf`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(`${user?.id}/${fileName}`, pdfBlob, {
          contentType: 'application/pdf'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(`${user?.id}/${fileName}`);

      // Also download locally
      doc.save(fileName);

      toast({ 
        title: 'Resume exported!',
        description: 'Your improved resume has been downloaded.'
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Error generating PDF',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getATSBadgeColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO 
        title="AI Resume Checker & Improver"
        description="Upload your resume and get AI-powered improvement suggestions. Optimize for ATS and stand out to recruiters."
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">AI Resume Checker & Improver</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload your existing resume and get AI-powered suggestions to improve it.
            Select the changes you want and download an optimized, ATS-friendly PDF.
          </p>
        </div>

        {/* Disclaimer */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Disclaimer:</strong> AI suggestions are advisory. We do not fabricate experience or qualifications. 
            All improvements are based solely on your uploaded content.
          </AlertDescription>
        </Alert>

        {/* Login Prompt for non-authenticated users */}
        {!authLoading && !user && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">Login Required</p>
                  <p className="text-sm text-blue-700">Sign in to analyze your resume with AI</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/login', { state: { from: { pathname: '/tools/resume-checker' } } })}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Login to Continue
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Resume
              </CardTitle>
              <CardDescription>
                Supported formats: PDF, DOC, DOCX (Max 2MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      Click or drag and drop your resume here
                    </p>
                  </>
                )}
              </div>

              {isExtracting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting text from resume...
                </div>
              )}

              {resumeText && !isExtracting && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Extracted Content Preview:</p>
                    <p className="text-xs text-muted-foreground line-clamp-4">
                      {resumeText.substring(0, 500)}...
                    </p>
                  </div>

                  <Button 
                    onClick={analyzeResume} 
                    disabled={isAnalyzing}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze Resume
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Analysis Results
              </CardTitle>
              <CardDescription>
                AI-powered insights and improvement suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!analysisResult ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload and analyze your resume to see results</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-6">
                    {/* Score */}
                    <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border">
                      <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                      <p className={`text-4xl font-bold ${getScoreColor(analysisResult.overallScore)}`}>
                        {analysisResult.overallScore}%
                      </p>
                      <Badge className={`mt-2 ${getATSBadgeColor(analysisResult.atsCompatibility)}`}>
                        ATS: {analysisResult.atsCompatibility}
                      </Badge>
                    </div>

                    {/* Critical Issues */}
                    {analysisResult.criticalIssues?.length > 0 && (
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          Critical Issues
                        </h3>
                        <ul className="space-y-1">
                          {analysisResult.criticalIssues.map((issue, i) => (
                            <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                              <span>•</span> {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Strengths */}
                    {analysisResult.strengths?.length > 0 && (
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Strengths
                        </h3>
                        <ul className="space-y-1">
                          {analysisResult.strengths.map((strength, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-green-500">✓</span> {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing Keywords */}
                    {analysisResult.missingKeywords?.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Missing Keywords</h3>
                        <div className="flex flex-wrap gap-1">
                          {analysisResult.missingKeywords.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Suggestions Section */}
        {suggestions.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Improvement Suggestions
                  </CardTitle>
                  <CardDescription>
                    Select the changes you want to apply, then download your improved resume
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllSuggestions}>
                    Select All
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={applySelectedChanges}
                    disabled={!suggestions.some(s => s.selected)}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Apply Selected
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-4 transition-colors ${
                      suggestion.selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={suggestion.selected}
                        onCheckedChange={() => toggleSuggestion(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{suggestion.section}</Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-muted-foreground mb-1">Original:</p>
                            <p className="bg-red-50 dark:bg-red-950/20 p-2 rounded text-red-800 dark:text-red-200">
                              {suggestion.original || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground mb-1">Improved:</p>
                            <p className="bg-green-50 dark:bg-green-950/20 p-2 rounded text-green-800 dark:text-green-200">
                              {suggestion.improved}
                            </p>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground italic">
                          💡 {suggestion.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Download Button */}
              <div className="mt-6 flex justify-center">
                <Button 
                  size="lg" 
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="px-8"
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Improved Resume (PDF)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
