

# Add SEOCacheBuilder to Admin SEO Tab

## What's happening

The admin dashboard has an **SEO** tab (the tab with a trend icon labeled "SEO"). Inside that tab, `SEOCacheManager` IS rendered — it's the card titled "SEO Static HTML Cache" with Refresh, Rebuild All, Force Rebuild, and Purge All CF buttons.

However, the **SEOCacheBuilder** component — which contains the "Build SEO Cache" button for inventory-sourced pages (cities, combos, hubs, and the 4 new standalone pages) — exists in the codebase but is **never rendered** in the admin dashboard.

**To find the existing SEO tools**: Click the **"SEO"** tab in your admin panel tab bar. You should see the SEO Cache Manager card there. If the tab label is hidden, look for the trend-line icon (📈).

## Plan

### File: `src/pages/admin/AdminDashboard.tsx`

Two changes:

1. **Add import** (around line 48):
   ```
   import { SEOCacheBuilder } from '@/components/admin/SEOCacheBuilder';
   ```

2. **Add component** after `SEOCacheManager` (line 368-369):
   ```
   <SEOContentHealth />
   <SEOCacheManager />
   <SEOCacheBuilder />    ← NEW
   <GuideGenerator />
   <GSCUrlExport />
   ```

### Result

The SEO tab will now show both:
- **SEO Static HTML Cache** (SEOCacheManager) — for DB-sourced rebuilds, purge, export
- **Build SEO Cache** (SEOCacheBuilder) — for inventory-sourced pages including the 4 new hub pages

No other files changed. Purely additive — zero regression risk.

