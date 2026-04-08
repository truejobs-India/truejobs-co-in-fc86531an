

# Add Slow Fallback Retries + Revenue-First Corrections

## File: `src/components/ads/AdPlaceholder.tsx` — only file changed.

## 5 Problems in Current Code

1. **Line 353**: `height: 0; overflow: hidden` during loading — `<ins>` has zero dimensions, AdSense cannot measure/fill it.
2. **Lines 321-326**: 20s absolute timeout forces `unfilled` — kills slots that haven't had a fair chance.
3. **Lines 268-270, 280-282**: Fast retry exhaustion and push errors set `unfilled` — slot dies permanently with no further attempts.
4. **Lines 185-186**: 5s fill-check timeout sets `unfilled` without checking for AdSense's explicit `unfilled` signal.
5. **No slow fallback retries**: After 8 fast retries (12s), if push never succeeded, the slot is abandoned forever. AdSense script may become ready later but no code path will attempt push again.

## Changes

### 1. Add `SLOW_RETRY_INTERVAL` constant
```
const SLOW_RETRY_INTERVAL = 8000; // 8s between fallback retries
```

### 2. Add `slowRetryRef` to track the interval ID for cleanup
```
const slowRetryRef = useRef<number | null>(null);
```

### 3. Restore reserved space during loading (lines 351-357)
Replace `height: 0; overflow: hidden` with reserved min-height + `opacity: 0`:
```
isLoading
  ? { minHeight: `${config.filledMinHeight}px`, opacity: 0 }
  : isFilled
    ? { minHeight: `${config.filledMinHeight}px` }
    : undefined
```
Also give `<ins>` its minHeight during loading:
```
minHeight: (isFilled || isLoading) ? `${config.insMinHeight}px` : undefined,
```

### 4. Delete 20s absolute timeout (lines 321-326)
Remove entirely. No timeout should force `unfilled`.

### 5. Remove `setAdStatus('unfilled')` from retry exhaustion (lines 268-270, 280-282)
- Line 268-270: push error retry path — instead of setting unfilled, start slow fallback retries.
- Line 280-282: fast retry exhaustion — instead of setting unfilled, start slow fallback retries.

### 6. Add slow fallback retry function
After fast retries exhaust without success, start `setInterval` at 8s:
```typescript
const startSlowRetries = () => {
  if (slowRetryRef.current !== null) return; // already running
  slowRetryRef.current = window.setInterval(() => {
    if (abortRef.current || pushSucceeded.current) {
      if (slowRetryRef.current !== null) {
        clearInterval(slowRetryRef.current);
        slowRetryRef.current = null;
      }
      return;
    }
    const el = adRef.current;
    if (!el) return;
    // Check if AdSense explicitly marked unfilled
    if (el.getAttribute('data-adsbygoogle-status') === 'unfilled') {
      setAdStatus('unfilled');
      clearInterval(slowRetryRef.current!);
      slowRetryRef.current = null;
      return;
    }
    // Check if already done (filled externally)
    if (el.getAttribute('data-adsbygoogle-status') === 'done') {
      pushSucceeded.current = true;
      if (hasBeenVisible.current) startFillObservation();
      clearInterval(slowRetryRef.current!);
      slowRetryRef.current = null;
      return;
    }
    // Attempt push if conditions are met
    const ready = isAdSenseReady();
    const width = el.offsetWidth ?? 0;
    if (ready && width > 0) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushSucceeded.current = true;
        if (hasBeenVisible.current) startFillObservation();
        clearInterval(slowRetryRef.current!);
        slowRetryRef.current = null;
      } catch { /* continue retrying */ }
    }
  }, SLOW_RETRY_INTERVAL);
};
```

### 7. Fix fill-check safety timeout (lines 185-186)
Only set `unfilled` if AdSense explicitly signals it:
```typescript
} else if (el?.getAttribute('data-adsbygoogle-status') === 'unfilled') {
  setAdStatus('unfilled');
}
// else: stay 'loading' — uncertain, keep reserved
```

### 8. Broaden `hasRealFill()` (lines 91-106)
Accept any child with `offsetHeight > 1` when status is `done`, not iframe-only:
```typescript
function hasRealFill(el: HTMLElement): boolean {
  const status = el.getAttribute('data-adsbygoogle-status');
  if (status !== 'done') return false;
  for (let i = 0; i < el.children.length; i++) {
    if ((el.children[i] as HTMLElement).offsetHeight > 1) return true;
  }
  return false;
}
```

### 9. Cleanup includes slow retry interval
In `cleanup()`, add:
```typescript
if (slowRetryRef.current !== null) {
  clearInterval(slowRetryRef.current);
  slowRetryRef.current = null;
}
```

## Retry Lifecycle (mount → resolution)

```text
Mount
  ↓ stagger delay (150-700ms)
  ↓
Phase 1: Fast retries (up to 8 × 1.5s = 12s)
  ├─ push succeeds → start fill observation → done
  ├─ push error → retry
  └─ retries exhaust → Phase 2
  ↓
Phase 2: Slow fallback retries (every 8s, indefinitely)
  ├─ push succeeds → fill observation → done
  ├─ status="unfilled" detected → collapse → done
  ├─ status="done" detected → fill observation → done
  └─ unmount/route change → cleanup → done
```

## Duplicate Push Prevention
- `pushSucceeded.current` is checked at the top of every retry. Once true, slow retries self-terminate via the guard clause. Fast retries also check `alreadyDone` status.

## Why Safer for Revenue
- Current code: after 12s of fast retries, slot is abandoned forever — if AdSense loads at 15s, the ad is permanently missed.
- New code: slow retries continue attempting push every 8s — if AdSense loads at 15s, 30s, or 60s, the next retry will succeed.
- No code path sets `unfilled` except explicit AdSense signal.
- Reserved space ensures AdSense always has a measurable container.

## Remaining Edge Cases
- Slot may hold reserved invisible space indefinitely if AdSense never fills and never signals `unfilled`. Acceptable per revenue-first priority.
- Very slow connections where AdSense script loads after minutes — slow retries will still catch it.

