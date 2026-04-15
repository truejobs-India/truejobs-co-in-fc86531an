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

// --- Pagination helper: fetches all rows beyond the 1000-row Supabase default ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T>(table: string, cols: string, filter?: [string, unknown]): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase.from(table as any).select(cols) as any;
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data } = await query.range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
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

  for (const p of ['/privacypolicy', '/termsofuse', '/aboutus', '/contactus', '/disclaimer', '/editorial-policy']) {
    s(p, 'Legal', 'sitemap-pages.xml', 'Low');
  }

  for (const p of [
    '/govt-job-age-calculator', '/percentage-calculator', '/govt-salary-calculator',
    '/photo-resizer', '/image-resizer', '/pdf-tools',
    '/typing-test-for-government-exams', '/govt-exam-eligibility-checker',
    '/govt-exam-fee-calculator', '/govt-exam-calendar',
  ]) {
    s(p, 'Tool', 'sitemap-pages.xml', 'Medium');
  }

  s('/enrol-now', 'Campaign', 'sitemap-pages.xml', 'Low');
  s('/thankyou', 'Campaign', 'sitemap-pages.xml', 'Low');

  return rows;
}

async function buildSEORows(): Promise<Row[]> {
  const rows: Row[] = [];
  const add = (slug: string, type: string, pri = 'High', notes = '') =>
    rows.push(r(`${SITE}/${slug}`, type, 'SEO', 'index, follow', 'sitemap-seo.xml', pri, notes));

  for (const c of CITY_JOBS_DATA) add(c.slug, 'SEO City');
  for (const c of CATEGORY_JOBS_DATA) add(c.slug, 'SEO Category');
  for (const i of INDUSTRY_JOBS_DATA) add(i.slug, 'SEO Industry', 'Medium');
  for (const p of NEAR_ME_PAGES) add(p.slug, 'Near Me');
  for (const s of INSURANCE_STATES) rows.push(r(`${SITE}${s.path}`, 'Insurance State', 'SEO', 'index, follow', 'sitemap-seo.xml', 'High', ''));
  for (const c of INSURANCE_CITIES) add(c.slug, 'Insurance City', 'Medium');

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

interface DBCounts {
  blogs: number;
  jobs: number;
  companies: number;
  exams: number;
  empNews: number;
  customPages: number;
  resources: number;
}

async function buildDBRows(): Promise<{ rows: Row[]; counts: DBCounts }> {
  const rows: Row[] = [];
  const counts: DBCounts = { blogs: 0, jobs: 0, companies: 0, exams: 0, empNews: 0, customPages: 0, resources: 0 };

  // Paginated fetches for tables that can exceed 1000 rows
  const [blogs, empNews, custom, exams] = await Promise.all([
    fetchAllRows<{ slug: string }>('blog_posts', 'slug', ['is_published', true]),
    fetchAllRows<{ slug: string | null }>('employment_news_jobs', 'slug', ['status', 'published']),
    fetchAllRows<{ slug: string; page_type: string | null }>('custom_pages', 'slug, page_type', ['is_published', true]),
    fetchAllRows<{ slug: string }>('govt_exams', 'slug'), // No is_published column — all rows are public pages
  ]);

  // Standard queries for smaller tables (well under 1000 rows)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobsRes, companiesRes, resourcesRes] = await Promise.all([
    (supabase.from('jobs' as any).select('slug') as any).eq('status', 'active'),
    (supabase.from('companies' as any).select('slug') as any).eq('is_approved', true),
    (supabase.from('pdf_resources' as any).select('slug, resource_type') as any).eq('is_published', true),
  ]);

  const jobsData = (jobsRes.data || []) as { slug: string }[];
  for (const j of jobsData) {
    if (j.slug) {
      rows.push(r(`${SITE}/jobs/${j.slug}`, 'Job Listing', 'Dynamic', 'index, follow', 'sitemap-jobs.xml', 'High', ''));
    }
  }
  counts.jobs = jobsData.filter(j => j.slug).length;

  const companiesData = (companiesRes.data || []) as { slug: string }[];
  for (const c of companiesData) {
    rows.push(r(`${SITE}/companies/${c.slug}`, 'Company', 'Dynamic', 'index, follow', 'sitemap-pages.xml', 'Medium', ''));
  }
  counts.companies = companiesData.length;

  for (const e of exams) {
    rows.push(r(`${SITE}/sarkari-jobs/${e.slug}`, 'Govt Exam', 'Dynamic', 'index, follow', 'sitemap-jobs.xml', 'High', ''));
  }
  counts.exams = exams.length;

  for (const e of empNews) {
    if (e.slug) {
      rows.push(r(`${SITE}/jobs/employment-news/${e.slug}`, 'Employment News', 'Dynamic', 'index, follow', 'sitemap-jobs.xml', 'Medium', ''));
    }
  }
  counts.empNews = empNews.filter(e => e.slug).length;

  for (const p of custom) {
    rows.push(r(`${SITE}/${p.slug}`, `Custom (${p.page_type || 'page'})`, 'Dynamic', 'index, follow', 'sitemap-pages.xml', 'Medium', ''));
  }
  counts.customPages = custom.length;

  const resourcesData = (resourcesRes.data || []) as { slug: string; resource_type: string }[];
  for (const res of resourcesData) {
    const prefix = res.resource_type === 'book' ? 'books' : res.resource_type === 'guide' ? 'guides' : res.resource_type === 'previous-year-paper' ? 'previous-year-papers' : 'sample-papers';
    rows.push(r(`${SITE}/${prefix}/${res.slug}`, `Resource (${res.resource_type})`, 'Dynamic', 'index, follow', 'sitemap-resources.xml', 'Medium', ''));
  }
  counts.resources = resourcesData.length;

  return { rows, counts };
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
      const [staticRows, seoRows, dbResult] = await Promise.all([
        Promise.resolve(buildStaticRows()),
        buildSEORows(),
        buildDBRows(),
      ]);
      const dbRows = dbResult.rows;
      const excludedRows = buildExcludedRows();
      const sitemapRows = buildSitemapRows();

      // Dedup by URL — applies to static + SEO + DB sheets only (not excluded/sitemaps)
      const seen = new Set<string>();
      let dupCount = 0;
      const dupExamples: string[] = [];
      const dedup = (rows: Row[]): Row[] => rows.filter(row => {
        if (seen.has(row[0])) {
          dupCount++;
          if (dupExamples.length < 20) dupExamples.push(row[0]);
          return false;
        }
        seen.add(row[0]);
        return true;
      });

      const s1 = dedup(staticRows);
      const s2 = dedup(seoRows);
      const s3 = dedup(dbRows);

      // Final counts from post-dedup arrays (what is actually written)
      const totalIndexable = s1.length + s2.length + s3.length;
      const totalWorkbook = totalIndexable + excludedRows.length + sitemapRows.length;

      // Per-type counts from final written s3 data
      const blogCount = s3.filter(row => row[1] === 'Blog').length;
      const empNewsCount = s3.filter(row => row[1] === 'Employment News').length;
      const companyCount = s3.filter(row => row[1] === 'Company').length;
      const customCount = s3.filter(row => row[1].startsWith('Custom')).length;
      const resourceCount = s3.filter(row => row[1].startsWith('Resource')).length;
      const jobCount = s3.filter(row => row[1] === 'Job Listing').length;
      const examCount = s3.filter(row => row[1] === 'Govt Exam').length;

      // Build Export Summary sheet data
      const summaryData: (string | number)[][] = [
        ['Metric', 'Value'],
        ['Generated At', new Date().toLocaleString()],
        ['', ''],
        ['Total Workbook URLs Exported', totalWorkbook],
        ['Total Indexable URLs', totalIndexable],
        ['', ''],
        ['Static Pages', s1.length],
        ['Programmatic SEO', s2.length],
        ['Database-Driven (total)', s3.length],
        ['  - Blog', blogCount],
        ['  - Employment News', empNewsCount],
        ['  - Companies', companyCount],
        ['  - Custom Pages', customCount],
        ['  - PDF Resources', resourceCount],
        ['  - Jobs', jobCount],
        ['  - Govt Exams', examCount],
        ['', ''],
        ['Excluded Routes', excludedRows.length],
        ['Sitemap URLs', sitemapRows.length],
        ['', ''],
        ['Duplicates Removed (from indexable sheets)', dupCount],
      ];

      if (dupExamples.length > 0) {
        summaryData.push(['', '']);
        summaryData.push(['First Duplicate URLs Found:', '']);
        for (const url of dupExamples) {
          summaryData.push(['', url]);
        }
      }

      // Build workbook — Summary first
      const wb = XLSX.utils.book_new();

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 40 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Export Summary');

      addSheet(wb, 'Static & Core', s1);
      addSheet(wb, 'Programmatic SEO', s2);
      addSheet(wb, 'Database-Driven', s3);
      addSheet(wb, 'Excluded', excludedRows);
      addSheet(wb, 'Sitemaps', sitemapRows);

      XLSX.writeFile(wb, 'TrueJobs_All_Site_URLs.xlsx');

      toast({
        title: 'Export Complete ✓',
        description: `${totalWorkbook} URLs exported (${s1.length} static, ${s2.length} SEO, ${s3.length} DB). ${dupCount} duplicates removed. File generated successfully.`,
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
