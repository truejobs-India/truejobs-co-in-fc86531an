import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

export function PWAUpdatePrompt() {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          if (shownRef.current) return;
          shownRef.current = true;
          toast({
            title: 'Update available',
            description: 'A new version of TrueJobs is ready.',
            action: (
              <button
                onClick={() => updateSW?.()}
                className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              >
                Update
              </button>
            ),
            duration: Infinity as any,
          });
        },
      });
    }).catch(() => {
      // virtual:pwa-register not available in dev – expected
    });

    let updateSW: (() => Promise<void>) | undefined;
  }, []);

  return null;
}
