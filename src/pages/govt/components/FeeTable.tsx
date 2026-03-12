import type { FeeStructure } from '@/data/examAuthority/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface FeeTableProps {
  fee: FeeStructure;
  examName: string;
}

export function FeeTable({ fee, examName }: FeeTableProps) {
  const rows = [
    { category: 'General', amount: fee.general },
    { category: 'OBC (Non-Creamy Layer)', amount: fee.obc },
    { category: 'SC / ST', amount: fee.scSt },
    { category: 'Female (all categories)', amount: fee.female },
    { category: 'PwD / Ex-Servicemen', amount: fee.ph },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        {examName} Application Fee
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Fee (₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-foreground">{r.category}</TableCell>
              <TableCell className="text-right">{r.amount === 0 ? 'Exempted' : `₹${r.amount}`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {fee.paymentModes.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>Payment Modes:</strong> {fee.paymentModes.join(', ')}
        </p>
      )}
    </section>
  );
}
