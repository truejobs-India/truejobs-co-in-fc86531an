/**
 * Real Google AdSense ad unit component.
 * Renders <ins class="adsbygoogle"> with multi-signal readiness gating.
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

const SLOT_IDS: Record<AdPlaceholderProps['variant'], string> = {
  banner: '6502762618',
  sidebar: '5672896678',
  'in-content': '9228297609',
  footer: '7728214373',
};

const variantConfig = {
  banner: {
    minHeight: 'min-h-[90px]',
    wrapper: 'w-full my-5 px-4 flex flex-col items-center min-h-[110px]',
    format: 'horizontal' as const,
  },
  sidebar: {
    minHeight: 'min-h-[250px]',
    wrapper: 'w-full my-5 px-2 flex flex-col items-center min-h-[280px]',
    format: 'vertical' as const,
  },
  'in-content': {
    minHeight: 'min-h-[250px]',
    wrapper: 'w-full my-8 px-4 flex flex-col items-center border-t border-b border-muted/20 py-4 min-h-[280px]',
    format: 'fluid' as const,
  },
  footer: {
    minHeight: 'min-h-[90px]',
    wrapper: 'w-full mt-5 mb-[88px] md:mb-5 px-4 flex flex-col items-center min-h-[110px]',
    format: 'horizontal' as const,
  },
};

const IS_PROD_DOMAIN =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'truejobs.co.in' ||
    window.location.hostname === 'www.truejobs.co.in');

const IS_DEV = !IS_PROD_DOMAIN;

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
  const retries = useRef(0);
  const config = variantConfig[variant];

  useEffect(() => {
    if (pushed.current || noAds || typeof window === 'undefined' || !IS_PROD_DOMAIN) {
      return;
    }

    const initAd = () => {
      const scriptPresent = !!document.querySelector('script[src*="adsbygoogle"]');
      const containerWidth = adRef.current?.offsetWidth ?? 0;
      const isVisible = document.visibilityState === 'visible';

      if (IS_DEV) {
        console.debug(`[AdSense] ${variant} | path=${window.location.pathname} | script=${scriptPresent} | width=${containerWidth} | visible=${isVisible} | retry=${retries.current}`);
      }

      if (scriptPresent && containerWidth > 0 && isVisible) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushed.current = true;
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK`);
        } catch (e) {
          if (IS_DEV) console.debug(`[AdSense] ${variant} → push error`, e);
        }
      } else if (retries.current < 3) {
        retries.current += 1;
        setTimeout(initAd, 1000);
      } else if (IS_DEV) {
        console.debug(`[AdSense] ${variant} → gave up after 3 retries`);
      }
    };

    // Defer first attempt slightly to allow layout to settle
    const timer = setTimeout(initAd, 100);
    return () => clearTimeout(timer);
  }, [noAds, variant]);

  if (noAds) return null;

  const adFormat = config.format === 'fluid' ? 'fluid' : config.format;

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
        data-ad-format={adFormat}
        data-full-width-responsive="true"
        {...(config.format === 'fluid'
          ? { 'data-ad-layout': 'in-article', 'data-ad-layout-key': '-fb+5w+4e-db+86' }
          : {})}
      />
    </div>
  );
}
