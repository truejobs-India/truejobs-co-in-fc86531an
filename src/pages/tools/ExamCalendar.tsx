import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, ExternalLink, FileText } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    upcoming: { label: 'Upcoming', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    application_open: { label: 'Apply Now', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    exam_scheduled: { label: 'Exam Scheduled', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  };
  const s = map[status] ?? { label: status, className: '' };
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function ExamCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exam-calendar', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('govt_exams')
        .select('id, exam_name, slug, status, exam_date, application_start, application_end, admit_card_date, result_date, conducting_body, total_vacancies, exam_year, notification_month')
        .or(`exam_year.eq.${year},application_end.gte.${year}-01-01`)
        .in('status', ['upcoming', 'active', 'application_open', 'exam_scheduled', 'admit_card_released', 'result_declared'])
        .order('application_end', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const monthExams = useMemo(() => {
    if (!exams) return [];
    const monthStr = String(month + 1).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    return exams.filter(e => {
      return (e.application_start?.startsWith(prefix) ||
              e.application_end?.startsWith(prefix) ||
              e.exam_date?.includes(MONTHS[month]) ||
              e.admit_card_date?.includes(MONTHS[month]) ||
              e.result_date?.includes(MONTHS[month]) ||
              (e.notification_month === month + 1 && (e.exam_year === year || !e.exam_year)));
    });
  }, [exams, month, year]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return d;
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://truejobs.co.in/' },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://truejobs.co.in/tools' },
      { '@type': 'ListItem', position: 3, name: 'Exam Calendar' },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What is the government exam calendar?', acceptedAnswer: { '@type': 'Answer', text: 'The exam calendar shows all upcoming government exams organized by month, including application dates, exam dates, admit card releases, and result declarations for SSC, UPSC, IBPS, Railway, and state-level exams.' } },
      { '@type': 'Question', name: 'How often is the exam calendar updated?', acceptedAnswer: { '@type': 'Answer', text: 'The calendar is updated in real-time as new notifications are released. All dates are sourced from official government notifications.' } },
    ],
  };

  return (
    <Layout noAds>
      <SEO
        title="Government Exam Calendar 2026 | Upcoming Exam Dates & Schedule"
        description="View the complete government exam calendar for 2026. Track application dates, exam schedules, admit cards & results for SSC, UPSC, IBPS, Railway exams."
      />
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>

      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/tools" className="hover:text-primary">Tools</Link>
          <span>/</span>
          <span className="text-foreground">Exam Calendar</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-3">Government Exam Calendar {year}</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Stay on top of all government exam dates. Browse month-by-month to see upcoming application
          deadlines, exam schedules, admit card releases, and result declarations.
        </p>

        {/* Month Navigation */}
        <Card className="mb-8">
          <CardContent className="flex items-center justify-between py-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span className="text-xl font-bold">{MONTHS[month]} {year}</span>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </CardContent>
        </Card>

        {/* Exam Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : monthExams.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Apply Start</TableHead>
                    <TableHead>Last Date</TableHead>
                    <TableHead>Exam Date</TableHead>
                    <TableHead>Vacancies</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthExams.map(exam => (
                    <TableRow key={exam.id}>
                      <TableCell>
                        <div>
                          <Link to={`/sarkari-jobs/${exam.slug}`} className="font-medium hover:text-primary">
                            {exam.exam_name}
                          </Link>
                          {exam.conducting_body && (
                            <div className="text-xs text-muted-foreground">{exam.conducting_body}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(exam.status)}</TableCell>
                      <TableCell className="text-sm">{formatDate(exam.application_start)}</TableCell>
                      <TableCell className="text-sm">{formatDate(exam.application_end)}</TableCell>
                      <TableCell className="text-sm">{exam.exam_date ?? '—'}</TableCell>
                      <TableCell className="text-sm">{exam.total_vacancies?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/sarkari-jobs/${exam.slug}`}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No exams in {MONTHS[month]} {year}</h3>
            <p className="text-muted-foreground">Try navigating to another month or check back later.</p>
          </Card>
        )}

        {/* Quick Stats */}
        {exams && exams.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-primary">{exams.length}</div>
              <div className="text-sm text-muted-foreground">Total Exams in {year}</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-green-600">{exams.filter(e => e.status === 'application_open').length}</div>
              <div className="text-sm text-muted-foreground">Applications Open</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-orange-600">{monthExams.length}</div>
              <div className="text-sm text-muted-foreground">This Month</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold">{exams.reduce((sum, e) => sum + (e.total_vacancies ?? 0), 0).toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Vacancies</div>
            </Card>
          </div>
        )}

        {/* Internal Links */}
        <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Eligibility Checker', href: '/govt-exam-eligibility-checker' },
            { label: 'Fee Calculator', href: '/govt-exam-fee-calculator' },
            { label: 'Age Calculator', href: '/govt-job-age-calculator' },
            { label: 'Sarkari Jobs', href: '/sarkari-jobs' },
          ].map(link => (
            <Link key={link.href} to={link.href} className="block p-3 rounded-lg border text-center text-sm font-medium hover:bg-accent transition-colors">
              {link.label}
            </Link>
          ))}
        </div>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div><h3 className="font-semibold">What is the government exam calendar?</h3><p className="text-sm text-muted-foreground mt-1">It shows all upcoming government exams organized by month, including application dates, exam dates, admit cards, and results.</p></div>
            <div><h3 className="font-semibold">How often is it updated?</h3><p className="text-sm text-muted-foreground mt-1">The calendar is updated in real-time as new official notifications are released.</p></div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
