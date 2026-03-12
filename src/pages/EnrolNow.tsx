import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Briefcase, Clock, Send, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateResumeFile } from '@/lib/fileValidation';

// Import premium logos
import logoTcs from '@/assets/logo-tcs-new.png';
import logoInfosys from '@/assets/logo-infosys-new.png';
import logoWipro from '@/assets/logo-wipro-new.png';
import logoTataAig from '@/assets/logo-tata-aig-new.png';
import logoHdfcLife from '@/assets/logo-hdfc-life.png';
import logoICICIPru from '@/assets/logo-icici-prudential.png';
import logoKotakLife from '@/assets/logo-kotak-life.png';
import logoBajaj from '@/assets/logo-bajaj.png';
import logoReliance from '@/assets/logo-reliance.png';
import truejobsLogo from '@/assets/truejobs-logo.png';
import iconCheckmark from '@/assets/icon-checkmark.png';
import { Upload, FileText, X } from 'lucide-react';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  experience: string;
  currentRole: string;
  preferredLocation: string;
  skills: string;
}

const trustedLogos = [
  { name: 'TCS', logo: logoTcs },
  { name: 'Infosys', logo: logoInfosys },
  { name: 'Wipro', logo: logoWipro },
  { name: 'Tata AIG', logo: logoTataAig },
  { name: 'HDFC Life', logo: logoHdfcLife },
  { name: 'ICICI Prudential', logo: logoICICIPru },
  { name: 'Kotak Life', logo: logoKotakLife },
  { name: 'Bajaj Allianz', logo: logoBajaj },
  { name: 'Reliance', logo: logoReliance },
];

