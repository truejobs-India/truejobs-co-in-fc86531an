/**
 * Google AdSense ad unit with robust fill detection and hide-if-empty.
 *
 * Three-state lifecycle: loading → filled | unfilled
 * - loading:  silent reserved-height placeholder (no label)
 * - filled:   visible ad with "Advertisement" label
 * - unfilled: returns null — complete collapse
 *
 * Fill detection uses MutationObserver + status/child-height heuristic.
 * Viewport-aware: below-fold slots defer unfilled timeout until visible.
 * Route-aware: re-initializes on SPA navigation via key-based remount.
 */

import { useContext, useEffect, useRef, useState } from 'react';
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
const FILL_CHECK_TIMEOUT = 5000; // 5s after push or viewport entry

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

function isAdSenseReady(): boolean {
  if (typeof window === 'undefined') return false;
  const arr = window.adsbygoogle;
  if (arr && !Array.isArray(arr)) return true;
  if (arr && typeof arr.push === 'function' && arr.push !== Array.prototype.push) return true;
  return false;
}

/** Check if the <ins> element has real rendered ad content. */
function hasRealFill(el: HTMLElement): boolean {
  const status = el.getAttribute('data-adsbygoogle-status');
  if (status !== 'done') return false;
  // Check for child content with real height (iframe or div injected by AdSense)
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i] as HTMLElement;
    if (child.offsetHeight > 0) return true;
  }
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerIds = useRef<number[]>([]);
  const abortRef = useRef(false);
  const hasBeenVisible = useRef(false);
  const pushSucceeded = useRef(false);
  const mutObserverRef = useRef<MutationObserver | null>(null);
  const intObserverRef = useRef<IntersectionObserver | null>(null);

  const [adStatus, setAdStatus] = useState<'loading' | 'filled' | 'unfilled'>('loading');

  const config = variantConfig[variant];
  const insKey = `${variant}-${location.pathname}`;

  const trackTimeout = (fn: () => void, delay: number): void => {
    const id = window.setTimeout(fn, delay);
    timerIds.current.push(id);
  };

  const clearAllTimers = () => {
    timerIds.current.forEach((id) => window.clearTimeout(id));
    timerIds.current = [];
  };

  const cleanup = () => {
    abortRef.current = true;
    clearAllTimers();
    mutObserverRef.current?.disconnect();
    mutObserverRef.current = null;
    intObserverRef.current?.disconnect();
    intObserverRef.current = null;
  };

  /** Start MutationObserver on <ins> to detect real fill, with a safety timeout. */
  const startFillObservation = () => {
    const el = adRef.current;
    if (!el || abortRef.current) return;

    // Immediate check — might already be filled
    if (hasRealFill(el)) {
      setAdStatus('filled');
      if (IS_DEV) console.debug(`[AdSense] ${variant} → filled (immediate)`);
      return;
    }

    const mo = new MutationObserver(() => {
      if (abortRef.current) return;
      if (el && hasRealFill(el)) {
        setAdStatus('filled');
        mo.disconnect();
        mutObserverRef.current = null;
        if (IS_DEV) console.debug(`[AdSense] ${variant} → filled (observer)`);
      }
    });

    mo.observe(el, { childList: true, subtree: true, attributes: true });
    mutObserverRef.current = mo;

    // Safety timeout: if not filled after FILL_CHECK_TIMEOUT, do final check
    trackTimeout(() => {
      if (abortRef.current) return;
      mo.disconnect();
      mutObserverRef.current = null;
      if (el && hasRealFill(el)) {
        setAdStatus('filled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → filled (timeout final check)`);
      } else {
        setAdStatus('unfilled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (timeout expired)`);
      }
    }, FILL_CHECK_TIMEOUT);
  };

  useEffect(() => {
    if (noAds || typeof window === 'undefined' || !IS_PROD_DOMAIN) return;

    // Reset state for new route
    abortRef.current = false;
    hasBeenVisible.current = false;
    pushSucceeded.current = false;
    setAdStatus('loading');
    clearAllTimers();
    mutObserverRef.current?.disconnect();
    intObserverRef.current?.disconnect();

    // --- IntersectionObserver for viewport awareness ---
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasBeenVisible.current) {
            hasBeenVisible.current = true;
            if (IS_DEV) console.debug(`[AdSense] ${variant} → entered viewport`);
            // If push already succeeded but fill observation was deferred, start it now
            if (pushSucceeded.current) {
              startFillObservation();
            }
          }
        },
        { threshold: 0, rootMargin: '200px' }
      );
      io.observe(wrapper);
      intObserverRef.current = io;
    }

    // --- Ad initialization with retries ---
    const initAd = (isRetry = false) => {
      if (abortRef.current) return;

      const el = adRef.current;
      if (!el) return;

      const alreadyDone = el.getAttribute('data-adsbygoogle-status') === 'done';
      const containerWidth = el.offsetWidth ?? 0;
      const isVisible = document.visibilityState === 'visible';
      const scriptReady = isAdSenseReady();

      if (IS_DEV) {
        console.debug(
          `[AdSense] ${variant} | path=${location.pathname} | scriptReady=${scriptReady} | width=${containerWidth} | visible=${isVisible} | done=${alreadyDone} | retry=${isRetry}`
        );
      }

      if (alreadyDone) {
        // Already processed — check if it actually filled
        if (hasBeenVisible.current) {
          startFillObservation();
        } else {
          pushSucceeded.current = true; // defer observation
        }
        return;
      }

      if (scriptReady && containerWidth > 0 && isVisible) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushSucceeded.current = true;
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK`);

          // Start fill observation if already in viewport, otherwise defer
          if (hasBeenVisible.current) {
            startFillObservation();
          }
        } catch (e) {
          if (IS_DEV) console.debug(`[AdSense] ${variant} → push error`, e);
          if (!isRetry) {
            trackTimeout(() => initAd(true), 2000);
          } else {
            // Push failed on retry too — mark unfilled if visible
            if (hasBeenVisible.current) {
              setAdStatus('unfilled');
            }
          }
        }
      } else if (!isRetry) {
        let retryCount = 0;
        const retryLoop = () => {
          if (abortRef.current || retryCount >= MAX_RETRIES) {
            if (retryCount >= MAX_RETRIES) {
              if (IS_DEV) console.debug(`[AdSense] ${variant} → gave up after ${MAX_RETRIES} retries`);
              // Only mark unfilled if slot was visible
              if (hasBeenVisible.current) {
                setAdStatus('unfilled');
              }
            }
            return;
          }
          retryCount += 1;
          trackTimeout(() => {
            if (abortRef.current) return;
            const el2 = adRef.current;
            if (!el2) return;
            const done = el2.getAttribute('data-adsbygoogle-status') === 'done';
            if (done) {
              pushSucceeded.current = true;
              if (hasBeenVisible.current) startFillObservation();
              return;
            }
            const ready = isAdSenseReady();
            const width = el2.offsetWidth ?? 0;
            const vis = document.visibilityState === 'visible';
            if (ready && width > 0 && vis) {
              try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                pushSucceeded.current = true;
                if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK on retry ${retryCount}`);
                if (hasBeenVisible.current) startFillObservation();
              } catch (e2) {
                if (IS_DEV) console.debug(`[AdSense] ${variant} → retry push error`, e2);
                retryLoop();
              }
            } else {
              retryLoop();
            }
          }, RETRY_INTERVAL);
        };
        retryLoop();
      }
    };

    trackTimeout(() => initAd(false), STAGGER_DELAY[variant]);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noAds, variant, location.pathname]);

  if (noAds) return null;

  // Non-prod: return null (no fake ad boxes in preview)
  if (!IS_PROD_DOMAIN) return null;

  // Unfilled: collapse entirely
  if (adStatus === 'unfilled') return null;

  const adFormat = config.format === 'fluid' ? 'fluid' : config.format;

  // Loading: silent placeholder with reserved height, no label
  // Filled: full container with label
  return (
    <div
      ref={wrapperRef}
      className={`${config.wrapper} ${className} ${adStatus === 'loading' ? 'opacity-0' : ''}`}
      style={adStatus === 'loading' ? { minHeight: variant === 'banner' || variant === 'footer' ? '90px' : '250px' } : undefined}
    >
      {adStatus === 'filled' && <AdLabel />}
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
