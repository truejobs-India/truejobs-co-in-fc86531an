/**
 * Google AdSense ad unit — Revenue-First architecture.
 *
 * Three-state lifecycle: loading → filled | unfilled
 * - loading:  reserved measurable space (minHeight), no label, ads can render immediately
 * - filled:   visible ad with "Advertisement" label
 * - unfilled: returns null — complete collapse (ONLY on explicit AdSense signal)
 *
 * Revenue-first rules:
 * - Never collapse uncertain slots
 * - Never use opacity:0 or visibility:hidden on loading slots
 * - Only explicit data-adsbygoogle-status="unfilled" may collapse
 * - Indefinite slow retries if push() hasn't succeeded
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

const MAX_FAST_RETRIES = 8;
const FAST_RETRY_INTERVAL = 1500;
const SLOW_RETRY_INTERVAL = 8000;
const FILL_CHECK_TIMEOUT = 5000;
const FILL_CONFIRM_DELAY = 500;

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
    wrapper: 'w-full mt-5 mb-2 px-4 flex flex-col items-center',
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

/**
 * Revenue-first fill detection with two-tier validation.
 *
 * Requires data-adsbygoogle-status === 'done' first.
 * Tier 1: iframe with dimensions >= 50×50 (strongest signal).
 * Tier 2: any direct child >= 50px height AND >= 100px width
 *         (catches non-iframe formats, rejects AdChoices/shells/pixels).
 */
function hasRealFill(el: HTMLElement): boolean {
  const status = el.getAttribute('data-adsbygoogle-status');
  if (status !== 'done') return false;

  // Tier 1: iframe with real ad dimensions
  const iframes = el.querySelectorAll('iframe');
  for (let i = 0; i < iframes.length; i++) {
    if (iframes[i].offsetHeight >= 50 && iframes[i].offsetWidth >= 50) return true;
  }

  // Tier 2: direct child large enough to be a real ad unit
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i] as HTMLElement;
    if (child.offsetHeight >= 50 && child.offsetWidth >= 100) return true;
  }

  return false;
}