export default function EnrolNow() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [resumeChoice, setResumeChoice] = useState<'upload' | 'later'>('later');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    experience: '',
    currentRole: '',
    preferredLocation: '',
    skills: '',
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateResumeFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setResumeFile(file);
    toast({
      title: "Resume Selected",
      description: `${file.name} ready to upload`,
    });
  };

  const removeFile = () => {
    setResumeFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.phone || !formData.experience) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('campaign_enrollments')
        .insert({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          experience: formData.experience,
          job_role: formData.currentRole || null,
          preferred_location: formData.preferredLocation || null,
          skills: formData.skills || null,
        });

      if (error) throw error;

      // Redirect to thank you page
      navigate('/thankyou');
    } catch (error) {
      console.error('Enrollment error:', error);
      toast({
        title: "Submission Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout noAds>
      <SEO 
        title="Enrol Now - Jobs Campaign | TrueJobs" 
        description="Register for our exclusive jobs campaign. Get connected with top employers hiring now."
        url="/enrol-now"
      />
      
      {/* Ultra Premium Hero Section - Optimized for speed */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-background">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />

        <div className="container mx-auto px-4 py-8 sm:py-12 md:py-16 relative z-10">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 glass-strong px-3 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-medium mb-4 sm:mb-6 text-xs sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span className="font-semibold text-foreground">Exclusive Campaign 2026</span>
            </div>

            {/* Hindi Tagline */}
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 sm:mb-4 leading-tight">
              <span className="text-gradient-primary">सही नौकरी, सही मौका!</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              Register now and let top employers find YOU. Our AI-powered platform matches your profile with the best opportunities across India.
            </p>
            
            {/* Stats Cards - Simple grid, no animation overhead */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-8 sm:mb-10">
              {[
                { icon: Briefcase, value: '1K+', label: 'Jobs', color: 'from-blue-500 to-blue-600' },
                { icon: Briefcase, value: '500+', label: 'Companies', color: 'from-green-500 to-green-600' },
                { icon: Briefcase, value: '100%', label: 'Free', color: 'from-purple-500 to-purple-600' },
                { icon: Clock, value: '24-48h', label: 'Response', color: 'from-orange-500 to-orange-600' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="glass-strong rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-soft hover:shadow-medium transition-shadow duration-200"
                >
                  <div className={`h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-sm`}>
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="text-base sm:text-lg md:text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Logos - CSS Animation instead of framer-motion */}
      <section className="py-6 sm:py-8 bg-background/80 border-y border-border/50 overflow-hidden">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs sm:text-sm font-medium text-muted-foreground mb-4 sm:mb-6">Hiring Partners across India</p>
          <div className="relative">
            <div className="flex items-center gap-4 sm:gap-6 md:gap-8 animate-marquee">
              {[...trustedLogos, ...trustedLogos].map((company, index) => (
                <div 
                  key={`${company.name}-${index}`}
                  className="flex-shrink-0 h-12 sm:h-14 md:h-16 w-20 sm:w-24 md:w-32 flex items-center justify-center glass rounded-lg sm:rounded-xl p-2 sm:p-3"
                  title={company.name}
                >
                  <img 
                    src={company.logo} 
                    alt={`${company.name} logo`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Premium Form Section */}
      <section className="py-8 sm:py-12 md:py-16 bg-gradient-to-b from-background to-secondary/20 relative">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="animate-fade-in">
            <Card className="shadow-elevated border-0 glass-strong rounded-2xl sm:rounded-3xl overflow-hidden">
              <div className="bg-gradient-primary p-4 sm:p-6 text-center">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1">Register Now</h3>
                <p className="text-xs sm:text-sm text-white/80">Fill your details & get instant match</p>
              </div>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs sm:text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="fullName"
                      placeholder="Your full name"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="h-11 sm:h-12 rounded-lg sm:rounded-xl border-2 focus:border-primary transition-colors text-sm sm:text-base"
                      required
                    />
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs sm:text-sm font-medium">Email <span className="text-destructive">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="h-11 sm:h-12 rounded-lg sm:rounded-xl border-2 focus:border-primary transition-colors text-sm sm:text-base"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-xs sm:text-sm font-medium">Phone <span className="text-destructive">*</span></Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="10-digit number"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="h-11 sm:h-12 rounded-lg sm:rounded-xl border-2 focus:border-primary transition-colors text-sm sm:text-base"
                        required
                      />
                    </div>
                  </div>

                  {/* Experience */}
                  <div className="space-y-2">
                    <Label htmlFor="experience" className="text-xs sm:text-sm font-medium">Experience <span className="text-destructive">*</span></Label>
                    <Select 
                      value={formData.experience} 
                      onValueChange={(value) => handleInputChange('experience', value)}
                    >
                      <SelectTrigger className="h-11 sm:h-12 rounded-lg sm:rounded-xl border-2 focus:border-primary text-sm sm:text-base">
                        <SelectValue placeholder="Select experience" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="fresher">Fresher (0-1 yrs)</SelectItem>
                        <SelectItem value="1-3">1-3 years</SelectItem>
                        <SelectItem value="3-5">3-5 years</SelectItem>
                        <SelectItem value="5-8">5-8 years</SelectItem>
                        <SelectItem value="8-10">8-10 years</SelectItem>
                        <SelectItem value="10+">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Current Role & Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentRole" className="text-xs sm:text-sm font-medium">Current Role <span className="text-muted-foreground text-[10px] sm:text-xs">(Opt.)</span></Label>
                      <Input
                        id="currentRole"
                        placeholder="e.g., Software Engineer"
                        value={formData.currentRole}
                        onChange={(e) => handleInputChange('currentRole', e.target.value)}
                        className="h-11 sm:h-12 rounded-lg sm:rounded-xl border-2 focus:border-primary transition-colors text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredLocation" className="text-xs sm:text-sm font-medium">Location <span className="text-muted-foreground text-[10px] sm:text-xs">(Opt.)</span></Label>
                      <Input
                        id="preferredLocation"
                        placeholder="e.g., Mumbai, Remote"
                        value={formData.preferredLocation}
                        onChange={(e) => handleInputChange('preferredLocation', e.target.value)}
                        className="h-11 sm:h-12 rounded-lg sm:rounded-xl border-2 focus:border-primary transition-colors text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="space-y-2">
                    <Label htmlFor="skills" className="text-xs sm:text-sm font-medium">Skills <span className="text-muted-foreground text-[10px] sm:text-xs">(Opt.)</span></Label>
                    <Textarea
                      id="skills"
                      placeholder="e.g., JavaScript, React, Node.js"
                      value={formData.skills}
                      onChange={(e) => handleInputChange('skills', e.target.value)}
                      rows={2}
                      className="rounded-lg sm:rounded-xl border-2 focus:border-primary transition-colors resize-none text-sm sm:text-base"
                    />
                  </div>

                  {/* Resume Upload Section */}
                  <div className="space-y-3">
                    <Label className="text-xs sm:text-sm font-medium">Resume <span className="text-muted-foreground text-[10px] sm:text-xs">(Opt.)</span></Label>
                    <RadioGroup
                      value={resumeChoice}
                      onValueChange={(value) => setResumeChoice(value as 'upload' | 'later')}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <Label
                        htmlFor="upload"
                        className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          resumeChoice === 'upload'
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value="upload" id="upload" />
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4 text-primary" />
                          <span className="text-xs sm:text-sm font-medium">Upload Resume</span>
                        </div>
                      </Label>
                      <Label
                        htmlFor="later"
                        className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          resumeChoice === 'later'
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value="later" id="later" />
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs sm:text-sm font-medium">Submit Later</span>
                        </div>
                      </Label>
                    </RadioGroup>

                    {resumeChoice === 'upload' && (
                      <div className="transition-all duration-200">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                        />
                        
                        {!resumeFile ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-20 sm:h-24 border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-lg sm:rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                          >
                            <Upload className="h-6 w-6 text-primary" />
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              Tap to upload PDF (Max 10MB)
                            </span>
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-green-100 dark:bg-green-800/50 flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{resumeFile.name}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={removeFile}
                              className="h-9 w-9 shrink-0 hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-95"
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit Button - Touch Friendly */}
                  <Button 
                    type="submit" 
                    className="w-full h-12 sm:h-14 bg-gradient-primary text-white font-bold text-base sm:text-lg rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200 active:scale-[0.98]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="hidden sm:inline">Submitting</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Send className="h-5 w-5" />
                        <span className="hidden sm:inline">Register Free</span>
                        <span className="sm:hidden">Register</span>
                      </span>
                    )}
                  </Button>

                  <p className="text-[10px] sm:text-xs text-center text-muted-foreground pt-2">
                    By submitting, you agree to our{' '}
                    <a href="/termsofuse" className="text-primary hover:underline font-medium">Terms</a>
                    {' '}and{' '}
                    <a href="/privacypolicy" className="text-primary hover:underline font-medium">Privacy</a>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
}
