import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEO } from '@/components/SEO';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Company } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AICompanyLogo } from '@/components/companies/AICompanyLogo';
import { Search, Building2, MapPin, Users, ChevronLeft, ChevronRight, Briefcase, GraduationCap, Newspaper } from 'lucide-react';

/** Explore More section — shown when company listing is sparse or empty */
function ExploreMoreSection() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Explore More Opportunities</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/sarkari-jobs">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-5 flex items-start gap-3">
              <GraduationCap className="h-8 w-8 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-foreground">Government Jobs</p>
                <p className="text-sm text-muted-foreground">Browse latest sarkari job notifications</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/private-jobs">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-5 flex items-start gap-3">
              <Briefcase className="h-8 w-8 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-foreground">Private Jobs</p>
                <p className="text-sm text-muted-foreground">Browse private sector openings</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/jobs/employment-news">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="p-5 flex items-start gap-3">
              <Newspaper className="h-8 w-8 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-foreground">Employment News</p>
                <p className="text-sm text-muted-foreground">Latest government recruitment updates</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

const ITEMS_PER_PAGE = 12;

interface CompanyFromJobs {
  name: string;
  jobs_count: number;
  locations: string[];
}

interface RegisteredCompany extends Company {
  jobs_count: number;
}

export default function Companies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();

  const [registeredCompanies, setRegisteredCompanies] = useState<RegisteredCompany[]>([]);
  const [companiesFromJobs, setCompaniesFromJobs] = useState<CompanyFromJobs[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    fetchCompanies();
  }, [currentPage, searchParams]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    const q = searchParams.get('q')?.toLowerCase() || '';

    // First, fetch registered companies (from companies table)
    let registeredQuery = supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .eq('is_approved', true);

    if (q) {
      registeredQuery = registeredQuery.or(`name.ilike.%${q}%,industry.ilike.%${q}%`);
    }

    const { data: registeredData } = await registeredQuery;
    const registeredCompanyNames = new Set((registeredData || []).map(c => c.name.toLowerCase()));

    // Get job counts for registered companies
    const registeredWithCounts: RegisteredCompany[] = await Promise.all(
      (registeredData || []).map(async (company) => {
        const { count: jobsCount } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'active');

        return { ...company, jobs_count: jobsCount || 0 };
      })
    );

    // Fetch unique companies from jobs table (that are NOT in registered companies)
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('company_name, location, city, state')
      .eq('status', 'active')
      .not('company_name', 'is', null);

    // Aggregate jobs by company_name
    const companyMap = new Map<string, CompanyFromJobs>();
    
    (jobsData || []).forEach(job => {
      if (!job.company_name || job.company_name === '[Company Name]') return;
      
      // Skip if this is a registered company
      if (registeredCompanyNames.has(job.company_name.toLowerCase())) return;
      
      // Filter by search query
      if (q && !job.company_name.toLowerCase().includes(q)) return;

      const existing = companyMap.get(job.company_name);
      const location = job.city || job.location || job.state || '';
      
      if (existing) {
        existing.jobs_count += 1;
        if (location && !existing.locations.includes(location)) {
          existing.locations.push(location);
        }
      } else {
        companyMap.set(job.company_name, {
          name: job.company_name,
          jobs_count: 1,
          locations: location ? [location] : [],
        });
      }
    });

    // Convert to array and sort by job count
    const jobCompaniesArray = Array.from(companyMap.values())
      .sort((a, b) => b.jobs_count - a.jobs_count);

    // Combine both sources
    const allCompaniesCount = registeredWithCounts.length + jobCompaniesArray.length;
    setTotalCount(allCompaniesCount);

    // Paginate the combined results
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE;

    // First show registered companies, then job-derived companies
    if (from < registeredWithCounts.length) {
      const registeredSlice = registeredWithCounts.slice(from, Math.min(to, registeredWithCounts.length));
      const remaining = to - registeredWithCounts.length;
      const jobsSlice = remaining > 0 ? jobCompaniesArray.slice(0, remaining) : [];
      
      setRegisteredCompanies(registeredSlice);
      setCompaniesFromJobs(jobsSlice);
    } else {
      const jobsFrom = from - registeredWithCounts.length;
      const jobsSlice = jobCompaniesArray.slice(jobsFrom, jobsFrom + ITEMS_PER_PAGE);
      
      setRegisteredCompanies([]);
      setCompaniesFromJobs(jobsSlice);
    }

    setIsLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    setSearchParams(params);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const companiesSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Companies Hiring in India',
    description: 'Discover top companies hiring in India. Browse company profiles, open positions, and apply directly on TrueJobs.',
    url: 'https://truejobs.co.in/companies',
  };

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO
        title="Companies Hiring in India - Browse Employers"
        description="Discover top companies hiring in India. Browse company profiles, open positions, and apply directly on TrueJobs."
        url="/companies"
        structuredData={companiesSchema}
      />
      <div className="bg-muted/30 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">{t('nav.companies')}</h1>
          <p className="text-muted-foreground mb-6">
            Discover companies hiring now and explore their open positions
          </p>

          <form onSubmit={handleSearch} className="flex gap-4 max-w-xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search companies by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-16 w-16 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-3" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : registeredCompanies.length === 0 && companiesFromJobs.length === 0 ? (
          <div className="space-y-8">
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No companies found</h3>
                <p className="text-muted-foreground">
                  {searchParams.get('q') ? 'Try adjusting your search criteria' : 'We\'re building India\'s employer directory. Explore job opportunities while we grow this section.'}
                </p>
              </CardContent>
            </Card>
            {/* Explore More section when listing is sparse/empty */}
            <ExploreMoreSection />
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">{totalCount} companies found</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Registered companies with full profiles */}
              {registeredCompanies.map((company) => (
                <Card key={company.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <AICompanyLogo 
                        companyName={company.name} 
                        existingLogoUrl={company.logo_url}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/companies/${company.slug}`}
                          className="text-lg font-semibold hover:text-primary transition-colors block truncate"
                        >
                          {company.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          {company.is_verified && (
                            <Badge variant="default" className="text-xs">Verified</Badge>
                          )}
                          {company.industry && (
                            <Badge variant="secondary" className="text-xs">
                              {company.industry}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {company.description && (
                      <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                        {company.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                      {company.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {company.location}
                        </span>
                      )}
                      {company.company_size && (
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {company.company_size}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-sm">
                        <strong>{company.jobs_count}</strong> open positions
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/companies/${company.slug}`}>
                          View Company
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Companies derived from jobs (no full profile) */}
              {companiesFromJobs.map((company) => (
                <Card key={company.name} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <AICompanyLogo 
                        companyName={company.name} 
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/companies/${encodeURIComponent(company.name)}`}
                          className="text-lg font-semibold hover:text-primary transition-colors block truncate"
                        >
                          {company.name}
                        </Link>
                        <Badge variant="outline" className="mt-1 text-xs">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {company.jobs_count} {company.jobs_count === 1 ? 'job' : 'jobs'}
                        </Badge>
                      </div>
                    </div>

                    {company.locations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-4 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">
                          {company.locations.slice(0, 3).join(', ')}
                          {company.locations.length > 3 && ` +${company.locations.length - 3} more`}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-sm text-primary font-medium">
                        {company.jobs_count} open {company.jobs_count === 1 ? 'position' : 'positions'}
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/companies/${encodeURIComponent(company.name)}`}>
                          View Company
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Explore More — shown when listing is sparse (< 6 total results) */}
        {!isLoading && totalCount > 0 && totalCount < 6 && (
          <div className="mt-12">
            <ExploreMoreSection />
          </div>
        )}
      </div>
    </Layout>
  );
}
