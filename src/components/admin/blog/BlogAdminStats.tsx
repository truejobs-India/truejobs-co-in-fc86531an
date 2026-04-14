import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Eye, EyeOff, ImageOff, AlertTriangle, Clock, ShieldAlert, ShieldCheck, User, Ban, Loader2 } from 'lucide-react';
import { blogPostToMetadata } from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance, getComplianceReadinessStatus } from '@/lib/blogComplianceAnalyzer';
import type { DrilldownFilter } from './BlogStatsDrilldown';

interface BlogStats {
  total: number;
  published: number;
  drafts: number;
  missingMeta: number;
  missingCover: number;
  thinContent: number;
  recentlyPublished: number;
  blocked: number | null;
  needsReview: number | null;
  missingAuthor: number;
  policyRisk: number | null;
}

interface BlogAdminStatsProps {
  onDrilldown?: (filter: DrilldownFilter) => void;
}

async function fetchAllPaginated<T>(
  queryBuilder: (from: number, to: number) => Promise<{ data: T[] | null }>
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data } = await queryBuilder(from, from + batchSize - 1);
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allData;
}

export function BlogAdminStats({ onDrilldown }: BlogAdminStatsProps) {
  const [stats, setStats] = useState<BlogStats | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // Phase 1: lightweight stats (no content column)
    const lightData = await fetchAllPaginated(async (from, to) => {
      const res = await supabase
        .from('blog_posts')
        .select('id, is_published, meta_title, meta_description, cover_image_url, word_count, published_at, author_name')
        .order('id')
        .range(from, to);
      return { data: res.data };
    });

    if (lightData.length === 0) return;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Set basic stats immediately
    setStats({
      total: lightData.length,
      published: lightData.filter(p => p.is_published).length,
      drafts: lightData.filter(p => !p.is_published).length,
      missingMeta: lightData.filter(p => !p.meta_title || !p.meta_description).length,
      missingCover: lightData.filter(p => !p.cover_image_url).length,
      thinContent: lightData.filter(p => (p.word_count || 0) < 500).length,
      recentlyPublished: lightData.filter(p => p.published_at && new Date(p.published_at) > weekAgo).length,
      missingAuthor: lightData.filter(p => !p.author_name).length,
      blocked: null,
      needsReview: null,
      policyRisk: null,
    });

    // Phase 2: compliance analysis (needs content)
    setComplianceLoading(true);
    const fullData = await fetchAllPaginated(async (from, to) => {
      const res = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, meta_title, meta_description, excerpt, cover_image_url, featured_image_alt, word_count, category, tags, faq_count, has_faq_schema, internal_links, canonical_url, is_published, author_name')
        .order('id')
        .range(from, to);
      return { data: res.data };
    });

    let blocked = 0, needsReview = 0, policyRisk = 0;
    for (const post of fullData) {
      const meta = blogPostToMetadata(post);
      const compliance = analyzePublishCompliance(meta);
      const status = getComplianceReadinessStatus(compliance, meta);
      if (status === 'Blocked') blocked++;
      if (status === 'Needs Review') needsReview++;
      const hasPolicyFail = compliance.checks.some(
        c => c.category === 'adsense-safety' && c.status === 'fail'
      );
      if (hasPolicyFail) policyRisk++;
    }

    setStats(prev => prev ? { ...prev, blocked, needsReview, policyRisk } : prev);
    setComplianceLoading(false);
  };

  if (!stats) return null;

  const items: { icon: any; label: string; value: number | null; color: string; filter?: DrilldownFilter; loading?: boolean }[] = [
    { icon: FileText, label: 'Total', value: stats.total, color: 'text-foreground' },
    { icon: Eye, label: 'Published', value: stats.published, color: 'text-green-600', filter: 'published' },
    { icon: EyeOff, label: 'Drafts', value: stats.drafts, color: 'text-muted-foreground', filter: 'drafts' },
    { icon: AlertTriangle, label: 'Missing SEO', value: stats.missingMeta, color: 'text-amber-500', filter: 'missing-seo' },
    { icon: ImageOff, label: 'No Cover', value: stats.missingCover, color: 'text-destructive', filter: 'no-cover' },
    { icon: Clock, label: 'This Week', value: stats.recentlyPublished, color: 'text-blue-500', filter: 'this-week' },
    { icon: Ban, label: 'Blocked', value: stats.blocked, color: 'text-destructive', filter: 'blocked', loading: complianceLoading },
    { icon: ShieldAlert, label: 'Needs Review', value: stats.needsReview, color: 'text-amber-500', filter: 'needs-review', loading: complianceLoading },
    { icon: User, label: 'No Author', value: stats.missingAuthor, color: 'text-orange-500', filter: 'no-author' },
    { icon: ShieldCheck, label: 'Policy Risk', value: stats.policyRisk, color: 'text-destructive', filter: 'policy-risk', loading: complianceLoading },
  ];

  return (
    <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mb-4">
      {items.map(({ icon: Icon, label, value, color, filter, loading }) => {
        const isClickable = !!filter && !!onDrilldown && value !== null && value > 0;
        return (
          <Card
            key={label}
            className={isClickable ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 transition-shadow focus-within:ring-2 focus-within:ring-primary/40' : ''}
            tabIndex={isClickable ? 0 : undefined}
            role={isClickable ? 'button' : undefined}
            onClick={isClickable ? () => onDrilldown(filter) : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDrilldown(filter); } } : undefined}
          >
            <CardContent className="p-2.5 flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color} shrink-0`} />
              <div>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-lg font-bold leading-tight">{value ?? '—'}</p>
                )}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
