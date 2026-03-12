import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const CATEGORY_CHIPS = [
  { label: 'IT & Software', href: '/jobs?industry=it' },
  { label: 'Sales', href: '/jobs?industry=sales' },
  { label: 'Banking', href: '/jobs?industry=banking' },
  { label: 'Remote', href: '/jobs?type=remote' },
  { label: 'Fresher', href: '/jobs?experience=fresher' },
  { label: 'WFH', href: '/jobs?type=wfh' },
];

export function PrivateHeroBlock() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/jobs?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 md:p-8">
      <div className="relative z-10">
        <Badge className="bg-primary/10 text-primary border-none mb-4 text-xs">
          💼 Private Sector Jobs
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 text-foreground font-['Outfit',sans-serif]">
          Private Jobs & Careers
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          IT, Sales, Marketing, Finance & more
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search job title, company..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORY_CHIPS.map(c => (
            <Link
              key={c.href}
              to={c.href}
              className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          Explore All Private Jobs <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
