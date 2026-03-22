

## Plan: Reduce Chunk Size to 7,500 Characters

### Change

**File**: `src/components/admin/EmploymentNewsManager.tsx`, line 77

```
// Before
const CHUNK_SIZE = 15000;

// After
const CHUNK_SIZE = 7500;
```

That's the only change needed. The overlap (300 chars) and inter-chunk delay (2s) remain appropriate at this smaller size.

### Effect
- Documents will be split into roughly 2× more chunks
- Each chunk sends ~50% less text to the AI, improving extraction accuracy
- Total processing time increases due to more chunks (each with a 2s delay between them)
- The `maxOutputTokens: 4096` limit becomes more than sufficient per chunk

