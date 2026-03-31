

# Add Sequential Numbering to SEO Section Buttons

## What & Why
The SEO section has two cards with multiple action buttons. Users need to know the correct order of operations. We will prefix button labels with step numbers indicating the workflow sequence.

## Verified Workflow Sequence

| Step | Button | Card | What it does |
|---|---|---|---|
| **①** | Build SEO Cache | SEOCacheBuilder | Generates HTML for inventory-sourced pages (cities, hubs, combos, deadlines, standalone pages) |
| **②** | Rebuild All | SEOCacheManager | Regenerates HTML for DB-sourced pages (blog, govt-exam, employment-news). Skips unchanged. |
| **③** | Purge All CF | SEOCacheManager | Clears Cloudflare CDN so visitors/bots get the fresh content |

### Buttons that do NOT get numbers (utility/alternative actions):
- **Refresh** — just reloads the stats table, can be used anytime
- **Force Rebuild** — alternative to step ②, used only when templates changed but data hasn't. Will get label "②⚡ Force Rebuild" to show it's an alternative to step 2
- **Export** — data export utility, no sequence dependency
- **Rebuild [slug]** in SEOCacheBuilder — single-slug tool, no sequence dependency
- **Rebuild All** in SEOCacheBuilder — same function as step ②, will get "② Rebuild All" to stay consistent

## Files Changed

### 1. `src/components/admin/SEOCacheBuilder.tsx`
- Line 531: `Build SEO Cache` → `① Build SEO Cache`
- Line 534: `Rebuild All` → `② Rebuild All`

### 2. `src/components/admin/seo-cache/SEOCacheManager.tsx`
- Line 186: `Rebuild All` → `② Rebuild All`
- Line 213: `Force Rebuild` → `②⚡ Force Rebuild`
- Line 237: `Purge All CF` → `③ Purge All CF`

## Risk
Minimal — label-only changes, no logic affected.

