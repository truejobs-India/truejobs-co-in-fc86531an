/**
 * PWA install hook — disabled.
 * PWA has been fully removed. This stub prevents import errors
 * in AppDownloadSection while returning inert values.
 */
export function usePWAInstall() {
  return {
    isInstallable: false,
    isInstalled: false,
    isIOS: false,
    installApp: async () => false,
  };
}
