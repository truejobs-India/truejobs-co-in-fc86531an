import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LastUpdatedBadge } from '@/pages/seo/components/LastUpdatedBadge';
import {
  ExternalLink, Users, Calendar, Clock, Banknote, GraduationCap,
  FileText, Download, BookOpen, ChevronRight, Share2, Bookmark, ArrowRight
} from 'lucide-react';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Helmet } from 'react-helmet-async';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { RelatedExamLinks } from '@/pages/govt/components/RelatedExamLinks';
import { QuickLinksBlock } from '@/components/govt/QuickLinksBlock';
import { ContextualLinks } from '@/components/govt/ContextualLinks';

interface GovtExam {
  id: string;
  exam_name: string;
  slug: string;
  conducting_body: string | null;
  department_slug: string | null;
  exam_category: string;
  states: string[];
  total_vacancies: number;
  posts: any[];
  qualification_required: string | null;
  age_limit: string | null;
  age_relaxation: string | null;
  application_fee: string | null;
  salary_range: string | null;
  pay_scale: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  admit_card_date: string | null;
  result_date: string | null;
  apply_link: string | null;
  official_notification_url: string | null;
  official_website: string | null;
  notification_pdf_url: string | null;
  exam_pattern: any[];
  syllabus: any[];
  selection_stages: string | null;
  how_to_apply: string | null;
  important_dates: any[];
  faqs: any[];
  status: string;
  is_featured: boolean;
  is_hot: boolean;
  published_date: string | null;
  seo_keywords: string[];
  meta_title: string | null;
  meta_description: string | null;
  seo_content: string | null;
  created_at: string;
  updated_at: string;
}

