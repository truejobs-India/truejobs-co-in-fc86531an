import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const shownRef = useRef(false);

  useEffect(() => {
    if (needRefresh && !shownRef.current) {
      shownRef.current = true;
      toast({
        title: 'Update available',
        description: 'A new version of TrueJobs is ready.',
        action: (
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            Update
          </button>
        ),
        duration: Infinity as any,
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
