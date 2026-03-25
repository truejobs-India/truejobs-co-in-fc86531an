/**
 * Real Google AdSense ad unit component.
 * Renders <ins class="adsbygoogle"> with proper push() call.
 * Respects NoAdsContext — returns null on admin/auth pages.
 */

import { useContext, useEffect, useRef } from 'react';
import { NoAdsContext } from '@/components/layout/Layout';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdPlaceholderProps {
  variant: 'banner' | 'sidebar' | 'in-content' | 'footer';
  className?: string;
}

const AD_CLIENT = 'ca-pub-7353331010234724';

// Each variant gets a unique slot ID for reporting granularity.
// Replace these with real slot IDs from AdSense dashboard when available.
const SLOT_IDS: Record<AdPlaceholderProps['variant'], string> = {
  banner: '1234567890',
  sidebar: '2345678901',
  'in-content': '3456789012',
  footer: '4567890123',
};

const variantConfig = {
  banner: {
    minHeight: 'min-h-[90px]',
    wrapper: 'w-full my-5 px-4 flex flex-col items-center',
    format: 'horizontal' as const,
  },
  sidebar: {
    minHeight: 'min-h-[250px]',
    wrapper: 'w-full my-5 px-2 flex flex-col items-center',
    format: 'auto' as const,
  },
  'in-content': {
    minHeight: 'min-h-[250px]',
    wrapper: 'w-full my-8 px-4 flex flex-col items-center border-t border-b border-muted/20 py-4',
    format: 'fluid' as const,
  },
  footer: {
    minHeight: 'min-h-[90px]',
    wrapper: 'w-full mt-5 mb-[88px] md:mb-5 px-4 flex flex-col items-center',
    format: 'horizontal' as const,
  },
};

function AdLabel() {
  return (
    <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest mb-1 select-none">
      Advertisement
    </p>
  );
}

export function AdPlaceholder({ variant, className = '' }: AdPlaceholderProps) {
  const noAds = useContext(NoAdsContext);
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const config = variantConfig[variant];

  useEffect(() => {
    // Only push on production domain, and only once per mount
    if (
      pushed.current ||
      noAds ||
      typeof window === 'undefined' ||
      (window.location.hostname !== 'truejobs.co.in' &&
        window.location.hostname !== 'www.truejobs.co.in')
    ) {
      return;
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      // AdSense not loaded yet or blocked — fail silently
    }
  }, [noAds]);

  // No ads on admin/auth pages
  if (noAds) return null;

  return (
    <div className={`${config.wrapper} ${className}`}>
      <AdLabel />
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          minHeight: variant === 'banner' || variant === 'footer' ? '90px' : '250px',
        }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={SLOT_IDS[variant]}
        data-ad-format={config.format === 'fluid' ? 'fluid' : 'auto'}
        data-full-width-responsive="true"
        {...(config.format === 'fluid'
          ? { 'data-ad-layout': 'in-article', 'data-ad-layout-key': '-fb+5w+4e-db+86' }
          : {})}
      />
    </div>
  );
}
