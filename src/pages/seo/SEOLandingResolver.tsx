import { useParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { NEAR_ME_PAGES } from '../jobs/nearMeData';
import NearMeJobPage from '../jobs/NearMeJobPage';
import NotFound from '../NotFound';

const CategoryJobsPage = lazy(() => import('./CategoryJobsPage'));
const CityJobsPage = lazy(() => import('./CityJobsPage'));
const IndustryJobsPage = lazy(() => import('./IndustryJobsPage'));
const TodayJobsPage = lazy(() => import('./TodayJobsPage'));
const GovtSelectionPage = lazy(() => import('./GovtSelectionPage'));
const ExamClusterHub = lazy(() => import('@/pages/govt/ExamClusterHub'));
const PreviousYearPaperPage = lazy(() => import('@/pages/govt/PreviousYearPaperPage'));
const ExamAuthorityPage = lazy(() => import('../govt/ExamAuthorityPage'));
const StateGovtJobsPage = lazy(() => import('./StateGovtJobsPage'));
const DepartmentJobsPage = lazy(() => import('./DepartmentJobsPage'));
const QualificationJobsPage = lazy(() => import('./QualificationJobsPage'));
const CustomLongTailPage = lazy(() => import('./CustomLongTailPage'));
const GovtComboPage = lazy(() => import('./GovtComboPage'));
const DeadlineJobsPage = lazy(() => import('./DeadlineJobsPage'));
const AllSarkariJobsHub = lazy(() => import('./AllSarkariJobsHub'));

const Loading = () => (
  <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>
);


/**
 * Dynamically resolves which SEO page component to render.
 * All data config lookups are done via dynamic import() so that
 * the large data files are NOT bundled into the main chunk.
 */
type ResolvedPage = React.LazyExoticComponent<any> | typeof NearMeJobPage | typeof NotFound;

export default function SEOLandingResolver() {
  const { slug } = useParams<{ slug: string }>();
  const [Resolved, setResolved] = useState<ResolvedPage | null>(null);

  useEffect(() => {
    if (!slug) { setResolved(() => NotFound); return; }

    // Handle redirects
    const REDIRECTS: Record<string, string> = {
      'govt-jobs-up': '/govt-jobs-uttar-pradesh',
      'ssc-cgl-previous-year-papers': '/ssc-cgl-previous-year-paper',
    };
    if (REDIRECTS[slug]) {
      window.location.replace(REDIRECTS[slug]);
      return;
    }

    // Run async resolution
    resolveSlug(slug).then(component => setResolved(() => component));
  }, [slug]);

  if (!Resolved) return <Loading />;

  // NearMeJobPage and NotFound are not lazy, render directly
  if (Resolved === NearMeJobPage || Resolved === NotFound) {
    return <Resolved />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <Resolved />
    </Suspense>
  );
}

async function resolveSlug(slug: string): Promise<ResolvedPage> {
  // 0-pre. All Sarkari Jobs hub
  if (slug === 'all-sarkari-jobs') return AllSarkariJobsHub;

  // 0-pre2. Deadline pages
  const { isDeadlineSlug } = await import('./DeadlineJobsPage');
  if (isDeadlineSlug(slug)) return DeadlineJobsPage;

  // 0a. Hub pages (cluster hubs)
  const { getHubConfig } = await import('@/data/examAuthority/hubs');
  if (getHubConfig(slug)) return ExamClusterHub;

  // 0b. Previous Year Paper pages
  const { getPYPConfig } = await import('@/data/previousYearPapers');
  if (getPYPConfig(slug)) return PreviousYearPaperPage;

  // 0c. Exam authority pages (SSC CGL, Railway RRB, etc.)
  const { getExamAuthorityConfig } = await import('@/data/examAuthority');
  if (getExamAuthorityConfig(slug)) return ExamAuthorityPage;

  // 1. Today pages
  const { getTodayPageConfig } = await import('./TodayJobsPage');
  if (getTodayPageConfig(slug)) return TodayJobsPage;

  // 2. City pages (jobs-in-{city})
  if (slug.startsWith('jobs-in-')) {
    const { getCityJobConfig } = await import('./cityJobsData');
    if (getCityJobConfig(slug)) return CityJobsPage;
  }

  // 3. Category pages
  const { getCategoryJobConfig } = await import('./categoryJobsData');
  if (getCategoryJobConfig(slug)) return CategoryJobsPage;

  // 4. Industry pages
  const { getIndustryJobConfig } = await import('./industryJobsData');
  if (getIndustryJobConfig(slug)) return IndustryJobsPage;

  // 5. Selection-based pages (govt-jobs-without-exam, etc.)
  if (slug.includes('without-exam')) {
    const { parseSelectionSlug } = await import('./selectionPageData');
    if (parseSelectionSlug(slug)) return GovtSelectionPage;
  }

  // 5.5 State govt pages: /govt-jobs-{state}
  if (slug.startsWith('govt-jobs-')) {
    const { getStateGovtJobConfig } = await import('./stateGovtJobsData');
    if (getStateGovtJobConfig(slug)) return StateGovtJobsPage;
  }

  // 5.6 Department pages: /{dept}-jobs (allowlist checked inside)
  const { isDepartmentSlug } = await import('./departmentJobsData');
  if (isDepartmentSlug(slug)) return DepartmentJobsPage;

  // 5.7 Qualification pages: /{qual}-govt-jobs
  if (slug.endsWith('-govt-jobs')) {
    const { getQualificationJobConfig } = await import('./qualificationJobsData');
    if (getQualificationJobConfig(slug)) return QualificationJobsPage;
  }

  // 6. Near-me pages
  if (NEAR_ME_PAGES.find(p => p.slug === slug)) return NearMeJobPage;

  // 6.5 Govt combo pages (dept+state, dept+qual, closing-soon)
  const { isComboSlug } = await import('./govtComboData');
  if (isComboSlug(slug)) return GovtComboPage;

  // 6.6 Custom long-tail pages (fallback expansion system)
  const { isCustomLongTailSlug } = await import('./customLongTailData');
  if (isCustomLongTailSlug(slug)) return CustomLongTailPage;

  // 7. Not found
  return NotFound;
}