/** Check if AdSense has explicitly signalled unfilled. */
function isExplicitlyUnfilled(el: HTMLElement): boolean {
  return el.getAttribute('data-adsbygoogle-status') === 'unfilled';
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
  const slowRetryRef = useRef<number | null>(null);
  const abortRef = useRef(false);
  const pushSucceeded = useRef(false);
  const mutObserverRef = useRef<MutationObserver | null>(null);

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
    if (slowRetryRef.current !== null) {
      window.clearInterval(slowRetryRef.current);
      slowRetryRef.current = null;
    }
    mutObserverRef.current?.disconnect();
    mutObserverRef.current = null;
  };

  /**
   * Confirm fill with a delayed re-check to filter transient shell iframes.
   * If hasRealFill() is still true after FILL_CONFIRM_DELAY, set filled.
   * If not, stay in loading (revenue-first: no false label, no collapse).
   */
  const confirmFill = (source: string) => {
    trackTimeout(() => {
      if (abortRef.current) return;
      const el = adRef.current;
      if (!el) return;
      if (hasRealFill(el)) {
        setAdStatus('filled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → filled (confirmed, ${source})`);
      } else {
        // Shell was transient — stay loading, do not collapse
        if (IS_DEV) console.debug(`[AdSense] ${variant} → fill not confirmed after ${FILL_CONFIRM_DELAY}ms, staying loading (${source})`);
      }
    }, FILL_CONFIRM_DELAY);
  };

  /** Start MutationObserver on <ins> to detect real fill. */
  const startFillObservation = () => {
    const el = adRef.current;
    if (!el || abortRef.current) return;

    // Immediate check — schedule confirmation re-check instead of instant fill
    if (hasRealFill(el)) {
      confirmFill('immediate');
      return;
    }

    if (isExplicitlyUnfilled(el)) {
      setAdStatus('unfilled');
      if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (explicit, immediate)`);
      return;
    }

    const mo = new MutationObserver(() => {
      if (abortRef.current) return;
      if (el && hasRealFill(el)) {
        mo.disconnect();
        mutObserverRef.current = null;
        confirmFill('observer');
      } else if (el && isExplicitlyUnfilled(el)) {
        setAdStatus('unfilled');
        mo.disconnect();
        mutObserverRef.current = null;
        if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (explicit, observer)`);
      }
    });

    mo.observe(el, { childList: true, subtree: true, attributes: true });
    mutObserverRef.current = mo;

    // Safety timeout: after FILL_CHECK_TIMEOUT, do a final check
    // Only collapse if explicitly unfilled; otherwise stay loading
    trackTimeout(() => {
      if (abortRef.current) return;
      mo.disconnect();
      mutObserverRef.current = null;

      if (el && hasRealFill(el)) {
        confirmFill('safety timeout');
      } else if (el && isExplicitlyUnfilled(el)) {
        setAdStatus('unfilled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (explicit, safety timeout)`);
      } else {
        // Uncertain — stay loading with reserved space (revenue-first)
        if (IS_DEV) console.debug(`[AdSense] ${variant} → uncertain after ${FILL_CHECK_TIMEOUT}ms, staying loading`);
      }
    }, FILL_CHECK_TIMEOUT);
  };

  /** Slow fallback retries — indefinite until success, unmount, or explicit unfilled. */
  const startSlowRetries = () => {
    if (abortRef.current || pushSucceeded.current || slowRetryRef.current !== null) return;

    if (IS_DEV) console.debug(`[AdSense] ${variant} → starting slow retries every ${SLOW_RETRY_INTERVAL}ms`);

    slowRetryRef.current = window.setInterval(() => {
      if (abortRef.current || pushSucceeded.current) {
        if (slowRetryRef.current !== null) {
          window.clearInterval(slowRetryRef.current);
          slowRetryRef.current = null;
        }
        return;
      }

      const el = adRef.current;
      if (!el) return;

      // Check explicit unfilled
      if (isExplicitlyUnfilled(el)) {
        setAdStatus('unfilled');
        if (slowRetryRef.current !== null) {
          window.clearInterval(slowRetryRef.current);
          slowRetryRef.current = null;
        }
        if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (explicit, slow retry)`);
        return;
      }

      // Check if already done
      if (el.getAttribute('data-adsbygoogle-status') === 'done') {
        pushSucceeded.current = true;
        startFillObservation();
        if (slowRetryRef.current !== null) {
          window.clearInterval(slowRetryRef.current);
          slowRetryRef.current = null;
        }
        return;
      }

      // Try push
      const ready = isAdSenseReady();
      const width = el.offsetWidth ?? 0;
      if (ready && width > 0) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushSucceeded.current = true;
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK (slow retry)`);
          startFillObservation();
          if (slowRetryRef.current !== null) {
            window.clearInterval(slowRetryRef.current);
            slowRetryRef.current = null;
          }
        } catch (e) {
          if (IS_DEV) console.debug(`[AdSense] ${variant} → slow retry push error`, e);
        }
      }
    }, SLOW_RETRY_INTERVAL);
  };

  useEffect(() => {
    if (noAds || typeof window === 'undefined' || !IS_PROD_DOMAIN) return;

    // Reset state for new route
    abortRef.current = false;
    pushSucceeded.current = false;
    setAdStatus('loading');
    clearAllTimers();
    if (slowRetryRef.current !== null) {
      window.clearInterval(slowRetryRef.current);
      slowRetryRef.current = null;
    }
    mutObserverRef.current?.disconnect();

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
        startFillObservation();
        return;
      }

      if (isExplicitlyUnfilled(el)) {
        setAdStatus('unfilled');
        if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (explicit, init)`);
        return;
      }

      if (scriptReady && containerWidth > 0 && isVisible) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushSucceeded.current = true;
          if (IS_DEV) console.debug(`[AdSense] ${variant} → pushed OK`);
          startFillObservation();
        } catch (e) {
          if (IS_DEV) console.debug(`[AdSense] ${variant} → push error`, e);
          if (!isRetry) {
            trackTimeout(() => initAd(true), 2000);
          } else {
            // Push failed on retry — start slow retries instead of killing the slot
            startSlowRetries();
          }
        }
      } else if (!isRetry) {
        let retryCount = 0;
        const retryLoop = () => {
          if (abortRef.current || retryCount >= MAX_FAST_RETRIES) {
            if (retryCount >= MAX_FAST_RETRIES) {
              if (IS_DEV) console.debug(`[AdSense] ${variant} → fast retries exhausted, starting slow retries`);
              // Do NOT set unfilled — start slow retries instead
              startSlowRetries();
            }
            return;
          }
          retryCount += 1;
          trackTimeout(() => {
            if (abortRef.current) return;
            const el2 = adRef.current;
            if (!el2) return;

            if (isExplicitlyUnfilled(el2)) {
              setAdStatus('unfilled');
              if (IS_DEV) console.debug(`[AdSense] ${variant} → unfilled (explicit, fast retry)`);
              return;
            }

            const done = el2.getAttribute('data-adsbygoogle-status') === 'done';
            if (done) {
              pushSucceeded.current = true;
              startFillObservation();
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
                startFillObservation();
              } catch (e2) {
                if (IS_DEV) console.debug(`[AdSense] ${variant} → retry push error`, e2);
                retryLoop();
              }
            } else {
              retryLoop();
            }
          }, FAST_RETRY_INTERVAL);
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

  // Unfilled: collapse entirely
  if (adStatus === 'unfilled') return null;

  const adFormat = config.format === 'fluid' ? 'fluid' : config.format;
  const isFilled = adStatus === 'filled';

  return (
    <div
      ref={wrapperRef}
      className={`${config.wrapper} ${className}`}
      style={{ minHeight: `${config.filledMinHeight}px` }}
    >
      {isFilled && <AdLabel />}
      <ins
        key={insKey}
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          minHeight: `${config.insMinHeight}px`,
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
