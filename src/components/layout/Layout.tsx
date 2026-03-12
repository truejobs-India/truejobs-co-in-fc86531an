import { createContext } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { JobSearchBot } from '@/components/chat/JobSearchBot';
import { StickyMobileCTA } from '@/components/conversion/StickyMobileCTA';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

export const NoAdsContext = createContext(false);

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  noAds?: boolean;
  showConsent?: boolean;
}

export function Layout({ children, hideFooter = false, noAds = false, showConsent = true }: LayoutProps) {
  return (
    <NoAdsContext.Provider value={noAds}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        {!hideFooter && <Footer />}
        <JobSearchBot />
        <StickyMobileCTA />
        {showConsent && <CookieConsentBanner />}
      </div>
    </NoAdsContext.Provider>
  );
}
