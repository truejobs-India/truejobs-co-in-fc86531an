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

      {/* Latest Updates (govt exams from DB) */}
      <LatestGovtJobs />

      {/* Govt Job Categories grid */}
      <GovtJobCategories />

      <div className="container mx-auto px-4 my-6">
        <AdPlaceholder variant="banner" />
      </div>

      {/* State-wise filter */}
      <StateQuickFilter />

      {/* Info cards: Results, Admit Cards, Exam Calendar */}
      <InfoCardsRow />

      {/* Preparation Tools banner */}
      <PrepToolsBanner />

      {/* Private Jobs (secondary) */}
      <PrivateJobsExplore />

      {/* Alert signup banner */}
      <AlertSignupBanner />
    </Layout>
  );
}
