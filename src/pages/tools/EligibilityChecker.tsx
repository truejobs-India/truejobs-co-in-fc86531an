import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, XCircle, CalendarDays, GraduationCap, Users, ArrowRight, Loader2 } from 'lucide-react';

const QUALIFICATION_OPTIONS = [
  { value: '10th', label: '10th Pass' },
  { value: '12th', label: '12th Pass' },
  { value: 'iti', label: 'ITI' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'medical', label: 'Medical' },
  { value: 'law', label: 'Law' },
  { value: 'postgraduate', label: 'Post Graduate' },
];

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General (UR)', ageField: 'max_age_gen' as const },
  { value: 'obc', label: 'OBC', ageField: 'max_age_obc' as const },
  { value: 'sc', label: 'SC', ageField: 'max_age_scst' as const },
  { value: 'st', label: 'ST', ageField: 'max_age_scst' as const },
  { value: 'ph', label: 'PH / PwBD', ageField: 'max_age_ph' as const },
  { value: 'exservicemen', label: 'Ex-Servicemen', ageField: 'max_age_exservicemen' as const },
];

function calculateAge(dob: string, refDate: string): { years: number; months: number; days: number } {
  const birth = new Date(dob);
  const ref = new Date(refDate);
  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  let days = ref.getDate() - birth.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months, days };
}

