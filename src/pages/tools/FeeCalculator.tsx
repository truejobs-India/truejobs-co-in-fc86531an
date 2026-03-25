import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { IndianRupee, Loader2, Info, ExternalLink } from 'lucide-react';

export default function FeeCalculator() {
  const [selectedExamId, setSelectedExamId] = useState('');

  const { data: examList, isLoading: loadingList } = useQuery({
    queryKey: ['fee-calc-exam-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('govt_exams')
        .select('id, exam_name, slug, fee_gen, fee_obc, fee_sc, fee_st, fee_female, application_fee, conducting_body, apply_link, application_end')
        .in('status', ['upcoming', 'active', 'application_open'])
        .order('exam_name');
      if (error) throw error;
      return data || [];
    },
  });

  const selectedExam = examList?.find(e => e.id === selectedExamId);
  const hasStructuredFees = selectedExam && (selectedExam.fee_gen !== null || selectedExam.fee_obc !== null || selectedExam.fee_sc !== null);

  const feeRows = selectedExam ? [
    { category: 'General / UR', fee: selectedExam.fee_gen },
    { category: 'OBC / EWS', fee: selectedExam.fee_obc },
    { category: 'SC', fee: selectedExam.fee_sc },
    { category: 'ST', fee: selectedExam.fee_st },
    { category: 'Female (all categories)', fee: selectedExam.fee_female },
  ] : [];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How to check government exam application fee?', acceptedAnswer: { '@type': 'Answer', text: 'Select any active government exam from the dropdown to see the category-wise fee breakdown including General, OBC, SC, ST, and female candidate fees.' } },
      { '@type': 'Question', name: 'Do SC/ST candidates get fee exemption?', acceptedAnswer: { '@type': 'Answer', text: 'Many government exams offer fee exemption or reduced fees for SC/ST candidates. The exact fee depends on the conducting body — SSC, UPSC, IBPS, and Railways each have their own fee structure.' } },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://truejobs.co.in/' },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://truejobs.co.in/tools' },
      { '@type': 'ListItem', position: 3, name: 'Fee Calculator' },
    ],
  };

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO
        title="Government Exam Fee Calculator 2026 | Category-Wise Application Fees"
        description="Check category-wise application fees for SSC, UPSC, IBPS, Railway & state government exams. See fees for General, OBC, SC, ST & female candidates."
      />
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/tools" className="hover:text-primary">Tools</Link>
          <span>/</span>
          <span className="text-foreground">Fee Calculator</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-3">Government Exam Application Fee Calculator</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Check the exact application fee for any government exam. Select an exam below to see
          the category-wise fee breakdown for General, OBC, SC/ST, and female candidates.
        </p>

        {/* Exam Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              Select Exam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label>Government Exam</Label>
              {loadingList ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading exams...
                </div>
              ) : (
                <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                  <SelectTrigger><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                  <SelectContent>
                    {examList?.map(exam => (
                      <SelectItem key={exam.id} value={exam.id}>{exam.exam_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fee Breakdown */}
        {selectedExam && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedExam.exam_name}</CardTitle>
                  {selectedExam.conducting_body && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedExam.conducting_body}</p>
                  )}
                </div>
                {selectedExam.application_end && (
                  <Badge variant="outline">Last Date: {new Date(selectedExam.application_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {hasStructuredFees ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Application Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeRows.map(row => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right">
                          {row.fee !== null && row.fee !== undefined ? (
                            row.fee === 0 ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Exempted</Badge>
                            ) : (
                              <span className="font-semibold">₹{row.fee.toLocaleString('en-IN')}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : selectedExam.application_fee ? (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-1">Application Fee Details</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedExam.application_fee}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Fee details not yet available for this exam.</p>
              )}

              {selectedExam.apply_link && (
                <div className="mt-6 pt-4 border-t">
                  <a
                    href={selectedExam.apply_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apply Online — Official Website
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Internal Links */}
        <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Eligibility Checker', href: '/govt-exam-eligibility-checker' },
            { label: 'Age Calculator', href: '/govt-job-age-calculator' },
            { label: 'Salary Calculator', href: '/govt-salary-calculator' },
            { label: 'Exam Calendar', href: '/govt-exam-calendar' },
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
            <div><h3 className="font-semibold">How to check government exam application fee?</h3><p className="text-sm text-muted-foreground mt-1">Select any active exam from the dropdown to see the category-wise fee breakdown.</p></div>
            <div><h3 className="font-semibold">Do SC/ST candidates get fee exemption?</h3><p className="text-sm text-muted-foreground mt-1">Many exams offer fee exemption or reduced fees for SC/ST candidates. The exact fee varies by conducting body.</p></div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
