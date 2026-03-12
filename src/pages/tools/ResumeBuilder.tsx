import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
// jsPDF is dynamically imported to reduce initial bundle size
import {
  FileText,
  Loader2,
  Plus,
  Trash2,
  Download,
  Sparkles,
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Award,
  FolderOpen,
  Edit3,
  Eye,
  Info
} from 'lucide-react';

interface WorkExperience {
  company: string;
  role: string;
  duration: string;
  description: string;
}

interface Education {
  institution: string;
  degree: string;
  year: string;
  field: string;
}

interface Project {
  name: string;
  description: string;
}

interface GeneratedResume {
  professionalSummary: string;
  experience: Array<{
    company: string;
    role: string;
    duration: string;
    bullets: string[];
  }>;
  skills: {
    technical: string[];
    soft: string[];
  };
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
  }>;
  certifications: string[];
}

export default function ResumeBuilder() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [careerRole, setCareerRole] = useState('');
  
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([
    { company: '', role: '', duration: '', description: '' }
  ]);
  
  const [education, setEducation] = useState<Education[]>([
    { institution: '', degree: '', year: '', field: '' }
  ]);
  
  const [skills, setSkills] = useState('');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [certifications, setCertifications] = useState('');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<GeneratedResume | null>(null);
  const [editedResume, setEditedResume] = useState<GeneratedResume | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Pre-fill user info when available
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
    if (user?.user_metadata?.full_name && !fullName) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user, email, fullName]);

  // Work Experience handlers
  const addWorkExperience = () => {
    setWorkExperience([...workExperience, { company: '', role: '', duration: '', description: '' }]);
  };

  const removeWorkExperience = (index: number) => {
    setWorkExperience(workExperience.filter((_, i) => i !== index));
  };

  const updateWorkExperience = (index: number, field: keyof WorkExperience, value: string) => {
    const updated = [...workExperience];
    updated[index][field] = value;
    setWorkExperience(updated);
  };

  // Education handlers
  const addEducation = () => {
    setEducation([...education, { institution: '', degree: '', year: '', field: '' }]);
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  // Projects handlers
  const addProject = () => {
    setProjects([...projects, { name: '', description: '' }]);
  };

  const removeProject = (index: number) => {
    setProjects(projects.filter((_, i) => i !== index));
  };

  const updateProject = (index: number, field: keyof Project, value: string) => {
    const updated = [...projects];
    updated[index][field] = value;
    setProjects(updated);
  };

  const generateResume = async () => {
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
          title: 'Please log in to generate your resume', 
          description: 'You will be redirected to the login page',
          variant: 'destructive' 
        });
        navigate('/login', { state: { from: { pathname: '/tools/resume-builder' } } });
        return;
      }
    }

    if (!fullName || !careerRole) {
      toast({ title: 'Please fill in your name and target role', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('resume-ai', {
        body: {
          action: 'build_resume',
          data: {
            fullName,
            email,
            phone,
            location,
            careerRole,
            workExperience: workExperience.filter(w => w.company && w.role),
            education: education.filter(e => e.institution && e.degree),
            skills: skills.split(',').map(s => s.trim()).filter(Boolean),
            projects: projects.filter(p => p.name && p.description),
            certifications: certifications.split(',').map(c => c.trim()).filter(Boolean)
          }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Parse the JSON response
      const cleanResponse = data.response.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);

      setGeneratedResume(parsed);
      setEditedResume(parsed);
      setShowPreview(true);
      toast({ title: 'Resume generated successfully!' });
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate resume',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = async () => {
    if (!editedResume) return;

    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPos = 20;
      const lineHeight = 6;
      const pageHeight = doc.internal.pageSize.getHeight();

      const checkPageBreak = (neededSpace: number) => {
        if (yPos + neededSpace > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
      };

      // Header - Name
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text(fullName.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Contact Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const contactInfo = [email, phone, location].filter(Boolean).join(' | ');
      doc.text(contactInfo, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;

      // Target Role
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235);
      doc.text(careerRole, pageWidth / 2, yPos, { align: 'center' });
      yPos += 12;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Professional Summary
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('PROFESSIONAL SUMMARY', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(editedResume.professionalSummary, maxWidth);
      summaryLines.forEach((line: string) => {
        checkPageBreak(lineHeight);
        doc.text(line, margin, yPos);
        yPos += lineHeight;
      });
      yPos += 8;

      // Experience
      if (editedResume.experience?.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 37, 41);
        doc.text('WORK EXPERIENCE', margin, yPos);
        yPos += 8;

        editedResume.experience.forEach((exp) => {
          checkPageBreak(30);
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(exp.role, margin, yPos);
          yPos += 5;
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(`${exp.company} | ${exp.duration}`, margin, yPos);
          yPos += 6;
          
          doc.setTextColor(60, 60, 60);
          exp.bullets?.forEach((bullet) => {
            checkPageBreak(lineHeight);
            const bulletLines = doc.splitTextToSize(`• ${bullet}`, maxWidth - 5);
            bulletLines.forEach((line: string) => {
              doc.text(line, margin + 3, yPos);
              yPos += lineHeight;
            });
          });
          yPos += 4;
        });
        yPos += 4;
      }

      // Skills
      if (editedResume.skills) {
        checkPageBreak(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 37, 41);
        doc.text('SKILLS', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        if (editedResume.skills.technical?.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.text('Technical: ', margin, yPos);
          doc.setFont('helvetica', 'normal');
          const techText = editedResume.skills.technical.join(', ');
          const techLines = doc.splitTextToSize(techText, maxWidth - 25);
          doc.text(techLines, margin + 25, yPos);
          yPos += techLines.length * lineHeight + 2;
        }
        
        if (editedResume.skills.soft?.length > 0) {
          checkPageBreak(lineHeight);
          doc.setFont('helvetica', 'bold');
          doc.text('Soft Skills: ', margin, yPos);
          doc.setFont('helvetica', 'normal');
          const softText = editedResume.skills.soft.join(', ');
          const softLines = doc.splitTextToSize(softText, maxWidth - 28);
          doc.text(softLines, margin + 28, yPos);
          yPos += softLines.length * lineHeight;
        }
        yPos += 8;
      }

      // Education
      if (editedResume.education?.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 37, 41);
        doc.text('EDUCATION', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        editedResume.education.forEach((edu) => {
          checkPageBreak(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(edu.degree, margin, yPos);
          yPos += 5;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(`${edu.institution} | ${edu.year}`, margin, yPos);
          yPos += 6;
        });
        yPos += 4;
      }

      // Projects
      if (editedResume.projects?.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 37, 41);
        doc.text('PROJECTS', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        editedResume.projects.forEach((proj) => {
          checkPageBreak(15);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(proj.name, margin, yPos);
          yPos += 5;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          const projLines = doc.splitTextToSize(proj.description, maxWidth);
          projLines.forEach((line: string) => {
            checkPageBreak(lineHeight);
            doc.text(line, margin, yPos);
            yPos += lineHeight;
          });
          yPos += 2;
        });
      }

      // Certifications
      if (editedResume.certifications?.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 37, 41);
        doc.text('CERTIFICATIONS', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        editedResume.certifications.forEach((cert) => {
          checkPageBreak(lineHeight);
          doc.text(`• ${cert}`, margin, yPos);
          yPos += lineHeight;
        });
      }

      // Save
      const fileName = `${fullName.replace(/\s+/g, '_')}_resume.pdf`;
      
      // Upload to storage
      const pdfBlob = doc.output('blob');
      await supabase.storage
        .from('resumes')
        .upload(`${user?.id}/${fileName}`, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      // Download locally
      doc.save(fileName);
      
      toast({ 
        title: 'Resume exported!',
        description: 'Your professional resume has been downloaded.'
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

  return (
    <Layout noAds>
      <SEO 
        title="AI Resume Builder | TrueJobs"
        description="Create a professional resume from scratch using AI. Fill in your details and get an ATS-optimized resume in minutes."
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">AI Resume Builder</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Create a professional, ATS-friendly resume from scratch. Fill in your details and let AI 
            generate polished content with strong action verbs and proper formatting.
          </p>
        </div>

        {/* Disclaimer */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Disclaimer:</strong> AI suggestions are advisory. We only use the information you provide. 
            No skills, experience, or qualifications are fabricated.
          </AlertDescription>
        </Alert>

        {/* Login Prompt for non-authenticated users */}
        {!authLoading && !user && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">Login Required</p>
                  <p className="text-sm text-blue-700">Sign in to generate your AI-powered resume</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/login', { state: { from: { pathname: '/tools/resume-builder' } } })}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Login to Continue
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="Mumbai, India"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careerRole">Target Job Title / Career Role *</Label>
                  <Input
                    id="careerRole"
                    placeholder="Senior Software Engineer"
                    value={careerRole}
                    onChange={(e) => setCareerRole(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-5 w-5" />
                    Work Experience
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addWorkExperience}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {workExperience.map((exp, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Experience {index + 1}</span>
                      {workExperience.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWorkExperience(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Company Name"
                        value={exp.company}
                        onChange={(e) => updateWorkExperience(index, 'company', e.target.value)}
                      />
                      <Input
                        placeholder="Job Title"
                        value={exp.role}
                        onChange={(e) => updateWorkExperience(index, 'role', e.target.value)}
                      />
                    </div>
                    <Input
                      placeholder="Duration (e.g., Jan 2022 - Present)"
                      value={exp.duration}
                      onChange={(e) => updateWorkExperience(index, 'duration', e.target.value)}
                    />
                    <Textarea
                      placeholder="Describe your responsibilities and achievements..."
                      value={exp.description}
                      onChange={(e) => updateWorkExperience(index, 'description', e.target.value)}
                      rows={3}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-5 w-5" />
                    Education
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addEducation}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {education.map((edu, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Education {index + 1}</span>
                      {education.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEducation(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Institution Name"
                        value={edu.institution}
                        onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                      />
                      <Input
                        placeholder="Degree (e.g., B.Tech, MBA)"
                        value={edu.degree}
                        onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Field of Study"
                        value={edu.field}
                        onChange={(e) => updateEducation(index, 'field', e.target.value)}
                      />
                      <Input
                        placeholder="Year (e.g., 2022)"
                        value={edu.year}
                        onChange={(e) => updateEducation(index, 'year', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wrench className="h-5 w-5" />
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Textarea
                    id="skills"
                    placeholder="Python, JavaScript, React, Node.js, SQL, Project Management..."
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Projects (Optional) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FolderOpen className="h-5 w-5" />
                    Projects (Optional)
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addProject}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No projects added yet. Click "Add" to include your projects.
                  </p>
                ) : (
                  projects.map((proj, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Project {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProject(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Project Name"
                        value={proj.name}
                        onChange={(e) => updateProject(index, 'name', e.target.value)}
                      />
                      <Textarea
                        placeholder="Brief description of the project..."
                        value={proj.description}
                        onChange={(e) => updateProject(index, 'description', e.target.value)}
                        rows={2}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Certifications (Optional) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5" />
                  Certifications (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="certs">Certifications (comma-separated)</Label>
                  <Textarea
                    id="certs"
                    placeholder="AWS Certified Solutions Architect, PMP, Google Analytics..."
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button 
              size="lg" 
              className="w-full" 
              onClick={generateResume}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Resume with AI
                </>
              )}
            </Button>
          </div>

          {/* Preview Section */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card className="h-[calc(100vh-8rem)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Resume Preview
                  </CardTitle>
                  {editedResume && (
                    <Button
                      onClick={generatePDF}
                      disabled={isGeneratingPDF}
                    >
                      {isGeneratingPDF ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download PDF
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="h-[calc(100%-5rem)]">
                {!editedResume ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FileText className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-center">
                      Fill in your details and click "Generate Resume" to see your professional resume here
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-6 pb-4">
                      {/* Header */}
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{fullName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {[email, phone, location].filter(Boolean).join(' | ')}
                        </p>
                        <Badge className="mt-2">{careerRole}</Badge>
                      </div>

                      <Separator />

                      {/* Professional Summary */}
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-primary mb-2">
                          Professional Summary
                        </h3>
                        <p className="text-sm">{editedResume.professionalSummary}</p>
                      </div>

                      {/* Experience */}
                      {editedResume.experience?.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm uppercase tracking-wider text-primary mb-3">
                            Work Experience
                          </h3>
                          {editedResume.experience.map((exp, i) => (
                            <div key={i} className="mb-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{exp.role}</p>
                                  <p className="text-sm text-muted-foreground">{exp.company}</p>
                                </div>
                                <span className="text-xs text-muted-foreground">{exp.duration}</span>
                              </div>
                              <ul className="mt-2 space-y-1">
                                {exp.bullets?.map((bullet, j) => (
                                  <li key={j} className="text-sm flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Skills */}
                      {editedResume.skills && (
                        <div>
                          <h3 className="font-semibold text-sm uppercase tracking-wider text-primary mb-2">
                            Skills
                          </h3>
                          <div className="space-y-2">
                            {editedResume.skills.technical?.length > 0 && (
                              <div>
                                <span className="text-xs font-medium">Technical:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {editedResume.skills.technical.map((skill, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {editedResume.skills.soft?.length > 0 && (
                              <div>
                                <span className="text-xs font-medium">Soft Skills:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {editedResume.skills.soft.map((skill, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Education */}
                      {editedResume.education?.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm uppercase tracking-wider text-primary mb-2">
                            Education
                          </h3>
                          {editedResume.education.map((edu, i) => (
                            <div key={i} className="mb-2">
                              <p className="font-medium text-sm">{edu.degree}</p>
                              <p className="text-xs text-muted-foreground">
                                {edu.institution} | {edu.year}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Projects */}
                      {editedResume.projects?.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm uppercase tracking-wider text-primary mb-2">
                            Projects
                          </h3>
                          {editedResume.projects.map((proj, i) => (
                            <div key={i} className="mb-2">
                              <p className="font-medium text-sm">{proj.name}</p>
                              <p className="text-xs text-muted-foreground">{proj.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Certifications */}
                      {editedResume.certifications?.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm uppercase tracking-wider text-primary mb-2">
                            Certifications
                          </h3>
                          <ul className="space-y-1">
                            {editedResume.certifications.map((cert, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <Award className="h-3 w-3 mt-1 text-primary" />
                                {cert}
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
