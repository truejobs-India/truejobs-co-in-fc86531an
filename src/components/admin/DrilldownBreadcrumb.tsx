import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface DrilldownBreadcrumbProps {
  items: BreadcrumbItem[];
  onHomeClick: () => void;
}

export function DrilldownBreadcrumb({ items, onHomeClick }: DrilldownBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
      <Button
        variant="ghost"
        size="sm"
        onClick={onHomeClick}
        className="h-7 px-2 gap-1"
      >
        <Home className="h-3.5 w-3.5" />
        Dashboard
      </Button>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.onClick && index < items.length - 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={item.onClick}
              className="h-7 px-2"
            >
              {item.label}
            </Button>
          ) : (
            <span className="px-2 font-medium text-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
