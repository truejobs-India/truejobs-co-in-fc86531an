import type { ExamPatternStage } from '@/data/examAuthority/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ExamPatternTableProps {
  stages: ExamPatternStage[];
  examName: string;
}

export function ExamPatternTable({ stages, examName }: ExamPatternTableProps) {
  if (!stages.length) return null;

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        {examName} Exam Pattern
      </h2>
      {stages.map((stage, idx) => {
        const totalQ = stage.rows.reduce((s, r) => s + r.questions, 0);
        const totalM = stage.rows.reduce((s, r) => s + r.marks, 0);
        return (
          <div key={idx} className="mb-6">
            <h3 className="text-lg font-medium text-foreground mb-2">{stage.stageName}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Negative Marking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stage.rows.map((r, ri) => (
                  <TableRow key={ri}>
                    <TableCell className="font-medium text-foreground">{r.subject}</TableCell>
                    <TableCell className="text-center">{r.questions}</TableCell>
                    <TableCell className="text-center">{r.marks}</TableCell>
                    <TableCell>{r.duration}</TableCell>
                    <TableCell>{r.negativeMarking}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{totalQ}</TableCell>
                  <TableCell className="text-center">{totalM}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        );
      })}
    </section>
  );
}
