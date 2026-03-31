import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface ExploreLink {
  label: string;
  href: string;
  description?: string;
}

interface ExploreRelatedSectionProps {
  title: string;
  links: ExploreLink[];
}

export function ExploreRelatedSection({ title, links }: ExploreRelatedSectionProps) {
  if (!links.length) return null;

  return (
    <section className="rounded-xl bg-primary/5 border border-primary/20 p-6 md:p-8 mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-5">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                {link.label}
              </span>
              {link.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{link.description}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1 transition-colors" />
          </Link>
        ))}
      </div>
    </section>
  );
}
