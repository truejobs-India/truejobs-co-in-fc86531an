import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { BLOG_CATEGORIES } from '@/lib/blogCategories';
import { categoryToSlug } from '@/lib/blogUtils';

interface CategoryClusterProps {
  currentCategory: string | null;
}

export function CategoryCluster({ currentCategory }: CategoryClusterProps) {
  const currentSlug = currentCategory ? categoryToSlug(currentCategory) : null;

  return (
    <div className="my-8">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Explore Topics
      </h3>
      <div className="flex flex-wrap gap-2">
        {BLOG_CATEGORIES.map((cat) => {
          const isActive = cat.slug === currentSlug;
          return (
            <Link key={cat.slug} to={`/blog/category/${cat.slug}`}>
              <Badge
                variant={isActive ? 'default' : 'outline'}
                className={`text-sm px-3 py-1.5 transition-colors hover:bg-primary/10 ${
                  isActive ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
                }`}
              >
                {cat.name}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
