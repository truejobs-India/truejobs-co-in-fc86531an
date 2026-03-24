import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderTabProps {
  title: string;
  description?: string;
}

export function PlaceholderTab({ title, description }: PlaceholderTabProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <Construction className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {description || 'This section will be available in a future update.'}
        </p>
      </CardContent>
    </Card>
  );
}
