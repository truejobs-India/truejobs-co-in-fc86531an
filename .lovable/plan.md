

# Add Google AdSense Auto-Ads Script to `index.html`

## Change

**File:** `index.html`  
**Location:** Line 75-76, between the closing `</script>` of OneSignal and `</head>`

**Add these 3 lines:**

```html
    <!-- Google AdSense Auto Ads -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7353331010234724"
         crossorigin="anonymous"></script>
```

So lines 75-76 change from:
```html
    </script>
  </head>
```
to:
```html
    </script>
    <!-- Google AdSense Auto Ads -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7353331010234724"
         crossorigin="anonymous"></script>
  </head>
```

## Verification after deployment

1. **Homepage (`/`)** — edge-rendered SEO page. View source → confirm the AdSense script is in `<head>`. Check browser DevTools Network tab for `adsbygoogle.js` loading.
2. **One SEO page (e.g. `/jobs`)** — same checks. The `_worker.js` merge preserves all original `<head>` scripts.
3. **One SPA page (e.g. `/dashboard`)** — served directly from `index.html`. Same checks.

## Next step after deployment

Wait 24-48 hours for AdSense to crawl and start placing auto-ads. Check your AdSense dashboard for ad impressions.

