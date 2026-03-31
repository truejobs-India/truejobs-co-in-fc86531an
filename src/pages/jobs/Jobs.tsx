import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { INSURANCE_STATES, INSURANCE_CITIES } from './cityData';
import { NEAR_ME_PAGES } from './nearMeData';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Job } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { AISearchAnimation } from '@/components/jobs/AISearchAnimation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, MapPin, Clock, IndianRupee, Building2, Bookmark, BookmarkCheck, 
  Filter, X, Briefcase, ChevronLeft, ChevronRight, Landmark 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
const JOB_TYPE_VALUES = ['full_time', 'part_time', 'contract', 'internship', 'remote'];

// Experience level values for database queries
const EXPERIENCE_VALUES = ['fresher', 'junior', 'mid', 'senior', 'lead', 'executive'];

const ITEMS_PER_PAGE = 12;

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Get translated job types
  const getJobTypes = () => [
    { value: 'full_time', label: t('job.fullTime') },
    { value: 'part_time', label: t('job.partTime') },
    { value: 'contract', label: t('job.contract') },
    { value: 'internship', label: t('job.internship') },
    { value: 'remote', label: t('job.remote') },
  ];

  // Get translated experience levels
  const getExperienceLevels = () => [
    { value: 'fresher', label: t('exp.fresher') },
    { value: 'junior', label: `${t('exp.junior')} (1-2 yrs)` },
    { value: 'mid', label: `${t('exp.mid')} (3-5 yrs)` },
    { value: 'senior', label: `${t('exp.senior')} (5-8 yrs)` },
    { value: 'lead', label: `${t('exp.lead')} (8+ yrs)` },
    { value: 'executive', label: t('exp.executive') },
  ];

  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAISearching, setIsAISearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sectorTab, setSectorTab] = useState('all');
  const [sectorCounts, setSectorCounts] = useState({ government: 0, private: 0 });

  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(
    searchParams.get('type')?.split(',').filter(Boolean) || []
  );
  const [selectedExperience, setSelectedExperience] = useState<string[]>(
    searchParams.get('experience')?.split(',').filter(Boolean) || []
  );
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, 100]);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

  useEffect(() => {
    fetchJobs();
    fetchSectorCounts();
    if (user) {
      fetchSavedJobs();
    }
  }, [currentPage, sortBy, user, sectorTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, location, selectedJobTypes, selectedExperience, salaryRange, sectorTab]);

  const fetchSectorCounts = async () => {
    const [govtRes, privateRes] = await Promise.all([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('job_sector', 'government'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('job_sector', 'private'),
    ]);
    setSectorCounts({ government: govtRes.count || 0, private: privateRes.count || 0 });
  };

  const fetchJobs = async () => {
    setIsLoading(true);

    let query = supabase
      .from('jobs')
      .select('*, company:companies(*)', { count: 'exact' })
      .eq('status', 'active');

    // Apply sector filter
    if (sectorTab === 'government') {
      query = query.eq('job_sector', 'government');
    } else if (sectorTab === 'private') {
      query = query.eq('job_sector', 'private');
    }

    // Apply filters
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }
    if (selectedJobTypes.length > 0) {
      query = query.in('job_type', selectedJobTypes as ('full_time' | 'part_time' | 'contract' | 'internship' | 'remote')[]);
    }
    if (selectedExperience.length > 0) {
      query = query.in('experience_level', selectedExperience as ('fresher' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive')[]);
    }
    if (salaryRange[0] > 0) {
      query = query.gte('salary_min', salaryRange[0] * 10000);
    }
    if (salaryRange[1] < 100) {
      query = query.lte('salary_max', salaryRange[1] * 10000);
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'salary_high':
        query = query.order('salary_max', { ascending: false, nullsFirst: false });
        break;
      case 'salary_low':
        query = query.order('salary_min', { ascending: true, nullsFirst: false });
        break;
    }

    // Pagination
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (!error && data) {
      setJobs(data as Job[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  };

  const fetchSavedJobs = async () => {
    const { data } = await supabase
      .from('saved_jobs')
      .select('job_id')
      .eq('user_id', user!.id);

    if (data) {
      setSavedJobIds(new Set(data.map((s) => s.job_id)));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (location) params.set('location', location);
    if (selectedJobTypes.length) params.set('type', selectedJobTypes.join(','));
    if (selectedExperience.length) params.set('experience', selectedExperience.join(','));
    if (sortBy !== 'newest') params.set('sort', sortBy);
    setSearchParams(params);
    
    // Track search query
    if (searchQuery.trim()) {
      supabase.rpc('upsert_search_query', { p_query: searchQuery.trim(), p_source: 'jobs' }).then(() => {});
    }
    
    // Trigger AI animation
    setIsAISearching(true);
  };

  const handleAISearchComplete = useCallback(() => {
    setIsAISearching(false);
    fetchJobs();
  }, []);

  const toggleSaveJob = async (jobId: string) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please login to save jobs',
        variant: 'destructive',
      });
      return;
    }

    const isSaved = savedJobIds.has(jobId);

    if (isSaved) {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', jobId);

      if (!error) {
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        toast({ title: 'Job removed from saved' });
      }
    } else {
      const { error } = await supabase
        .from('saved_jobs')
        .insert({ user_id: user.id, job_id: jobId });

      if (!error) {
        setSavedJobIds((prev) => new Set([...prev, jobId]));
        toast({ title: 'Job saved!' });
      }
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setLocation('');
    setSelectedJobTypes([]);
    setSelectedExperience([]);
    setSalaryRange([0, 100]);
    setSortBy('newest');
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || location || selectedJobTypes.length > 0 || 
    selectedExperience.length > 0 || salaryRange[0] > 0 || salaryRange[1] < 100;

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return 'Not disclosed';
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `${formatter.format(min)}+`;
    return `Up to ${formatter.format(max!)}`;
  };

  const getJobTypeLabel = (type: string) => {
    return getJobTypes().find((t) => t.value === type)?.label || type;
  };

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Job Type */}
      <div>
        <h4 className="font-medium mb-3">{t('jobs.jobType')}</h4>
        <div className="space-y-2">
          {getJobTypes().map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                id={type.value}
                checked={selectedJobTypes.includes(type.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedJobTypes([...selectedJobTypes, type.value]);
                  } else {
                    setSelectedJobTypes(selectedJobTypes.filter((t) => t !== type.value));
                  }
                }}
              />
              <Label htmlFor={type.value} className="text-sm cursor-pointer">
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Experience Level */}
      <div>
        <h4 className="font-medium mb-3">{t('jobs.experienceLevel')}</h4>
        <div className="space-y-2">
          {getExperienceLevels().map((exp) => (
            <div key={exp.value} className="flex items-center space-x-2">
              <Checkbox
                id={exp.value}
                checked={selectedExperience.includes(exp.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedExperience([...selectedExperience, exp.value]);
                  } else {
                    setSelectedExperience(selectedExperience.filter((e) => e !== exp.value));
                  }
                }}
              />
              <Label htmlFor={exp.value} className="text-sm cursor-pointer">
                {exp.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Salary Range */}
      <div>
        <h4 className="font-medium mb-3">{t('jobs.salaryRange')}</h4>
        <div className="px-2">
          <Slider
            value={salaryRange}
            onValueChange={(value) => setSalaryRange(value as [number, number])}
            max={100}
            step={5}
            className="mb-2"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>₹{salaryRange[0]}L</span>
            <span>₹{salaryRange[1]}L+</span>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          <X className="h-4 w-4 mr-2" />
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  );

  const jobsPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Job Listings - Browse All Jobs in India',
    description: 'Browse thousands of verified job openings across India. Filter by location, salary, experience level and job type. Apply directly on TrueJobs.',
    url: 'https://truejobs.co.in/jobs',
    isPartOf: { '@type': 'WebSite', name: 'TrueJobs', url: 'https://truejobs.co.in' },
  };

  return (
    <Layout>
      <SEO
        title="Jobs in India - Browse Latest Openings"
        description="Browse thousands of verified job openings across India. Filter by location, salary, experience level and job type. Apply directly on TrueJobs."
        url="/jobs"
        structuredData={jobsPageSchema}
      />
      {/* AI Search Animation Overlay */}
      <AISearchAnimation isSearching={isAISearching} onComplete={handleAISearchComplete} />
      
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/" itemProp="item" className="hover:text-primary"><span itemProp="name">Home</span></Link>
              <meta itemProp="position" content="1" />
            </li>
            <li className="text-muted-foreground">/</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span itemProp="name" className="text-foreground font-medium">Jobs</span>
              <meta itemProp="position" content="2" />
            </li>
          </ol>
        </div>
      </nav>

      <div className="bg-muted/30 py-8">
        <div className="container mx-auto px-4">
          {/* Sector Tabs */}
          <Tabs value={sectorTab} onValueChange={setSectorTab} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Jobs</TabsTrigger>
              <TabsTrigger value="government" className="gap-1.5">
                <Landmark className="h-3.5 w-3.5" />
                Government ({sectorCounts.government.toLocaleString()})
              </TabsTrigger>
              <TabsTrigger value="private" className="gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Private ({sectorCounts.private.toLocaleString()})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <h1 className="text-3xl font-bold mb-6">{t('nav.jobs')}</h1>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('jobs.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('jobs.locationPlaceholder')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" className="md:w-auto">
              <Search className="h-4 w-4 mr-2" />
              {t('common.search')}
            </Button>
          </form>

          {/* Active Filters & Sort */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Mobile Filter Button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <Filter className="h-4 w-4 mr-2" />
                    {t('jobs.filters')}
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2">
                        Active
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FiltersContent />
                  </div>
                </SheetContent>
              </Sheet>

              {/* Active Filter Tags */}
              {selectedJobTypes.map((type) => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {getJobTypeLabel(type)}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedJobTypes(selectedJobTypes.filter((t) => t !== type))}
                  />
                </Badge>
              ))}
              {selectedExperience.map((exp) => (
                <Badge key={exp} variant="secondary" className="gap-1">
                  {getExperienceLevels().find((e) => e.value === exp)?.label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedExperience(selectedExperience.filter((e) => e !== exp))}
                  />
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{totalCount} {t('jobs.jobsFound')}</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('common.sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('jobs.newest')}</SelectItem>
                  <SelectItem value="oldest">{t('jobs.oldest')}</SelectItem>
                  <SelectItem value="salary_high">{t('jobs.salaryHighLow')}</SelectItem>
                  <SelectItem value="salary_low">{t('jobs.salaryLowHigh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 my-6">
        <AdPlaceholder variant="banner" />
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {t('jobs.filters')}
                </h3>
                <FiltersContent />
              </CardContent>
            </Card>
          </aside>

          {/* Job Listings */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <Skeleton className="h-14 w-14 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-1/2 mb-2" />
                          <Skeleton className="h-4 w-1/3 mb-3" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('jobs.noJobsFound')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('jobs.tryAdjusting')}
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    {t('common.clearFilters')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4">
                  {jobs.map((job) => (
                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {job.company?.logo_url ? (
                              <img
                                src={job.company.logo_url}
                                alt={`${job.company.name} logo`}
                                className="h-10 w-10 object-contain"
                              />
                            ) : (
                              <Building2 className="h-7 w-7 text-primary" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <Link
                                  to={`/jobs/${job.id}`}
                                  className="text-lg font-semibold hover:text-primary transition-colors line-clamp-1"
                                >
                                  {job.title}
                                </Link>
                                <p className="text-muted-foreground">
                                  {job.company?.name || (job as any).company_name || 'Company'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {job.is_featured && (
                                  <Badge className="bg-amber-500">Featured</Badge>
                                )}
                                <Badge variant="secondary">{getJobTypeLabel(job.job_type)}</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleSaveJob(job.id)}
                                >
                                  {savedJobIds.has(job.id) ? (
                                    <BookmarkCheck className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Bookmark className="h-5 w-5" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {job.location || 'Remote'}
                              </span>
                              {job.is_salary_visible && (job.salary_min || job.salary_max) && (
                                <span className="flex items-center gap-1">
                                  <IndianRupee className="h-4 w-4" />
                                  {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {job.skills_required.slice(0, 5).map((skill) => (
                                <Badge key={skill} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {job.skills_required.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{job.skills_required.length - 5} more
                                </Badge>
                              )}
                            </div>

                          </div>
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
          </div>
        </div>

        {/* Popular Insurance Advisor Job Locations */}
        <section className="mt-12 mb-4">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Popular Insurance Advisor Job Locations</h2>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">By State</h3>
            <div className="flex flex-wrap gap-2">
              {INSURANCE_STATES.map((s) => (
                <Link
                  key={s.slug}
                  to={s.path}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {s.state}
                </Link>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Top Cities</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5">
              {INSURANCE_CITIES.slice(0, 20).map((c) => (
                <Link
                  key={c.slug}
                  to={`/${c.slug}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Insurance Advisor – {c.city}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Jobs Near Me</h3>
            <div className="flex flex-wrap gap-2">
              {NEAR_ME_PAGES.map((p) => (
                <Link
                  key={p.slug}
                  to={`/${p.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {p.h1}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <EmailDigestCapture variant="banner" className="mt-8" />
      </div>
    </Layout>
  );
}
