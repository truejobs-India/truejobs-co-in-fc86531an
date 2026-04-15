

# Redesign: "Latest Government Jobs" → Horizontal Row Layout

## Scope
Single file only: `src/components/home/LatestGovtJobs.tsx`. No other files touched. Index.tsx, ad placements, other sections all unchanged.

## Design (inspired by reference file, written from scratch with real data)

```text
┌──────────────────────────────────────────────────────────────┐
│ ▓▓▓ Indian flag accent strip (saffron → white → green)  ▓▓▓ │
├──────────────────────────────────────────────────────────────┤
│  Latest Government Jobs                     [View All →]     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🏛 org_name              vacancies · state   [badge]  │  │
│  │   post                                   [View Job →] │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🏛 org_name ...                          [View Job →] │  │
│  └────────────────────────────────────────────────────────┘  │
│  ... (8 rows, 2 columns on xl)                               │
└──────────────────────────────────────────────────────────────┘
```

## Visual Details
- **Outer container:** `rounded-2xl border border-slate-200 bg-white shadow` with a 1.5px tri-color top strip (`from-orange-500 via-white to-emerald-600`).
- **Each row:** `rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-white` with hover lift.
- **Left icon:** Orange-tinted circle with `BriefcaseBusiness` icon.
- **Title:** `org_name` — bold, truncated. **Subtitle:** `post` — muted, truncated.
- **Meta:** vacancies + state with icons.
- **Badge:** Derived from real data — "Apply Now" if last_date exists & future, "Trending" if vacancies > 500, else hidden.
- **CTA:** Orange `View Job →` button, right-aligned on desktop, full-width stacked on mobile.
- **Grid:** `grid-cols-1 xl:grid-cols-2 gap-3` inside the container.
- **Loading:** 4 skeleton rows at `h-[72px]` matching row height for CLS safety.
- **Header:** "View All" pill links to `/sarkari-jobs`.

## Data & Routing
- Same Supabase query, same fields, same `limit(8)`.
- Same link: `/jobs/employment-news/${job.slug || job.id}`.
- Badge logic uses real `last_date_resolved` and `vacancies` fields.

## AdSense Safety
- Section `py-8` preserved — identical spacing around adjacent ad slots.
- No ad containers moved or resized.
- Section occupies the same grid cell in Index.tsx.
- CLS-safe skeleton heights match final row heights.

## Technical
- No new dependencies. Uses `BriefcaseBusiness`, `MapPin`, `ArrowRight` from lucide-react.
- Uses `Link` from react-router-dom (not `<a>`).
- ~110 lines, single file replacement.

