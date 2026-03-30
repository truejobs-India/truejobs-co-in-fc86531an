import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Globe } from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

import { INSURANCE_CITIES, INSURANCE_STATES } from '@/pages/jobs/cityData';
import { NEAR_ME_PAGES } from '@/pages/jobs/nearMeData';
import { CITY_JOBS_DATA } from '@/pages/seo/cityJobsData';
import { CATEGORY_JOBS_DATA } from '@/pages/seo/categoryJobsData';
import { INDUSTRY_JOBS_DATA } from '@/pages/seo/industryJobsData';

const SITE = 'https://truejobs.co.in';

type Row = [string, string, string, string, string, string, string];
const HEADERS: Row = ['URL', 'Page Type', 'Category', 'Index Status', 'Sitemap Child', 'Priority', 'Notes'];

function r(url: string, pageType: string, cat: string, idx: string, sitemap: string, pri: string, notes = ''): Row {
  return [url, pageType, cat, idx, sitemap, pri, notes];
}

function buildStaticRows(): Row[] {
  const rows: Row[] = [];
  const s = (path: string, type: string, sitemap = 'sitemap-pages.xml', pri = 'High', notes = '') =>
    rows.push(r(`${SITE}${path}`, type, 'Static', 'index, follow', sitemap, pri, notes));

  s('/', 'Homepage', 'sitemap-pages.xml', 'High', 'Main entry point');
  s('/jobs', 'Job Hub', 'sitemap-pages.xml', 'High');
  s('/private-jobs', 'Private Jobs Hub', 'sitemap-pages.xml', 'High');
  s('/sarkari-jobs', 'Sarkari Jobs Hub', 'sitemap-pages.xml', 'High');
  s('/latest-govt-jobs', 'Latest Govt Jobs', 'sitemap-pages.xml', 'High');
  s('/all-sarkari-jobs', 'All Sarkari Jobs', 'sitemap-seo.xml', 'High');
  s('/jobs/employment-news', 'Emp News Hub', 'sitemap-pages.xml', 'High');
  s('/blog', 'Blog Index', 'sitemap-pages.xml', 'High');
  s('/companies', 'Companies Index', 'sitemap-pages.xml', 'Medium');
  s('/tools', 'Tools Hub', 'sitemap-pages.xml', 'Medium');
  s('/sample-papers', 'Sample Papers Hub', 'sitemap-pages.xml', 'Medium');
  s('/books', 'Books Hub', 'sitemap-pages.xml', 'Medium');
  s('/previous-year-papers', 'PYP Hub', 'sitemap-pages.xml', 'Medium');
  s('/guides', 'Guides Hub', 'sitemap-pages.xml', 'Medium');
  s('/free-guides', 'Free Guides Hub', 'sitemap-pages.xml', 'Medium');

  // Legal
  for (const p of ['/privacypolicy', '/termsofuse', '/aboutus', '/contactus', '/disclaimer', '/editorial-policy']) {
    s(p, 'Legal', 'sitemap-pages.xml', 'Low');
  }

  // Tools
  for (const p of [
    '/govt-job-age-calculator', '/percentage-calculator', '/govt-salary-calculator',
    '/photo-resizer', '/image-resizer', '/pdf-tools',
    '/typing-test-for-government-exams', '/govt-exam-eligibility-checker',
    '/govt-exam-fee-calculator', '/govt-exam-calendar',
  ]) {
    s(p, 'Tool', 'sitemap-pages.xml', 'Medium');
  }

  // Campaign
  s('/enrol-now', 'Campaign', 'sitemap-pages.xml', 'Low');
  s('/thankyou', 'Campaign', 'sitemap-pages.xml', 'Low');

  return rows;
}

