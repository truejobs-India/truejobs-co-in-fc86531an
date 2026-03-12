import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Education, Experience, Profile } from '@/types/database';
import { ResumeScoring } from './ResumeScoring';
import { SavedResumes } from './SavedResumes';
import { LinkedInImport } from './LinkedInImport';
import { ATSKeywordOptimizer } from './ATSKeywordOptimizer';
// jsPDF is dynamically imported to reduce initial bundle size
import { 
  FileText, 
  Download, 
  Loader2, 
  Mail, 
  Phone, 
  MapPin,
  Linkedin,
  Github,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  RefreshCw,
  Target,
  FolderOpen,
  LayoutTemplate,
  Search
} from 'lucide-react';

type TemplateStyle = 'professional' | 'modern' | 'minimal' | 'creative';

interface ResumeData {
  profile: Profile | null;
  education: Education[];
  experience: Experience[];
}

const TEMPLATE_INFO: Record<TemplateStyle, { name: string; description: string; color: string }> = {
  professional: {
    name: 'Professional',
    description: 'Classic layout with traditional styling',
    color: 'bg-blue-500'
  },
  modern: {
    name: 'Modern',
    description: 'Contemporary design with accent colors',
    color: 'bg-purple-500'
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean and simple, content-focused',
    color: 'bg-gray-500'
  },
  creative: {
    name: 'Creative',
    description: 'Bold design for creative industries',
    color: 'bg-orange-500'
  }
};

