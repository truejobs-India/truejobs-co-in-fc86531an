

# Unify Intake AI Model Selector

## Current State

There is already **one single `AiModelSelector`** in `IntakeDraftsManager.tsx` (line 600) controlling the `aiModel` state variable. This same `aiModel` is already passed to all three edge function calls:
- Initial classification (line 202)
- Retry enhanced (line 241)
- Fill empty fields (line 441)

**There is no duplicate selector and no silent fallback.** The architecture is already correct.

## Only Change Needed

Relabel the existing selector from its current unlabeled state to **"Intake AI Model"** so it is explicitly clear this is the single source of truth for all Intake AI actions.

### File: `src/components/admin/intake/IntakeDraftsManager.tsx`

**Line 600** — Wrap the existing `AiModelSelector` with a label:

```tsx
<div className="flex items-center gap-1.5">
  <span className="text-xs text-muted-foreground whitespace-nowrap">Intake AI Model:</span>
  <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" size="sm" triggerClassName="w-[180px] h-8 text-xs" />
</div>
```

No other files changed. No new selectors. No architectural changes.

## Why This Is Sufficient

- Single `aiModel` state already governs all AI calls (classify, retry, fill-empty)
- The edge function (`intake-ai-classify`) receives `aiModel` from the request body and uses it directly — no hidden fallback logic
- Adding a visible label makes the single-source-of-truth behavior obvious to the admin

