import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgeCalculatorCTAProps {
  examName?: string;
  contextText?: string;
}

export function AgeCalculatorCTA({ examName, contextText }: AgeCalculatorCTAProps) {
  const defaultContext = examName
    ? `Check if you meet the age requirement for ${examName}. Our calculator shows your exact age on the cut-off date with category-wise relaxation (OBC, SC/ST, PH, Ex-Servicemen).`
    : 'Calculate your exact age on any cut-off date. Includes category-wise relaxation for OBC, SC/ST, PH, and Ex-Servicemen as per government norms.';

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 my-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Check Your Age Eligibility
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {contextText || defaultContext}
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 mb-4">
            <li>✓ Enter DOB and cut-off date</li>
            <li>✓ Category-wise age relaxation</li>
            <li>✓ Preset cut-off dates for major exams</li>
          </ul>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/govt-job-age-calculator">
              <CalendarDays className="h-4 w-4" />
              Use Government Age Calculator
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
