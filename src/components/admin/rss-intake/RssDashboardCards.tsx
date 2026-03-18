import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Rss, CheckCircle, AlertTriangle, FileText, Clock, ClipboardList, XCircle, TrendingUp, Briefcase, GraduationCap, BookOpen, Shield } from 'lucide-react';

interface DashboardStats {
  totalSources: number;
  activeSources: number;
  brokenSources: number;
  totalItems: number;
  newItems7d: number;
  pendingReviews: number;
  failedSources: number;
  recentRuns: number;
  jobsItems: number;
  educationItems: number;
  examItems: number;
  policyAlertItems: number;
}

export function RssDashboardCards() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSources: 0, activeSources: 0, brokenSources: 0,
    totalItems: 0, newItems7d: 0, pendingReviews: 0, failedSources: 0, recentRuns: 0,
    jobsItems: 0, educationItems: 0, examItems: 0, policyAlertItems: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        totalSrc, activeSrc, brokenSrc,
        totalItems, newItems,
        pendingReviews, failedSrc, recentRuns,
        jobsItems, educationItems, examItems, policyAlertItems,
      ] = await Promise.all([
        supabase.from('rss_sources' as any).select('id', { count: 'exact', head: true }),
        supabase.from('rss_sources' as any).select('id', { count: 'exact', head: true }).eq('fetch_enabled', true).not('status', 'in', '("Broken","Paused")'),
        supabase.from('rss_sources' as any).select('id', { count: 'exact', head: true }).eq('status', 'Broken'),
        supabase.from('rss_items' as any).select('id', { count: 'exact', head: true }),
        supabase.from('rss_items' as any).select('id', { count: 'exact', head: true }).gte('first_seen_at', sevenDaysAgo),
        supabase.from('monitoring_review_queue' as any).select('id', { count: 'exact', head: true }).eq('review_status', 'pending'),
        supabase.from('rss_sources' as any).select('id', { count: 'exact', head: true }).not('last_error', 'is', null),
        supabase.from('rss_fetch_runs' as any).select('id', { count: 'exact', head: true }).eq('status', 'success').gte('started_at', sevenDaysAgo),
        supabase.from('rss_items' as any).select('id', { count: 'exact', head: true }).eq('primary_domain', 'jobs'),
        supabase.from('rss_items' as any).select('id', { count: 'exact', head: true }).eq('primary_domain', 'education_services'),
        supabase.from('rss_items' as any).select('id', { count: 'exact', head: true }).eq('primary_domain', 'exam_updates'),
        supabase.from('rss_items' as any).select('id', { count: 'exact', head: true }).in('primary_domain', ['policy_updates', 'public_services', 'general_alerts']),
      ]);

      setStats({
        totalSources: (totalSrc as any).count || 0,
        activeSources: (activeSrc as any).count || 0,
        brokenSources: (brokenSrc as any).count || 0,
        totalItems: (totalItems as any).count || 0,
        newItems7d: (newItems as any).count || 0,
        pendingReviews: (pendingReviews as any).count || 0,
        failedSources: (failedSrc as any).count || 0,
        recentRuns: (recentRuns as any).count || 0,
        jobsItems: (jobsItems as any).count || 0,
        educationItems: (educationItems as any).count || 0,
        examItems: (examItems as any).count || 0,
        policyAlertItems: (policyAlertItems as any).count || 0,
      });
    } catch (e) {
      console.error('Failed to fetch RSS stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { label: 'Total Sources', value: stats.totalSources, icon: Rss, color: 'text-blue-500' },
    { label: 'Active Sources', value: stats.activeSources, icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Total Items', value: stats.totalItems, icon: FileText, color: 'text-indigo-500' },
    { label: 'New (7d)', value: stats.newItems7d, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Pending Review', value: stats.pendingReviews, icon: ClipboardList, color: 'text-yellow-500' },
    { label: 'Successful Runs (7d)', value: stats.recentRuns, icon: Clock, color: 'text-purple-500' },
    { label: 'Broken Sources', value: stats.brokenSources, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Sources with Errors', value: stats.failedSources, icon: XCircle, color: 'text-orange-500' },
    { label: 'Government Jobs', value: stats.jobsItems, icon: Briefcase, color: 'text-emerald-600' },
    { label: 'Education Services', value: stats.educationItems, icon: GraduationCap, color: 'text-blue-600' },
    { label: 'Exam Updates', value: stats.examItems, icon: BookOpen, color: 'text-purple-600' },
    { label: 'Policy / Alerts', value: stats.policyAlertItems, icon: Shield, color: 'text-pink-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : card.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
