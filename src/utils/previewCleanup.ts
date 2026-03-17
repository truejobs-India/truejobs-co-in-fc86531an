const PRODUCTION_HOSTS = new Set(["truejobs.co.in", "www.truejobs.co.in"]);

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

export function cleanupPreviewRuntime(): void {
  if (typeof window === "undefined") return;
  if (PRODUCTION_HOSTS.has(window.location.hostname)) return;

  unregisterServiceWorkers();
  clearCaches();
}
