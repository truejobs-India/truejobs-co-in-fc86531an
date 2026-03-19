import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isIOS = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const mq = window.matchMedia("(display-mode: standalone)");
    const mqHandler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      mq.removeEventListener("change", mqHandler);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    installApp,
  };
}
