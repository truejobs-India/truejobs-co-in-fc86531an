function clearCaches(): void {
  if (!("caches" in window)) return;

  void caches.keys().then((keys) =>
    Promise.all(keys.map((key) => caches.delete(key))).catch(() => undefined),
  );
}

function unregisterServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;

  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())).catch(() => undefined),
    )
    .catch(() => undefined);
}

/**
 * Cleanup all service workers and caches on EVERY load.
 * PWA has been fully removed — no service workers should ever be active.
 */
export function cleanupPreviewRuntime(): void {
  if (typeof window === "undefined") return;

  // Always unregister any stale service workers (including on production)
  unregisterServiceWorkers();
  clearCaches();
}
