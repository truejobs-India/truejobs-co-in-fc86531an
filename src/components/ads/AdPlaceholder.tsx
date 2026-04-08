/**
 * Google AdSense ad unit — revenue-first with robust fill detection.
 *
 * Three-state lifecycle: loading → filled | unfilled
 * - loading:  reserved-height placeholder (opacity 0, measurable by AdSense)
 * - filled:   visible ad with "Advertisement" label
 * - unfilled: returns null — complete collapse (ONLY on explicit AdSense signal)
 *
 * Retry strategy:
 *   Phase 1: 8 fast retries × 1.5s
 *   Phase 2: slow fallback retries every 8s until success/unmount/explicit-unfilled
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
const FILL_CHECK_TIMEOUT = 5000;
const SLOW_RETRY_INTERVAL = 8000;

const variantConfig = {
  banner: {
    filledMinHeight: 110,
    insMinHeight: 90,
    wrapper: 'w-full my-5 px-4 flex flex-col items-center',
    format: 'horizontal' as const,
  },
  sidebar: {
    filledMinHeight: 280,
    insMinHeight: 250,
    wrapper: 'w-full my-5 px-2 flex flex-col items-center',
    format: 'vertical' as const,
  },
  'in-content': {
    filledMinHeight: 280,
    insMinHeight: 250,
    wrapper: 'w-full my-8 px-4 flex flex-col items-center border-t border-b border-muted/20 py-4',
    format: 'fluid' as const,
  },
  footer: {
    filledMinHeight: 110,
    insMinHeight: 90,
    wrapper: 'w-full mt-5 mb-[88px] md:mb-5 px-4 flex flex-col items-center',
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
  for (let i = 0; i < el.children.length; i++) {
    if ((el.children[i] as HTMLElement).offsetHeight > 1) return true;
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
  const slowRetryRef = useRef<number | null>(null);

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
    if (slowRetryRef.current !== null) {
      clearInterval(slowRetryRef.current);
      slowRetryRef.current = null;
    }
  };

  /** Start slow fallback retries every 8s until success/unmount/explicit-unfilled. */
  const startSlowRetries = () => {
    if (slowRetryRef.current !== null) return;
    if (IS_DEV) console.debug(`[AdSense] ${variant} → starting slow fallback retries`);

    slowRetryRef.current = window.setInterval(() => {
      if (abortRef.current || pushSucceeded.current) {
        if (slowRetryRef.current !== null) {
          clearInterval(slowRetryRef.current);
          slowRetryRef.current = null;
        }
        return;
      }
      const el = adRef.current;
      if (!el) return;

      // Check explicit unfilled signal
      if (el.getAttribute('data-adsbygoogle-status') === 'unfilled') {
        setAdStatus('unfilled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → explicit unfilled (slow retry)`);
        clearInterval(slowRetryRef.current!);
        slowRetryRef.current = null;
        return;
      }

      // Check if already done externally
      if (el.getAttribute('data-adsbygoogle-status') === 'done') {
        pushSucceeded.current = true;
        if (hasBeenVisible.current) startFillObservation();
        clearInterval(slowRetryRef.current!);
        slowRetryRef.current = null;
        return;
      }

      // Attempt push
      const ready = isAdSenseReady();
      const width = el.offsetWidth ?? 0;
      if (ready && width > 0) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushSucceeded.current = true;
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK (slow retry)`);
          if (hasBeenVisible.current) startFillObservation();
          clearInterval(slowRetryRef.current!);
          slowRetryRef.current = null;
        } catch {
          // continue retrying
        }
      }
    }, SLOW_RETRY_INTERVAL);
  };

  /** Start MutationObserver on <ins> to detect real fill. */
  const startFillObservation = () => {
    const el = adRef.current;
    if (!el || abortRef.current) return;

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

    // Safety timeout: only collapse on explicit unfilled signal
    trackTimeout(() => {
      if (abortRef.current) return;
      mo.disconnect();
      mutObserverRef.current = null;
      if (el && hasRealFill(el)) {
        setAdStatus('filled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → filled (timeout final check)`);
      } else if (el?.getAttribute('data-adsbygoogle-status') === 'unfilled') {
        setAdStatus('unfilled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → explicit unfilled (timeout)`);
      }
      // else: stay 'loading' — uncertain, keep reserved space
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
    if (slowRetryRef.current !== null) {
      clearInterval(slowRetryRef.current);
      slowRetryRef.current = null;
    }

    // --- IntersectionObserver for viewport awareness ---
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasBeenVisible.current) {
            hasBeenVisible.current = true;
            if (IS_DEV) console.debug(`[AdSense] ${variant} → entered viewport`);
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
        pushSucceeded.current = true;
        if (hasBeenVisible.current) {
          startFillObservation();
        }
        return;
      }

      if (scriptReady && containerWidth > 0 && isVisible) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushSucceeded.current = true;
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK`);
          if (hasBeenVisible.current) {
            startFillObservation();
          }
        } catch (e) {
          if (IS_DEV) console.debug(`[AdSense] ${variant} → push error`, e);
          if (!isRetry) {
            trackTimeout(() => initAd(true), 2000);
          } else {
            // Push failed on retry — start slow fallback
            startSlowRetries();
          }
        }
      } else if (!isRetry) {
        let retryCount = 0;
        const retryLoop = () => {
          if (abortRef.current || retryCount >= MAX_RETRIES) {
            if (retryCount >= MAX_RETRIES) {
              if (IS_DEV) console.debug(`[AdSense] ${variant} → fast retries exhausted, starting slow fallback`);
              // Do NOT set unfilled — start slow fallback retries instead
              startSlowRetries();
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
  if (!IS_PROD_DOMAIN) return null;
  if (adStatus === 'unfilled') return null;

  const adFormat = config.format === 'fluid' ? 'fluid' : config.format;
  const isFilled = adStatus === 'filled';
  const isLoading = adStatus === 'loading';

  return (
    <div
      ref={wrapperRef}
      className={`${config.wrapper} ${className}`}
      style={
        isLoading
          ? { minHeight: `${config.filledMinHeight}px`, opacity: 0 }
          : isFilled
            ? { minHeight: `${config.filledMinHeight}px` }
            : undefined
      }
    >
      {isFilled && <AdLabel />}
      <ins
        key={insKey}
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          minHeight: (isFilled || isLoading) ? `${config.insMinHeight}px` : undefined,
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
