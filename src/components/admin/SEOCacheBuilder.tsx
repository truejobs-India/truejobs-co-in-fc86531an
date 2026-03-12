import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PageData {
  slug: string;
  pageType: string;
  title: string;
  h1: string;
  metaDescription: string;
  introContent: string;
  faqItems: { question: string; answer: string }[];
  datePublished: string;
  lastUpdated: string;
  crossLinks: { label: string; slug: string }[];
}

const DATE_DEFAULTS = { datePublished: '2026-01-15', lastUpdated: '2026-02-21' };

async function collectAllPages(): Promise<PageData[]> {
  const pages: PageData[] = [];

  // 0a. Standalone public routes (not in data files)
  const standalonePages: PageData[] = [
    {
      slug: '',
      pageType: 'standalone',
      title: 'TrueJobs – Smart Job Search India | AI-Powered Job Portal',
      h1: 'Find Your Dream Job in India',
      metaDescription: 'AI-powered job portal for India. Search latest jobs, post listings, and apply fast. Find your dream career with intelligent job matching on TrueJobs.',
      introContent: '<h2>India\'s Smart Job Search Platform</h2><p>TrueJobs connects job seekers with top employers across India using AI-powered matching. Browse thousands of verified job openings in IT, banking, government, healthcare, and more.</p>',
      faqItems: [
        { question: 'How does TrueJobs work?', answer: 'TrueJobs uses AI to match your skills and preferences with the best job openings across India. Create a profile, upload your resume, and get matched instantly.' },
        { question: 'Is TrueJobs free for job seekers?', answer: 'Yes, TrueJobs is completely free for job seekers. You can search jobs, apply, and use our AI resume tools at no cost.' },
      ],
      ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Browse All Jobs', slug: 'jobs' },
        { label: 'Companies', slug: 'companies' },
        { label: 'Blog', slug: 'blog' },
      ],
    },
    {
      slug: 'jobs',
      pageType: 'standalone',
      title: 'Browse Jobs – Latest Job Openings in India | TrueJobs',
      h1: 'Latest Job Openings in India',
      metaDescription: 'Browse thousands of latest job openings across India. Filter by location, category, salary, and experience. Apply to verified jobs on TrueJobs.',
      introContent: '<h2>Search & Apply for Jobs</h2><p>Explore the latest job openings from top companies across India. Use filters to find the perfect match for your skills and experience.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Companies', slug: 'companies' },
      ],
    },
    {
      slug: 'blog',
      pageType: 'standalone',
      title: 'Career Blog – Job Search Tips & Career Advice | TrueJobs',
      h1: 'TrueJobs Career Blog',
      metaDescription: 'Expert career advice, job search tips, resume writing guides, and interview preparation. Stay updated with the latest hiring trends in India.',
      introContent: '<h2>Career Advice & Job Search Tips</h2><p>Read expert articles on resume writing, interview preparation, salary negotiation, and career growth strategies.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Browse Jobs', slug: 'jobs' },
        { label: 'Resume Tools', slug: 'tools' },
      ],
    },
    {
      slug: 'companies',
      pageType: 'standalone',
      title: 'Top Companies Hiring in India | TrueJobs',
      h1: 'Top Companies Hiring in India',
      metaDescription: 'Explore top companies hiring in India. View company profiles, reviews, open positions, and apply directly on TrueJobs.',
      introContent: '<h2>Discover Top Employers</h2><p>Browse company profiles, see their open positions, and apply directly. Find your next employer on TrueJobs.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Browse Jobs', slug: 'jobs' },
      ],
    },
    {
      slug: 'tools',
      pageType: 'standalone',
      title: 'Free Career Tools – AI Resume Builder & Checker | TrueJobs',
      h1: 'Free Career Tools',
      metaDescription: 'Free AI-powered career tools. Build ATS-friendly resumes, check resume scores, and optimize your job applications with TrueJobs.',
      introContent: '<h2>AI-Powered Career Tools</h2><p>Use our free tools to build professional resumes, check ATS compatibility, and improve your job applications.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Browse Jobs', slug: 'jobs' },
      ],
    },
    {
      slug: 'aboutus',
      pageType: 'standalone',
      title: 'About TrueJobs – India\'s AI Job Portal',
      h1: 'About TrueJobs',
      metaDescription: 'Learn about TrueJobs, India\'s AI-powered job portal connecting job seekers with verified employers across the country.',
      introContent: '<h2>About TrueJobs</h2><p>TrueJobs is an AI-powered job portal dedicated to connecting Indian job seekers with verified employers.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [],
    },
    {
      slug: 'contactus',
      pageType: 'standalone',
      title: 'Contact Us – TrueJobs',
      h1: 'Contact TrueJobs',
      metaDescription: 'Get in touch with TrueJobs. Contact us for support, feedback, or business inquiries.',
      introContent: '<h2>Contact Us</h2><p>We\'d love to hear from you. Reach out for support, feedback, or partnership opportunities.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [],
    },
    {
      slug: 'privacypolicy',
      pageType: 'standalone',
      title: 'Privacy Policy – TrueJobs',
      h1: 'Privacy Policy',
      metaDescription: 'Read TrueJobs privacy policy. Learn how we collect, use, and protect your personal information.',
      introContent: '<h2>Privacy Policy</h2><p>Your privacy is important to us. This policy outlines how TrueJobs handles your data.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [],
    },
    {
      slug: 'termsofuse',
      pageType: 'standalone',
      title: 'Terms of Use – TrueJobs',
      h1: 'Terms of Use',
      metaDescription: 'Read TrueJobs terms of use. Understand the terms and conditions for using our platform.',
      introContent: '<h2>Terms of Use</h2><p>By using TrueJobs, you agree to the following terms and conditions.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [],
    },
    {
      slug: 'disclaimer',
      pageType: 'standalone',
      title: 'Disclaimer – TrueJobs',
      h1: 'Disclaimer',
      metaDescription: 'Read the TrueJobs disclaimer regarding job listings, accuracy, and third-party content.',
      introContent: '<h2>Disclaimer</h2><p>Information on TrueJobs is provided for general informational purposes.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [],
    },
    {
      slug: 'editorial-policy',
      pageType: 'standalone',
      title: 'Editorial Policy – TrueJobs',
      h1: 'Editorial Policy',
      metaDescription: 'Read the TrueJobs editorial policy. Learn about our content standards and editorial guidelines.',
      introContent: '<h2>Editorial Policy</h2><p>TrueJobs maintains high editorial standards for all content published on our platform.</p>',
      faqItems: [],
      ...DATE_DEFAULTS,
      crossLinks: [],
    },
  ];
  pages.push(...standalonePages);


  // 1. City job pages (jobs-in-*)
  const { CITY_JOBS_DATA } = await import('@/pages/seo/cityJobsData');
  for (const c of CITY_JOBS_DATA) {
    pages.push({
      slug: c.slug,
      pageType: 'city',
      title: c.metaTitle,
      h1: c.h1,
      metaDescription: c.metaDescription,
      introContent: c.introContent,
      faqItems: c.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [
        ...c.nearbyCities.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
        ...c.relatedCategories.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
      ],
    });
  }

  // 10. Category job pages
  const { CATEGORY_JOBS_DATA } = await import('@/pages/seo/categoryJobsData');
  for (const c of CATEGORY_JOBS_DATA) {
    pages.push({
      slug: c.slug,
      pageType: 'category',
      title: c.metaTitle,
      h1: c.h1,
      metaDescription: c.metaDescription,
      introContent: c.introContent,
      faqItems: c.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [
        ...c.topCities.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
        ...c.relatedIndustries.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
      ],
    });
  }

  // 11. Industry job pages
  const { INDUSTRY_JOBS_DATA } = await import('@/pages/seo/industryJobsData');
  for (const i of INDUSTRY_JOBS_DATA) {
    pages.push({
      slug: i.slug,
      pageType: 'industry',
      title: i.metaTitle,
      h1: i.h1,
      metaDescription: i.metaDescription,
      introContent: i.introContent,
      faqItems: i.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [
        ...i.topCities.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
        ...i.relatedCategories.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
      ],
    });
  }

  // 12. Exam Authority pages (80 configs)
  const { getAllExamAuthoritySlugs, getExamAuthorityConfig } = await import('@/data/examAuthority/index');
  for (const slug of getAllExamAuthoritySlugs()) {
    const cfg = getExamAuthorityConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: `authority-${cfg.pageType}`,
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.overview.substring(0, 500),
      faqItems: cfg.faqs,
      datePublished: cfg.datePublished,
      lastUpdated: cfg.lastUpdated,
      crossLinks: (cfg.relatedExams || []).map(r => ({ label: r.label, slug: r.href.replace(/^\//, '') })),
    });
  }

  // 13. Exam Cluster Hub pages (16 hubs)
  const { getAllHubSlugs, getHubConfig } = await import('@/data/examAuthority/hubs');
  for (const slug of getAllHubSlugs()) {
    const hub = getHubConfig(slug);
    if (!hub) continue;
    pages.push({
      slug: hub.slug,
      pageType: 'exam-hub',
      title: hub.metaTitle,
      h1: hub.h1,
      metaDescription: hub.metaDescription,
      introContent: hub.intro.substring(0, 500),
      faqItems: hub.faqs,
      lastUpdated: hub.lastUpdated,
      datePublished: '2026-01-15',
      crossLinks: hub.subtopicPages.map(s => ({ label: s.label, slug: s.href.replace(/^\//, '') })),
    });
  }

  // 14. Previous Year Paper pages (16 PYPs)
  const { getAllPYPSlugs, getPYPConfig } = await import('@/data/previousYearPapers');
  for (const slug of getAllPYPSlugs()) {
    const pyp = getPYPConfig(slug);
    if (!pyp) continue;
    pages.push({
      slug: pyp.slug,
      pageType: 'previous-year-paper',
      title: pyp.metaTitle,
      h1: pyp.h1,
      metaDescription: pyp.metaDescription,
      introContent: pyp.overview.substring(0, 500),
      faqItems: pyp.faqs,
      lastUpdated: pyp.lastUpdated,
      datePublished: '2026-01-15',
      crossLinks: pyp.relatedExams.map(r => ({ label: r.label, slug: r.href.replace(/^\//, '') })),
    });
  }

  // 15. State govt pages (36)
  const { getAllStateGovtSlugs, getStateGovtJobConfig } = await import('@/pages/seo/stateGovtJobsData');
  for (const slug of getAllStateGovtSlugs()) {
    const cfg = getStateGovtJobConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: 'state-govt',
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [],
    });
  }

  // 16. Department pages (5)
  const { getAllDepartmentSlugs, getDepartmentJobConfig } = await import('@/pages/seo/departmentJobsData');
  for (const slug of getAllDepartmentSlugs()) {
    const cfg = getDepartmentJobConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: 'department',
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [],
    });
  }

  // 17. Qualification pages (6)
  const { getAllQualificationSlugs, getQualificationJobConfig } = await import('@/pages/seo/qualificationJobsData');
  for (const slug of getAllQualificationSlugs()) {
    const cfg = getQualificationJobConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: 'qualification',
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [],
    });
  }

  // 18. Custom long-tail pages
  const { getAllCustomLongTailSlugs, getCustomLongTailConfig } = await import('@/pages/seo/customLongTailData');
  for (const slug of getAllCustomLongTailSlugs()) {
    const cfg = getCustomLongTailConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: `custom-${cfg.subtype}`,
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      datePublished: cfg.datePublished || DATE_DEFAULTS.datePublished,
      lastUpdated: cfg.lastUpdated || DATE_DEFAULTS.lastUpdated,
      crossLinks: cfg.quickLinks.map(l => ({ label: l.label, slug: l.href.replace(/^\//, '') })),
    });
  }

  // 19. Govt combo pages (dept+state, dept+qual, closing-soon) — Wave 3
  const { getAllComboSlugs, getComboPageConfig } = await import('@/pages/seo/govtComboData');
  for (const slug of getAllComboSlugs()) {
    const cfg = getComboPageConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: `combo-${cfg.comboType}`,
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: cfg.crossLinks.map(l => ({ label: l.label, slug: l.href.replace(/^\//, '') })),
    });
  }

  // 20. Without-exam+State pages (from selectionPageData)
  const { parseSelectionSlug, buildSelectionPageConfig } = await import('@/pages/seo/selectionPageData');
  const SELECTION_STATES = [
    'delhi', 'uttar-pradesh', 'bihar', 'haryana', 'rajasthan', 'madhya-pradesh',
    'maharashtra', 'karnataka', 'tamil-nadu', 'west-bengal', 'punjab', 'jharkhand',
    'chhattisgarh', 'odisha', 'gujarat',
  ];
  for (const st of SELECTION_STATES) {
    const selSlug = `govt-jobs-without-exam-${st}`;
    const filters = parseSelectionSlug(selSlug);
    if (!filters) continue;
    const cfg = buildSelectionPageConfig(filters);
    pages.push({
      slug: cfg.slug,
      pageType: 'selection-state',
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [],
    });
  }

  // 21. Deadline pages (today, this-week, monthly)
  const { getAllDeadlineSlugs, getDeadlinePageConfig } = await import('@/pages/seo/DeadlineJobsPage');
  for (const slug of getAllDeadlineSlugs()) {
    const cfg = getDeadlinePageConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug,
      pageType: `deadline-${cfg.deadlineType}`,
      title: cfg.metaTitle,
      h1: cfg.h1,
      metaDescription: cfg.metaDescription,
      introContent: `<p>${cfg.metaDescription}</p>`,
      faqItems: cfg.faqItems,
      ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Last Date Today', slug: 'govt-jobs-last-date-today' },
        { label: 'This Week', slug: 'govt-jobs-last-date-this-week' },
        { label: 'All Sarkari Jobs', slug: 'all-sarkari-jobs' },
      ],
    });
  }

  // 22. All Sarkari Jobs A-Z hub
  pages.push({
    slug: 'all-sarkari-jobs',
    pageType: 'discovery-hub',
    title: 'All Sarkari Jobs A-Z Index — Complete Government Job Directory',
    h1: 'All Sarkari Jobs — A to Z Directory',
    metaDescription: 'Complete A-Z index of all government job notifications in India. Browse SSC, Railway, Banking, UPSC, Defence & State govt exams.',
    introContent: '<h2>Complete Government Job Directory</h2><p>Browse the complete alphabetical index of all government exam notifications in India.</p>',
    faqItems: [],
    ...DATE_DEFAULTS,
    crossLinks: [
      { label: 'SSC Jobs', slug: 'ssc-jobs' },
      { label: 'Railway Jobs', slug: 'railway-jobs' },
      { label: 'Banking Jobs', slug: 'banking-jobs' },
      { label: 'Last Date Today', slug: 'govt-jobs-last-date-today' },
    ],
  });

  return pages;
}

export function SEOCacheBuilder() {
  const { toast } = useToast();
  const [isBuilding, setIsBuilding] = useState(false);
  const [result, setResult] = useState<{ total: number; inserted: number; errors?: string[]; staleDeleted?: number } | null>(null);
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  const [lastBuilt, setLastBuilt] = useState<string | null>(() => localStorage.getItem('seo_cache_last_built'));

  const fetchCacheCount = async () => {
    const { count } = await supabase
      .from('seo_page_cache')
      .select('*', { count: 'exact', head: true });
    setCachedCount(count ?? 0);
  };

  const handleBuild = async () => {
    setIsBuilding(true);
    setResult(null);
    try {
      const pages = await collectAllPages();
      
      // Send in batches of 30 to avoid payload limits
      let totalInserted = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < pages.length; i += 30) {
        const batch = pages.slice(i, i + 30);
        const { data, error } = await supabase.functions.invoke('build-seo-cache', {
          body: { pages: batch },
        });

        if (error) {
          allErrors.push(`Batch ${i}: ${error.message}`);
        } else if (data) {
          totalInserted += data.inserted || 0;
          if (data.errors) allErrors.push(...data.errors);
        }
      }

      // Cleanup stale entries
      let staleDeleted = 0;
      const allSlugs = pages.map(p => p.slug);
      const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('build-seo-cache', {
        body: { cleanup: true, allSlugs },
      });
      if (cleanupError) {
        allErrors.push(`Cleanup: ${cleanupError.message}`);
      } else if (cleanupData) {
        staleDeleted = cleanupData.staleDeleted || 0;
      }

      setResult({ total: pages.length, inserted: totalInserted, errors: allErrors.length > 0 ? allErrors : undefined, staleDeleted });
      const builtAt = new Date().toLocaleString();
      localStorage.setItem('seo_cache_last_built', builtAt);
      setLastBuilt(builtAt);
      toast({
        title: 'SEO Cache Built',
        description: `${totalInserted} of ${pages.length} pages cached. ${staleDeleted > 0 ? `${staleDeleted} stale entries removed.` : ''}`,
      });
      fetchCacheCount();
    } catch (err: any) {
      toast({
        title: 'Build Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsBuilding(false);
    }
  };

  // Fetch count on mount
  useState(() => { fetchCacheCount(); });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-primary" />
          SEO Static HTML Cache
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Generates static HTML snapshots for all SEO pages. These are served to search engine crawlers (Googlebot, Bingbot, etc.) so they see full content without JavaScript rendering.
        </p>
        
        <div className="flex items-center gap-3">
          <Button onClick={handleBuild} disabled={isBuilding} className="gap-2">
            {isBuilding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building Cache...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" />
                Build SEO Cache
              </>
            )}
          </Button>
          {cachedCount !== null && (
            <Badge variant="secondary">{cachedCount} pages cached</Badge>
          )}
          {lastBuilt && (
            <span className="text-xs text-muted-foreground">Last built: {lastBuilt}</span>
          )}
        </div>

        {result && (
          <div className="flex items-start gap-2 text-sm">
            {result.errors ? (
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            ) : (
              <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
            )}
            <div>
              <p>{result.inserted} / {result.total} pages cached successfully.</p>
              {(result.staleDeleted ?? 0) > 0 && (
                <p className="text-muted-foreground">🧹 {result.staleDeleted} stale entries removed.</p>
              )}
              {result.errors && (
                <ul className="text-destructive mt-1">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
