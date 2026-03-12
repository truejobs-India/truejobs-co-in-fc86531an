import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export function GovtDisclaimer() {
  return (
    <div className="mt-8 mb-4 rounded-lg border border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800/30 px-4 py-3 text-xs text-muted-foreground">
      <p className="flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <span>
          <strong className="text-foreground">Disclaimer:</strong> TrueJobs is NOT affiliated with, endorsed by, or connected to any government organization, public service commission, or recruitment board. Information is sourced from official notifications and is provided for informational purposes only. Always verify details on the official website of the respective recruiting body before applying. See our{' '}
          <Link to="/editorial-policy" className="text-primary hover:underline">Editorial Policy</Link> and{' '}
          <Link to="/disclaimer" className="text-primary hover:underline">Disclaimer</Link>.
        </span>
      </p>
    </div>
  );
}
