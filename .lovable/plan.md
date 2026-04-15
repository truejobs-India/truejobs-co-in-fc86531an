

# Fix: "Mark as Baseline" Must Reset ALL Articles

## Problem
The `baseline_mark_posts` SQL function, when called without specific post IDs, only updates posts where `last_bulk_scanned_at IS NULL`. This misses the ~1983 articles that were previously scanned but still have non-fixed statuses (`partially_fixed`, `no_action_taken`, `failed`, etc.). After baseline, these articles still qualify for smart scope and keep reappearing.

## Root Cause
Line 48 of the migration: `WHERE last_bulk_scanned_at IS NULL` — too restrictive. Should baseline ALL posts regardless of current status.

## Fix

### 1. Database Migration — Update `baseline_mark_posts` function

Replace the `ELSE` branch so that when no specific IDs are passed, it updates ALL blog posts (not just unscanned ones):

```sql
CREATE OR REPLACE FUNCTION public.baseline_mark_posts(
  p_post_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_post_ids IS NOT NULL THEN
    UPDATE blog_posts
    SET
      last_bulk_scanned_at = now(),
      last_bulk_fix_status = 'baseline',
      remaining_auto_fixable_count = 0
    WHERE id = ANY(p_post_ids);
  ELSE
    -- Baseline ALL posts that are not already 'fixed' or 'baseline'
    UPDATE blog_posts
    SET
      last_bulk_scanned_at = now(),
      last_bulk_fix_status = 'baseline',
      remaining_auto_fixable_count = 0
    WHERE last_bulk_fix_status IS DISTINCT FROM 'fixed'
      AND last_bulk_fix_status IS DISTINCT FROM 'baseline';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

This ensures that clicking "Mark as Baseline" (without selection) resets all `partially_fixed`, `no_action_taken`, `failed`, and `NULL`-status posts to `baseline`, so they stop appearing in smart scans.

### 2. No frontend code changes needed

The `isEligibleForSmartScope` logic (Rule 5) already correctly handles `baseline` status — it excludes posts unless their content has changed since the baseline timestamp. Once the DB function properly marks all posts, the smart scan will correctly skip them.

### AdSense Safety
No UI changes. No layout changes. Database-only fix.

