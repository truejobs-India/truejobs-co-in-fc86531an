import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

interface PopularSearchesProps {
  searches: { label: string; slug: string }[];
  title?: string;
}

export function PopularSearches({ searches, title = 'Related Searches' }: PopularSearchesProps) {
  if (!searches.length) return null;

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {searches.map((s) => (
          <Link
            key={s.slug}
            to={`/${s.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Search className="h-3 w-3" />
            {s.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
