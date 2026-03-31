import { Link } from 'react-router-dom';
import { Landmark, ArrowRight } from 'lucide-react';

interface GovtJobsCrossLinkProps {
  context?: string; // e.g. "in Delhi", "in IT"
}

export function GovtJobsCrossLink({ context }: GovtJobsCrossLinkProps) {
  return (
    <section className="mb-10">
      <Link
        to="/sarkari-jobs"
        className="group flex items-center gap-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
      >
        <Landmark className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            Looking for Government Jobs{context ? ` ${context}` : ''}?
          </p>
          <p className="text-sm text-muted-foreground">
            Browse 1,100+ Sarkari Naukri — SSC, Railway, Banking, Defence & more
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-600 shrink-0 transition-colors" />
      </Link>
    </section>
  );
}