export default function EligibilityChecker() {
  const [dob, setDob] = useState('');
  const [qualification, setQualification] = useState('');
  const [category, setCategory] = useState('general');
  const [hasSearched, setHasSearched] = useState(false);

  const { data: exams, isLoading } = useQuery({
    queryKey: ['eligibility-exams', qualification],
    queryFn: async () => {
      if (!qualification) return [];
      const { data, error } = await supabase
        .from('govt_exams')
        .select('id, exam_name, slug, status, min_age, max_age_gen, max_age_obc, max_age_scst, max_age_ph, max_age_exservicemen, qualification_tags, application_end, exam_date, total_vacancies, conducting_body')
        .contains('qualification_tags', [qualification])
        .in('status', ['upcoming', 'active', 'application_open'])
        .order('application_end', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!qualification && hasSearched,
  });

  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === category);

  const filteredExams = useMemo(() => {
    if (!exams || !dob || !selectedCategory) return [];
    const ageInfo = calculateAge(dob, new Date().toISOString().split('T')[0]);
    
    return exams.map(exam => {
      const maxAge = exam[selectedCategory.ageField] ?? exam.max_age_gen;
      const minAge = exam.min_age ?? 18;
      const isEligible = maxAge ? (ageInfo.years >= minAge && ageInfo.years <= maxAge) : null;
      return { ...exam, isEligible, maxAge, minAge, userAge: ageInfo.years };
    }).sort((a, b) => {
      if (a.isEligible === true && b.isEligible !== true) return -1;
      if (b.isEligible === true && a.isEligible !== true) return 1;
      return 0;
    });
  }, [exams, dob, selectedCategory]);

  const handleSearch = () => {
    if (dob && qualification) setHasSearched(true);
  };

  const eligibleCount = filteredExams.filter(e => e.isEligible === true).length;
  const notEligibleCount = filteredExams.filter(e => e.isEligible === false).length;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How does the government exam eligibility checker work?', acceptedAnswer: { '@type': 'Answer', text: 'Enter your date of birth, highest qualification, and reservation category. The tool matches your profile against all active government exams to show which ones you are eligible for based on age limits and educational requirements.' } },
      { '@type': 'Question', name: 'Does the eligibility checker include age relaxation?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. When you select your category (OBC, SC/ST, PH, Ex-Servicemen), the tool automatically uses the relaxed age limits specified in the official notification for that category.' } },
      { '@type': 'Question', name: 'Which exams are included in the eligibility check?', acceptedAnswer: { '@type': 'Answer', text: 'The checker includes all active government exams on TrueJobs — SSC, UPSC, IBPS, Railway, state PSCs, and other central/state government recruitment exams.' } },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://truejobs.co.in/' },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://truejobs.co.in/tools' },
      { '@type': 'ListItem', position: 3, name: 'Eligibility Checker' },
    ],
  };

  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Government Exam Eligibility Checker',
    url: 'https://truejobs.co.in/govt-exam-eligibility-checker',
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };

  return (
    <Layout>
      <SEO
        title="Government Exam Eligibility Checker 2026 | Check Age & Qualification"
        description="Check your eligibility for SSC, UPSC, IBPS, Railway & state government exams. Enter DOB, qualification & category to find matching exams instantly."
      />
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(webAppSchema)}</script>

      <div className="container mx-auto px-4 py-10 max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/tools" className="hover:text-primary">Tools</Link>
          <span>/</span>
          <span className="text-foreground">Eligibility Checker</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-3">Government Exam Eligibility Checker</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Find out which government exams you're eligible for in 2026. Enter your date of birth, highest qualification,
          and reservation category to instantly check eligibility across SSC, UPSC, IBPS, Railway, and state-level exams.
        </p>

        {/* Input Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Enter Your Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label>Highest Qualification</Label>
                <Select value={qualification} onValueChange={v => { setQualification(v); setHasSearched(false); }}>
                  <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                  <SelectContent>
                    {QUALIFICATION_OPTIONS.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={!dob || !qualification} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Check Eligibility
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Checking eligibility...</span>
          </div>
        )}

        {hasSearched && !isLoading && filteredExams.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="text-center p-4">
                <div className="text-2xl font-bold text-primary">{filteredExams.length}</div>
                <div className="text-sm text-muted-foreground">Exams Found</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-2xl font-bold text-green-600">{eligibleCount}</div>
                <div className="text-sm text-muted-foreground">Eligible</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-2xl font-bold text-red-500">{notEligibleCount}</div>
                <div className="text-sm text-muted-foreground">Not Eligible</div>
              </Card>
            </div>

            {/* Exam List */}
            <div className="space-y-3">
              {filteredExams.map(exam => (
                <Card key={exam.id} className={`border-l-4 ${exam.isEligible === true ? 'border-l-green-500' : exam.isEligible === false ? 'border-l-red-400' : 'border-l-muted'}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{exam.exam_name}</h3>
                        {exam.isEligible === true && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Eligible</Badge>}
                        {exam.isEligible === false && <Badge variant="destructive">Not Eligible</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {exam.conducting_body && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{exam.conducting_body}</span>}
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Age: {exam.minAge}–{exam.maxAge ?? '—'} yrs (You: {exam.userAge})</span>
                        {exam.total_vacancies && exam.total_vacancies > 0 && <span>{exam.total_vacancies.toLocaleString()} vacancies</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/sarkari-jobs/${exam.slug}`}>
                        View <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {hasSearched && !isLoading && filteredExams.length === 0 && (
          <Card className="text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No matching exams found</h3>
            <p className="text-muted-foreground">Try changing your qualification or check back later for new notifications.</p>
          </Card>
        )}

        {/* Internal Links */}
        <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Age Calculator', href: '/govt-job-age-calculator' },
            { label: 'Fee Calculator', href: '/govt-exam-fee-calculator' },
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
            <div><h3 className="font-semibold">How does the eligibility checker work?</h3><p className="text-sm text-muted-foreground mt-1">Enter your DOB, qualification, and category. The tool queries all active government exams and matches your profile against their age limits and educational requirements.</p></div>
            <div><h3 className="font-semibold">Does it include age relaxation?</h3><p className="text-sm text-muted-foreground mt-1">Yes. When you select OBC, SC/ST, PH, or Ex-Servicemen, the relaxed age limits from official notifications are used automatically.</p></div>
            <div><h3 className="font-semibold">Which exams are included?</h3><p className="text-sm text-muted-foreground mt-1">All active exams on TrueJobs — SSC, UPSC, IBPS, Railway, state PSCs, and other central/state government recruitments.</p></div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
