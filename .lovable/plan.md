

## Fallback Routes Fix — Implementation

### 4 Files, 12 New Policy Mappings

**File 1: `seoRoutePolicyRegistry.ts`** — Add 12 entries to `PAGE_TYPE_POLICIES` (7 active + 5 future-proof)

**File 2: `seoRoutePolicyTypes.ts`** — Add `fallbackPageType?: string` to `PolicyOutput`

**File 3: `seoRoutePolicyEngine.ts`** — Include `fallbackPageType` in fallback return + enhanced reason summary

**File 4: `cacheTypes.ts`** — Add 7 active missing types to `PAGE_TYPES` array

---

### Policy Mappings

**Active (fixes 143 fallbacks):**
| Type | Policy | Reasoning |
|---|---|---|
| `combo-dept-state` | `seo()` | Stable geo+dept listing. No schema. |
| `authority-age-limit` | `seo()` | Evergreen exam info. No schema. |
| `authority-exam-pattern` | `seo()` | Exam pattern pages. No schema. |
| `authority-eligibility` | `seo()` | Eligibility pages. No schema. |
| `custom-exam-support` | `seo()` | Utility/guide pages. No schema. |
| `combo-closing-soon` | `noindex(...)` | Ephemeral — deadlines change daily. |
| `deadline-this-week` | `noindex(...)` | Ephemeral — same as deadline-week. |

**Future-proof (not currently collected):**
| Type | Policy | Reasoning |
|---|---|---|
| `landing` | `seo({ breadcrumb: false })` | Top-level entry points. |
| `guide` | `seo()` | Conservative — no schema until verified. |
| `resource` | `seo()` | Evergreen utility. |
| `comparison` | `seo()` | Indexable if substantial. |
| `result-landing` | `seo()` | Conservative — no schema until verified. |

### Expected Result
- Fallback: 143 → 0
- +127 indexed, +16 explicit noindex

