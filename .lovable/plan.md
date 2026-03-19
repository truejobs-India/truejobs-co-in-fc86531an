

## Re-enable PWA with injectManifest + Custom Service Worker

### What this does
Makes TrueJobs installable as a PWA with offline-capable public browsing, while keeping all sensitive flows (admin, auth, employer, tools, mutations, API calls) strictly network-dependent. Updates are silent — no "Update available" prompt. When you Publish, users get the new version automatically on next navigation.

### Files to create (3)

**1. `public/manifest.webmanifest`**
Standard web app manifest with TrueJobs branding, standalone display, `#2563eb` theme, icons at 192 and 512 reusing existing `/pwa-icon.png` with `"any maskable"` purpose.

**2. `src/sw.ts`** — Custom Workbox service worker
- Imports from `workbox-core`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-navigation-preload`
- Calls `cleanupOutdatedCaches()`, `precacheAndRoute(self.__WB_MANIFEST)`, `self.skipWaiting()`, `clientsClaim()`, enables navigation preload

Route registration order:

| # | Match | Strategy | Details |
|---|-------|----------|---------|
| A | Non-GET requests | NetworkOnly | Custom match on `request.method !== 'GET'` |
| B | Supabase `/rest/v1/` and `/functions/v1/` | NetworkOnly | URL string match |
| C | Sensitive nav paths (`/admin`, `/dashboard`, `/employer`, `/login`, `/signup`, `/phone-signup`, `/forgot-password`, `/profile`, `/enrol-now`, `/tools/resume-builder`, `/tools/resume-checker`, `/auth/callback`) | NetworkOnly | Navigation request + URL path match |
| D | `fonts.googleapis.com` | StaleWhileRevalidate | Cache: `google-fonts-stylesheets` |
| E | `fonts.gstatic.com` | CacheFirst | Cache: `google-fonts-webfonts`, 30 entries, 365d |
| F | Images (png/jpg/jpeg/webp/svg/ico) | CacheFirst | Cache: `images`, 200 entries, 30d |
| G | JS/CSS | StaleWhileRevalidate | Cache: `static-assets` |
| H | Other navigation | NetworkFirst | 3s timeout |

Navigation fallback via `NavigationRoute` with `createHandlerBoundToURL('/index.html')` and a denylist regex excluding `/admin`, `/dashboard`, `/employer`, `/login`, `/signup`, `/phone-signup`, `/forgot-password`, `/profile`, `/enrol-now`, `/tools/`, `/auth/`, `/api/`, `/rest/`, `/functions/`.

**3. `src/pwa.d.ts`** — Replace with module declaration for `virtual:pwa-register`.

### Files to modify (6)

**4. `package.json`**
- devDependencies: add `vite-plugin-pwa`
- dependencies: add `workbox-core`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-navigation-preload`

**5. `vite.config.ts`**
Add `VitePWA` plugin with `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, `registerType: 'autoUpdate'`, `injectManifest.maximumFileSizeToCacheInBytes: 5MB`, `manifest: false`, `devOptions.enabled: false`.

**6. `index.html`**
Add after the theme-color meta tag:
- `<link rel="manifest" href="/manifest.webmanifest">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`

**7. `src/main.tsx`**
- Remove `cleanupPreviewRuntime` import and call
- Add `import { registerSW } from 'virtual:pwa-register'` and `registerSW({ immediate: true })` — no `onNeedRefresh`, purely silent

**8. `src/utils/previewCleanup.ts`**
Rewrite to only clean third-party artifacts:
- `unregisterServiceWorkers`: skip SWs ending with `/sw.js`
- `clearCaches`: only delete keys containing `onesignal` (case-insensitive)
- `removeManifestLinks`: only remove links whose href ≠ `/manifest.webmanifest`
- Keep exported but no longer called from `main.tsx`

**9. `src/hooks/usePWAInstall.ts`**
Restore real logic with `useEffect`/`useState`:
- `beforeinstallprompt` listener → store deferred prompt → `isInstallable: true`
- `isInstalled`: `matchMedia('(display-mode: standalone)')` or `navigator.standalone`
- `isIOS`: UA detection
- `installApp()`: call `prompt()`, await `userChoice`, return outcome
- Cleanup on unmount

### TypeScript compatibility
`tsconfig.app.json` currently has `lib: ["ES2020", "DOM", "DOM.Iterable"]`. The SW file needs `WebWorker` types but it runs in a different context. Since `vite-plugin-pwa` with `injectManifest` compiles `src/sw.ts` separately using its own tsconfig (via Rollup), and `skipLibCheck: true` is already set, the build will succeed. The SW file will use `declare const self: ServiceWorkerGlobalScope` at the top for type safety without modifying the app's tsconfig.

### What stays unchanged
- `usePushNotifications.ts` — remains inert stub
- All routes, components, admin logic, Cloudflare Pages worker
- No broad cache clearing or SW unregistration reintroduced

### Update behavior after Publish
1. New assets deploy with new content hashes
2. Browser detects updated precache manifest on next visit
3. New SW installs → `skipWaiting()` + `clientsClaim()` → immediately active
4. No toast, no prompt, no manual action required
5. User gets new version on next navigation/reload
6. Already-open tabs are controlled by new SW on next fetch cycle

