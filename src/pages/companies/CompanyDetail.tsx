import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEO } from '@/components/SEO';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AICompanyLogo } from '@/components/companies/AICompanyLogo';
import { 
  Building2, MapPin, Briefcase, Clock, IndianRupee, 
  ArrowLeft, Globe, Users, Calendar, ChevronRight 
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Job = Tables<'jobs'>;

interface CompanyData {
  name: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  location?: string;
  company_size?: string;
  website_url?: string;
  founded_year?: number;
  is_verified?: boolean;
}

export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchCompanyData();
    }
  }, [slug]);

  const fetchCompanyData = async () => {
    setIsLoading(true);

    // First try to find registered company by slug
    const { data: registeredCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .eq('is_approved', true)
      .single();

    if (registeredCompany) {
      setCompany(registeredCompany);
      setIsRegistered(true);

      // Fetch jobs for registered company
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', registeredCompany.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setJobs(jobsData || []);
    } else {
      // This is a company name from jobs (URL decoded)
      const companyName = decodeURIComponent(slug || '');
      
      setCompany({
        name: companyName,
      });
      setIsRegistered(false);

      // Fetch jobs by company_name
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_name', companyName)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setJobs(jobsData || []);

      // Extract location from jobs
      if (jobsData && jobsData.length > 0) {
        const locations = [...new Set(jobsData.map(j => j.city || j.location).filter(Boolean))];
        setCompany(prev => prev ? {
          ...prev,
          location: locations.slice(0, 3).join(', '),
        } : null);
      }
    }

    setIsLoading(false);
  };

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return null;
    const formatNum = (n: number) => {
      if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
      if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
      return n.toString();
    };
    if (min && max) return `₹${formatNum(min)} - ₹${formatNum(max)}`;
    if (min) return `₹${formatNum(min)}+`;
    if (max) return `Up to ₹${formatNum(max)}`;
    return null;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-2 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Company Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The company you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/companies">Browse Companies</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const companySchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: company.website_url || `https://truejobs.co.in/companies/${slug}`,
    ...(company.logo_url ? { logo: company.logo_url } : {}),
    ...(company.description ? { description: company.description } : {}),
    ...(company.location ? { address: { '@type': 'PostalAddress', addressLocality: company.location, addressCountry: 'IN' } } : {}),
  };

  return (
    <Layout>
      <SEO
        title={`${company.name} - Jobs & Company Profile`}
        description={company.description || `View ${company.name} company profile, open positions and career opportunities on TrueJobs.`}
        url={`/companies/${slug}`}
        structuredData={companySchema}
      />
      {/* Top Banner Ad */}
      <AdPlaceholder variant="banner" />
      {/* Header */}
      <div className="bg-muted/30 py-8 border-b">
        <div className="container mx-auto px-4">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/companies">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Companies
            </Link>
          </Button>

          <div className="flex items-start gap-6">
            <AICompanyLogo 
              companyName={company.name} 
              existingLogoUrl={company.logo_url}
              size="lg"
            />

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{company.name}</h1>
                {company.is_verified && (
                  <Badge variant="default">Verified</Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {company.industry && (
                  <Badge variant="secondary">{company.industry}</Badge>
                )}
                {company.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {company.location}
                  </span>
                )}
                {company.company_size && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {company.company_size} employees
                  </span>
                )}
                {company.founded_year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Founded {company.founded_year}
                  </span>
                )}
              </div>

              {company.website_url && (
                <a 
                  href={company.website_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-2 text-sm"
                >
                  <Globe className="h-4 w-4" />
                  Visit Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {company.description && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">About</h3>
                  <p className="text-sm text-muted-foreground">
                    {company.description}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Open Positions</span>
                    <Badge variant="outline">{jobs.length}</Badge>
                  </div>
                  {jobs.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Job Types</span>
                        <span className="text-sm font-medium">
                          {[...new Set(jobs.map(j => j.job_type))].length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Locations</span>
                        <span className="text-sm font-medium">
                          {[...new Set(jobs.map(j => j.city || j.location).filter(Boolean))].length}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Jobs List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {jobs.length} Open {jobs.length === 1 ? 'Position' : 'Positions'}
              </h2>
            </div>

            {jobs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Open Positions</h3>
                  <p className="text-muted-foreground">
                    This company doesn't have any active job openings at the moment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <Link
                            to={`/jobs/${job.slug}`}
                            className="text-lg font-semibold hover:text-primary transition-colors"
                          >
                            {job.title}
                          </Link>

                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            {(job.city || job.location) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {job.city || job.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              {job.job_type?.replace('_', ' ')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {job.experience_level}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {formatSalary(job.salary_min, job.salary_max) && (
                              <Badge variant="outline" className="text-green-600">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {formatSalary(job.salary_min, job.salary_max)}
                              </Badge>
                            )}
                            {job.is_remote && (
                              <Badge variant="secondary">Remote</Badge>
                            )}
                            {job.is_work_from_home && (
                              <Badge variant="secondary">WFH</Badge>
                            )}
                            {job.is_featured && (
                              <Badge variant="default">Featured</Badge>
                            )}
                          </div>
                        </div>

                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/jobs/${job.slug}`}>
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
