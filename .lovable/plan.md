

# Auto-First Workflow for Long Tail SEO Pages

## What Changes

The current panel requires admin to manually select template, exam, state, department, year, and source URL **before** generation. This plan converts that to: paste topics → click generate → system auto-detects everything → admin reviews.

---

## New File: `src/lib/longTailAutoDetect.ts` (~180 lines)

A pure client-side detection engine that parses each keyword string and returns:

```typescript
export interface DetectedMeta {
  template: string;        // e.g. 'age-limit'
  templateConfidence: 'high' | 'medium' | 'low';
  exam: string | null;     // e.g. 'SSC CGL'
  state: string | null;    // e.g. 'Uttar Pradesh'
  department: string | null;
  category: string | null; // e.g. 'OBC'
  year: string | null;     // e.g. '2026'
  intent: string;          // e.g. 'factual-answer'
  languageHint: string;    // 'hindi' | 'english' | 'auto'
  sourceCandidate: string | null; // e.g. 'ssc.gov.in'
}
```

### Detection strategy (all rule-based, no AI call needed):

**Template detection** — keyword matching against patterns:
| Pattern | Template |
|---|---|
| `age limit`, `age criteria`, `age relaxation` | `age-limit` |
| `salary`, `in hand`, `pay`, `vetan` | `salary` |
| `eligibility`, `yogyata`, `eligible` | `eligibility` |
| `syllabus`, `pathyakram` | `syllabus` |
| `exam pattern`, `paper pattern` | `exam-pattern` |
| `selection process`, `chayan prakriya` | `selection-process` |
| `application fee`, `avedan shulk` | `application-fee` |
| `last date`, `important date` | `dates` |
| `admit card`, `hall ticket`, `pravesh patra` | `admit-card` |
| `result`, `pariksha parinam` | `result` |
| `qualification`, `shaikshik yogyata` | `qualification` |
| `vs`, `versus`, `comparison`, `difference between` | `comparison` |
| `how to`, `step by step`, `kaise` | `how-to-guide` |
| Fallback | `keyword-answer` |

**Exam detection** — match against a curated list of ~50 known exam names:
`SSC CGL`, `SSC CHSL`, `SSC GD`, `SSC MTS`, `UPSC CSE`, `UPSC NDA`, `UPSC CDS`, `UPSC CAPF`, `IBPS PO`, `IBPS Clerk`, `SBI PO`, `SBI Clerk`, `RBI Grade B`, `CTET`, `Railway Group D`, `RRB NTPC`, `UP Police`, `UP SI`, `Bihar Police`, `BPSC`, `UPPSC`, `MPPSC`, `RPSC`, `Army Agniveer`, etc.

**State detection** — match against Indian state names and abbreviations:
`UP`→`Uttar Pradesh`, `MP`→`Madhya Pradesh`, `Bihar`, `Rajasthan`, `Maharashtra`, etc.

**Department detection** — match keywords like `railway`, `defence`, `ministry`, `police`, `bank`.

**Year detection** — extract `20XX` tokens.

**Language hint** — if Hindi tokens (`ke`, `ki`, `mein`, `kaise`, `pathyakram`) are present, hint `hindi`.

**Source candidate** — map detected exam to known official domains:
`SSC *` → `ssc.gov.in`, `UPSC *` → `upsc.gov.in`, `Railway *` → `rrbcdg.gov.in`, `IBPS *` → `ibps.in`, etc.

**Confidence** — `high` if template pattern + exam both matched; `medium` if only template; `low` if fallback to keyword-answer.

---

## Modified File: `src/components/admin/blog/LongTailSeoPanel.tsx`

### UI restructure:

**Default view (simplified):**
```
┌──────────────────────────────────────────────────┐
│ Keywords (one per line, max 50):                 │
│ ┌──────────────────────────────────────────────┐ │
│ │ ssc cgl age limit for obc                    │ │
│ │ up police constable syllabus in hindi        │ │
│ └──────────────────────────────────────────────┘ │
│ 2 / 50 keywords                                  │
│                                                  │
│ Words: [800] [1200] [1500]  Lang: [Auto]         │
│ Model: [Gemini Flash]                            │
│                                                  │
│ [Check Duplicates]  [Generate Pages (2)]         │
│                                                  │
│ ▸ Advanced Overrides (hidden by default)          │
└──────────────────────────────────────────────────┘
```

