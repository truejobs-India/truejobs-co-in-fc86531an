import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IndianRupee } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  PAY_MATRIX,
  DA_RATE,
  HRA_RATES,
  getTransportAllowance,
  NPS_RATE,
  computeAnnualTax,
} from '@/data/cpcPayMatrix';

const SITE_URL = 'https://truejobs.co.in';

const CITY_TYPES = [
  { value: 'X', label: 'X – Metro (Delhi, Mumbai, Kolkata, etc.)' },
  { value: 'Y', label: 'Y – Other Cities (Lucknow, Jaipur, etc.)' },
  { value: 'Z', label: 'Z – Small Towns & Rural' },
];

const FAQ_ITEMS = [
  {
    question: 'What is the current DA rate for central government employees?',
    answer: `The current Dearness Allowance (DA) rate is ${DA_RATE * 100}% of basic pay, effective from January 2025. DA is revised twice a year (January and July) based on the All India Consumer Price Index.`,
  },
  {
    question: 'How is HRA calculated for government employees?',
    answer: 'HRA is calculated as a percentage of basic pay based on the city classification: 27% for X cities (metros), 18% for Y cities, and 9% for Z cities (small towns and rural areas).',
  },
  {
    question: 'What is NPS deduction in government salary?',
    answer: 'Under the National Pension System (NPS), 10% of (Basic Pay + DA) is deducted from the employee\'s salary as their contribution. The government contributes an additional 14%.',
  },
  {
    question: 'How many pay levels are there in the 7th CPC pay matrix?',
    answer: 'The 7th CPC pay matrix has 18 pay levels (Level 1 to Level 18), plus Level 13A. Level 1 starts at ₹18,000 and Level 18 goes up to ₹2,50,000.',
  },
];

function fmt(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export default function SalaryCalculator() {
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedBasic, setSelectedBasic] = useState('');
  const [cityType, setCityType] = useState('X');

  const level = PAY_MATRIX.find(l => String(l.level) === selectedLevel);

  const breakdown = useMemo(() => {
    const basic = Number(selectedBasic);
    if (!basic || !level) return null;

    const da = basic * DA_RATE;
    const hra = basic * HRA_RATES[cityType];
    const taBase = getTransportAllowance(level.level);
    const daOnTA = taBase * DA_RATE;
    const ta = taBase + daOnTA;

    const grossMonthly = basic + da + hra + ta;
    const npsDeduction = (basic + da) * NPS_RATE;

    const annualGross = grossMonthly * 12;
    const annualTax = computeAnnualTax(annualGross);
    const monthlyTax = annualTax / 12;

    const netMonthly = grossMonthly - npsDeduction - monthlyTax;

    return {
      basic,
      da,
      hra,
      taBase,
      daOnTA,
      ta,
      grossMonthly,
      npsDeduction,
      monthlyTax,
      annualTax,
      netMonthly,
    };
  }, [selectedBasic, selectedLevel, cityType, level]);

  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '7th CPC Salary Calculator',
    url: `${SITE_URL}/govt-salary-calculator`,
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
      { '@type': 'ListItem', position: 3, name: 'Salary Calculator', item: `${SITE_URL}/govt-salary-calculator` },
    ],
  };

  return (
    <Layout noAds>
      <SEO
        title="7th CPC Salary Calculator | Govt Pay"
        description="Calculate your government salary under the 7th Pay Commission. Get detailed breakdown of DA, HRA, TA, NPS deduction, and estimated tax for all 18 pay levels."
        canonical="/govt-salary-calculator"
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
            <li className="text-foreground font-medium">Salary Calculator</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">7th CPC Government Salary Calculator</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Calculate the complete salary breakdown for central government employees under the 
          7th Pay Commission. Select your pay level, basic pay index, and city type to see 
          detailed monthly earnings including DA ({DA_RATE * 100}%), HRA, Transport Allowance, 
          NPS deduction, and estimated income tax.
        </p>

        {/* Input Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              Enter Your Pay Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Pay Level</Label>
                <Select value={selectedLevel} onValueChange={(v) => { setSelectedLevel(v); setSelectedBasic(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {PAY_MATRIX.map(l => (
                      <SelectItem key={l.level} value={String(l.level)}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Basic Pay (Index)</Label>
                <Select value={selectedBasic} onValueChange={setSelectedBasic} disabled={!level}>
                  <SelectTrigger><SelectValue placeholder={level ? 'Select basic pay' : 'Select level first'} /></SelectTrigger>
                  <SelectContent>
                    {level?.basicPaySteps.map((bp, i) => (
                      <SelectItem key={i} value={String(bp)}>₹{bp.toLocaleString('en-IN')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City Type</Label>
                <Select value={cityType} onValueChange={setCityType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CITY_TYPES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown */}
        {breakdown && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Salary Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Component</th>
                      <th className="text-right py-3 px-4 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2.5 px-4">Basic Pay</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(breakdown.basic)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-4">Dearness Allowance (DA) @ {DA_RATE * 100}%</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(breakdown.da)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-4">House Rent Allowance (HRA) @ {HRA_RATES[cityType] * 100}%</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(breakdown.hra)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-4">Transport Allowance (TA)</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(breakdown.taBase)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-4">DA on TA @ {DA_RATE * 100}%</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(breakdown.daOnTA)}</td>
                    </tr>
                    <tr className="border-b bg-primary/5">
                      <td className="py-3 px-4 font-bold">Gross Monthly Salary</td>
                      <td className="py-3 px-4 text-right font-bold text-primary">{fmt(breakdown.grossMonthly)}</td>
                    </tr>

                    <tr className="border-b">
                      <td className="py-2.5 px-4 text-destructive">NPS Deduction @ {NPS_RATE * 100}%</td>
                      <td className="py-2.5 px-4 text-right font-medium text-destructive">- {fmt(breakdown.npsDeduction)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-4 text-destructive">Estimated Income Tax (monthly)</td>
                      <td className="py-2.5 px-4 text-right font-medium text-destructive">- {fmt(breakdown.monthlyTax)}</td>
                    </tr>

                    <tr className="bg-green-50 dark:bg-green-950">
                      <td className="py-3 px-4 font-bold text-lg">Net Take-Home Salary</td>
                      <td className="py-3 px-4 text-right font-bold text-lg text-green-700 dark:text-green-400">{fmt(breakdown.netMonthly)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                * Tax estimate uses New Tax Regime (FY 2025-26) with standard deduction of ₹75,000.
                Actual tax may vary based on investments and exemptions. NPS is calculated on Basic + DA.
              </p>
            </CardContent>
          </Card>
        )}

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
          <h2 className="text-lg font-semibold mb-3">Explore More</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Age Calculator', href: '/govt-job-age-calculator' },
              { label: 'Percentage Calculator', href: '/percentage-calculator' },
              { label: 'SSC CGL', href: '/sarkari-jobs' },
              { label: 'IBPS PO', href: '/sarkari-jobs' },
              { label: 'UPSC CSE', href: '/sarkari-jobs' },
              { label: 'Railway NTPC', href: '/sarkari-jobs' },
              { label: 'All Govt Jobs', href: '/sarkari-jobs' },
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
