

## Correction: POSSIBLE_CONFLICT note format

The conflict note stored in `qa_notes` should use this exact format with stable keys, always including `existing_slug` and `new_slug`:

```
POSSIBLE_CONFLICT|existing_page_id:abc-123|existing_slug:haryana-bseh-result|existing_batch:batch-xyz|existing_title:BSEH Main Result|match_type:state_ut+board_name+result_variant|new_slug:haryana-bseh-result
```

### Keys (all required, in this order)
1. `existing_page_id` — UUID of the matched page
2. `existing_slug` — slug of the matched page (stable, human-readable identifier)
3. `existing_batch` — batch ID the matched page belongs to
4. `existing_title` — title of the matched page (display only)
5. `match_type` — which fields triggered the match
6. `new_slug` — slug computed for the incoming row

### Why `existing_slug` matters
- Page IDs are opaque UUIDs — not useful for admin review at a glance
- The slug is the stable, human-readable key the admin actually recognizes
- Including both `existing_slug` and `new_slug` makes it immediately clear whether the slugs collide or just the logical identity matches

### Resolution notes follow the same key style
```
CONFLICT_RESOLVED|action:updated|existing_slug:haryana-bseh-result|resolved_at:2026-03-16T12:00:00Z
```
```
CONFLICT_RESOLVED|action:skipped|existing_slug:haryana-bseh-result|resolved_at:2026-03-16T12:00:00Z
```

### No other changes
Everything else in the plan remains as approved. This only tightens the serialization format for conflict notes in `qa_notes`.