async function buildSEORows(): Promise<Row[]> {
  const rows: Row[] = [];
  const add = (slug: string, type: string, pri = 'High', notes = '') =>
    rows.push(r(`${SITE}/${slug}`, type, 'SEO', 'index, follow', 'sitemap-seo.xml', pri, notes));

  // City pages
  for (const c of CITY_JOBS_DATA) add(c.slug, 'SEO City');
  // Category pages
  for (const c of CATEGORY_JOBS_DATA) add(c.slug, 'SEO Category');
  // Industry pages
  for (const i of INDUSTRY_JOBS_DATA) add(i.slug, 'SEO Industry', 'Medium');
  // Near Me pages
  for (const p of NEAR_ME_PAGES) add(p.slug, 'Near Me');
  // Insurance states
  for (const s of INSURANCE_STATES) rows.push(r(`${SITE}${s.path}`, 'Insurance State', 'SEO', 'index, follow', 'sitemap-seo.xml', 'High', ''));
  // Insurance cities
  for (const c of INSURANCE_CITIES) add(c.slug, 'Insurance City', 'Medium');

  // Lazy-load all slug generators
  const [
    { getAllStateGovtSlugs },
    { getAllDepartmentSlugs },
    { getAllQualificationSlugs },
    { getAllDeadlineSlugs },
    { getAllTodaySlugs },
    { getAllComboSlugs },
    { getAllCustomLongTailSlugs },
    { getAllSelectionSlugs },
    { getAllExamAuthoritySlugs },
    { getAllHubSlugs },
    { getAllPYPSlugs },
  ] = await Promise.all([
    import('@/pages/seo/stateGovtJobsData'),
    import('@/pages/seo/departmentJobsData'),
    import('@/pages/seo/qualificationJobsData'),
    import('@/pages/seo/DeadlineJobsPage'),
    import('@/pages/seo/TodayJobsPage'),
    import('@/pages/seo/govtComboData'),
    import('@/pages/seo/customLongTailData'),
    import('@/pages/seo/selectionPageData'),
    import('@/data/examAuthority/index'),
    import('@/data/examAuthority/hubs'),
    import('@/data/previousYearPapers'),
  ]);

  for (const s of getAllStateGovtSlugs()) add(s, 'State Govt');
  for (const s of getAllDepartmentSlugs()) add(s, 'Department');
  for (const s of getAllQualificationSlugs()) add(s, 'Qualification');
  for (const s of getAllDeadlineSlugs()) add(s, 'Deadline', 'Medium', 'Time-sensitive');
  for (const s of getAllTodaySlugs()) add(s, 'Today', 'Medium', 'Time-sensitive');
  for (const s of getAllComboSlugs()) add(s, 'Combo');
  for (const s of getAllCustomLongTailSlugs()) add(s, 'Long-tail');
  for (const s of getAllSelectionSlugs()) add(s, 'Selection');
  for (const s of getAllExamAuthoritySlugs()) add(s, 'Exam Authority');
  for (const s of getAllHubSlugs()) add(s, 'Hub');
  for (const s of getAllPYPSlugs()) add(s, 'Previous Year Paper');

  return rows;
}

