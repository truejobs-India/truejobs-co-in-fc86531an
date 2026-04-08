

# Fix Missing Sidebar & Footer Ads — Root Cause and Plan

## Root Cause: Both Placements

**Single root cause for both**: The loading-state wrapper renders with `opacity: 0` (line 385 of AdPlaceholder.tsx). This makes the entire ad container — including any real ad content that AdSense has already rendered — completely invisible until `hasRealFill()` confirms a fill and transitions the state to `filled`.

If AdSense renders ad content that doesn't trigger `hasRealFill()` (e.g., a child element with `offsetHeight` of exactly 0 or 1 during initial measurement, or a rendering path that takes longer than the 5s safety timeout), the slot stays in `loading` → `opacity: 0` → the ad is present in the DOM but invisible to the user forever.

This is a **revenue-destroying bug**: real ads are being served and impressions may be counted by AdSense, but users never see them — meaning zero clicks and wasted fill.

### Why the sidebar specifically
The sidebar has a 500ms stagger delay (highest after footer at 700ms). Combined with `opacity: 0` during loading and the requirement for `hasBeenVisible` to be true before fill observation even starts, the sidebar ad can easily get stuck invisible.

### Why the footer specifically
The footer has a 700ms stagger delay. It's at the bottom of the page, so `IntersectionObserver` may not fire `hasBeenVisible = true` until the user scrolls down. Without `hasBeenVisible`, `startFillObservation()` is never called even after `push()` succeeds (lines 309-311, 267-269). The ad fills, but the component never checks — so it stays `loading` (opacity 0) forever for users who don't scroll to the bottom.

## Fix

**File**: `src/components/ads/AdPlaceholder.tsx` — only file changed.

### Change 1: Remove `opacity: 0` from loading state (line 385)

Replace:
```
isLoading
  ? { minHeight: `${config.filledMinHeight}px`, opacity: 0 }
```
With:
```
isLoading
  ? { minHeight: `${config.filledMinHeight}px` }
```

The loading state now has reserved space AND is fully visible. If AdSense renders content, users see it immediately — no dependency on fill detection timing. The "Advertisement" label is already gated behind `isFilled` (line 391), so it won't appear prematurely.

### Change 2: Start fill observation regardless of viewport (lines 267-269, 309-311)

Currently, `startFillObservation()` only fires when `hasBeenVisible.current` is true. This means below-fold ads (footer, some sidebars) that receive a successful push never get their fill state confirmed, staying in `loading` forever.

Fix: call `startFillObservation()` unconditionally after a successful push. The viewport check should not gate fill observation — it should only affect collapse decisions (which it already does via the safety timeout logic).

Replace both instances of:
```typescript
if (hasBeenVisible.current) {
  startFillObservation();
}
```
With:
```typescript
startFillObservation();
```

This applies to lines 268-269, 298-300, 309-311, 340-341, 351, and the slow retry callback (lines 179, 193).

### What does NOT change
- Revenue-first philosophy unchanged
- No slot ever collapses unless AdSense explicitly signals `unfilled`
- Reserved space during loading remains
- Ad push fires immediately regardless of viewport (unchanged)
- Label still only appears on confirmed fill
- Retry strategy (fast + slow) unchanged
- No other files touched

### Verification reasoning
1. **Sidebar**: mounted inside `<aside className="hidden lg:block">` on 33+ pages. At lg+ viewport (user is at 1272px > 1024px), the aside is visible. With opacity fix, ad content is visible as soon as AdSense renders it. With fill observation fix, the component will confirm fill and show the label.
2. **Footer**: mounted in Layout.tsx for every page. With opacity fix, visible immediately. With fill observation fix, state transitions to `filled` even if user hasn't scrolled to the bottom.

