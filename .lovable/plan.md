

# Tighten FLUX Positive Block — Add "NOT corporate professionals"

## Change

**File**: `supabase/functions/_shared/blog-image-prompt-policy.ts`, line 116 only.

**Current** (line 116):
```
Subjects: Authentic ordinary Indian college-going students and aspirants — NOT fashion models. Age-appropriate appearance...
```

**Updated** (line 116):
```
Subjects: Authentic ordinary Indian college-going students and aspirants — NOT fashion models, NOT office workers, NOT corporate professionals. Age-appropriate appearance...
```

One phrase inserted: `, NOT office workers, NOT corporate professionals` after `NOT fashion models`.

## Not changed

- `FLUX_REALISM_NEGATIVE` — unchanged
- `BLOG_IMAGE_MANDATORY_RULES` — unchanged
- All builder functions, routing, call sites — unchanged
- All non-FLUX model paths — unchanged
- No other file touched

## Post-implementation

Redeploy `generate-vertex-image` edge function so the updated shared module takes effect.

