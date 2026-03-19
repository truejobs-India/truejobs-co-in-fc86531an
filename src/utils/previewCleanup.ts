/**
 * Clean up only third-party artifacts (e.g. OneSignal).
 * Does NOT touch our own service worker (/sw.js) or manifest.
 */

function clearThirdPartyCaches(): void {
  if (!("caches" in window)) return;

  void caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((key) => /onesignal/i.test(key))
        .map((key) => caches.delete(key)),
    ).catch(() => undefined),
  );
}

function unregisterThirdPartyServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;

  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations
          .filter((reg) => !reg.active?.scriptURL.endsWith("/sw.js"))
          .map((reg) => reg.unregister()),
      ).catch(() => undefined),
    )
    .catch(() => undefined);
}

function removeThirdPartyManifestLinks(): void {
  document.querySelectorAll('link[rel="manifest"]').forEach((el) => {
    const href = (el as HTMLLinkElement).getAttribute("href");
    if (href && href !== "/manifest.webmanifest") {
      el.remove();
    }
  });
}

export function cleanupPreviewRuntime(): void {
  if (typeof window === "undefined") return;

  unregisterThirdPartyServiceWorkers();
  clearThirdPartyCaches();
  removeThirdPartyManifestLinks();
}
