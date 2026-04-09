import { Layout } from '@/components/layout/Layout';
import { GovtHeroBlock } from '@/components/home/GovtHeroBlock';
import { HeroSideCards } from '@/components/home/HeroSideCards';
import { LatestGovtJobs } from '@/components/home/LatestGovtJobs';
import { GovtJobCategories } from '@/components/home/GovtJobCategories';
import { StateQuickFilter } from '@/components/home/StateQuickFilter';
import { InfoCardsRow } from '@/components/home/InfoCardsRow';
import { PrepToolsBanner } from '@/components/home/PrepToolsBanner';
import { PrivateJobsExplore } from '@/components/home/PrivateJobsExplore';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { SEO, OrganizationSchema, WebsiteSchema } from '@/components/SEO';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';

export default function Index() {
  return (
    <Layout>
      <SEO
        description="Find latest sarkari naukri, government exams, private jobs, IT, sales, marketing & more. Free job alerts for freshers & experienced. Updated daily."
      />
      <OrganizationSchema />
      <WebsiteSchema />

      {/* Hero: 2fr / 1fr grid */}
      <section className="py-6 md:py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <GovtHeroBlock />
            </div>
            <div className="lg:col-span-1">
              <HeroSideCards />
            </div>
          </div>
        </div>
      </section>

      {/* Main content + desktop sidebar */}
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Top banner ad — full-span row inside grid for sidebar persistence */}
          <div className="lg:col-span-2 mt-4">
            <AdPlaceholder variant="banner" />
          </div>
          {/* Left: main content */}
          <div>
            <LatestGovtJobs />

            <AdPlaceholder variant="in-content" />

            <GovtJobCategories />

            <div className="my-6">
              <AdPlaceholder variant="banner" />
            </div>

            <StateQuickFilter />

            <InfoCardsRow />

            <AdPlaceholder variant="in-content" />

            <PrepToolsBanner />

            <PrivateJobsExplore />

            <section className="py-6">
              <JobAlertCTA variant="strong" />
            </section>
          </div>

          {/* Right: desktop-only sticky sidebar ad */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <AdPlaceholder variant="sidebar" />
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
