/**
 * Ad-ready placeholder component — policy-compliant.
 * Renders ad slots respecting noAds and adVisibility signals.
 */

import { useContext, useState, useEffect } from 'react';
import { NoAdsContext } from '@/components/layout/Layout';

interface AdPlaceholderProps {
  variant: 'banner' | 'sidebar' | 'in-content' | 'footer';
  className?: string;
}

const variantConfig = {
  banner: {
    minHeight: 'min-h-[90px]',
    wrapper: 'w-full my-5 px-4 flex flex-col items-center',
  },
  sidebar: {
    minHeight: 'min-h-[250px]',
    wrapper: 'w-full my-5 px-2 flex flex-col items-center',
  },
  'in-content': {
    minHeight: 'min-h-[250px]',
    wrapper: 'w-full my-8 px-4 flex flex-col items-center border-t border-b border-muted/20 py-4',
  },
  footer: {
    minHeight: 'min-h-[90px]',
    wrapper: 'w-full mt-5 mb-[88px] md:mb-5 px-4 flex flex-col items-center',
  },
};

function AdLabel() {
  return (
    <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest mb-1 select-none">
      Advertisement
    </p>
  );
}

function AdPlaceholderSkeleton({ variant, className = '' }: AdPlaceholderProps) {
  const config = variantConfig[variant];
  return (
    <div className={`${config.wrapper} ${className}`} aria-hidden="true">
      <AdLabel />
      <div
        className={`ad-slot ad-slot-${variant} ${config.minHeight} w-full animate-pulse rounded-lg bg-muted`}
      />
    </div>
  );
}

export function AdPlaceholder({ variant, className = '' }: AdPlaceholderProps) {
  const noAds = useContext(NoAdsContext);
  const [adsVisible, setAdsVisible] = useState(true);
  const config = variantConfig[variant];

  // Listen for adVisibility events (from ExitIntentPopup)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAdsVisible(detail?.visible !== false);
    };
    window.addEventListener('adVisibility', handler);
    return () => window.removeEventListener('adVisibility', handler);
  }, []);

  // Developer policy flag — no ads on this page
  if (noAds) return null;

  // Exit intent popup is active — show skeleton instead of ad
  if (!adsVisible) {
    return <AdPlaceholderSkeleton variant={variant} className={className} />;
  }

  // Render ad container — Google handles personalized vs non-personalized server-side
  return (
    <div className={`${config.wrapper} ${className}`} aria-hidden="true">
      <AdLabel />
      <div
        className={`ad-slot ad-slot-${variant} ${config.minHeight} w-full`}
        data-ad-slot={variant}
      />
    </div>
  );
}
