

# Revised Plan — Footer Diagnosis + Fill Detection

## 1. Why the previous footer diagnosis was too weak

`mb-[88px]` is a **bottom margin** on the ad wrapper. It pushes the `<Footer>` component down by 88px, but the ad element itself remains at its normal position between `<main>` and `<Footer>`. A bottom margin does not hide, clip, or collapse the element above it. The ad wrapper still renders with `minHeight: 110px` at its correct position.

The JobSearchBot is `position: fixed` (line 263 of JobSearchBot.tsx) — it is out of document flow. No margin compensation is needed in the layout for it.

Therefore, `mb-[88px]` is cosmetically wasteful but **cannot be the root cause** of a site-wide invisible footer ad.

## 2. Corrected footer diagnosis — actual possible failure modes

The footer ad at Layout.tsx line 21 renders `<AdPlaceholder variant="footer" />` between `<main className="flex-1">` and `<Footer>`. On production (`IS_PROD_DOMAIN` true), this renders a wrapper div with `minHeight: 110px`.

The most likely failure modes, in order of probability:

| # | Failure mode | Evidence needed |
|---|---|---|
| A | AdSense never fills this slot (no demand / low-priority slot ID) | Check `data-adsbygoogle-status` on live production DOM |
| B | Slot stays in `loading` forever — push() succeeds but AdSense never responds with `done` or `unfilled` | Check production DOM for status attribute value |
| C | Slot gets explicit `unfilled` → component returns null → invisible (correct behavior but means lost inventory) | Check if the element is absent from DOM entirely |
| D | Push() never succeeds despite retries (script load race, width=0 at init) | Check console debug logs on production |
| E | The wrapper is rendered but visually unnoticeable (110px of blank space between main content and footer that users scroll past) | Visual inspection of the area above the footer |

**What the plan must do:** Investigate on production before making code changes. The `mb-[88px]` can be cleaned up (it's unnecessary since JobSearchBot is fixed-position), but this is a cosmetic fix, not the root cause fix.

### Corrected footer fix plan

1. **Diagnostic step (browser verification on production):** Navigate to truejobs.co.in, scroll to the footer area, and inspect:
   - Is the footer ad wrapper div present in DOM?
   - What is `data-adsbygoogle-status` on the `<ins>` element?
   - Does the wrapper have visible reserved space (110px)?
   - Is there an iframe inside?

2. **Code-level fix (regardless of diagnosis):** Clean up `mb-[88px] md:mb-5` → `mb-2` since the JobSearchBot is `position: fixed` and doesn't need layout compensation. This is a minor cleanup, not a root cause fix.

3. **If the slot is `unfilled` (mode C):** This is correct behavior — AdSense has no ad for this slot. No code fix needed; the issue is demand-side (AdSense dashboard: check if the slot ID is active, check ad coverage settings).

4. **If the slot stays `loading` forever (mode B):** The slow retry system should handle this. Verify that slow retries are actually firing for the footer variant by checking console output.

5. **If the slot never initializes (mode D):** Check if the footer wrapper has `offsetWidth > 0` at init time. The `flex-col items-center` layout might cause a zero-width condition in some edge cases.

**Key principle:** Do not change footer spacing or layout until the actual failure mode is proven.

---

## 3. Why iframe `src` validation was too risky

The proposed rule was: only count an iframe as filled if `src` is non-empty and not `about:blank`.

Problems:
- **AdSense may use `about:blank` iframes legitimately** during ad rendering (e.g., friendly iframe technique where the creative is written into the iframe via JavaScript, not via `src`)
- **`src` may be empty at the moment of check** but populated milliseconds later — a race condition that would cause false negatives
- **Different AdSense rendering paths** (SafeFrame, friendly iframe, cross-domain iframe) use different `src` patterns — a hard rule against `about:blank` may miss valid ads in certain rendering modes
- This directly violates the revenue-first rule: "if uncertain, keep loading, do not suppress valid ads"

## 4. Corrected false-positive fill detection plan

The core problem: `data-adsbygoogle-status === 'done'` + iframe ≥50×50 can pass for shell iframes that AdSense injects during initialization but that contain no visible ad creative.

### Revised approach: confirmation delay re-check

Instead of adding brittle attribute checks, use a **temporal confirmation**:

```
When hasRealFill() first returns true (from MutationObserver or immediate check):
  1. Do NOT set filled immediately
  2. Schedule a 500ms confirmation re-check
  3. After 500ms, call hasRealFill() again
  4. If still true → set filled (label appears)
  5. If now false → stay in loading (shell was transient)
```

**Why this works:**
- Shell/placeholder iframes that AdSense injects during initialization are transient — they appear briefly then get replaced or resized to tiny dimensions
- Real ad creatives persist and maintain their dimensions
- 500ms is long enough for transient shells to resolve, short enough to not meaningfully delay label appearance on real ads
- No assumption about `src`, `contentDocument`, or any cross-origin property
- No new threshold logic that could miss valid formats

**Why this is safer than iframe `src` checking:**
- Does not depend on any specific iframe attribute value
- Works regardless of AdSense rendering mode (SafeFrame, friendly, cross-domain)
- If a real ad fills, the 500ms delay only affects when the label appears — the ad itself is already visible to the user in the reserved space
- Revenue impact: zero (ad is visible immediately; only the "ADVERTISEMENT" label is delayed by 500ms)

### What stays unchanged in `hasRealFill()`:
- Still requires `data-adsbygoogle-status === 'done'`
- Tier 1: iframe ≥ 50h × 50w (unchanged)
- Tier 2: direct child ≥ 50h × 100w (unchanged)
- If `hasRealFill()` returns false after confirmation, slot stays in `loading` — no label, no collapse

### Implementation location:
Modify `startFillObservation()` in AdPlaceholder.tsx:
- Where it currently calls `setAdStatus('filled')` immediately after `hasRealFill()` returns true (lines 178, 192), instead schedule a 500ms re-check
- Same for the safety timeout final check (line 215)

---

## 5. Approval readiness

The plan is now approval-ready with these corrections:
- Footer: diagnostic-first approach instead of guesswork margin fix; code cleanup of `mb-[88px]` is secondary
- Fill detection: temporal confirmation (500ms re-check) instead of brittle `src` validation
- Both changes preserve revenue-first architecture
- No new collapse logic, no opacity tricks, no timeout kills