**Advanced Overrides (collapsed):**
- Template override
- Exam override
- State override
- Department override
- Year override
- Official Source URL override

These only apply when explicitly filled — empty means "use auto-detected".

### Generation flow change:

1. For each keyword, call `autoDetectMeta(keyword)` **before** the edge function call
2. Use detected values (template, exam, state, etc.) for the generation request
3. If admin filled an override, use the override instead
4. Store both detected and override values in `long_tail_metadata`

### Results display enhancement:

Each result row now shows detected metadata badges:
```
✓ ssc cgl age limit for obc
  [age-limit] [SSC CGL] [OBC]  Q:78  ssc.gov.in
```

Badges are color-coded by confidence:
- High: default badge
- Medium: outline badge
- Low: muted/dashed badge

### `GenerationResult` interface update:

```typescript
interface GenerationResult {
  keyword: string;
  status: ResultStatus;
  articleId?: string;
  slug?: string;
  error?: string;
  thinRisk?: boolean;
  dupScore?: number;
  qualityScore?: number;
  // New auto-detected fields
  detected?: DetectedMeta;
}
```

### State changes:

Remove these as primary state (move to advanced overrides):
- `template` → `overrideTemplate` (default empty string = auto)
- `examInput` → `overrideExam` (default empty)
- `stateInput` → `overrideState` (default empty)
- `deptInput` → `overrideDept` (default empty)
- `yearInput` → `overrideYear` (default empty)
- `sourceUrl` → `overrideSourceUrl` (default empty)

Add a `showAdvanced` boolean state (default false).

### Insert behavior update:

```typescript
const detected = autoDetectMeta(keyword);
const effectiveTemplate = overrideTemplate || detected.template;
const effectiveExam = overrideExam || detected.exam;
// ... same pattern for all fields

// Store in long_tail_metadata
long_tail_metadata: {
  templateUsed: effectiveTemplate,
  autoDetected: detected,
  overrides: { template: overrideTemplate || null, exam: overrideExam || null, ... },
  qualityScore: qualityResult.score,
  modelUsed: aiModel,
}
```

### Duplicate check update:

Pass auto-detected metadata into `TopicInput` for structured similarity:
```typescript
const detected = autoDetectMeta(kw);
const topic: TopicInput = {
  keyword: kw,
  template: detected.template,
  exam: detected.exam || undefined,
  state: detected.state || undefined,
  department: detected.department || undefined,
  year: detected.year || undefined,
};
```

---

## No edge function changes needed

The edge function already accepts `contentMode`, `pageTemplate`, `targetExam`, etc. as parameters. The only change is that the **client** now auto-populates these instead of requiring manual input.

## No database changes needed

All fields already exist from the previous migration. The `long_tail_metadata` JSONB column stores auto-detected vs. override distinction.

---

## Files Changed Summary

| File | Change |
|---|---|
| **New: `src/lib/longTailAutoDetect.ts`** | Auto-detection engine (~180 lines) |
| `src/components/admin/blog/LongTailSeoPanel.tsx` | Restructured UI + auto-detect integration (~100 lines changed) |

---

## What Is Auto-Detected vs. Optional Override

| Field | Default | Override |
|---|---|---|
| Template | Auto-detected from keyword | Advanced Overrides dropdown |
| Exam | Auto-detected from keyword | Advanced Overrides input |
| State | Auto-detected from keyword | Advanced Overrides input |
| Department | Auto-detected from keyword | Advanced Overrides input |
| Year | Auto-detected from keyword | Advanced Overrides input |
| Category | Auto-detected from keyword | Not overridable (stored in metadata) |
| Language hint | Auto-detected from keyword | Language selector (already in primary controls) |
| Source candidate | Auto-mapped from exam | Advanced Overrides URL input |
| Intent | Auto-detected from template | Not overridable |

