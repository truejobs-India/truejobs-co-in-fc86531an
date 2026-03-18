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
 * Remove any stale <link rel="manifest"> tags that third-party scripts
 * (like OneSignal) may have injected at runtime. A manifest.json triggers
 * "Add to Home Screen" / "Update available" prompts in browsers.
 */
function removeManifestLinks(): void {
  document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
}

/**
 * Cleanup all service workers, caches, and PWA artifacts on EVERY load.
 * PWA and OneSignal have been fully removed — no service workers,
 * manifests, or consent banners should ever be active.
 */
export function cleanupPreviewRuntime(): void {
  if (typeof window === "undefined") return;

  unregisterServiceWorkers();
  clearCaches();
  removeManifestLinks();
}
