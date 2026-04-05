/**
 * Real Google AdSense ad unit component.
 * Renders <ins class="adsbygoogle"> with multi-signal readiness gating.
 * Respects NoAdsContext — returns null on admin/auth pages.
 * Route-aware: re-initializes on SPA navigation via key-based remount.
 */

import { useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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

const STAGGER_DELAY: Record<AdPlaceholderProps['variant'], number> = {
  banner: 150,
  'in-content': 300,
  sidebar: 500,
  footer: 700,
};

const MAX_RETRIES = 8;
const RETRY_INTERVAL = 1500;

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

/** Check if AdSense library has actually loaded (not just script tag present). */
function isAdSenseReady(): boolean {
  if (typeof window === 'undefined') return false;
  const arr = window.adsbygoogle;
  // After load, AdSense replaces the plain array with a proxy object
  if (arr && !Array.isArray(arr)) return true;
  // Also check if push has been overridden (some AdSense versions keep array-like)
  if (arr && typeof arr.push === 'function' && arr.push !== Array.prototype.push) return true;
  return false;
}

function AdLabel() {
  return (
    <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest mb-1 select-none">
      Advertisement
    </p>
  );
}

export function AdPlaceholder({ variant, className = '' }: AdPlaceholderProps) {
  const noAds = useContext(NoAdsContext);
  const location = useLocation();
  const adRef = useRef<HTMLModElement>(null);
  const retries = useRef(0);
  const config = variantConfig[variant];

  // Key forces React to fully remount <ins> on route change,
  // giving AdSense a fresh element without stale status attributes.
  const insKey = `${variant}-${location.pathname}`;

  useEffect(() => {
    if (noAds || typeof window === 'undefined' || !IS_PROD_DOMAIN) return;

    retries.current = 0;

    const initAd = () => {
      const el = adRef.current;
      if (!el) return;

      const alreadyDone = el.getAttribute('data-adsbygoogle-status') === 'done';
      const containerWidth = el.offsetWidth ?? 0;
      const isVisible = document.visibilityState === 'visible';
      const scriptReady = isAdSenseReady();

      if (IS_DEV) {
        console.debug(
          `[AdSense] ${variant} | path=${location.pathname} | scriptReady=${scriptReady} | width=${containerWidth} | visible=${isVisible} | done=${alreadyDone} | retry=${retries.current}`
        );
      }

      if (alreadyDone) {
        if (IS_DEV) console.debug(`[AdSense] ${variant} → already processed, skipping`);
        return;
      }

      if (scriptReady && containerWidth > 0 && isVisible) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK`);
        } catch (e) {
          if (IS_DEV) console.debug(`[AdSense] ${variant} → push error`, e);
        }
      } else if (retries.current < MAX_RETRIES) {
        retries.current += 1;
        setTimeout(initAd, RETRY_INTERVAL);
      } else if (IS_DEV) {
        console.debug(`[AdSense] ${variant} → gave up after ${MAX_RETRIES} retries`);
      }
    };

    const timer = setTimeout(initAd, STAGGER_DELAY[variant]);
    return () => clearTimeout(timer);
  }, [noAds, variant, location.pathname]);

  if (noAds) return null;

  const adFormat = config.format === 'fluid' ? 'fluid' : config.format;

  return (
    <div className={`${config.wrapper} ${className}`}>
      <AdLabel />
      <ins
        key={insKey}
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
