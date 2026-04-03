import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { List, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface TableOfContentsProps {
  headings: Heading[];
  inline?: boolean;
}

export function TableOfContents({ headings, inline = false }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [collapsed, setCollapsed] = useState(headings.length > 8);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    });

    return () => {
      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) observer.unobserve(element);
      });
    };
  }, [headings]);

  if (headings.length < 3) return null;

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const displayedHeadings = collapsed ? headings.slice(0, 6) : headings;

  // Inline variant — compact box for embedding in article body
  if (inline) {
    return (
      <div className="article-toc my-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">In This Article</span>
          </div>
          {headings.length > 6 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {collapsed ? (
                <>Show all ({headings.length}) <ChevronDown className="h-3 w-3" /></>
              ) : (
                <>Show less <ChevronUp className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
        <nav>
          <ol className="space-y-0.5 list-none m-0 p-0">
            {displayedHeadings.map((heading, idx) => (
              <li key={heading.id} className="m-0 p-0">
                <button
                  onClick={() => scrollToHeading(heading.id)}
                  className={cn(
                    'w-full text-left text-sm py-1 px-2 rounded transition-colors hover:bg-primary/5 flex items-start gap-2',
                    heading.level === 3 && 'pl-6',
                    activeId === heading.id && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className="text-primary/50 text-xs mt-0.5 shrink-0">{idx + 1}.</span>
                  <span className="line-clamp-1">{heading.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    );
  }

  // Sidebar variant — sticky card (original)
  return (
    <Card className="sticky top-24">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Table of Contents</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <nav className="space-y-1">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => scrollToHeading(heading.id)}
              className={cn(
                'block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors hover:bg-muted',
                heading.level === 1 && 'font-semibold',
                heading.level === 2 && 'pl-4',
                heading.level === 3 && 'pl-6 text-muted-foreground',
                activeId === heading.id && 'bg-primary/10 text-primary font-medium'
              )}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
