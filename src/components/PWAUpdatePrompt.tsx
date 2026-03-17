import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

export function PWAUpdatePrompt() {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    // @ts-ignore – virtual module only exists when VitePWA plugin is active (production build)
    import('virtual:pwa-register').then((mod: any) => {
      const updateSW = mod.registerSW({
        onNeedRefresh() {
          if (shownRef.current) return;
          shownRef.current = true;
          toast({
            title: 'Update available',
            description: 'A new version of TrueJobs is ready.',
            action: (
              <button
                onClick={() => updateSW?.(true)}
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
      // virtual:pwa-register not available – expected in dev
    });
  }, []);

  return null;
}
