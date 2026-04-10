

# Exact CSV Structure Required by the Intake Import Function

## How the importer works

The importer reads your file (CSV, Excel, or JSON), auto-maps column headers to database fields using a known alias list, then inserts rows into the `intake_drafts` table. Two columns are **required** for import to proceed: `raw_title` and `source_url`. All others are optional.

## Column Reference

| # | CSV Header (any of these work) | Maps to DB field | Type | Required? | Allowed Values | Default if missing |
|---|-------------------------------|-----------------|------|-----------|---------------|-------------------|
| 1 | `raw_title`, `title` | `raw_title` | text | **YES** | Any text | — |
| 2 | `source_url`, `url`, `link` | `source_url` | text | **YES** | Valid URL | — |
| 3 | `source_domain`, `domain`, `host` | `source_domain` | text | No | Hostname (e.g. `ssc.nic.in`) | Auto-extracted from `source_url` |
| 4 | `source_name`, `sourcename`, `source` | `source_name` | text | No | Any text | `null` |
| 5 | `raw_text`, `text`, `content` | `raw_text` | text | No | Plain text body | `null` |
| 6 | `raw_html`, `html` | `raw_html` | text | No | HTML string | `null` |
| 7 | `raw_file_url`, `file_url` | `raw_file_url` | text | No | URL to a file | `null` |
| 8 | `raw_file_type`, `file_type`, `filetype` | `raw_file_type` | text | No | **`html`, `pdf`, `doc`, `image`, `unknown`** | `'unknown'` |
| 9 | `source_type`, `type` | `source_type` | text | No | **`crawler`, `rss`, `employment_news`, `manual`** | `'manual'` |
| 10 | `scrape_run_id` | `scrape_run_id` | text | No | UUID or any identifier | Auto-generated per upload |

## Database Validation (the trigger that rejects rows)

The `validate_intake_drafts_fields` trigger enforces these **strict enum values** — any other value causes the entire batch (up to 50 rows) to fail silently:

| Field | Allowed Values | What happens on invalid value |
|-------|---------------|-------------------------------|
| `source_type` | `crawler`, `rss`, `employment_news`, `manual` | Row rejected — e.g. `"cf"` or `"df"` fails |
| `raw_file_type` | `html`, `pdf`, `doc`, `image`, `unknown` | Row rejected |
| `processing_status` | `imported` (set automatically) | N/A — user doesn't control this |
| `review_status` | `pending` (set automatically) | N/A — user doesn't control this |

## Why your 251 rows failed

Your CSV had `source_type` values like `"cf"` and `"df"` (from the external crawler). These are not in the allowed list (`crawler`, `rss`, `employment_news`, `manual`), so the database trigger raised an exception for each batch containing them. The UI only reported the 50 skipped duplicates, hiding the 251 failures.

## Minimum viable CSV example

```text
raw_title,source_url,source_type,raw_file_type
SSC CGL 2025 Notification,https://ssc.nic.in/cgl-2025,crawler,pdf
UPSC NDA 2025 Apply Online,https://upsc.gov.in/nda-2025,manual,html
```

## What needs to be fixed in the code

1. **Normalize `source_type`** before insertion: map `"cf"` → `"crawler"`, `"df"` → `"crawler"`, any unrecognized value → `"manual"`
2. **Normalize `raw_file_type`**: map any unrecognized value → `"unknown"`
3. **Show error count in toast** when `stats.errors > 0`: e.g. `"0 imported, 48 dupes skipped, 251 failed"`

These three changes go in `src/components/admin/intake/IntakeCsvUploader.tsx` only — no database changes needed.

