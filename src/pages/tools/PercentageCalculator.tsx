import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';

const SITE_URL = 'https://truejobs.co.in';

const CGPA_SCALES = [
  { value: '10', label: '10-Point Scale', multiplier: 9.5 },
  { value: '7', label: '7-Point Scale', multiplier: 100 / 7 },
  { value: '4', label: '4-Point Scale', multiplier: 25 },
];

const FAQ_ITEMS = [
  {
    question: 'How to convert CGPA to percentage?',
    answer: 'For a 10-point CGPA scale, multiply your CGPA by 9.5 to get the approximate percentage. For example, a CGPA of 8.0 equals 76% (8.0 × 9.5 = 76).',
  },
  {
    question: 'What percentage is required for SSC CGL?',
    answer: 'SSC CGL requires a minimum of graduation (Bachelor\'s degree) from a recognized university. There is no specific minimum percentage required for most posts.',
  },
  {
    question: 'How to calculate percentage from marks?',
    answer: 'Divide the marks obtained by the total marks and multiply by 100. For example, if you scored 450 out of 600, your percentage is (450/600) × 100 = 75%.',
  },
  {
    question: 'Is CGPA to percentage conversion accepted in government exams?',
    answer: 'Yes, most government recruitment bodies accept the CGPA-to-percentage conversion formula provided by the respective university. If no formula is given, the standard formula (CGPA × 9.5 for 10-point scale) is generally accepted.',
  },
];

export default function PercentageCalculator() {
  const [marksObtained, setMarksObtained] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [cgpaScale, setCgpaScale] = useState('10');

  const percentage = marksObtained && totalMarks && Number(totalMarks) > 0
    ? ((Number(marksObtained) / Number(totalMarks)) * 100).toFixed(2)
    : null;

  const selectedScale = CGPA_SCALES.find(s => s.value === cgpaScale);
  const cgpaPercentage = cgpa && selectedScale
    ? (Number(cgpa) * selectedScale.multiplier).toFixed(2)
    : null;

  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Percentage & CGPA Calculator',
    url: `${SITE_URL}/percentage-calculator`,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'All',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };

  const schemaFAQ = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const schemaBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Percentage Calculator', item: `${SITE_URL}/percentage-calculator` },
    ],
  };

  return (
    <Layout noAds>
      <SEO
        title="Percentage & CGPA Calculator | TrueJobs"
        description="Calculate percentage from marks or convert CGPA to percentage for government exam eligibility. Supports 10-point, 7-point, and 4-point scales."
        canonical="/percentage-calculator"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaBreadcrumb) }} />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li>/</li>
            <li><Link to="/tools" className="hover:text-primary">Tools</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Percentage Calculator</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">Percentage & CGPA Calculator</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Calculate your percentage from marks obtained or convert your CGPA to percentage for 
          government job applications. Many exams like SSC, UPSC, and Banking require minimum 
          qualification percentages. This free tool supports 10-point, 7-point, and 4-point 
          CGPA scales used by Indian universities.
        </p>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <Tabs defaultValue="marks" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="marks">Marks → Percentage</TabsTrigger>
                <TabsTrigger value="cgpa">CGPA → Percentage</TabsTrigger>
              </TabsList>

              <TabsContent value="marks" className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="marks">Marks Obtained</Label>
                    <Input
                      id="marks"
                      type="number"
                      placeholder="e.g. 450"
                      value={marksObtained}
                      onChange={(e) => setMarksObtained(e.target.value)}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="total">Total Marks</Label>
                    <Input
                      id="total"
                      type="number"
                      placeholder="e.g. 600"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(e.target.value)}
                      min={1}
                    />
                  </div>
                </div>
                {percentage && (
                  <div className="rounded-xl border bg-primary/5 p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your Percentage</p>
                    <p className="text-5xl font-bold text-primary">{percentage}%</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {marksObtained} out of {totalMarks} marks
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cgpa" className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cgpa">Your CGPA</Label>
                    <Input
                      id="cgpa"
                      type="number"
                      placeholder="e.g. 8.5"
                      value={cgpa}
                      onChange={(e) => setCgpa(e.target.value)}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div>
                    <Label>CGPA Scale</Label>
                    <Select value={cgpaScale} onValueChange={setCgpaScale}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CGPA_SCALES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
                  <strong>Formula:</strong> CGPA × {selectedScale?.multiplier.toFixed(2)} = Percentage
                </div>
                {cgpaPercentage && (
                  <div className="rounded-xl border bg-primary/5 p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Equivalent Percentage</p>
                    <p className="text-5xl font-bold text-primary">{cgpaPercentage}%</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      CGPA {cgpa} on {selectedScale?.label}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Internal Links */}
        <section className="mb-8 p-6 bg-muted/50 rounded-xl">
          <h2 className="text-lg font-semibold mb-3">Related Tools & Resources</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Age Calculator', href: '/govt-job-age-calculator' },
              { label: 'Salary Calculator', href: '/govt-salary-calculator' },
              { label: 'SSC Jobs', href: '/sarkari-jobs' },
              { label: 'IBPS PO', href: '/sarkari-jobs' },
              { label: 'UPSC CSE', href: '/sarkari-jobs' },
              { label: 'Railway Jobs', href: '/sarkari-jobs' },
              { label: 'AI Resume Checker', href: '/tools/resume-checker' },
            ].map((link) => (
              <Link key={link.label} to={link.href}>
                <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                  {link.label}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
