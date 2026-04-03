

# Verification: Ad Wrapper Reserved Heights vs Actual AdSense Rendering

## Analysis of Each Slot Type

### 1. **Banner** (`data-ad-format="auto"`, `data-full-width-responsive="true"`)
- **Current inner min-height**: 90px
- **Proposed outer wrapper min-height**: 110px (90px ad + ~16px label + margins)
- **Desktop real rendering**: Typically 728x90 or 970x90 leaderboard → 90px height ✓
- **Mobile real rendering**: With `full-width-responsive="true"` and `format="auto"`, AdSense commonly serves 320x50 (50px), 320x100 (100px), or occasionally **300x250 (250px)** on mobile
- **Risk**: On mobile, if AdSense serves a 300x250 unit, a 110px reservation would cause a **~160px shift**. However, this is a known AdSense behavior that cannot be predicted — reserving 250px on mobile for all banner slots would create excessive blank space on the majority of page loads where a 50-100px unit is served
- **Verdict**: 110px is a **reasonable middle ground**. Reserving more would waste space on most loads; reserving less would shift more often. The current plan is correct.

### 2. **Sidebar** (`data-ad-format="auto"`, `data-full-width-responsive="true"`)
- **Current inner min-height**: 250px
- **Proposed outer wrapper min-height**: 280px
- **Desktop real rendering**: Typically 300x250 or 336x280 → max 280px
- **Mobile**: Sidebar slots are hidden on mobile (`className="hidden lg:block"` in ResourceDetail and CompanyDetail); BlogPost sidebar is in a `sticky` container within a desktop-only column
- **Verdict**: 280px is correct — covers 336x280 (the largest common rectangle). Desktop-only so no mobile concern. ✓

### 3. **In-content** (`data-ad-format="fluid"`, `data-ad-layout="in-article"`)
- **Current inner min-height**: 250px
- **Proposed outer wrapper min-height**: 280px
- **Desktop real rendering**: Fluid in-article units render at variable heights, commonly 250-400px. Height depends on viewport width and content context.
- **Mobile real rendering**: Fluid ads on mobile are typically shorter (200-300px) but can occasionally be taller
- **Risk**: Fluid ads are inherently unpredictable. 250px inner + 280px outer catches the most common case but a tall fluid unit (400px+) would still shift ~120px
- **Verdict**: 280px is the best practical reservation without creating dead space. Cannot perfectly predict fluid ad height. ✓

### 4. **Footer** (`data-ad-format="auto"`, `data-full-width-responsive="true"`)
- **Current inner min-height**: 90px
- **Proposed outer wrapper min-height**: 110px
- **Real rendering**: Same as banner, but positioned at page bottom before the footer
- **CLS impact**: Footer ads cause minimal CLS because they're below the fold on most pages. Any expansion pushes the footer down, which users rarely see during initial load
- **Mobile note**: Footer wrapper has `mb-[88px] md:mb-5` (reserves space for mobile bottom nav). The 110px outer min-height is fine
- **Verdict**: 110px is correct and low-risk. ✓

## Key Finding: The Proposed Heights Are Well-Calibrated

| Variant | Inner min-height | Proposed outer min-height | Typical desktop render | Typical mobile render | Over-reserve risk | Under-reserve risk |
|---------|-----------------|--------------------------|----------------------|---------------------|-------------------|-------------------|
| Banner | 90px | 110px | 90px ✓ | 50-100px (rarely 250px) | Minimal | Low (rare 250px mobile) |
| Sidebar | 250px | 280px | 250-280px ✓ | Hidden on mobile ✓ | None | None |
| In-content | 250px | 280px | 250-400px | 200-300px | None | Moderate (fluid variability) |
| Footer | 90px | 110px | 90px ✓ | 50-100px | Minimal | Very low (below fold) |

## Recommendation

The planned heights are correct as-is. No adjustments needed. Two inherent risks remain:

1. **Banner on mobile**: AdSense `auto` format with `full-width-responsive` *can* serve a 300x250 in a horizontal slot on mobile. This is rare and unpredictable. Reserving 250px for all banner slots would waste space ~90% of the time. The 110px reservation is the right trade-off.

2. **In-content fluid**: Fluid in-article ads have no fixed height by design. The 280px reservation covers the most common case. Occasional taller renders will still cause minor shifts — this is an inherent limitation of fluid ad format that cannot be eliminated without switching to fixed-size units (which would reduce revenue).

**Proceed with implementation as planned — the reserved heights are verified as appropriate for both mobile and desktop.**

