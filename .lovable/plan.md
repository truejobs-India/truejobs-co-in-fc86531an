

# Remove Cookie Consent System & Add PWA Cache-Busting

## 1. Update `src/components/layout/Layout.tsx`
- Remove `CookieConsentBanner` import (line 6)
- Remove `showConsent` prop from interface and destructuring (lines 14, 17)
- Remove `{showConsent && <CookieConsentBanner />}` (line 26)

## 2. Update `src/components/layout/Footer.tsx`
- Remove `useCookieConsent` import (line 8)
- Remove `Cookie` from lucide-react import (line 5)
- Delete entire `CookieSettingsButton` component (lines 10-21)
- Remove `<CookieSettingsButton />` from the footer bottom links (line ~236)

## 3. Update `src/components/ads/AdPlaceholder.tsx`
- Remove `useCookieConsent` import (line 8)
- Remove `consent`/`isLoaded` destructuring (line 56)
- Remove consent-null and isLoaded guards (lines 71-80)
- Keep `noAds` and `adsVisible` guards intact
- Update file comment to remove consent references

## 4. Delete files
- `src/components/CookieConsentBanner.tsx`
- `src/hooks/useCookieConsent.ts`

## 5. Update `vite.config.ts`
- Add `skipWaiting: true` and `clientsClaim: true` inside the `workbox` block (after line 52)

## Preserved
- `index.html` consent-mode bootstrap script — unchanged (all storage denied by default)

