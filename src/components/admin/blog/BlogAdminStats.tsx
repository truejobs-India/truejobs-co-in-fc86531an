import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Eye, EyeOff, ImageOff, AlertTriangle, Clock } from 'lucide-react';

interface BlogStats {
  total: number;
  published: number;
  drafts: number;
  missingMeta: number;
  missingCover: number;
  thinContent: number;
  recentlyPublished: number;
}

export function BlogAdminStats() {
  const [stats, setStats] = useState<BlogStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase.from('blog_posts').select('is_published, meta_title, meta_description, cover_image_url, word_count, published_at');
    if (!data) return;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    setStats({
      total: data.length,
      published: data.filter(p => p.is_published).length,
      drafts: data.filter(p => !p.is_published).length,
      missingMeta: data.filter(p => !p.meta_title || !p.meta_description).length,
      missingCover: data.filter(p => !p.cover_image_url).length,
      thinContent: data.filter(p => (p.word_count || 0) < 500).length,
      recentlyPublished: data.filter(p => p.published_at && new Date(p.published_at) > weekAgo).length,
    });
  };

  if (!stats) return null;

  const items = [
    { icon: FileText, label: 'Total', value: stats.total, color: 'text-foreground' },
    { icon: Eye, label: 'Published', value: stats.published, color: 'text-green-600' },
    { icon: EyeOff, label: 'Drafts', value: stats.drafts, color: 'text-muted-foreground' },
    { icon: AlertTriangle, label: 'Missing SEO', value: stats.missingMeta, color: 'text-amber-500' },
    { icon: ImageOff, label: 'No Cover', value: stats.missingCover, color: 'text-destructive' },
    { icon: Clock, label: 'This Week', value: stats.recentlyPublished, color: 'text-blue-500' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
      {items.map(({ icon: Icon, label, value, color }) => (
        <Card key={label}>
          <CardContent className="p-2.5 flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color} shrink-0`} />
            <div>
              <p className="text-lg font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
