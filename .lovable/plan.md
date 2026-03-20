

## Problem
The `PendingActionsPanel` receives `enrichWordLimit` as a prop from the parent but provides no way for the user to override it before scanning/executing. The word count target is fixed to whatever the parent passes.

## Solution
Add an editable word count input field next to the "Enrich Pending Articles" button in the `PendingActionsPanel`. This lets the user specify their desired target before scanning.

### Changes — Single file: `src/components/admin/blog/PendingActionsPanel.tsx`

1. **Add local state** for a user-editable word count, initialized from the `enrichWordLimit` prop:
   ```tsx
   const [customWordLimit, setCustomWordLimit] = useState(enrichWordLimit);
   ```

2. **Add an Input field** in the idle/scanned phases next to the "Enrich Pending Articles" button — a small number input labeled "Target words" (e.g., 80px wide).

3. **Use `customWordLimit`** instead of `enrichWordLimit` in both `scanEnrich` (for the filtering threshold) and `executeEnrich` (for the `targetWordCount` sent to the edge function).

4. **Sync with prop** — update `customWordLimit` if the parent prop changes via a `useEffect`.

This is a minimal, self-contained change to one file. The input appears inline with the enrich button, keeping the UI compact.

