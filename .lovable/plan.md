

# Fix: All Manual AdSense Placements Rendering Reliably

## Root Causes Found

After auditing `AdPlaceholder.tsx`, `Layout.tsx`, `Index.tsx`, `index.html`, and 63 files using `AdPlaceholder`, here are the real issues:

### Bug 1: `pushed` ref prevents re-initialization forever
Once `push({})` is called (even if AdSense never actually fills the slot), `pushed.current = true` locks the component permanently. On SPA route changes where React reuses the same component instance (e.g. the footer ad inside `Layout.tsx`), the ad never re-initializes on subsequent pages.

### Bug 2: No SPA route-change awareness
The `useEffect` depends only on `[noAds, variant]`. Neither changes on navigation. For components that survive across routes (Layout's footer ad), the effect never re-runs.

### Bug 3: All 5+ slots fire `push({})` at the exact same 100ms
No staggering. AdSense processes pushes against `<ins>` elements in DOM order. When multiple fire simultaneously before the library has fully loaded, later pushes can silently fail or hit unprocessed elements.

### Bug 4: "Script present" ≠ "Script loaded"
The code checks `document.querySelector('script[src*="adsbygoogle"]')` — this confirms the `<script>` tag exists in DOM, but NOT that AdSense has actually executed. Pushing before execution queues items into a plain array, but AdSense's post-load processing of that backlog is unreliable for multiple slots.

### Bug 5: Only 3 retries (3 seconds total)
If AdSense takes >3s to load (common on slow connections or with ad blockers partially interfering), all slots give up permanently.

---

## Fix Plan

### Single file change: `src/components/ads/AdPlaceholder.tsx`

Complete rewrite of the initialization logic:

1. **Use `useLocation().pathname`** to detect route changes. Reset internal state and re-run initialization when the path changes. This fixes the Layout footer ad and any other persisted instances.

2. **Replace `pushed` ref with `data-adsbygoogle-status` DOM check.** AdSense sets `data-adsbygoogle-status="done"` on processed `<ins>` elements. Before calling `push({})`, check if the element already has this attribute. This is the authoritative signal — no guessing.

3. **Wait for actual script load, not just script presence.** Instead of checking for the `<script>` tag in DOM, check `typeof window.adsbygoogle?.push === 'function'` OR listen for the script's `load` event. Fallback: check if `window.adsbygoogle` has been replaced by AdSense's proxy (it becomes a non-plain-array object).

4. **Stagger initialization by variant.** Assign a base delay per variant to prevent all slots from competing:
   - `banner`: 150ms
   - `in-content`: 300ms  
   - `sidebar`: 500ms
   - `footer`: 700ms

5. **Increase retries to 8 with 1.5s intervals** (~12s total window). This covers slow script loads reliably.

6. **On route change, destroy and recreate the `<ins>` element** using a React `key` tied to pathname. This ensures AdSense sees a fresh, unprocessed element on every page — no stale `data-adsbygoogle-status` from a previous render.

7. **Enhanced debug logging** (dev only). Log: script loaded state, element width, adsbygoogle-status, push result, retry count, pathname. All behind the existing `IS_DEV` guard.

---

## Files Changed

| # | File | Change |
|---|---|---|
| 1 | `src/components/ads/AdPlaceholder.tsx` | Rewrite init logic: add useLocation, status-based push guard, staggered delays, increased retries, key-based remount |

**Total: 1 file, ~40 lines changed**

## Expected Result After Fix

| Slot | Desktop | Mobile |
|---|---|---|
| Banner (top) | ✓ shows | ✓ shows |
| In-content | ✓ shows | ✓ shows |
| Sidebar | ✓ shows (sticky) | Hidden by design (`hidden lg:block`) |
| Footer | ✓ shows | ✓ shows |

**Remaining limitations**: Ad blocker extensions will still block all ads. AdSense "no fill" (low demand for a slot) is server-side and cannot be fixed in code. New AdSense accounts may have limited fill rates for the first few weeks.

