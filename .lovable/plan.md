

# Revised Tier 2 Width Threshold in `hasRealFill()`

## 1. Revised Tier 2 Rule

```typescript
// Tier 2: any direct child large enough to be a real ad
// 50px height filters shells/icons; 100px width filters AdChoices but accepts narrow sidebar formats
for (let i = 0; i < el.children.length; i++) {
  const child = el.children[i] as HTMLElement;
  if (child.offsetHeight >= 50 && child.offsetWidth >= 100) return true;
}
```

Threshold changed from `width >= 200` to `width >= 100`.

## 2. Why 200px Was Too High

Valid sidebar ad formats that could render as non-iframe content include:
- **120×600** (skyscraper) — width 120, fails ≥200
- **160×600** (wide skyscraper) — width 160, fails ≥200
- **125×125** (button) — width 125, fails ≥200
- Responsive sidebar units on narrower containers can render at 150-180px width

All of these are legitimate IAB formats that would be falsely rejected by the 200px floor, causing the slot to stay in `loading` with no label even though a real ad is present.

## 3. Why 100px Is Safer Without Reintroducing False Positives

| Element | Typical size | Passes 50h × 100w? |
|---|---|---|
| AdChoices icon | 15-20 × 15-20 | No |
| Shell/wrapper div | 2-10px height | No (height) |
| Tracking pixel | 1×1 to 5×5 | No |
| 120×600 skyscraper | 120w | Yes |
| 160×600 wide skyscraper | 160w | Yes |
| 300×250 medium rectangle | 300w | Yes |
| 320×50 mobile banner | 320w | Yes |

No known AdSense utility artifact reaches 100px width AND 50px height simultaneously. The smallest real ad format (120×600) clears both thresholds comfortably.

## 4. Approval Readiness

The plan is now approval-ready. All other parts remain unchanged. Only the Tier 2 width floor moved from 200 to 100, closing the sidebar false-negative gap without reopening false-positive risk.

