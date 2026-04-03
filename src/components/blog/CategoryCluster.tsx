import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { BLOG_CATEGORIES } from '@/lib/blogCategories';
import { categoryToSlug } from '@/lib/blogUtils';

interface CategoryClusterProps {
  currentCategory: string | null;
}

export function CategoryCluster({ currentCategory }: CategoryClusterProps) {
  const currentSlug = currentCategory ? categoryToSlug(currentCategory) : null;

  const MAX_PILLS = 8;

  // Build display list: current category first, then fill from full list
  const displayCategories = (() => {
    const currentCat = currentSlug
      ? BLOG_CATEGORIES.find((c) => c.slug === currentSlug)
      : null;
    const others = BLOG_CATEGORIES.filter((c) => c.slug !== currentSlug);
    const base = currentCat ? [currentCat] : [];
    return [...base, ...others].slice(0, MAX_PILLS);
  })();

  return (
    <div className="my-8">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Explore Topics
      </h3>
      <div className="flex flex-wrap gap-2">
        {displayCategories.map((cat) => {
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
