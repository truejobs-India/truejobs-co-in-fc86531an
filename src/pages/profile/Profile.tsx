import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Education, Experience } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  User, Mail, Phone, MapPin, Briefcase, GraduationCap, Link as LinkIcon,
  Plus, Trash2, Upload, Loader2, X, Save, FileText
} from 'lucide-react';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { validateAvatarFile, validateResumeFile } from '@/lib/fileValidation';

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'remote', label: 'Remote' },
];

export default function Profile() {
  const { user, profile, role, hasRole, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Employers should never see the candidate profile — safety redirect
  useEffect(() => {
    if (role === 'employer' || hasRole('employer')) {
      navigate('/employer/company', { replace: true });
    }
  }, [role, navigate, hasRole]);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [education, setEducation] = useState<Education[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [preferredJobTypes, setPreferredJobTypes] = useState<string[]>([]);
  const [expectedSalaryMin, setExpectedSalaryMin] = useState('');
  const [expectedSalaryMax, setExpectedSalaryMax] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Dialog states
  const [isEducationDialogOpen, setIsEducationDialogOpen] = useState(false);
  const [isExperienceDialogOpen, setIsExperienceDialogOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Partial<Education> | null>(null);
  const [editingExperience, setEditingExperience] = useState<Partial<Experience> | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setHeadline(profile.headline || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setSkills(profile.skills || []);
      setExperienceYears(profile.experience_years || 0);
      setLinkedinUrl(profile.linkedin_url || '');
      setGithubUrl(profile.github_url || '');
      setPortfolioUrl(profile.portfolio_url || '');
      setPreferredJobTypes(profile.preferred_job_types || []);
      setExpectedSalaryMin(profile.expected_salary_min?.toString() || '');
      setExpectedSalaryMax(profile.expected_salary_max?.toString() || '');
      setIsAvailable(profile.is_available);
      setResumeUrl(profile.resume_url);
      setAvatarUrl(profile.avatar_url);
      fetchEducationAndExperience();
    }
  }, [profile]);

  const fetchEducationAndExperience = async () => {
    if (!profile) return;

    const [eduResult, expResult] = await Promise.all([
      supabase.from('education').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false }),
      supabase.from('experience').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    ]);

    if (eduResult.data) setEducation(eduResult.data as Education[]);
    if (expResult.data) setExperience(expResult.data as Experience[]);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
        headline,
        bio,
        location,
        skills,
        experience_years: experienceYears,
        linkedin_url: linkedinUrl || null,
        github_url: githubUrl || null,
        preferred_job_types: preferredJobTypes as ('full_time' | 'part_time' | 'contract' | 'internship' | 'remote')[],
        portfolio_url: portfolioUrl || null,
        expected_salary_min: expectedSalaryMin ? parseInt(expectedSalaryMin) : null,
        expected_salary_max: expectedSalaryMax ? parseInt(expectedSalaryMax) : null,
        is_available: isAvailable,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated successfully!' });
      refreshProfile();
    }
    setIsSaving(false);
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file before upload
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast({ 
        title: 'Invalid file', 
        description: validation.error, 
        variant: 'destructive' 
      });
      // Reset the input
      e.target.value = '';
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const filePath = `${user.id}/avatar.${fileExt}`;

    setIsLoading(true);
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(publicUrl);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
      toast({ title: 'Avatar uploaded!' });
      refreshProfile();
    }
    setIsLoading(false);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file before upload
    const validation = validateResumeFile(file);
    if (!validation.valid) {
      toast({ 
        title: 'Invalid file', 
        description: validation.error, 
        variant: 'destructive' 
      });
      // Reset the input
      e.target.value = '';
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const filePath = `${user.id}/resume.${fileExt}`;

    setIsLoading(true);
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(filePath);
      setResumeUrl(publicUrl);
      await supabase.from('profiles').update({ resume_url: publicUrl }).eq('user_id', user.id);
      toast({ title: 'Resume uploaded!' });
      refreshProfile();
    }
    setIsLoading(false);
  };

  const handleSaveEducation = async () => {
    if (!profile || !editingEducation) return;

    if (editingEducation.id) {
      await supabase.from('education').update({
        institution: editingEducation.institution,
        degree: editingEducation.degree,
        field_of_study: editingEducation.field_of_study,
        start_date: editingEducation.start_date,
        end_date: editingEducation.end_date,
        is_current: editingEducation.is_current,
        description: editingEducation.description,
      }).eq('id', editingEducation.id);
    } else {
      await supabase.from('education').insert({
        profile_id: profile.id,
        institution: editingEducation.institution || '',
        degree: editingEducation.degree || '',
        field_of_study: editingEducation.field_of_study,
        start_date: editingEducation.start_date,
        end_date: editingEducation.end_date,
        is_current: editingEducation.is_current,
      });
    }
    setIsEducationDialogOpen(false);
    setEditingEducation(null);
    fetchEducationAndExperience();
    toast({ title: 'Education saved!' });
  };

  const handleDeleteEducation = async (id: string) => {
    await supabase.from('education').delete().eq('id', id);
    fetchEducationAndExperience();
    toast({ title: 'Education deleted' });
  };

  const handleSaveExperience = async () => {
    if (!profile || !editingExperience) return;

    if (editingExperience.id) {
      await supabase.from('experience').update({
        job_title: editingExperience.job_title,
        company_name: editingExperience.company_name,
        location: editingExperience.location,
        start_date: editingExperience.start_date,
        end_date: editingExperience.end_date,
        is_current: editingExperience.is_current,
        description: editingExperience.description,
      }).eq('id', editingExperience.id);
    } else {
      await supabase.from('experience').insert({
        profile_id: profile.id,
        job_title: editingExperience.job_title || '',
        company_name: editingExperience.company_name || '',
        location: editingExperience.location,
        start_date: editingExperience.start_date,
        end_date: editingExperience.end_date,
        is_current: editingExperience.is_current,
      });
    }
    setIsExperienceDialogOpen(false);
    setEditingExperience(null);
    fetchEducationAndExperience();
    toast({ title: 'Experience saved!' });
  };

  const handleDeleteExperience = async (id: string) => {
    await supabase.from('experience').delete().eq('id', id);
    fetchEducationAndExperience();
    toast({ title: 'Experience deleted' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <div className="space-y-8">
          {/* Avatar & Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Your public profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90">
                    <Upload className="h-4 w-4" />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                    <Label>Available for opportunities</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Let employers know you're open to new roles
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" value={profile?.email || ''} disabled className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-10"
                      placeholder="Mumbai, India"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Professional Headline</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Senior Software Engineer | React | Node.js"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">About Me</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell employers about yourself, your experience, and what you're looking for..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resume */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resume
              </CardTitle>
              <CardDescription>Upload your resume for quick applications</CardDescription>
            </CardHeader>
            <CardContent>
              {resumeUrl ? (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">Resume uploaded</p>
                      <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        View Resume
                      </a>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Replace
                      </span>
                    </Button>
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="font-medium mb-1">Upload your resume</p>
                  <p className="text-sm text-muted-foreground">PDF, DOC, or DOCX (max 5MB)</p>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" />
                </label>
              )}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
              <CardDescription>Add your technical and professional skills</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="Add a skill (e.g., React, Python, Project Management)"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                />
                <Button onClick={handleAddSkill}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button onClick={() => handleRemoveSkill(skill)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {skills.length === 0 && (
                  <p className="text-sm text-muted-foreground">No skills added yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Work Experience
                </CardTitle>
                <CardDescription>Add your professional experience</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingExperience({ is_current: false });
                  setIsExperienceDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Experience
              </Button>
            </CardHeader>
            <CardContent>
              {experience.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No experience added yet</p>
              ) : (
                <div className="space-y-4">
                  {experience.map((exp) => (
                    <div key={exp.id} className="flex gap-4 p-4 border rounded-lg">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Briefcase className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{exp.job_title}</h4>
                            <p className="text-muted-foreground">{exp.company_name}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingExperience(exp);
                                setIsExperienceDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteExperience(exp.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {exp.start_date} - {exp.is_current ? 'Present' : exp.end_date}
                          {exp.location && ` • ${exp.location}`}
                        </p>
                        {exp.description && <p className="text-sm mt-2">{exp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Education
                </CardTitle>
                <CardDescription>Add your educational background</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingEducation({ is_current: false });
                  setIsEducationDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Education
              </Button>
            </CardHeader>
            <CardContent>
              {education.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No education added yet</p>
              ) : (
                <div className="space-y-4">
                  {education.map((edu) => (
                    <div key={edu.id} className="flex gap-4 p-4 border rounded-lg">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{edu.degree}</h4>
                            <p className="text-muted-foreground">{edu.institution}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingEducation(edu);
                                setIsEducationDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteEducation(edu.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {edu.field_of_study && `${edu.field_of_study} • `}
                          {edu.start_date} - {edu.is_current ? 'Present' : edu.end_date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Social Links
              </CardTitle>
              <CardDescription>Add your professional profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github">GitHub</Label>
                <Input
                  id="github"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/yourusername"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portfolio">Portfolio</Label>
                <Input
                  id="portfolio"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://yourportfolio.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Job Preferences</CardTitle>
              <CardDescription>Help us find the right opportunities for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Preferred Job Types</Label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((type) => (
                    <Badge
                      key={type.value}
                      variant={preferredJobTypes.includes(type.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (preferredJobTypes.includes(type.value)) {
                          setPreferredJobTypes(preferredJobTypes.filter((t) => t !== type.value));
                        } else {
                          setPreferredJobTypes([...preferredJobTypes, type.value]);
                        }
                      }}
                    >
                      {type.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Years of Experience</Label>
                  <Select value={experienceYears.toString()} onValueChange={(v) => setExperienceYears(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y === 0 ? 'Fresher' : y === 20 ? '20+ years' : `${y} years`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Expected Salary (Min)</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={expectedSalaryMin}
                    onChange={(e) => setExpectedSalaryMin(e.target.value)}
                    placeholder="₹500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryMax">Expected Salary (Max)</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={expectedSalaryMax}
                    onChange={(e) => setExpectedSalaryMax(e.target.value)}
                    placeholder="₹1000000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <NotificationSettings />
        </div>
      </div>

      {/* Experience Dialog */}
      <Dialog open={isExperienceDialogOpen} onOpenChange={setIsExperienceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExperience?.id ? 'Edit Experience' : 'Add Experience'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input
                value={editingExperience?.job_title || ''}
                onChange={(e) => setEditingExperience({ ...editingExperience, job_title: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={editingExperience?.company_name || ''}
                onChange={(e) => setEditingExperience({ ...editingExperience, company_name: e.target.value })}
                placeholder="Google"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={editingExperience?.location || ''}
                onChange={(e) => setEditingExperience({ ...editingExperience, location: e.target.value })}
                placeholder="Bangalore, India"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editingExperience?.start_date || ''}
                  onChange={(e) => setEditingExperience({ ...editingExperience, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editingExperience?.end_date || ''}
                  onChange={(e) => setEditingExperience({ ...editingExperience, end_date: e.target.value })}
                  disabled={editingExperience?.is_current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingExperience?.is_current || false}
                onCheckedChange={(checked) => setEditingExperience({ ...editingExperience, is_current: checked })}
              />
              <Label>I currently work here</Label>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editingExperience?.description || ''}
                onChange={(e) => setEditingExperience({ ...editingExperience, description: e.target.value })}
                placeholder="Describe your responsibilities and achievements..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExperienceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveExperience}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Education Dialog */}
      <Dialog open={isEducationDialogOpen} onOpenChange={setIsEducationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEducation?.id ? 'Edit Education' : 'Add Education'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Institution</Label>
              <Input
                value={editingEducation?.institution || ''}
                onChange={(e) => setEditingEducation({ ...editingEducation, institution: e.target.value })}
                placeholder="University of Delhi"
              />
            </div>
            <div className="space-y-2">
              <Label>Degree</Label>
              <Input
                value={editingEducation?.degree || ''}
                onChange={(e) => setEditingEducation({ ...editingEducation, degree: e.target.value })}
                placeholder="Bachelor of Technology"
              />
            </div>
            <div className="space-y-2">
              <Label>Field of Study</Label>
              <Input
                value={editingEducation?.field_of_study || ''}
                onChange={(e) => setEditingEducation({ ...editingEducation, field_of_study: e.target.value })}
                placeholder="Computer Science"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editingEducation?.start_date || ''}
                  onChange={(e) => setEditingEducation({ ...editingEducation, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editingEducation?.end_date || ''}
                  onChange={(e) => setEditingEducation({ ...editingEducation, end_date: e.target.value })}
                  disabled={editingEducation?.is_current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingEducation?.is_current || false}
                onCheckedChange={(checked) => setEditingEducation({ ...editingEducation, is_current: checked })}
              />
              <Label>I'm currently studying here</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEducationDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEducation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
