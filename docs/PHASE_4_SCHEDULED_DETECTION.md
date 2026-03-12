# Phase 4: Scheduled Duplicate Detection & AI Semantic Matching

## Overview
Phase 4 implements automated, scheduled duplicate detection using:
1. **Database-level detection** (exact, URL hash, date window matching)
2. **AI Semantic Matching** (AWS Bedrock embeddings for description similarity ≥ 0.92)
3. **Scheduled Cron Jobs** (daily at 2 AM UTC + manual triggers)

## Components

### 1. Edge Function: `detect-and-group-duplicates`
**File**: `supabase/functions/detect-and-group-duplicates/index.ts`

**Capabilities**:
- Runs multi-level duplicate detection (3 database levels + 1 AI level)
- Generates embeddings using AWS Bedrock Titan Embeddings
- Calculates cosine similarity between job descriptions
- Marks duplicates with confidence scores
- Logs all operations

**Invocation**:
```bash
POST /functions/v1/detect-and-group-duplicates
Authorization: Bearer SUPABASE_ANON_KEY
```

**Response**:
```json
{
  "success": true,
  "groupsDetected": 215,
  "jobsMarked": 606,
  "timestamp": "2025-02-11T..."
}
```

### 2. Manual Trigger Utility
**File**: `src/lib/duplicateDetectionScheduler.ts`

**Functions**:
- `triggerDuplicateDetection()` - Manually invoke detection (for UI buttons, testing, post-scrape)

**Usage**:
```typescript
import { triggerDuplicateDetection } from '@/lib/duplicateDetectionScheduler';

const result = await triggerDuplicateDetection();
if (result.success) {
  console.log(`Marked ${result.jobsMarked} duplicates`);
}
```

### 3. Admin Dashboard Integration
**File**: `src/components/admin/DuplicateJobsManager.tsx`

**Added**:
- "Run Detection Now" button in the Duplicates tab header
- Manual trigger shows detection progress
- Auto-refreshes duplicate list after completion
- Success/error toast notifications

## Setup Instructions

### Step 1: Enable Extensions (One-time)
In Lovable Cloud → Run SQL:

```sql
-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Step 2: Schedule Cron Job (One-time)
In Lovable Cloud → Run SQL:

```sql
select cron.schedule(
  'detect-duplicates-daily',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$
  select net.http_post(
    url:='https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-and-group-duplicates',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**Replace**:
- `YOUR_PROJECT_ID`: From Supabase project URL
- `YOUR_ANON_KEY`: From Supabase project settings

### Step 3: Verify AWS Bedrock Credentials
Ensure these secrets are configured in Lovable Cloud:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g., "us-east-1")

If missing, add them in Cloud → Secrets.

## How It Works

### Detection Levels (Sequential)

**Level 1: Exact Matching**
- Normalized title + company + location match
- Confidence: 100%

**Level 2: Source URL Matching**
- MD5 hash of source_url matches
- Confidence: 95%

**Level 3: Date Window Matching**
- Same title + company, posted within 15 days
- Confidence: 85%

**Level 4: AI Semantic Matching**
- AWS Bedrock generates embeddings for job descriptions
- Calculates cosine similarity
- Marks as duplicate if similarity ≥ 0.92
- Confidence: Similarity score (0-1)

### Grouping Strategy

- All duplicates assigned to same `duplicate_group_id`
- Most recent job becomes canonical (earliest created_at)
- Admin can override canonical selection in dashboard

## Manual Testing

### Via Admin Dashboard
1. Navigate to Admin → Duplicates tab
2. Click "Run Detection Now" button
3. Watch progress spinner
4. View results as they load
5. Use filters to examine groups

### Via API (curl)
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-and-group-duplicates \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring

### Check Cron Job Status
In Lovable Cloud → Run SQL:

```sql
-- List all scheduled cron jobs
SELECT * FROM cron.job;

-- Check last execution
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### View Detection Logs
In Edge Function Logs, search for `detect-and-group-duplicates`:
- Look for "Starting duplicate detection run..."
- Track number of groups detected
- Monitor any errors or timeouts

## Performance Considerations

- **Batch Size**: Process 500 jobs per cycle (configurable in edge function)
- **AI Embeddings**: Generated on-demand; cached by job ID
- **Similarity Threshold**: 0.92 to reduce false positives
- **Cron Timing**: 2 AM UTC to avoid peak hours

## Cost Implications

- **AWS Bedrock**: Charged per embedding request (~$0.0001 per request)
- **Supabase**: Includes pg_cron and pg_net at standard rates
- **Lovable Cloud**: Function invocations counted in monthly usage

## Troubleshooting

### Detection not running?
1. Check cron job exists: `SELECT * FROM cron.job WHERE jobname = 'detect-duplicates-daily';`
2. Check last execution: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 1;`
3. Verify edge function deployed: Check Supabase Functions dashboard

### No duplicates found?
1. Run detection manually to check status
2. Verify AWS credentials are configured
3. Check if jobs have descriptions (required for AI similarity)

### AWS Bedrock errors?
1. Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
2. Ensure AWS user has bedrock-runtime:InvokeModel permission
3. Check AWS region is correct

## Next Steps

- Monitor detection accuracy over time
- Fine-tune similarity threshold based on false positive rate
- Add manual review workflow for flagged duplicates
- Implement automated cleanup for stale duplicates (>90 days)
