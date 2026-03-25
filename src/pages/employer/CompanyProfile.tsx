import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Company } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, Globe, MapPin, Calendar, Upload, Loader2, Save } from 'lucide-react';

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'E-commerce',
  'Manufacturing',
  'Consulting',
  'Media & Entertainment',
  'Real Estate',
  'Transportation',
  'Other',
];

export default function CompanyProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [isNewCompany, setIsNewCompany] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [location, setLocation] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchCompany();
  }, [user]);

  const fetchCompany = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCompany(data as Company);
      setName(data.name);
      setSlug(data.slug);
      setDescription(data.description || '');
      setIndustry(data.industry || '');
      setCompanySize(data.company_size || '');
      setFoundedYear(data.founded_year?.toString() || '');
      setWebsiteUrl(data.website_url || '');
      setLinkedinUrl(data.linkedin_url || '');
      setLocation(data.location || '');
      setLogoUrl(data.logo_url);
      setCoverImageUrl(data.cover_image_url);
    } else {
      setIsNewCompany(true);
    }
    setIsLoading(false);
  };

  const generateSlug = (companyName: string) => {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (isNewCompany) {
      setSlug(generateSlug(value));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim() || !slug.trim()) {
      toast({ title: t('companyProfile.companyNameRequired'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const companyData = {
      name,
      slug,
      description: description || null,
      industry: industry || null,
      company_size: companySize || null,
      founded_year: foundedYear ? parseInt(foundedYear) : null,
      website_url: websiteUrl || null,
      linkedin_url: linkedinUrl || null,
      location: location || null,
      logo_url: logoUrl,
      cover_image_url: coverImageUrl,
    };

    let error;
    if (company) {
      const result = await supabase
        .from('companies')
        .update(companyData)
        .eq('id', company.id);
      error = result.error;
    } else {
      // Double-check no company exists before creating (prevent duplicates)
      const { data: existingCheck } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();

      if (existingCheck) {
        // Company already exists (race condition) - update instead
        const result = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', existingCheck.id);
        error = result.error;
        if (!error) {
          setCompany({ ...existingCheck, ...companyData, owner_id: user.id } as Company);
          setIsNewCompany(false);
        }
      } else {
        const result = await supabase
          .from('companies')
          .insert({ ...companyData, owner_id: user.id, is_approved: true, auto_approve_jobs: true });
        error = result.error;
      }
    }

    if (error) {
      toast({ title: t('common.error') || 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isNewCompany ? t('companyProfile.companyCreated') : t('companyProfile.companyUpdated') });
      // Refetch to get the full company object (needed for logo/cover uploads)
      await fetchCompany();
      if (isNewCompany) {
        // After creating, stay on the page briefly to show success, then redirect
        setTimeout(() => navigate('/employer/dashboard'), 500);
      }
    }
    setIsSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${company.id}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: t('companyProfile.uploadFailed'), description: uploadError.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(filePath);
      setLogoUrl(publicUrl);
      await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', company.id);
      toast({ title: t('companyProfile.logoUploaded') });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${company.id}/cover.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: t('companyProfile.uploadFailed'), description: uploadError.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(filePath);
      setCoverImageUrl(publicUrl);
      await supabase.from('companies').update({ cover_image_url: publicUrl }).eq('id', company.id);
      toast({ title: t('companyProfile.coverUploaded') });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Company Profile" noindex />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              {isNewCompany ? t('companyProfile.createTitle') : t('companyProfile.editTitle')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isNewCompany
                ? t('companyProfile.setupDesc')
                : t('companyProfile.manageDesc')}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isNewCompany ? t('companyProfile.createCompany') : t('companyProfile.saveChanges')}
          </Button>
        </div>

        <div className="space-y-8">
          {/* Logo & Cover */}
          {company && (
            <Card>
              <CardHeader>
                <CardTitle>{t('companyProfile.branding')}</CardTitle>
                <CardDescription>{t('companyProfile.brandingDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Company logo preview" className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90">
                      <Upload className="h-4 w-4" />
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                  <div>
                    <p className="font-medium">{t('companyProfile.companyLogo')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('companyProfile.logoRecommended')}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-2">{t('companyProfile.coverImage')}</p>
                  <label className="block">
                    <div className="h-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden border cursor-pointer hover:bg-muted/80 transition-colors">
                      {coverImageUrl ? (
                        <img src={coverImageUrl} alt="Company cover image preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">{t('companyProfile.clickToUpload')}</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('companyProfile.coverRecommended')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('companyProfile.basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('companyProfile.companyName')} *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="pl-10"
                    placeholder="Acme Corporation"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('companyProfile.aboutCompany')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('companyProfile.aboutPlaceholder')}
                  rows={5}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('companyProfile.industry')}</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('companyProfile.selectIndustry')} />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('companyProfile.companySize')}</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('companyProfile.selectSize')} />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size} {t('companyProfile.employees')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="founded">{t('companyProfile.foundedYear')}</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="founded"
                      type="number"
                      value={foundedYear}
                      onChange={(e) => setFoundedYear(e.target.value)}
                      className="pl-10"
                      placeholder="2020"
                      min="1800"
                      max={new Date().getFullYear()}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">{t('companyProfile.headquarters')}</Label>
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
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle>{t('companyProfile.onlinePresence')}</CardTitle>
              <CardDescription>{t('companyProfile.onlinePresenceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">{t('companyProfile.website')}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="pl-10"
                    placeholder="https://www.yourcompany.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">{t('companyProfile.linkedin')}</Label>
                <Input
                  id="linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/yourcompany"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}