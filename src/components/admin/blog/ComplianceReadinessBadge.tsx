import { Badge } from '@/components/ui/badge';
import type { ComplianceReadinessStatus } from '@/lib/blogComplianceAnalyzer';

const STATUS_CONFIG: Record<ComplianceReadinessStatus, { variant: 'destructive' | 'secondary' | 'outline' | 'default'; className: string }> = {
  'Blocked': { variant: 'destructive', className: '' },
  'Needs Review': { variant: 'secondary', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  'Ready with Warnings': { variant: 'outline', className: 'border-blue-400 text-blue-700 dark:text-blue-300' },
  'Ready to Publish': { variant: 'default', className: 'bg-green-600 hover:bg-green-700' },
  'Published': { variant: 'default', className: '' },
};

interface ComplianceReadinessBadgeProps {
  status: ComplianceReadinessStatus;
  className?: string;
}

export function ComplianceReadinessBadge({ status, className = '' }: ComplianceReadinessBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={`text-xs ${config.className} ${className}`}>
      {status}
    </Badge>
  );
}
