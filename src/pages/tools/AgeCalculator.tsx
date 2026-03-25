import { useState, useMemo } from 'react';
import { format, differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CalendarIcon, Info, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const SITE_URL = 'https://truejobs.co.in';

const RELAXATION_TABLE = [
  { category: 'General (UR)', relaxation: 0, color: 'bg-muted' },
  { category: 'OBC (Non-Creamy Layer)', relaxation: 3, color: 'bg-orange-50 dark:bg-orange-950' },
  { category: 'SC / ST', relaxation: 5, color: 'bg-blue-50 dark:bg-blue-950' },
  { category: 'PwBD (PH)', relaxation: 10, color: 'bg-green-50 dark:bg-green-950' },
  { category: 'Ex-Servicemen', relaxation: 5, color: 'bg-amber-50 dark:bg-amber-950' },
];

const FAQ_ITEMS = [
  {
    question: 'How is age calculated for government exams?',
    answer: 'Age is calculated from the date of birth to a specific reference/cut-off date mentioned in the exam notification. Most exams use 1st January or 1st August of the exam year as the cut-off date.',
  },
  {
    question: 'What is the age relaxation for OBC candidates?',
    answer: 'OBC (Non-Creamy Layer) candidates get 3 years of age relaxation over the upper age limit in most central government exams like SSC, UPSC, and Railway recruitments.',
  },
  {
    question: 'Is there any age relaxation for female candidates?',
    answer: 'Some state-level exams provide age relaxation for female candidates. For central government exams, there is generally no separate relaxation for females unless they belong to a reserved category.',
  },
  {
    question: 'What is the maximum age limit for UPSC Civil Services?',
    answer: 'The upper age limit for UPSC CSE is 32 years for General category, 35 years for OBC, and 37 years for SC/ST candidates, calculated as of 1st August of the exam year.',
  },
];

function calculateExactAge(dob: Date, refDate: Date) {
  const years = differenceInYears(refDate, dob);
  const afterYears = addYears(dob, years);
  const months = differenceInMonths(refDate, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(refDate, afterMonths);
  return { years, months, days };
}

export default function AgeCalculator() {
  const [dob, setDob] = useState<Date>();
  const [refDate, setRefDate] = useState<Date>(new Date());

  const age = useMemo(() => {
    if (!dob) return null;
    return calculateExactAge(dob, refDate);
  }, [dob, refDate]);

  const setAugust2026 = () => setRefDate(new Date(2026, 7, 1));
  const setJan2026 = () => setRefDate(new Date(2026, 0, 1));

  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Government Job Age Calculator',
    url: `${SITE_URL}/govt-job-age-calculator`,
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
      { '@type': 'ListItem', position: 3, name: 'Age Calculator', item: `${SITE_URL}/govt-job-age-calculator` },
    ],
  };

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO
        title="Govt Job Age Calculator | Check Eligibility"
        description="Calculate your exact age for government exams like SSC, UPSC, Railway, Banking. Check category-wise age relaxation and eligibility instantly."
        canonical="/govt-job-age-calculator"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaBreadcrumb) }} />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li>/</li>
            <li><Link to="/tools" className="hover:text-primary">Tools</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Age Calculator</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">Government Job Age Calculator</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Calculate your exact age in years, months, and days for government exam eligibility. 
          Most central government exams like SSC CGL, UPSC, IBPS PO, and Railway NTPC have specific 
          age limits with category-wise relaxation. Use this free tool to instantly check your 
          eligibility based on the exam's cut-off date.
        </p>

        {/* Calculator Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Calculate Your Age</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              {/* DOB Picker */}
              <div>
                <label className="text-sm font-medium mb-2 block">Date of Birth</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dob && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dob ? format(dob, 'dd MMM yyyy') : 'Select your DOB'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dob}
                      onSelect={setDob}
                      disabled={(date) => date > new Date() || date < new Date('1950-01-01')}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      captionLayout="dropdown-buttons"
                      fromYear={1950}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Reference Date */}
              <div>
                <label className="text-sm font-medium mb-2 block">Reference / Cut-off Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(refDate, 'dd MMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={refDate}
                      onSelect={(d) => d && setRefDate(d)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={setAugust2026}>1 Aug 2026</Button>
                  <Button variant="outline" size="sm" onClick={setJan2026}>1 Jan 2026</Button>
                  <Button variant="outline" size="sm" onClick={() => setRefDate(new Date())}>Today</Button>
                </div>
              </div>
            </div>

            {/* Result */}
            {age && (
              <div className="rounded-xl border bg-primary/5 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Your exact age on {format(refDate, 'dd MMM yyyy')}</p>
                <p className="text-4xl font-bold text-primary">
                  {age.years} <span className="text-lg font-normal text-muted-foreground">years</span>{' '}
                  {age.months} <span className="text-lg font-normal text-muted-foreground">months</span>{' '}
                  {age.days} <span className="text-lg font-normal text-muted-foreground">days</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Age Relaxation Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Category-wise Age Relaxation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Category</th>
                    <th className="text-center py-3 px-4 font-semibold">Relaxation (Years)</th>
                    {age && <th className="text-center py-3 px-4 font-semibold">Effective Age</th>}
                    {age && <th className="text-center py-3 px-4 font-semibold">Eligible (≤35)?</th>}
                  </tr>
                </thead>
                <tbody>
                  {RELAXATION_TABLE.map((row) => {
                    const effectiveAge = age ? age.years - row.relaxation : null;
                    const eligible = effectiveAge !== null ? effectiveAge <= 35 : null;
                    return (
                      <tr key={row.category} className={cn('border-b', row.color)}>
                        <td className="py-3 px-4 font-medium">{row.category}</td>
                        <td className="py-3 px-4 text-center">+{row.relaxation} years</td>
                        {effectiveAge !== null && (
                          <td className="py-3 px-4 text-center font-semibold">{effectiveAge} years</td>
                        )}
                        {eligible !== null && (
                          <td className="py-3 px-4 text-center">
                            {eligible ? (
                              <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Yes</Badge>
                            ) : (
                              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />No</Badge>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              * Sample check against a 35-year upper age limit. Actual limits vary by exam.
            </p>
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
          <h2 className="text-lg font-semibold mb-3">Popular Government Exams</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'SSC CGL', href: '/sarkari-jobs' },
              { label: 'IBPS PO', href: '/sarkari-jobs' },
              { label: 'UPSC CSE', href: '/sarkari-jobs' },
              { label: 'Railway NTPC', href: '/sarkari-jobs' },
              { label: 'All Govt Jobs', href: '/sarkari-jobs' },
              { label: 'Salary Calculator', href: '/govt-salary-calculator' },
              { label: 'Percentage Calculator', href: '/percentage-calculator' },
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
