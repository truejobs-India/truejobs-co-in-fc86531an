import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Briefcase, Clock, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { formatDistanceToNow } from 'date-fns';

export default function PrivateJobs() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['private-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, slug, company_name, location, city, state, job_type, experience_level, salary_min, salary_max, salary_currency, created_at, is_featured, skills_required')
        .eq('status', 'active')
        .eq('job_sector', 'private' as any)
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return data;
    },
  });

  const filteredJobs = jobs?.filter(job => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.title?.toLowerCase().includes(q) ||
      job.company_name?.toLowerCase().includes(q) ||
      job.location?.toLowerCase().includes(q) ||
      job.city?.toLowerCase().includes(q) ||
      job.state?.toLowerCase().includes(q)
    );
  });

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://truejobs.co.in/' },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: 'https://truejobs.co.in/jobs' },
      { '@type': 'ListItem', position: 3, name: 'Private Jobs', item: 'https://truejobs.co.in/private-jobs' },
    ],
  };

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Private Jobs in India 2026',
    description: 'Browse latest private sector job openings across India — IT, Banking, Sales, Marketing & more.',
    url: 'https://truejobs.co.in/private-jobs',
    numberOfItems: filteredJobs?.length || 0,
  };

  return (
    <Layout>
      <SEO
        title="Private Jobs in India 2026 | Latest Private Sector Job Openings"
        description="Find latest private sector jobs in India 2026. IT, banking, sales, marketing, fresher & experienced openings from top companies. Apply now on TrueJobs."
        url="/private-jobs"
        structuredData={[breadcrumbSchema, collectionSchema]}
      />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-primary">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Private Jobs</li>
          </ol>
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-primary/10 via-background to-accent/10 py-10 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="h-10 w-10 md:h-12 md:w-12 text-primary" />
            <h1 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">
              Private Jobs in India 2026 — Latest IT, Banking, Sales & More
            </h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mt-2">
            Latest private sector job openings from top companies across India
          </p>

          <div className="mt-8 max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by title, company, location..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-base rounded-full shadow-medium bg-background"
            />
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <section className="py-10 md:py-14 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {isLoading ? 'Loading...' : `${filteredJobs?.length || 0} Private Jobs Found`}
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : filteredJobs && filteredJobs.length > 0 ? (
            <div className="space-y-4">
              {filteredJobs.map(job => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.slug}`}
                  className="block card-premium rounded-2xl p-5 md:p-6 group"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-semibold text-base md:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {job.title}
                        </h3>
                        {job.is_featured && (
                          <Badge variant="default" className="bg-gradient-primary text-xs shrink-0">Featured</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                        {job.company_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" /> {job.company_name}
                          </span>
                        )}
                        {(job.city || job.state || job.location) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {job.city || job.state || job.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" /> {job.job_type?.replace('_', ' ')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {job.skills_required && job.skills_required.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {job.skills_required.slice(0, 4).map(skill => (
                            <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                          ))}
                          {job.skills_required.length > 4 && (
                            <Badge variant="outline" className="text-xs">+{job.skills_required.length - 4}</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {job.salary_min && (
                        <span className="text-sm font-semibold text-primary">
                          {job.salary_currency === 'INR' ? '₹' : '$'}{(job.salary_min / 1000).toFixed(0)}K
                          {job.salary_max ? `–${(job.salary_max / 1000).toFixed(0)}K` : '+'}
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Private Jobs Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term.' : 'New private sector jobs are added daily. Check back soon!'}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 my-6">
        <AdPlaceholder variant="banner" />
      </div>
    </Layout>
  );
}
