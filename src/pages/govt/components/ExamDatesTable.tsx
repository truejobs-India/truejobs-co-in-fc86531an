import type { ExamDate } from '@/data/examAuthority/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ExamDatesTableProps {
  dates: ExamDate[];
  examName: string;
}

export function ExamDatesTable({ dates, examName }: ExamDatesTableProps) {
  if (!dates.length) return null;

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        {examName} Important Dates
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dates.map((d, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-foreground">{d.label}</TableCell>
              <TableCell className={d.date === 'To Be Announced' ? 'italic text-muted-foreground' : 'text-foreground'}>
                {d.date === 'To Be Announced' ? 'To Be Announced' : d.date}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
