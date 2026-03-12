import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EnrichmentOverlay {
  enrichment_data: Record<string, unknown>;
  version: number;
  published_at: string;
}

export function useEnrichmentOverlay(slug: string | undefined) {
  return useQuery({
    queryKey: ['enrichment-overlay', slug],
    queryFn: async () => {
      if (!slug) return null;
      // The partial unique index idx_one_published_per_slug guarantees at most
      // one row per page_slug where published_at IS NOT NULL. The ORDER BY
      // version DESC is defensive only — correctness is enforced by the index.
      const { data, error } = await supabase
        .from('content_enrichments')
        .select('enrichment_data, version, published_at')
        .eq('page_slug', slug)
        .eq('status', 'approved')
        .not('published_at', 'is', null)
        .order('version', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as unknown as EnrichmentOverlay) ?? null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}
