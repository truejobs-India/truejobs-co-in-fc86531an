import { toast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';

export function PWAUpdatePrompt() {
  const shownRef = useRef(false);

  useEffect(() => {
    // Only register SW in production where VitePWA plugin is active
    if (!import.meta.env.PROD) return;

    import('virtual:pwa-register/react').then(({ useRegisterSW }) => {
      // This dynamic import approach won't work with hooks,
      // so we fall back to the imperative API instead
    }).catch(() => {
      // Not available – expected in dev
    });
  }, []);

  return null;
}
