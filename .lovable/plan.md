

## Implementation Plan: Time Budget, Auto-Batching, Claude Fix, Persistent Messages

### File 1: `supabase/functions/enrich-authority-pages/index.ts`

**A. Fix Claude model ID (line 271)**
Change `'claude-sonnet-4-20250514'` → `'claude-sonnet-4-6'` to match all other edge functions.

**B. Reduce timeouts + add time budget (line 199)**
```
- const AI_TIMEOUT_MS = 90_000;
+ const AI_TIMEOUT_MS = 60_000; // 60s per call
+ const FUNCTION_TIME_BUDGET_MS = 120_000; // bail before 150s platform limit
```

**C. Add time budget guard in main handler (lines 1073-1082)**
Track `const fnStart = Date.now()` at handler entry (~line 975). Before each concurrency batch, check elapsed time. If over budget, mark remaining slugs as `skipped`:

```typescript
const fnStart = Date.now();
// ... inside the batch loop:
for (let i = 0; i < slugs.length; i += CONCURRENCY) {
  if (Date.now() - fnStart > FUNCTION_TIME_BUDGET_MS) {
    // Mark remaining as skipped
    for (let j = i; j < slugs.length; j++) {
      results[j] = {
        slug: slugs[j], status: 'skipped', sectionsAdded: [], qualityScore: {},
        flags: [], totalWords: 0, failureReason: 'Skipped — function time budget exceeded',
      };
    }
    break;
  }
  // ... existing batch processing
}
```

**D. Add `skipped` count to report (lines 1084-1093)**
Add `pagesSkipped` to report object:
```typescript
pagesSkipped: results.filter(r => r.status === 'skipped').length,
```

**E. Add boot log (after line 975)**
```typescript
console.log(`[enrich-authority-pages] Boot: ${slugs.length} slugs, model=${selectedModel}, type=${pageType}`);
```

---

### File 2: `src/components/admin/ContentEnricher.tsx` (major changes)

**A. Model-aware batch size limits (new constant + logic)**
Add after AI_MODELS constant (~line 100):
```typescript
const MODEL_BATCH_LIMITS: Record<string, number> = {
  'gemini-flash': 8,
  'gemini-pro': 5,
  'claude-sonnet': 3,
  'mistral': 4,
  'lovable-gemini': 5,
  'gpt5': 3,
  'gpt5-mini': 4,
};
function getModelBatchLimit(model: string): number {
  return MODEL_BATCH_LIMITS[model] || 3;
}
```

**B. Persistent status messages (replace toasts for enrichment results)**
Add new state for persistent messages:
```typescript
interface PersistentMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description: string;
  timestamp: Date;
}
const [messages, setMessages] = useState<PersistentMessage[]>([]);
const addMessage = (type, title, description) => {
  setMessages(prev => [{ id: crypto.randomUUID(), type, title, description, timestamp: new Date() }, ...prev]);
};
```

Render persistent messages block between the controls and the table — a scrollable card showing timestamped results with dismiss buttons, colored by type (green success, amber warning, red error, blue info).

**C. Auto-continue batching (rewrite `handleEnrichBatch`, lines 232-270)**
When the user clicks "Enrich N pages", if N exceeds the model batch limit, automatically split into sequential batches:

