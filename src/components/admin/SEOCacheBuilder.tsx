import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Globe, CheckCircle, AlertCircle, RefreshCw, RotateCcw, Clock, XCircle } from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';

export interface PageData {
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

export async function collectAllPages(): Promise<PageData[]> {
  const pages: PageData[] = [];

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
      crossLinks: [{ label: 'Companies', slug: 'companies' }],
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
      crossLinks: [{ label: 'Browse Jobs', slug: 'jobs' }, { label: 'Resume Tools', slug: 'tools' }],
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
      crossLinks: [{ label: 'Browse Jobs', slug: 'jobs' }],
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
      crossLinks: [{ label: 'Browse Jobs', slug: 'jobs' }],
    },
    {
      slug: 'aboutus', pageType: 'standalone', title: 'About TrueJobs – India\'s AI Job Portal', h1: 'About TrueJobs',
      metaDescription: 'Learn about TrueJobs, India\'s AI-powered job portal connecting job seekers with verified employers across the country.',
      introContent: '<h2>About TrueJobs</h2><p>TrueJobs is an AI-powered job portal dedicated to connecting Indian job seekers with verified employers.</p>',
      faqItems: [], ...DATE_DEFAULTS, crossLinks: [],
    },
    {
      slug: 'contactus', pageType: 'standalone', title: 'Contact Us – TrueJobs', h1: 'Contact TrueJobs',
      metaDescription: 'Get in touch with TrueJobs. Contact us for support, feedback, or business inquiries.',
      introContent: '<h2>Contact Us</h2><p>We\'d love to hear from you. Reach out for support, feedback, or partnership opportunities.</p>',
      faqItems: [], ...DATE_DEFAULTS, crossLinks: [],
    },
    {
      slug: 'privacypolicy', pageType: 'standalone', title: 'Privacy Policy – TrueJobs', h1: 'Privacy Policy',
      metaDescription: 'Read TrueJobs privacy policy. Learn how we collect, use, and protect your personal information.',
      introContent: '<h2>Privacy Policy</h2><p>Your privacy is important to us. This policy outlines how TrueJobs handles your data.</p>',
      faqItems: [], ...DATE_DEFAULTS, crossLinks: [],
    },
    {
      slug: 'termsofuse', pageType: 'standalone', title: 'Terms of Use – TrueJobs', h1: 'Terms of Use',
      metaDescription: 'Read TrueJobs terms of use. Understand the terms and conditions for using our platform.',
      introContent: '<h2>Terms of Use</h2><p>By using TrueJobs, you agree to the following terms and conditions.</p>',
      faqItems: [], ...DATE_DEFAULTS, crossLinks: [],
    },
    {
      slug: 'disclaimer', pageType: 'standalone', title: 'Disclaimer – TrueJobs', h1: 'Disclaimer',
      metaDescription: 'Read the TrueJobs disclaimer regarding job listings, accuracy, and third-party content.',
      introContent: '<h2>Disclaimer</h2><p>Information on TrueJobs is provided for general informational purposes.</p>',
      faqItems: [], ...DATE_DEFAULTS, crossLinks: [],
    },
    {
      slug: 'editorial-policy', pageType: 'standalone', title: 'Editorial Policy – TrueJobs', h1: 'Editorial Policy',
      metaDescription: 'Read the TrueJobs editorial policy. Learn about our content standards and editorial guidelines.',
      introContent: '<h2>Editorial Policy</h2><p>TrueJobs maintains high editorial standards for all content published on our platform.</p>',
      faqItems: [], ...DATE_DEFAULTS, crossLinks: [],
    },
  ];
  pages.push(...standalonePages);

  const { CITY_JOBS_DATA } = await import('@/pages/seo/cityJobsData');
  for (const c of CITY_JOBS_DATA) {
    pages.push({
      slug: c.slug, pageType: 'city', title: c.metaTitle, h1: c.h1, metaDescription: c.metaDescription,
      introContent: c.introContent, faqItems: c.faqItems, ...DATE_DEFAULTS,
      crossLinks: [
        ...c.nearbyCities.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
        ...c.relatedCategories.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
      ],
    });
  }

  const { CATEGORY_JOBS_DATA } = await import('@/pages/seo/categoryJobsData');
  for (const c of CATEGORY_JOBS_DATA) {
    pages.push({
      slug: c.slug, pageType: 'category', title: c.metaTitle, h1: c.h1, metaDescription: c.metaDescription,
      introContent: c.introContent, faqItems: c.faqItems, ...DATE_DEFAULTS,
      crossLinks: [
        ...c.topCities.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
        ...c.relatedIndustries.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
      ],
    });
  }

  const { INDUSTRY_JOBS_DATA } = await import('@/pages/seo/industryJobsData');
  for (const i of INDUSTRY_JOBS_DATA) {
    pages.push({
      slug: i.slug, pageType: 'industry', title: i.metaTitle, h1: i.h1, metaDescription: i.metaDescription,
      introContent: i.introContent, faqItems: i.faqItems, ...DATE_DEFAULTS,
      crossLinks: [
        ...i.topCities.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
        ...i.relatedCategories.map(s => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), slug: s })),
      ],
    });
  }

  const { getAllExamAuthoritySlugs, getExamAuthorityConfig } = await import('@/data/examAuthority/index');
  for (const slug of getAllExamAuthoritySlugs()) {
    const cfg = getExamAuthorityConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: `authority-${cfg.pageType}`, title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.overview.substring(0, 500),
      faqItems: cfg.faqs, datePublished: cfg.datePublished, lastUpdated: cfg.lastUpdated,
      crossLinks: (cfg.relatedExams || []).map(r => ({ label: r.label, slug: r.href.replace(/^\//, '') })),
    });
  }

  const { getAllHubSlugs, getHubConfig } = await import('@/data/examAuthority/hubs');
  for (const slug of getAllHubSlugs()) {
    const hub = getHubConfig(slug);
    if (!hub) continue;
    pages.push({
      slug: hub.slug, pageType: 'exam-hub', title: hub.metaTitle, h1: hub.h1,
      metaDescription: hub.metaDescription, introContent: hub.intro.substring(0, 500),
      faqItems: hub.faqs, lastUpdated: hub.lastUpdated, datePublished: '2026-01-15',
      crossLinks: hub.subtopicPages.map(s => ({ label: s.label, slug: s.href.replace(/^\//, '') })),
    });
  }

  const { getAllPYPSlugs, getPYPConfig } = await import('@/data/previousYearPapers');
  for (const slug of getAllPYPSlugs()) {
    const pyp = getPYPConfig(slug);
    if (!pyp) continue;
    pages.push({
      slug: pyp.slug, pageType: 'previous-year-paper', title: pyp.metaTitle, h1: pyp.h1,
      metaDescription: pyp.metaDescription, introContent: pyp.overview.substring(0, 500),
      faqItems: pyp.faqs, lastUpdated: pyp.lastUpdated, datePublished: '2026-01-15',
      crossLinks: pyp.relatedExams.map(r => ({ label: r.label, slug: r.href.replace(/^\//, '') })),
    });
  }

  const { getAllStateGovtSlugs, getStateGovtJobConfig } = await import('@/pages/seo/stateGovtJobsData');
  for (const slug of getAllStateGovtSlugs()) {
    const cfg = getStateGovtJobConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: 'state-govt', title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems, ...DATE_DEFAULTS, crossLinks: [],
    });
  }

  const { getAllDepartmentSlugs, getDepartmentJobConfig } = await import('@/pages/seo/departmentJobsData');
  for (const slug of getAllDepartmentSlugs()) {
    const cfg = getDepartmentJobConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: 'department', title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems, ...DATE_DEFAULTS, crossLinks: [],
    });
  }

  const { getAllQualificationSlugs, getQualificationJobConfig } = await import('@/pages/seo/qualificationJobsData');
  for (const slug of getAllQualificationSlugs()) {
    const cfg = getQualificationJobConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: 'qualification', title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems, ...DATE_DEFAULTS, crossLinks: [],
    });
  }

  const { getAllCustomLongTailSlugs, getCustomLongTailConfig } = await import('@/pages/seo/customLongTailData');
  for (const slug of getAllCustomLongTailSlugs()) {
    const cfg = getCustomLongTailConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: `custom-${cfg.subtype}`, title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems,
      datePublished: cfg.datePublished || DATE_DEFAULTS.datePublished,
      lastUpdated: cfg.lastUpdated || DATE_DEFAULTS.lastUpdated,
      crossLinks: cfg.quickLinks.map(l => ({ label: l.label, slug: l.href.replace(/^\//, '') })),
    });
  }

  const { getAllComboSlugs, getComboPageConfig } = await import('@/pages/seo/govtComboData');
  for (const slug of getAllComboSlugs()) {
    const cfg = getComboPageConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: `combo-${cfg.comboType}`, title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems, ...DATE_DEFAULTS,
      crossLinks: cfg.crossLinks.map(l => ({ label: l.label, slug: l.href.replace(/^\//, '') })),
    });
  }

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
      slug: cfg.slug, pageType: 'selection-state', title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: cfg.introContent.substring(0, 500),
      faqItems: cfg.faqItems, ...DATE_DEFAULTS, crossLinks: [],
    });
  }

  const { getAllDeadlineSlugs, getDeadlinePageConfig } = await import('@/pages/seo/DeadlineJobsPage');
  for (const slug of getAllDeadlineSlugs()) {
    const cfg = getDeadlinePageConfig(slug);
    if (!cfg) continue;
    pages.push({
      slug: cfg.slug, pageType: `deadline-${cfg.deadlineType}`, title: cfg.metaTitle, h1: cfg.h1,
      metaDescription: cfg.metaDescription, introContent: `<p>${cfg.metaDescription}</p>`,
      faqItems: cfg.faqItems, ...DATE_DEFAULTS,
      crossLinks: [
        { label: 'Last Date Today', slug: 'govt-jobs-last-date-today' },
        { label: 'This Week', slug: 'govt-jobs-last-date-this-week' },
        { label: 'All Sarkari Jobs', slug: 'all-sarkari-jobs' },
      ],
    });
  }

  pages.push({
    slug: 'all-sarkari-jobs', pageType: 'discovery-hub',
    title: 'All Sarkari Jobs A-Z Index — Complete Government Job Directory',
    h1: 'All Sarkari Jobs — A to Z Directory',
    metaDescription: 'Complete A-Z index of all government job notifications in India. Browse SSC, Railway, Banking, UPSC, Defence & State govt exams.',
    introContent: '<h2>Complete Government Job Directory</h2><p>Browse the complete alphabetical index of all government exam notifications in India.</p>',
    faqItems: [], ...DATE_DEFAULTS,
    crossLinks: [
      { label: 'SSC Jobs', slug: 'ssc-jobs' },
      { label: 'Railway Jobs', slug: 'railway-jobs' },
      { label: 'Banking Jobs', slug: 'banking-jobs' },
      { label: 'Last Date Today', slug: 'govt-jobs-last-date-today' },
    ],
  });

  // Hub pages that were previously missing from cache generation
  pages.push({
    slug: 'sarkari-jobs', pageType: 'standalone',
    title: 'Sarkari Jobs 2026 – Latest Government Job Notifications India',
    h1: 'Sarkari Jobs 2026 – Latest Government Job Notifications',
    metaDescription: 'Find latest Sarkari Jobs 2026. Browse all government job notifications, exam dates, eligibility, and apply online at TrueJobs.',
    introContent: '<h2>Latest Sarkari Naukri Notifications</h2><p>Browse the latest government job notifications from central and state governments across India.</p>',
    faqItems: [
      { question: 'What are Sarkari Jobs?', answer: 'Sarkari Jobs are government jobs in India offered by central, state, and local government bodies through competitive exams and recruitment drives.' },
    ],
    ...DATE_DEFAULTS,
    crossLinks: [
      { label: 'All Sarkari Jobs', slug: 'all-sarkari-jobs' },
      { label: 'Latest Govt Jobs', slug: 'latest-govt-jobs' },
    ],
  });

  pages.push({
    slug: 'latest-govt-jobs', pageType: 'standalone',
    title: 'Latest Govt Jobs 2026 – New Government Job Openings Today',
    h1: 'Latest Govt Jobs 2026',
    metaDescription: 'Latest government job openings 2026. Find new Sarkari Naukri notifications, upcoming exams, and apply online at TrueJobs.',
    introContent: '<h2>New Government Job Openings</h2><p>Stay updated with the latest government job notifications published today.</p>',
    faqItems: [], ...DATE_DEFAULTS,
    crossLinks: [
      { label: 'Sarkari Jobs', slug: 'sarkari-jobs' },
      { label: 'All Sarkari Jobs', slug: 'all-sarkari-jobs' },
    ],
  });

  pages.push({
    slug: 'private-jobs', pageType: 'standalone',
    title: 'Private Jobs in India 2026 – Latest Private Sector Openings',
    h1: 'Private Jobs in India 2026',
    metaDescription: 'Find latest private sector job openings in India 2026. Browse IT, banking, healthcare, and more private jobs on TrueJobs.',
    introContent: '<h2>Private Sector Job Openings</h2><p>Explore the latest private sector job opportunities across India from top companies.</p>',
    faqItems: [], ...DATE_DEFAULTS,
    crossLinks: [
      { label: 'Browse All Jobs', slug: 'jobs' },
      { label: 'Companies', slug: 'companies' },
    ],
  });

  pages.push({
    slug: 'jobs/employment-news', pageType: 'standalone',
    title: 'Employment News – Latest Government Recruitment Notices India',
    h1: 'Employment News – Government Recruitment Notices',
    metaDescription: 'Browse latest Employment News government recruitment notices. Find official vacancies from Employment News weekly publication on TrueJobs.',
    introContent: '<h2>Official Employment News Notices</h2><p>Browse government recruitment notices published in Employment News, India\'s premier recruitment publication.</p>',
    faqItems: [
      { question: 'What is Employment News?', answer: 'Employment News is an official weekly publication by the Government of India that carries advertisements for government job vacancies across central and state departments.' },
    ],
    ...DATE_DEFAULTS,
    crossLinks: [
      { label: 'Sarkari Jobs', slug: 'sarkari-jobs' },
      { label: 'Latest Govt Jobs', slug: 'latest-govt-jobs' },
    ],
  });

  return pages;
}

export function SEOCacheBuilder() {
  const { toast } = useToast();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildSlugInput, setRebuildSlugInput] = useState('');
  const [result, setResult] = useState<{ total: number; inserted: number; errors?: string[]; staleDeleted?: number } | null>(null);
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  const [lastBuilt, setLastBuilt] = useState<string | null>(() => localStorage.getItem('seo_cache_last_built'));
  const [pendingCount, setPendingCount] = useState(0);
  const [rebuildLogs, setRebuildLogs] = useState<any[]>([]);
  const [failedItems, setFailedItems] = useState<any[]>([]);

  const fetchCacheCount = async () => {
    const { count } = await supabase
      .from('seo_page_cache')
      .select('*', { count: 'exact', head: true });
    setCachedCount(count ?? 0);
  };

  const fetchQueueStatus = async () => {
    const { count } = await supabase
      .from('seo_rebuild_queue' as any)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count ?? 0);

    const { data: failed } = await supabase
      .from('seo_rebuild_queue' as any)
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(20);
    setFailedItems(failed || []);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('seo_rebuild_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setRebuildLogs(data || []);
  };

  useEffect(() => {
    fetchCacheCount();
    fetchQueueStatus();
    fetchLogs();
  }, []);

  const handleBuild = async () => {
    setIsBuilding(true);
    setResult(null);
    try {
      const pages = await collectAllPages();
      let totalInserted = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < pages.length; i += 30) {
        const batch = pages.slice(i, i + 30);
        const { data, error } = await supabase.functions.invoke('build-seo-cache', {
          body: { pages: batch },
        });
        if (error) allErrors.push(`Batch ${i}: ${error.message}`);
        else if (data) {
          totalInserted += data.inserted || 0;
          if (data.errors) allErrors.push(...data.errors);
        }
      }

      let staleDeleted = 0;
      const allSlugs = pages.map(p => p.slug);
      const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('build-seo-cache', {
        body: { cleanup: true, allSlugs },
      });
      if (cleanupError) allErrors.push(`Cleanup: ${cleanupError.message}`);
      else if (cleanupData) staleDeleted = cleanupData.staleDeleted || 0;

      setResult({ total: pages.length, inserted: totalInserted, errors: allErrors.length > 0 ? allErrors : undefined, staleDeleted });
      const builtAt = new Date().toLocaleString();
      localStorage.setItem('seo_cache_last_built', builtAt);
      setLastBuilt(builtAt);
      toast({ title: 'SEO Cache Built', description: `${totalInserted} of ${pages.length} pages cached.` });
      fetchCacheCount();
    } catch (err: any) {
      toast({ title: 'Build Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsBuilding(false);
    }
  };

  const handleRebuildAll = async () => {
    setIsRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-cache-rebuild', {
        body: { mode: 'full', trigger: 'admin-ui' },
      });
      if (error) throw error;
      toast({
        title: 'Full Rebuild Complete',
        description: `Rebuilt: ${data?.rebuilt ?? 0}, Skipped: ${data?.skipped ?? 0}, Failed: ${data?.failed ?? 0}`,
      });
      fetchCacheCount();
      fetchLogs();
      fetchQueueStatus();
    } catch (err: any) {
      toast({ title: 'Rebuild Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleRebuildSlug = async () => {
    if (!rebuildSlugInput.trim()) return;
    setIsRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-cache-rebuild', {
        body: { mode: 'slugs', slugs: [rebuildSlugInput.trim()], trigger: 'admin-ui' },
      });
      if (error) throw error;
      toast({
        title: 'Slug Rebuild Complete',
        description: `Rebuilt: ${data?.rebuilt ?? 0}, Skipped: ${data?.skipped ?? 0}`,
      });
      setRebuildSlugInput('');
      fetchLogs();
    } catch (err: any) {
      toast({ title: 'Rebuild Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleRetryFailed = async (id: string) => {
    await supabase
      .from('seo_rebuild_queue' as any)
      .update({ status: 'pending', retry_count: 0, error_message: null } as any)
      .eq('id', id);
    toast({ title: 'Retrying', description: 'Item re-queued for rebuild.' });
    fetchQueueStatus();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-primary" />
          SEO Static HTML Cache
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Generates static HTML fragments for all public SEO pages. DB triggers auto-queue changes for rebuild every 5 minutes.
        </p>
        
        {/* Build & Status Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleBuild} disabled={isBuilding || isRebuilding} className="gap-2">
            {isBuilding ? <><Loader2 className="h-4 w-4 animate-spin" /> Building...</> : <><Globe className="h-4 w-4" /> Build SEO Cache</>}
          </Button>
          <Button onClick={handleRebuildAll} disabled={isBuilding || isRebuilding} variant="secondary" className="gap-2">
            {isRebuilding ? <><Loader2 className="h-4 w-4 animate-spin" /> Rebuilding...</> : <><RefreshCw className="h-4 w-4" /> Rebuild All</>}
          </Button>
          {cachedCount !== null && <Badge variant="secondary">{cachedCount} pages cached</Badge>}
          {pendingCount > 0 && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{pendingCount} pending</Badge>}
          {lastBuilt && <span className="text-xs text-muted-foreground">Last built: {lastBuilt}</span>}
        </div>

        {/* Rebuild Slug */}
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="Enter slug to rebuild (e.g. ssc-cgl)"
            value={rebuildSlugInput}
            onChange={(e) => setRebuildSlugInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRebuildSlug()}
          />
          <Button onClick={handleRebuildSlug} disabled={isRebuilding || !rebuildSlugInput.trim()} variant="outline" size="sm" className="gap-1 whitespace-nowrap">
            <RotateCcw className="h-3 w-3" /> Rebuild
          </Button>
        </div>

        {/* Build Result */}
        {result && (
          <div className="flex items-start gap-2 text-sm">
            {result.errors ? <AlertCircle className="h-4 w-4 text-destructive mt-0.5" /> : <CheckCircle className="h-4 w-4 text-primary mt-0.5" />}
            <div>
              <p>{result.inserted} / {result.total} pages cached successfully.</p>
              {(result.staleDeleted ?? 0) > 0 && <p className="text-muted-foreground">🧹 {result.staleDeleted} stale entries removed.</p>}
              {result.errors && <ul className="text-destructive mt-1">{result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>}
            </div>
          </div>
        )}

        {/* Failed Items */}
        {failedItems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1"><XCircle className="h-4 w-4" /> Failed Queue Items ({failedItems.length})</h3>
            <div className="rounded-md border overflow-auto max-h-48">
              <Table>
                <TableHeader><TableRow><TableHead>Slug</TableHead><TableHead>Reason</TableHead><TableHead>Error</TableHead><TableHead>Retries</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {failedItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.slug}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{item.reason}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">{item.error_message || '—'}</TableCell>
                      <TableCell className="text-xs">{item.retry_count}/{item.max_retries}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => handleRetryFailed(item.id)} className="h-7 text-xs">Retry</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Rebuild Log */}
        {rebuildLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Recent Rebuild Log</h3>
            <div className="rounded-md border overflow-auto max-h-56">
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Rebuilt</TableHead><TableHead>Skipped</TableHead><TableHead>Failed</TableHead><TableHead>CF Purged</TableHead><TableHead>Duration</TableHead><TableHead>Source</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rebuildLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{log.rebuild_type}</Badge></TableCell>
                      <TableCell className="text-xs">{log.slugs_rebuilt}</TableCell>
                      <TableCell className="text-xs">{log.slugs_skipped}</TableCell>
                      <TableCell className="text-xs">{log.slugs_failed > 0 ? <span className="text-destructive">{log.slugs_failed}</span> : '0'}</TableCell>
                      <TableCell className="text-xs">{log.cf_purged}</TableCell>
                      <TableCell className="text-xs">{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}</TableCell>
                      <TableCell className="text-xs">{log.trigger_source || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
