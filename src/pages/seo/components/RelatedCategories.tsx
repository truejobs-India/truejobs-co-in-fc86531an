import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';

interface RelatedCategoriesProps {
  categories: { name: string; slug: string }[];
  title?: string;
}

export function RelatedCategories({ categories, title = 'Browse by Category' }: RelatedCategoriesProps) {
  if (!categories.length) return null;

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            to={`/${cat.slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
            {cat.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
