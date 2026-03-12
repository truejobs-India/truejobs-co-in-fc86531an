import { useState, useEffect, useCallback } from 'react';

export type ConsentSignal = 'granted' | 'denied';

export interface ConsentState {
  ad_storage: ConsentSignal;
  analytics_storage: ConsentSignal;
  ad_personalization: ConsentSignal;
  ad_user_data: ConsentSignal;
}

interface StoredConsent extends ConsentState {
  timestamp: number;
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    adsbygoogle: unknown[];
  }
}

const STORAGE_KEY = 'cookieConsent';
const EXPIRY_DAYS = 180;
const GTAG_ID = 'AW-17816171399';
const ADSENSE_PUB = 'ca-pub-7353331010234724';

let scriptsInjected = false;

function injectScripts() {
  if (scriptsInjected) return;
  scriptsInjected = true;

  // Inject gtag.js
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
  document.head.appendChild(gtagScript);

  gtagScript.onload = () => {
    window.gtag('js', new Date());
    window.gtag('config', GTAG_ID);
  };

  // Inject adsbygoogle.js — ALWAYS loaded for non-personalized ads
  const adsScript = document.createElement('script');
  adsScript.async = true;
  adsScript.crossOrigin = 'anonymous';
  adsScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB}`;
  document.head.appendChild(adsScript);
}

function isExpired(timestamp: number): boolean {
  const now = Date.now();
  const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return now - timestamp > expiryMs;
}

function readStoredConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredConsent = JSON.parse(raw);
    if (!stored.timestamp || isExpired(stored.timestamp)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      ad_storage: stored.ad_storage,
      analytics_storage: stored.analytics_storage,
      ad_personalization: stored.ad_personalization,
      ad_user_data: stored.ad_user_data,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setConsent(stored);
      // Apply stored consent signals
      window.gtag('consent', 'update', {
        ad_storage: stored.ad_storage,
        analytics_storage: stored.analytics_storage,
        ad_personalization: stored.ad_personalization,
        ad_user_data: stored.ad_user_data,
      });
      // Always inject scripts when consent exists (even if denied — for non-personalized ads)
      injectScripts();
    }
    setIsLoaded(true);
  }, []);

  const updateConsent = useCallback((state: ConsentState) => {
    // Update gtag consent signals
    window.gtag('consent', 'update', {
      ad_storage: state.ad_storage,
      analytics_storage: state.analytics_storage,
      ad_personalization: state.ad_personalization,
      ad_user_data: state.ad_user_data,
    });

    // Store with timestamp
    const stored: StoredConsent = { ...state, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    setConsent(state);

    // Always inject scripts — Google handles personalized vs non-personalized server-side
    injectScripts();
  }, []);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConsent(null);
  }, []);

  return { consent, isLoaded, updateConsent, resetConsent };
}