async function buildDBRows(): Promise<Row[]> {
  const rows: Row[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (table: string, cols: string, filter?: [string, unknown]) =>
    filter
      ? (supabase.from(table as any).select(cols) as any).eq(filter[0], filter[1])
      : supabase.from(table as any).select(cols);

  const [blogs, jobs, companies, exams, empNews, custom, resources] = await Promise.all([
    q('blog_posts', 'slug', ['is_published', true]),
    q('jobs', 'id', ['status', 'active']),
    q('companies', 'slug', ['is_approved', true]),
    q('govt_exams', 'slug', ['is_published', true]),
    q('employment_news_jobs', 'slug', ['status', 'published']),
    q('custom_pages', 'slug, page_type', ['is_published', true]),
    q('pdf_resources', 'slug, resource_type', ['is_published', true]),
  ]);

  for (const b of (blogs.data || []) as { slug: string }[]) rows.push(r(`${SITE}/blog/${b.slug}`, 'Blog', 'Dynamic', 'index, follow', 'sitemap-blog.xml', 'High', ''));
  for (const j of (jobs.data || []) as { id: string }[]) rows.push(r(`${SITE}/jobs/${j.id}`, 'Job Listing', 'Dynamic', 'index, follow', 'sitemap-jobs.xml', 'High', ''));
  for (const c of (companies.data || []) as { slug: string }[]) rows.push(r(`${SITE}/companies/${c.slug}`, 'Company', 'Dynamic', 'index, follow', 'sitemap-pages.xml', 'Medium', ''));
  for (const e of (exams.data || []) as { slug: string }[]) rows.push(r(`${SITE}/sarkari-jobs/${e.slug}`, 'Govt Exam', 'Dynamic', 'index, follow', 'sitemap-jobs.xml', 'High', ''));
  for (const e of (empNews.data || []) as { slug: string | null }[]) {
    if (e.slug) rows.push(r(`${SITE}/jobs/employment-news/${e.slug}`, 'Employment News', 'Dynamic', 'index, follow', 'sitemap-jobs.xml', 'Medium', ''));
  }
  for (const p of (custom.data || []) as { slug: string; page_type: string | null }[]) rows.push(r(`${SITE}/${p.slug}`, `Custom (${p.page_type || 'page'})`, 'Dynamic', 'index, follow', 'sitemap-pages.xml', 'Medium', ''));
  for (const res of (resources.data || []) as { slug: string; resource_type: string }[]) {
    const prefix = res.resource_type === 'book' ? 'books' : res.resource_type === 'guide' ? 'guides' : res.resource_type === 'previous-year-paper' ? 'previous-year-papers' : 'sample-papers';
    rows.push(r(`${SITE}/${prefix}/${res.slug}`, `Resource (${res.resource_type})`, 'Dynamic', 'index, follow', 'sitemap-resources.xml', 'Medium', ''));
  }

  return rows;
}

function buildExcludedRows(): Row[] {
  const excluded = [
    '/admin', '/dashboard', '/login', '/signup', '/phone-signup', '/forgot-password',
    '/profile', '/employer', '/employer/dashboard', '/employer/post-job',
    '/offline', '/tools/resume-checker', '/tools/resume-builder',
  ];
  return excluded.map(p => r(`${SITE}${p}`, 'Excluded', 'Excluded', 'noindex, nofollow', 'None', 'N/A', 'Auth/internal only'));
}

function buildSitemapRows(): Row[] {
  return [
    r(`${SITE}/sitemap.xml`, 'Sitemap Index', 'Sitemap', 'N/A', 'N/A', 'High', 'Submit this to GSC'),
    r(`${SITE}/sitemap-pages.xml`, 'Sitemap Child', 'Sitemap', 'N/A', 'N/A', 'High', ''),
    r(`${SITE}/sitemap-jobs.xml`, 'Sitemap Child', 'Sitemap', 'N/A', 'N/A', 'High', ''),
    r(`${SITE}/sitemap-blog.xml`, 'Sitemap Child', 'Sitemap', 'N/A', 'N/A', 'High', ''),
    r(`${SITE}/sitemap-seo.xml`, 'Sitemap Child', 'Sitemap', 'N/A', 'N/A', 'High', ''),
    r(`${SITE}/sitemap-resources.xml`, 'Sitemap Child', 'Sitemap', 'N/A', 'N/A', 'Medium', ''),
  ];
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Row[]) {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = [{ wch: 70 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function GSCAllUrlsExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const [staticRows, seoRows, dbRows] = await Promise.all([
        Promise.resolve(buildStaticRows()),
        buildSEORows(),
        buildDBRows(),
      ]);
      const excludedRows = buildExcludedRows();
      const sitemapRows = buildSitemapRows();

      // Dedup by URL
      const seen = new Set<string>();
      const dedup = (rows: Row[]): Row[] => rows.filter(row => {
        if (seen.has(row[0])) return false;
        seen.add(row[0]);
        return true;
      });

      const s1 = dedup(staticRows);
      const s2 = dedup(seoRows);
      const s3 = dedup(dbRows);
      const total = s1.length + s2.length + s3.length;

      const wb = XLSX.utils.book_new();
      addSheet(wb, 'Static & Core', s1);
      addSheet(wb, 'Programmatic SEO', s2);
      addSheet(wb, 'Database-Driven', s3);
      addSheet(wb, 'Excluded', excludedRows);
      addSheet(wb, 'Sitemaps', sitemapRows);

      XLSX.writeFile(wb, 'TrueJobs_All_Site_URLs.xlsx');

      toast({
        title: 'Export Complete',
        description: `Downloaded ${total} indexable URLs + ${excludedRows.length} excluded + ${sitemapRows.length} sitemaps across 5 sheets.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Could not generate the Excel file. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting} variant="outline" className="gap-2">
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Globe className="h-4 w-4" /><Download className="h-4 w-4" /></>}
      {isExporting ? 'Exporting All URLs…' : 'Export All Site URLs (.xlsx)'}
    </Button>
  );
}
