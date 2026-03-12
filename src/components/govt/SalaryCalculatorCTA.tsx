import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalaryCalculatorCTAProps {
  examName?: string;
  contextText?: string;
}

export function SalaryCalculatorCTA({ examName, contextText }: SalaryCalculatorCTAProps) {
  const defaultContext = examName
    ? `Use the 7th CPC Government Salary Calculator to estimate your in-hand salary for ${examName} posts — including DA, HRA, and all deductions based on your pay level and city.`
    : 'Estimate your in-hand government salary using the 7th CPC pay matrix. Includes DA, HRA, city-based allowances, and deductions.';

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 my-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Calculate Your In-Hand Salary
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {contextText || defaultContext}
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 mb-4">
            <li>✓ Select pay level (1–18) and basic pay</li>
            <li>✓ City-wise HRA (X, Y, Z category)</li>
            <li>✓ DA, TA, NPS deductions included</li>
          </ul>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/govt-salary-calculator">
              <Calculator className="h-4 w-4" />
              Use Government Salary Calculator
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
