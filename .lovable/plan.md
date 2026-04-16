

## Issue: Misleading "vertex" naming (no functional bug)

The `vertex-*` model keys (`vertex-flash`, `vertex-pro`, `vertex-3.1-pro`, etc.) and the `VERTEX_MODEL_MAP` variable name suggest Google Vertex AI routing, but they actually call the **Direct Google Gemini API** via `generativelanguage.googleapis.com/v1beta` using `GEMINI_API_KEY` (handled by `_shared/gemini-direct.ts`).

This complies with your `Gemini Direct API` policy. **No request goes to Vertex AI.** Routing is functionally correct — only the naming is wrong.

### What's confusing (verified)

| UI Key | Variable Name | Actual API Called |
|---|---|---|
| `vertex-flash` | `VERTEX_MODEL_MAP` | `generativelanguage.googleapis.com` (Direct Gemini API) |
| `vertex-pro` | `VERTEX_MODEL_MAP` | `generativelanguage.googleapis.com` (Direct Gemini API) |
| `vertex-3.1-pro` | `VERTEX_MODEL_MAP` | `generativelanguage.googleapis.com` (Direct Gemini API) |
| `vertex-3-flash` | `VERTEX_MODEL_MAP` | `generativelanguage.googleapis.com` (Direct Gemini API) |
| `vertex-3.1-flash-lite` | `VERTEX_MODEL_MAP` | `generativelanguage.googleapis.com` (Direct Gemini API) |

The labels in `aiModels.ts` already say "(Direct API)" — only the internal key prefix and variable name are stale.

### Two options

**Option A — Cosmetic rename only (safe, recommended)**
- Rename internal variable `VERTEX_MODEL_MAP` → `GEMINI_DIRECT_MODEL_MAP` and log line `routing to Vertex AI` → `routing to Gemini Direct API` in `intake-ai-classify/index.ts`.
- Keep UI keys (`vertex-flash`, etc.) unchanged — they are persisted in user preferences, used across many edge functions, and changing them is high-risk.
- **0 behavior change**, just clearer logs/code.

**Option B — Full rename (risky, not recommended)**
- Rename all `vertex-*` keys to `gemini-direct-*` everywhere (registry, all edge functions, legacy alias map, saved DB rows). Requires migration. High blast radius.

### Recommendation: Option A

1 file changed: `supabase/functions/intake-ai-classify/index.ts` — rename internal variable + log string. ~5 lines.