```typescript
const handleEnrichBatch = async () => {
  if (selected.size === 0) return;
  setIsEnriching(true);
  setBatchReport(null);

  const allSlugs = Array.from(selected);
  const batchLimit = getModelBatchLimit(aiModel);
  const totalBatches = Math.ceil(allSlugs.length / batchLimit);
  const allResults: EnrichmentResult[] = [];

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchSlugs = allSlugs.slice(batchIdx * batchLimit, (batchIdx + 1) * batchLimit);
    const start = batchIdx * batchLimit + 1;
    const end = start + batchSlugs.length - 1;
    
    addMessage('info', `Processing batch ${batchIdx + 1} of ${totalBatches}`,
      `Slugs ${start}-${end} of ${allSlugs.length}...`);

    const currentContent = batchSlugs.map(slug => {
      const row = pageRows.find(r => r.slug === slug);
      return { slug, examName: row?.name || slug, existingWordCount: row?.wordCount || 0, existingSections: [] };
    });

    try {
      const { data, error } = await supabase.functions.invoke('enrich-authority-pages', {
        body: { slugs: batchSlugs, pageType: family, currentContent, aiModel },
      });
      if (error) throw error;
      
      const batchResults = data.results || [];
      allResults.push(...batchResults);
      
      const succeeded = batchResults.filter(r => r.status === 'success' || r.status === 'flagged').length;
      const failed = batchResults.filter(r => r.status === 'failed').length;
      const skipped = batchResults.filter(r => r.status === 'skipped').length;
      
      if (failed > 0 || skipped > 0) {
        addMessage('warning', `Batch ${batchIdx + 1} partial`,
          `${succeeded} enriched, ${failed} failed, ${skipped} skipped`);
      } else {
        addMessage('success', `Batch ${batchIdx + 1} complete`, `${succeeded} pages enriched`);
      }
    } catch (err) {
      addMessage('error', `Batch ${batchIdx + 1} failed`,
        err instanceof Error ? err.message : 'Unknown error');
    }

    await loadDrafts();
    if (batchIdx + 1 < totalBatches) await new Promise(r => setTimeout(r, 3000));
  }

  setBatchReport({ results: allResults });
  const totalOk = allResults.filter(r => r.status === 'success' || r.status === 'flagged').length;
  const totalFail = allResults.filter(r => r.status === 'failed').length;
  addMessage(totalFail > 0 ? 'warning' : 'success', 'Enrichment complete',
    `${totalOk} enriched, ${totalFail} failed out of ${allSlugs.length} pages`);
  setIsEnriching(false);
};
```

**D. Update selection limit (line 226-229)**
Change the max selection from hardcoded 8 to model-aware:
```typescript
else if (next.size < getModelBatchLimit(aiModel) * 3) next.add(slug);
// Allow up to 3x batch limit (auto-continue handles the rest)
```
Actually, just remove the upper limit entirely (or set to a high number like 24) since auto-continue handles batching.

**E. Model info message in UI (after model selector, ~line 465)**
Add a small info text:
```tsx
<span className="text-xs text-muted-foreground">
  {AI_MODELS.find(m => m.value === aiModel)?.label} processes {getModelBatchLimit(aiModel)} pages per batch.
  {selected.size > getModelBatchLimit(aiModel) && ` Remaining pages auto-queued in ${Math.ceil(selected.size / getModelBatchLimit(aiModel))} batches.`}
</span>
```

**F. Update `handleEnrichAllPending` (lines 272-317)**
Same auto-batching pattern using `getModelBatchLimit(aiModel)` instead of hardcoded `BATCH_SIZE = 8`.

**G. Persistent messages UI block (new, between controls and table)**
```tsx
{messages.length > 0 && (
  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-muted/30">
    {messages.map(msg => (
      <div key={msg.id} className={cn("flex items-start gap-2 p-2 rounded text-sm border",
        msg.type === 'success' && "bg-emerald-50 border-emerald-200",
        msg.type === 'warning' && "bg-amber-50 border-amber-200",
        msg.type === 'error' && "bg-red-50 border-red-200",
        msg.type === 'info' && "bg-blue-50 border-blue-200",
      )}>
        {/* icon per type */}
        <div className="flex-1 min-w-0">
          <p className="font-medium">{msg.title}</p>
          <p className="text-muted-foreground text-xs">{msg.description}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {msg.timestamp.toLocaleTimeString()}
        </span>
        <button onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))} className="text-muted-foreground hover:text-foreground">×</button>
      </div>
    ))}
  </div>
)}
```

**H. Remove toast calls for enrichment results**
Replace all `toast()` calls in enrichment handlers with `addMessage()` calls. Keep toasts only for approve/reject/publish actions (those are quick one-off actions).

---

### Summary of Changes

| Change | File | What |
|--------|------|------|
| Claude model ID | edge function L271 | `claude-sonnet-4-20250514` → `claude-sonnet-4-6` |
| AI timeout | edge function L199 | 90s → 60s |
| Time budget | edge function L975+ | 120s guard, skip remaining slugs |
| Skipped status | edge function report | New `pagesSkipped` field |
| Boot log | edge function | Console log at start |
| Model batch limits | ContentEnricher | Per-model max slugs |
| Auto-continue | ContentEnricher | Split into sequential batches automatically |
| Persistent messages | ContentEnricher | Timestamped on-page log replacing toasts |
| Selection limit | ContentEnricher | Remove 8-slug cap, allow any count |

