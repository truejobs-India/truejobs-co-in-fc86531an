import { Link } from 'react-router-dom';
import { Shield, FileText, MapPin, Briefcase, Clock } from 'lucide-react';

interface CrossLinkItem {
  label: string;
  slug: string;
}

interface CrossLinksProps {
  title: string;
  items: CrossLinkItem[];
  type?: 'govt' | 'exam' | 'state' | 'city' | 'category' | 'today';
}

const ICON_MAP = {
  govt: Shield,
  exam: FileText,
  state: Shield,
  city: MapPin,
  category: Briefcase,
  today: Clock,
};

export function CrossLinks({ title, items, type = 'govt' }: CrossLinksProps) {
  if (!items.length) return null;
  const Icon = ICON_MAP[type];

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map((item) => (
          <Link
            key={item.slug}
            to={`/${item.slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