export function ResumeTemplates() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const resumeRef = useRef<HTMLDivElement>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>('professional');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData>({
    profile: null,
    education: [],
    experience: []
  });

  useEffect(() => {
    if (user && profile) {
      fetchResumeData();
    }
  }, [user, profile]);

  const fetchResumeData = async () => {
    if (!profile) return;
    setIsLoading(true);
    
    try {
      const [educationRes, experienceRes] = await Promise.all([
        supabase
          .from('education')
          .select('*')
          .eq('profile_id', profile.id)
          .order('start_date', { ascending: false }),
        supabase
          .from('experience')
          .select('*')
          .eq('profile_id', profile.id)
          .order('start_date', { ascending: false })
      ]);

      setResumeData({
        profile,
        education: (educationRes.data || []) as Education[],
        experience: (experienceRes.data || []) as Experience[]
      });
    } catch (error) {
      console.error('Error fetching resume data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load resume data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const exportToPDF = async () => {
    if (!resumeData.profile) return;
    setIsExporting(true);

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      const colors = {
        professional: { primary: [37, 99, 235], secondary: [100, 116, 139] },
        modern: { primary: [147, 51, 234], secondary: [107, 114, 128] },
        minimal: { primary: [0, 0, 0], secondary: [107, 114, 128] },
        creative: { primary: [249, 115, 22], secondary: [107, 114, 128] }
      };

      const color = colors[selectedTemplate];
      const p = resumeData.profile;

      // Header - Name
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(color.primary[0], color.primary[1], color.primary[2]);
      doc.text(p.full_name || 'Your Name', margin, yPos + 8);
      yPos += 12;

      // Headline
      if (p.headline) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(color.secondary[0], color.secondary[1], color.secondary[2]);
        doc.text(p.headline, margin, yPos + 4);
        yPos += 8;
      }

      // Contact info
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const contactParts = [];
      if (p.email) contactParts.push(p.email);
      if (p.phone) contactParts.push(p.phone);
      if (p.location) contactParts.push(p.location);
      if (contactParts.length > 0) {
        doc.text(contactParts.join('  •  '), margin, yPos + 4);
        yPos += 6;
      }

      // Links
      const links = [];
      if (p.linkedin_url) links.push('LinkedIn');
      if (p.github_url) links.push('GitHub');
      if (p.portfolio_url) links.push('Portfolio');
      if (links.length > 0) {
        doc.setTextColor(color.primary[0], color.primary[1], color.primary[2]);
        doc.text(links.join('  |  '), margin, yPos + 4);
        yPos += 8;
      }

      // Divider
      yPos += 2;
      doc.setDrawColor(color.primary[0], color.primary[1], color.primary[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      // Summary/Bio
      if (p.bio) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color.primary[0], color.primary[1], color.primary[2]);
        doc.text('PROFESSIONAL SUMMARY', margin, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const bioLines = doc.splitTextToSize(p.bio, contentWidth);
        doc.text(bioLines, margin, yPos);
        yPos += bioLines.length * 5 + 6;
      }

      // Skills
      if (p.skills && p.skills.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color.primary[0], color.primary[1], color.primary[2]);
        doc.text('SKILLS', margin, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const skillsText = p.skills.join('  •  ');
        const skillLines = doc.splitTextToSize(skillsText, contentWidth);
        doc.text(skillLines, margin, yPos);
        yPos += skillLines.length * 5 + 6;
      }

      // Experience
      if (resumeData.experience.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color.primary[0], color.primary[1], color.primary[2]);
        doc.text('WORK EXPERIENCE', margin, yPos);
        yPos += 6;

        resumeData.experience.forEach((exp) => {
          if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = margin;
          }

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(exp.job_title, margin, yPos);
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          const dateText = `${formatDate(exp.start_date)} - ${exp.is_current ? 'Present' : formatDate(exp.end_date)}`;
          doc.text(dateText, pageWidth - margin, yPos, { align: 'right' });
          yPos += 5;

          doc.setTextColor(color.secondary[0], color.secondary[1], color.secondary[2]);
          let companyLine = exp.company_name;
          if (exp.location) companyLine += ` | ${exp.location}`;
          doc.text(companyLine, margin, yPos);
          yPos += 5;

          if (exp.description) {
            doc.setTextColor(60, 60, 60);
            const descLines = doc.splitTextToSize(exp.description, contentWidth);
            doc.text(descLines, margin, yPos);
            yPos += descLines.length * 4 + 4;
          } else {
            yPos += 2;
          }
        });
        yPos += 4;
      }

      // Education
      if (resumeData.education.length > 0) {
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color.primary[0], color.primary[1], color.primary[2]);
        doc.text('EDUCATION', margin, yPos);
        yPos += 6;

        resumeData.education.forEach((edu) => {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(edu.degree, margin, yPos);
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          const dateText = `${formatDate(edu.start_date)} - ${edu.is_current ? 'Present' : formatDate(edu.end_date)}`;
          doc.text(dateText, pageWidth - margin, yPos, { align: 'right' });
          yPos += 5;

          doc.setTextColor(color.secondary[0], color.secondary[1], color.secondary[2]);
          let instLine = edu.institution;
          if (edu.field_of_study) instLine += ` - ${edu.field_of_study}`;
          doc.text(instLine, margin, yPos);
          yPos += 6;
        });
      }

      doc.save(`${p.full_name?.replace(/\s+/g, '_') || 'resume'}_${selectedTemplate}.pdf`);
      toast({ title: 'Resume exported successfully!' });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not generate PDF',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderResumePreview = () => {
    const p = resumeData.profile;
    if (!p) return null;

    const templateStyles: Record<TemplateStyle, { headerBg: string; headerText: string; accentText: string; border: string }> = {
      professional: {
        headerBg: 'bg-blue-600',
        headerText: 'text-white',
        accentText: 'text-blue-600',
        border: 'border-blue-200'
      },
      modern: {
        headerBg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
        headerText: 'text-white',
        accentText: 'text-purple-600',
        border: 'border-purple-200'
      },
      minimal: {
        headerBg: 'bg-gray-900',
        headerText: 'text-white',
        accentText: 'text-gray-800',
        border: 'border-gray-300'
      },
      creative: {
        headerBg: 'bg-gradient-to-r from-orange-500 to-pink-500',
        headerText: 'text-white',
        accentText: 'text-orange-600',
        border: 'border-orange-200'
      }
    };

    const style = templateStyles[selectedTemplate];

    return (
      <div ref={resumeRef} className={`bg-white shadow-lg rounded-lg overflow-hidden border ${style.border}`}>
        {/* Header */}
        <div className={`${style.headerBg} ${style.headerText} p-6`}>
          <h1 className="text-2xl font-bold">{p.full_name || 'Your Name'}</h1>
          {p.headline && <p className="text-sm opacity-90 mt-1">{p.headline}</p>}
          
          <div className="flex flex-wrap gap-4 mt-4 text-sm opacity-90">
            {p.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {p.email}
              </span>
            )}
            {p.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {p.phone}
              </span>
            )}
            {p.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {p.location}
              </span>
            )}
          </div>
          
          <div className="flex gap-3 mt-3">
            {p.linkedin_url && (
              <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100">
                <Linkedin className="h-4 w-4" />
              </a>
            )}
            {p.github_url && (
              <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100">
                <Github className="h-4 w-4" />
              </a>
            )}
            {p.portfolio_url && (
              <a href={p.portfolio_url} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100">
                <Globe className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Bio */}
          {p.bio && (
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${style.accentText} mb-2 flex items-center gap-2`}>
                <FileText className="h-4 w-4" /> Professional Summary
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">{p.bio}</p>
            </section>
          )}

          {/* Skills */}
          {p.skills && p.skills.length > 0 && (
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${style.accentText} mb-2 flex items-center gap-2`}>
                <Award className="h-4 w-4" /> Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {p.skills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {resumeData.experience.length > 0 && (
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${style.accentText} mb-3 flex items-center gap-2`}>
                <Briefcase className="h-4 w-4" /> Work Experience
              </h2>
              <div className="space-y-4">
                {resumeData.experience.map((exp) => (
                  <div key={exp.id} className="border-l-2 border-muted pl-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-sm">{exp.job_title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {exp.company_name}
                          {exp.location && ` • ${exp.location}`}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(exp.start_date)} - {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-sm text-gray-600 mt-2">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {resumeData.education.length > 0 && (
            <section>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${style.accentText} mb-3 flex items-center gap-2`}>
                <GraduationCap className="h-4 w-4" /> Education
              </h2>
              <div className="space-y-3">
                {resumeData.education.map((edu) => (
                  <div key={edu.id} className="border-l-2 border-muted pl-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-sm">{edu.degree}</h3>
                        <p className="text-sm text-muted-foreground">
                          {edu.institution}
                          {edu.field_of_study && ` - ${edu.field_of_study}`}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(edu.start_date)} - {edu.is_current ? 'Present' : formatDate(edu.end_date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
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
    <Tabs defaultValue="builder" className="space-y-4">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="builder" className="text-xs sm:text-sm">
          <LayoutTemplate className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Builder</span>
        </TabsTrigger>
        <TabsTrigger value="import" className="text-xs sm:text-sm">
          <Linkedin className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Import</span>
        </TabsTrigger>
        <TabsTrigger value="keywords" className="text-xs sm:text-sm">
          <Search className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">ATS</span>
        </TabsTrigger>
        <TabsTrigger value="scoring" className="text-xs sm:text-sm">
          <Target className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Scoring</span>
        </TabsTrigger>
        <TabsTrigger value="saved" className="text-xs sm:text-sm">
          <FolderOpen className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Saved</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="builder">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Resume Builder</CardTitle>
                  <CardDescription>
                    Choose a template and download your professional resume
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchResumeData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Template Selection */}
            <div>
              <h3 className="text-sm font-medium mb-3">Choose Template</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(TEMPLATE_INFO) as TemplateStyle[]).map((template) => (
                  <button
                    key={template}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedTemplate === template
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className={`h-2 w-8 ${TEMPLATE_INFO[template].color} rounded mb-2`} />
                    <p className="font-medium text-sm">{TEMPLATE_INFO[template].name}</p>
                    <p className="text-xs text-muted-foreground">{TEMPLATE_INFO[template].description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview & Export */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Preview</h3>
                <Button onClick={exportToPDF} disabled={isExporting || !resumeData.profile}>
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
              
              <ScrollArea className="h-[600px] rounded-lg border p-4 bg-gray-50">
                {renderResumePreview()}
              </ScrollArea>

              {(!resumeData.experience.length || !resumeData.education.length) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p className="font-medium">💡 Complete your profile for a better resume</p>
                  <p className="text-amber-700 mt-1">
                    Add your work experience and education in your profile to populate the resume template.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="import">
        <LinkedInImport />
      </TabsContent>

      <TabsContent value="keywords">
        <ATSKeywordOptimizer />
      </TabsContent>

      <TabsContent value="scoring">
        <ResumeScoring />
      </TabsContent>

      <TabsContent value="saved">
        <SavedResumes />
      </TabsContent>
    </Tabs>
  );
}