export default function GovtExamDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [exam, setExam] = useState<GovtExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedExams, setRelatedExams] = useState<any[]>([]);

  useEffect(() => {
    const fetchExam = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from('govt_exams')
        .select('*')
        .eq('slug', slug)
        .single();
      const exam = data as unknown as GovtExam | null;
      setExam(exam);
      setLoading(false);

      if (exam) {
        const { data: related } = await supabase
          .from('govt_exams')
          .select('id, exam_name, slug, total_vacancies, status')
          .eq('status', 'active')
          .neq('id', exam.id)
          .eq('exam_category', exam.exam_category)
          .limit(4);
        setRelatedExams((related as unknown as any[]) || []);
      }
    };
    fetchExam();
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!exam) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Exam Not Found</h1>
          <Link to="/sarkari-jobs" className="text-primary hover:underline">← Back to Sarkari Jobs</Link>
        </div>
      </Layout>
    );
  }

  const year = exam.application_start ? new Date(exam.application_start).getFullYear() : new Date().getFullYear();
  const faqs = Array.isArray(exam.faqs) ? exam.faqs : [];
  const posts = Array.isArray(exam.posts) ? exam.posts : [];
  const examPattern = Array.isArray(exam.exam_pattern) ? exam.exam_pattern : [];

  // JSON-LD schemas
  const jobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: exam.exam_name,
    description: exam.meta_description || `${exam.exam_name} recruitment notification`,
    datePosted: exam.published_date || exam.created_at?.split('T')[0],
    validThrough: exam.application_end || undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: exam.conducting_body || 'Government of India',
    },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressCountry: 'IN' },
    },
    employmentType: 'FULL_TIME',
  };

  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f: any) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://truejobs.co.in/' },
      { '@type': 'ListItem', position: 2, name: 'Sarkari Jobs', item: 'https://truejobs.co.in/sarkari-jobs' },
      { '@type': 'ListItem', position: 3, name: exam.exam_name },
    ],
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'result_declared': return 'bg-purple-100 text-purple-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Layout>
      <SEO
        title={exam.meta_title || `${exam.exam_name} ${year} — Apply Online | TrueJobs`}
        description={exam.meta_description || `${exam.exam_name} notification ${year}. Check eligibility, vacancy, dates & apply online.`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jobPostingSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
        <link rel="canonical" href={`https://truejobs.co.in/sarkari-jobs/${exam.slug}`} />
      </Helmet>

      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/sarkari-jobs" className="hover:text-foreground">Sarkari Jobs</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{exam.exam_name}</span>
        </nav>

        {/* 1. Quick Summary Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground font-['Outfit',sans-serif] mb-2">
                  {exam.exam_name}
                </h1>
                {exam.conducting_body && (
                  <p className="text-muted-foreground mb-3">{exam.conducting_body}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-xs px-3 py-1 rounded-full ${statusColor(exam.status)}`}>
                    {exam.status.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="outline">{exam.exam_category}</Badge>
                  {exam.states?.length > 0 && (
                    <Badge variant="secondary">{exam.states.join(', ')}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {exam.total_vacancies > 0 && (
                    <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Vacancies</p><p className="font-semibold">{exam.total_vacancies.toLocaleString()}</p></div></div>
                  )}
                  {exam.salary_range && (
                    <div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Salary</p><p className="font-semibold">{exam.salary_range}</p></div></div>
                  )}
                  {exam.application_end && (
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Last Date</p><p className="font-semibold">{exam.application_end}</p></div></div>
                  )}
                  {exam.qualification_required && (
                    <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Qualification</p><p className="font-semibold">{exam.qualification_required}</p></div></div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {exam.apply_link && (
                  <Button asChild className="gap-2">
                    <a href={exam.apply_link} target="_blank" rel="noopener noreferrer">
                      Apply Online <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-2">
                  <Bookmark className="h-4 w-4" /> Save
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigator.share?.({ url: window.location.href, title: exam.exam_name })}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4">
          <AdPlaceholder variant="banner" />
        </div>

        {/* 2. Last Updated Badge */}
        <div className="mb-6">
          <LastUpdatedBadge date={exam.updated_at.split('T')[0]} />
        </div>

        {/* 3. Eligibility */}
        {(exam.age_limit || exam.qualification_required) && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Eligibility Criteria</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {exam.qualification_required && (
                  <div><p className="text-sm font-medium mb-1">Qualification</p><p className="text-sm text-muted-foreground">{exam.qualification_required}</p></div>
                )}
                {exam.age_limit && (
                  <div><p className="text-sm font-medium mb-1">Age Limit</p><p className="text-sm text-muted-foreground">{exam.age_limit}</p></div>
                )}
                {exam.age_relaxation && (
                  <div className="md:col-span-2"><p className="text-sm font-medium mb-1">Age Relaxation</p><p className="text-sm text-muted-foreground">{exam.age_relaxation}</p></div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. Vacancy Breakdown */}
        {posts.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Vacancy Breakdown</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post Name</TableHead>
                    <TableHead>Vacancies</TableHead>
                    <TableHead>Qualification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name || p.post_name || '—'}</TableCell>
                      <TableCell>{p.vacancies || p.count || '—'}</TableCell>
                      <TableCell>{p.qualification || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 5. Application Fee */}
        {exam.application_fee && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Application Fee</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{exam.application_fee}</p></CardContent>
          </Card>
        )}

        {/* 6. Selection Process */}
        {exam.selection_stages && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Selection Process</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {exam.selection_stages.split('→').map((stage, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="secondary">{stage.trim()}</Badge>
                    {i < exam.selection_stages!.split('→').length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 7. Exam Pattern */}
        {examPattern.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Exam Pattern</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examPattern.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.subject || '—'}</TableCell>
                      <TableCell>{p.questions || '—'}</TableCell>
                      <TableCell>{p.marks || '—'}</TableCell>
                      <TableCell>{p.duration || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 8. How to Apply */}
        {exam.how_to_apply && (
          <Card className="mb-6">
            <CardHeader><CardTitle>How to Apply</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{exam.how_to_apply}</p></CardContent>
          </Card>
        )}

        {/* 9. Important Links */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Important Links</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {exam.apply_link && (
                <a href={exam.apply_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 text-sm font-medium text-primary transition-colors">
                  <ExternalLink className="h-4 w-4" /> Apply Online
                </a>
              )}
              {exam.official_notification_url && (
                <a href={exam.official_notification_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 text-sm font-medium text-primary transition-colors">
                  <FileText className="h-4 w-4" /> Official Notification
                </a>
              )}
              {exam.official_website && (
                <a href={exam.official_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 text-sm font-medium text-primary transition-colors">
                  <ExternalLink className="h-4 w-4" /> Official Website
                </a>
              )}
              {exam.notification_pdf_url && (
                <a href={exam.notification_pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 text-sm font-medium text-primary transition-colors">
                  <Download className="h-4 w-4" /> Download Notification PDF
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 10. FAQs */}
        {faqs.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Frequently Asked Questions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {faqs.map((faq: any, i: number) => (
                  <div key={i}>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{faq.question}</h3>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 11. SEO Content */}
        {exam.seo_content && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="prose prose-neutral max-w-none text-muted-foreground [&_h2]:text-foreground [&_h3]:text-foreground" dangerouslySetInnerHTML={{ __html: exam.seo_content }} />
            </CardContent>
          </Card>
        )}

        {/* 12. Quick Links */}
        <QuickLinksBlock
          departmentSlug={exam.department_slug}
          states={exam.states}
          qualificationRequired={exam.qualification_required}
        />

        {/* 13. Contextual Combo Links */}
        <ContextualLinks
          departmentSlug={exam.department_slug}
          states={exam.states}
        />

        {/* 14. Related Exam Links (authority + tools + guides) */}
        {exam.department_slug && (
          <RelatedExamLinks
            departmentSlug={exam.department_slug}
          />
        )}

        {/* 15. Related Jobs */}
        {relatedExams.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Related Government Jobs</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {relatedExams.map((r: any) => (
                  <Link key={r.id} to={`/sarkari-jobs/${r.slug}`} className="p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                    <h3 className="text-sm font-medium text-foreground">{r.exam_name}</h3>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      {r.total_vacancies > 0 && <span>{r.total_vacancies} vacancies</span>}
                      <span>{r.status.replace(/_/g, ' ')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <PopularExamsBlock departmentSlug={exam?.department_slug || undefined} />
    </Layout>
  );
}
