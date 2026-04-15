

# Fix: Government Job Cards Not Clickable + Add 3D Styling

## Root Cause

All 8 latest `employment_news_jobs` rows have `slug = NULL`. The current link logic is:
```jsx
<Link to={job.slug ? `/jobs/employment-news/${job.slug}` : '#'}>
```
Since `slug` is always null, every card links to `#` — effectively not clickable. The detail page (`EmploymentNewsJobDetail.tsx`) already supports UUID-based lookup (line 30), so we can safely link by `id` when `slug` is missing.

## Changes — Single File: `src/components/home/LatestGovtJobs.tsx`

**1. Fix the link target** — fall back to `id` when `slug` is null:
```jsx
<Link to={`/jobs/employment-news/${job.slug || job.id}`}>
```

**2. Add 3D card styling + click animation** via Tailwind classes on the Card:
```
cursor-pointer rounded-xl border border-border border-b-4 border-b-primary/20
shadow-md hover:shadow-lg hover:-translate-y-1
active:scale-[0.97] active:shadow-sm
transition-all duration-200
```

**3. Add `block` to the Link** to ensure full card area is clickable.

That's it — one file, two lines changed.

