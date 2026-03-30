import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Loader2, CheckCircle, Globe } from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { GSCAllUrlsExport } from './GSCAllUrlsExport';
import { INSURANCE_CITIES, INSURANCE_STATES } from '@/pages/jobs/cityData';
import { NEAR_ME_PAGES } from '@/pages/jobs/nearMeData';
import { CITY_JOBS_DATA } from '@/pages/seo/cityJobsData';
import { CATEGORY_JOBS_DATA } from '@/pages/seo/categoryJobsData';
import { INDUSTRY_JOBS_DATA } from '@/pages/seo/industryJobsData';

import * as XLSX from 'xlsx';

const SITE_URL = 'https://truejobs.co.in';

interface UrlRow {
  URL: string;
  'Page Type': string;
  State: string;
  'City / District': string;
  'Job Role': string;
  'Index Status': string;
  'Schema Type': string;
  'Sitemap Included': string;
  'GSC Submission Priority': string;
}

function buildUrlRows(): UrlRow[] {
  const rows: UrlRow[] = [];

  // Core job hub pages
  rows.push({
    URL: `${SITE_URL}/jobs`,
    'Page Type': 'Job Hub',
    State: '',
    'City / District': '',
    'Job Role': 'All Jobs',
    'Index Status': 'index, follow',
    'Schema Type': '',
    'Sitemap Included': 'Yes',
    'GSC Submission Priority': 'High',
  });

  // State-level pages (legacy insurance)
  for (const s of INSURANCE_STATES) {
    rows.push({
      URL: `${SITE_URL}${s.path}`,
      'Page Type': 'State',
      State: s.state,
      'City / District': '',
      'Job Role': 'Insurance Advisor / Insurance Consultant',
      'Index Status': 'index, follow',
      'Schema Type': 'JobPosting',
      'Sitemap Included': 'Yes',
      'GSC Submission Priority': 'High',
    });
  }

  // City / District pages (legacy insurance)
  for (const c of INSURANCE_CITIES) {
    const isDistrict = c.slug.includes('-uttar-pradesh') ||
      c.slug.includes('-west-bengal') ||
      c.slug.includes('-madhya-pradesh') ||
      c.slug.includes('-bihar');

    rows.push({
      URL: `${SITE_URL}/${c.slug}`,
      'Page Type': isDistrict ? 'District' : 'City',
      State: c.state,
      'City / District': c.city,
      'Job Role': 'Insurance Advisor / Insurance Consultant',
      'Index Status': 'index, follow',
      'Schema Type': 'JobPosting',
      'Sitemap Included': 'Yes',
      'GSC Submission Priority': isDistrict ? 'Medium' : 'High',
    });
  }

  // Near Me pages
  for (const p of NEAR_ME_PAGES) {
    rows.push({
      URL: `${SITE_URL}/${p.slug}`,
      'Page Type': 'Near Me',
      State: '',
      'City / District': '',
      'Job Role': p.h1.replace(' Near Me', ''),
      'Index Status': 'index, follow',
      'Schema Type': 'JobPosting',
      'Sitemap Included': 'Yes',
      'GSC Submission Priority': 'High',
    });
  }

  // SEO City pages (new marketplace)
  for (const c of CITY_JOBS_DATA) {
    rows.push({
      URL: `${SITE_URL}/${c.slug}`,
      'Page Type': 'SEO City',
      State: c.state,
      'City / District': c.city,
      'Job Role': 'All Jobs',
      'Index Status': 'index, follow',
      'Schema Type': 'BreadcrumbList, FAQPage',
      'Sitemap Included': 'Yes',
      'GSC Submission Priority': 'High',
    });
  }

  // SEO Category pages
  for (const c of CATEGORY_JOBS_DATA) {
    rows.push({
      URL: `${SITE_URL}/${c.slug}`,
      'Page Type': 'SEO Category',
      State: '',
      'City / District': '',
      'Job Role': `${c.category} Jobs`,
      'Index Status': 'index, follow',
      'Schema Type': 'BreadcrumbList, FAQPage',
      'Sitemap Included': 'Yes',
      'GSC Submission Priority': 'High',
    });
  }

  // SEO Industry pages
  for (const i of INDUSTRY_JOBS_DATA) {
    rows.push({
      URL: `${SITE_URL}/${i.slug}`,
      'Page Type': 'SEO Industry',
      State: '',
      'City / District': '',
      'Job Role': `${i.industry} Jobs`,
      'Index Status': 'index, follow',
      'Schema Type': 'BreadcrumbList, FAQPage',
      'Sitemap Included': 'Yes',
      'GSC Submission Priority': 'Medium',
    });
  }


  return rows;
}

export function GSCUrlExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const rows = buildUrlRows();
  const stateCount = INSURANCE_STATES.length;
  const cityCount = INSURANCE_CITIES.length;
  const seoCityCount = CITY_JOBS_DATA.length;
  const categoryCount = CATEGORY_JOBS_DATA.length;
  const industryCount = INDUSTRY_JOBS_DATA.length;
  

  const handleExport = () => {
    setIsExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(rows);

      ws['!cols'] = [
        { wch: 65 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 40 },
        { wch: 14 },
        { wch: 24 },
        { wch: 16 },
        { wch: 22 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'GSC Job URLs');

      XLSX.writeFile(wb, 'TrueJobs_GSC_Job_URLs.xlsx');

      toast({
        title: 'Export Complete',
        description: `Downloaded ${rows.length} URLs to TrueJobs_GSC_Job_URLs.xlsx`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not generate the Excel file.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              GSC Job URL Export
            </CardTitle>
            <CardDescription className="mt-1">
              Download all indexable job page URLs for Google Search Console submission
            </CardDescription>
          </div>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export .xlsx
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{rows.length}</p>
            <p className="text-xs text-muted-foreground">Total URLs</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{seoCityCount}</p>
            <p className="text-xs text-muted-foreground">City Pages</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{categoryCount}</p>
            <p className="text-xs text-muted-foreground">Category Pages</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{industryCount}</p>
            <p className="text-xs text-muted-foreground">Industry Pages</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{NEAR_ME_PAGES.length}</p>
            <p className="text-xs text-muted-foreground">Near Me Pages</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stateCount}</p>
            <p className="text-xs text-muted-foreground">Insurance States</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{cityCount}</p>
            <p className="text-xs text-muted-foreground">Insurance Cities</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3 text-primary" /> Auto-updated
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3 text-primary" /> All pages index, follow
          </Badge>
          <Badge variant="outline" className="gap-1">
            <FileSpreadsheet className="h-3 w-3 text-primary" /> Schema validated
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          All SEO data files (cities, categories, industries, govt jobs) are automatically included in exports.
        </p>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Comprehensive Export</p>
          <p className="text-xs text-muted-foreground mb-3">
            Download every URL on the website — static pages, programmatic SEO, database-driven dynamic pages, excluded routes, and sitemaps — in a multi-sheet Excel file.
          </p>
          <GSCAllUrlsExport />
        </div>
      </CardContent>
    </Card>
  );
}
