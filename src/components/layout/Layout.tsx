import { createContext } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { JobSearchBot } from '@/components/chat/JobSearchBot';
import { StickyMobileCTA } from '@/components/conversion/StickyMobileCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';

export const NoAdsContext = createContext(false);

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  noAds?: boolean;
}

export function Layout({ children, hideFooter = false, noAds = false }: LayoutProps) {
  return (
    <NoAdsContext.Provider value={noAds}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <AdPlaceholder variant="footer" />
        {!hideFooter && <Footer />}
        <JobSearchBot />
        <StickyMobileCTA />
      </div>
    </NoAdsContext.Provider>
  );
}
