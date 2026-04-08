

# Fix Inconsistent Hide-If-Empty in AdPlaceholder

## Root Causes Found (3 distinct bugs)

### Bug 1: False-positive fill detection
`hasRealFill()` (line 88-97) checks if **any** child element has `offsetHeight > 0`. AdSense routinely injects empty container `<div>`s with non-zero height even when no monetized ad fills. This causes the component to set `filled` state on slots with no real ad — showing the "Advertisement" label over blank space.

**Fix**: Require the presence of an `<iframe>` inside the `<ins>` element. Real AdSense fills always render via an iframe. An empty container div is not a fill.

### Bug 2: Loading state occupies layout space permanently
When `adStatus === 'loading'`, the wrapper renders with `opacity-0` but **still has min-height** (90px or 250px via both CSS classes and inline style). This is invisible but occupies vertical space — creating blank white rectangles in the layout. Slots that never enter the viewport stay in `loading` forever, permanently reserving space.

**Fix**: During `loading`, render with `height: 0; overflow: hidden` instead of `opacity-0` with min-height. This makes loading slots take zero layout space. When the ad fills, it expands naturally.

### Bug 3: No absolute maximum timeout
If a below-fold slot never enters the viewport, `hasBeenVisible` stays `false`, and the slot stays `loading` forever. The viewport-aware deferral has no upper bound.

**Fix**: Add an absolute maximum timeout (20 seconds from mount). If still `loading` after 20s regardless of viewport status, force `unfilled` → collapse.

## File Changed

`src/components/ads/AdPlaceholder.tsx` — only file.

## Exact Changes

### 1. Tighten `hasRealFill()` — require iframe
```typescript
function hasRealFill(el: HTMLElement): boolean {
  const status = el.getAttribute('data-adsbygoogle-status');
  if (status !== 'done') return false;
  // Real AdSense fills always contain an iframe
  const iframes = el.querySelectorAll('iframe');
  for (let i = 0; i < iframes.length; i++) {
    if (iframes[i].offsetHeight > 0 && iframes[i].offsetWidth > 0) return true;
  }
  // Also check for ins > div > iframe (nested containers)
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i] as HTMLElement;
    if (child.offsetHeight > 0 && child.querySelector('iframe')) return true;
  }
  return false;
}
```

### 2. Loading state: zero layout space
Replace the loading wrapper rendering (line 331-332):
- Remove `opacity-0` approach with min-height
- Use `height: 0; overflow: hidden` during loading so the wrapper takes no space
- When filled, render normally (no inline height constraint)

### 3. Add absolute max timeout (20s)
Inside the `useEffect`, after the stagger delay kickoff, add:
```typescript
trackTimeout(() => {
  if (abortRef.current) return;
  // Force unfilled if still loading after 20s
  setAdStatus(prev => prev === 'loading' ? 'unfilled' : prev);
}, 20000);
```

### 4. Remove min-height from wrapper CSS classes
The `variantConfig` wrapper strings include `min-h-[110px]` / `min-h-[280px]`. These force minimum height even after ads fill (which is fine) but also during loading (which is the bug). Move min-height to only apply in `filled` state via inline style instead of CSS classes, so the wrapper is truly zero-height during loading.

## Why Previous Logic Failed
- `offsetHeight > 0` on any child is too weak — AdSense injects empty wrappers with height
- `opacity-0` hides visually but doesn't collapse layout space
- No timeout ceiling means indefinite blank space for never-scrolled-to slots

## Why New Logic Is More Reliable
- Iframe check is the strongest client-side heuristic for real ad content
- Zero-height loading state means no blank space is ever visible regardless of fill timing
- 20s absolute cap guarantees eventual collapse for all edge cases
- Trade-off: minor CLS when a real ad fills (element goes from 0 to ad height), but this is far better than permanent blank holes across the site

## Edge Cases Still Remaining
- If AdSense ever changes to render ads without iframes (unlikely but possible) — would cause false negatives
- The 20s absolute timeout could collapse a very slow-loading below-fold ad — but 20s is generous
- CLS on fill is a trade-off accepted in favor of eliminating blank holes

