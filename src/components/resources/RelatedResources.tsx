import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResourceCard } from './ResourceCard';
import type { ResourceType } from '@/lib/resourceHubs';

interface RelatedResourcesProps {
  currentId: string;
  category?: string | null;
  resourceType: ResourceType;
  title?: string;
  limit?: number;
}

export function RelatedResources({
  currentId,
  category,
  resourceType,
  title = 'Related Resources',
  limit = 6,
}: RelatedResourcesProps) {
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    async function fetch() {
      let query = supabase
        .from('pdf_resources')
        .select('slug, title, excerpt, category, resource_type, cover_image_url, language, download_count, file_size_bytes, page_count, is_featured, is_trending')
        .eq('is_published', true)
        .eq('resource_type', resourceType)
        .neq('id', currentId)
        .limit(limit);

      if (category) query = query.eq('category', category);

      const { data } = await query.order('download_count', { ascending: false });
      if (data) setResources(data);
    }
    fetch();
  }, [currentId, category, resourceType, limit]);

  if (!resources.length) return null;

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold text-foreground mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((r) => (
          <ResourceCard
            key={r.slug}
            slug={r.slug}
            title={r.title}
            excerpt={r.excerpt}
            category={r.category}
            resourceType={r.resource_type as ResourceType}
            coverImageUrl={r.cover_image_url}
            language={r.language}
            downloadCount={r.download_count}
            fileSizeBytes={r.file_size_bytes}
            pageCount={r.page_count}
            isFeatured={r.is_featured}
            isTrending={r.is_trending}
          />
        ))}
      </div>
    </section>
  );
}
