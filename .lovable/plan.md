

# Revised Homepage Sidebar Viewability Fix

## Problem

The hero section (lines 24-35) and top banner ad (lines 37-40) sit **outside** the sidebar grid (lines 43-79). The sidebar's sticky range is bounded by the grid container's height. Content outside the grid does not contribute to the sidebar's scroll persistence.

## The Key Structural Insight

The fix is not to move the banner **into the left column** (which would narrow it from full container width to `1fr` minus 300px). Instead, move the **entire grid start point upward** so that both the hero and the banner are **inside** the same grid container — but spanning the **full width** across both columns.

In CSS Grid, an element can span all columns (`lg:col-span-2` across a `[1fr_300px]` grid) and still render at full grid width. This means:

- The banner keeps its full container width (identical to today)
- The banner's ~130px height now contributes to the grid's total height
- The sidebar's sticky range increases by ~130px

We can also pull the hero section inside the grid with full-span, adding another ~400px to the grid height — but only if that doesn't break the hero's internal 2fr/1fr layout.

## Revised Plan — Single File: `src/pages/Index.tsx`

### Change

Merge the top banner ad into the sidebar grid as a **full-width row spanning both columns**:

```
Before (current):
  <Hero />                    ← outside grid
  <Banner ad />               ← outside grid (~130px wasted)
  <Grid [1fr | 300px]>
    <Left column>...</Left>
    <Aside sticky />
  </Grid>

After (revised):
  <Hero />                    ← stays outside (has its own internal grid)
  <Grid [1fr | 300px]>
    <div class="lg:col-span-2">   ← full-width row inside grid
      <Banner ad />               ← same width as before, now adds to grid height
    </div>
    <Left column>...</Left>
    <Aside sticky />
  </Grid>
```

The grid becomes `lg:grid-cols-[1fr_300px]` with the banner as the first row spanning both columns via `lg:col-span-2`. The banner renders at `1fr + 300px + gap = full container width` — identical to its current width.

### Why the banner is not weakened

- `lg:col-span-2` on a `[1fr_300px]` grid = `1fr + 300px + 6px gap` = the full grid width, which equals the container width. The banner is the same width as today.
- On mobile (`grid-cols-1`), `col-span-2` has no effect — it stacks normally. No mobile change.
- The banner's AdSense slot ID, variant, and rendering logic are untouched.

### Why sidebar persistence improves

The banner's ~130px height is now **inside** the grid container. The sidebar's sticky element is bounded by the grid container's height. Adding ~130px to the grid height adds ~130px of sticky scroll range. Combined with the 10 content sections already in the left column (~2300px estimated), the sidebar gets meaningful persistence.

### Why this is safer than moving the banner into the left column

| Approach | Banner width | Revenue risk |
|---|---|---|
| Move into left column (`1fr` = ~container minus 306px) | **Narrower** by ~306px | Banner CPM/CTR may drop |
| Full-span row inside grid (`lg:col-span-2`) | **Same** as today | Zero revenue risk |

The full-span approach preserves the banner's width, viewability, and value while still contributing its height to the sidebar's sticky range.

## Whether any min-height fallback is needed

Not proposed at this stage. The left column has 10 content sections plus 3 ad placements. With the banner now also contributing to grid height, the total grid height should comfortably exceed 2000px. If post-implementation measurement shows otherwise, a minimal fallback can be proposed then — but it is unlikely to be needed.

## Approval Readiness

This plan is approval-ready:
- Banner keeps full width (zero revenue risk)
- Sidebar gains ~130px of sticky persistence naturally
- No artificial min-height
- No layout redesign
- Single file change (`src/pages/Index.tsx`)
- Mobile layout unaffected

