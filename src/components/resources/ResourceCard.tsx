import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileText, BookOpen } from 'lucide-react';
import { RESOURCE_TYPE_PATHS, type ResourceType, getDefaultCover } from '@/lib/resourceHubs';

interface ResourceCardProps {
  slug: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  resourceType: ResourceType;
  coverImageUrl?: string | null;
  language?: string | null;
  downloadCount?: number;
  fileSizeBytes?: number | null;
  pageCount?: number | null;
  isFeatured?: boolean;
  isTrending?: boolean;
}

export function ResourceCard({
  slug,
  title,
  excerpt,
  category,
  resourceType,
  coverImageUrl,
  language,
  downloadCount = 0,
  fileSizeBytes,
  pageCount,
  isFeatured,
  isTrending,
}: ResourceCardProps) {
  const typePath = RESOURCE_TYPE_PATHS[resourceType];
  const href = `/${typePath}/${slug}`;
  const coverSrc = coverImageUrl || getDefaultCover(category);

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Link to={href} className="group block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg border-border/50">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          <img
            src={coverSrc}
            alt={title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getDefaultCover(null);
            }}
          />
          <div className="absolute top-2 left-2 flex gap-1.5">
            {isFeatured && <Badge className="bg-primary text-primary-foreground text-xs">Featured</Badge>}
            {isTrending && <Badge variant="secondary" className="text-xs">🔥 Trending</Badge>}
          </div>
          {category && (
            <Badge variant="outline" className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs">
              {category}
            </Badge>
          )}
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          {excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2">{excerpt}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              PDF
            </span>
            {formatSize(fileSizeBytes) && (
              <span>{formatSize(fileSizeBytes)}</span>
            )}
            {pageCount && <span>{pageCount} pages</span>}
            {language && <span className="capitalize">{language}</span>}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="h-3 w-3" />
            <span>{downloadCount.toLocaleString()} downloads</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
