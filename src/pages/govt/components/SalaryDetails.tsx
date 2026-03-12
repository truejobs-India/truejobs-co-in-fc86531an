import type { SalaryInfo } from '@/data/examAuthority/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SalaryCalculatorCTA } from '@/components/govt/SalaryCalculatorCTA';

interface SalaryDetailsProps {
  salary: SalaryInfo;
  examName: string;
}

export function SalaryDetails({ salary, examName }: SalaryDetailsProps) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        {examName} Salary Structure
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pay Levels</p>
          <p className="text-lg font-semibold text-foreground">{salary.payLevels}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Gross Salary Range</p>
          <p className="text-lg font-semibold text-foreground">{salary.grossRange}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">In-Hand Salary Range</p>
          <p className="text-lg font-semibold text-foreground">{salary.netRange}</p>
        </div>
      </div>

      {salary.postWiseSalary && salary.postWiseSalary.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-foreground mb-2">Post-wise Basic Pay</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post Name</TableHead>
                <TableHead>Pay Level</TableHead>
                <TableHead>Basic Pay (₹/month)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salary.postWiseSalary.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground">{p.post}</TableCell>
                  <TableCell>{p.payLevel}</TableCell>
                  <TableCell>{p.basicPay}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {salary.allowances.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Allowances & Benefits</h3>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            {salary.allowances.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </>
      )}

      <SalaryCalculatorCTA examName={examName} />
    </section>
  );
}
