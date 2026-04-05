import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Calendar, Search, ChevronLeft, ChevronRight, Building2, ExternalLink } from 'lucide-react';

const PER_PAGE = 20;

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['public-notifications', page, search, stateFilter],
    queryFn: async () => {
      let query = supabase
        .from('employment_news_jobs')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .eq('job_category', 'Notification')
        .order('published_at', { ascending: false });

      if (search.trim()) {
        query = query.or(`org_name.ilike.%${search}%,post.ilike.%${search}%,enriched_title.ilike.%${search}%`);
      }
      if (stateFilter !== 'all') query = query.eq('state', stateFilter);

      const from = (page - 1) * PER_PAGE;
      query = query.range(from, from + PER_PAGE - 1);

      const { data: items, count, error } = await query;
      if (error) throw error;
      return { items: items || [], count: count || 0 };
    },
    staleTime: 5 * 60 * 1000,
  });

  const totalPages = Math.ceil((data?.count || 0) / PER_PAGE);

  return (
    <Layout>
      <SEO
        title="Latest Official Notifications 2026 – Recruitment & Exam Notices"
        description="Latest official recruitment notifications, exam notices, document verification schedules, shortlist notices & important government updates on TrueJobs."
        canonical="https://truejobs.co.in/notifications"
      />
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div>
        <h1 className="text-3xl font-bold mb-2">Latest Official Notifications</h1>
        <p className="text-muted-foreground mb-6">
          Official recruitment notifications, exam notices, corrigenda, shortlists & important updates
        </p>

        <AdPlaceholder variant="banner" />

        {!isLoading && data && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing {data.items.length} of {data.count} notification{data.count !== 1 ? 's' : ''}
          </p>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by organisation or notice title…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={stateFilter} onValueChange={v => { setStateFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Bihar', 'Odisha', 'Punjab', 'Haryana', 'Andhra Pradesh'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notification Cards */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No notifications found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.items.map((item: any) => (
              <Link key={item.id} to={`/jobs/employment-news/${item.slug || item.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {item.org_name && (
                          <p className="text-sm font-semibold text-primary flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {item.org_name}
                          </p>
                        )}
                        <h2 className="text-lg font-bold mt-0.5 truncate">
                          {item.enriched_title || item.post || 'Official Notification'}
                        </h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <Bell className="h-3 w-3 mr-1" /> Notification
                          </Badge>
                          {item.state && (
                            <Badge variant="outline" className="text-xs">{item.state}</Badge>
                          )}
                          {item.location && (
                            <Badge variant="outline" className="text-xs">{item.location}</Badge>
                          )}
                        </div>
                        {item.meta_description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.meta_description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {item.last_date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Deadline: {item.last_date}
                          </p>
                        )}
                        {item.apply_link && (
                          <Badge variant="outline" className="text-xs mt-1">
                            <ExternalLink className="h-3 w-3 mr-1" /> Official Link
                          </Badge>
                        )}
                        <Button variant="outline" size="sm" className="mt-2">View Notice</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <AdPlaceholder variant="in-content" />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
