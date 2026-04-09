

# Notification Centre — Implementation Plan

## Baseline Confirmation

All audit findings confirmed accurate against current code:
- `email_subscribers`: 6 active, write-only (no delivery pipeline)
- `telegram_subscribers`: 0 active, `TELEGRAM_BOT_TOKEN` not configured
- WhatsApp: link-only, no backend
- 3 orphaned components confirmed: `NewsletterSection`, `AlertSignupBanner`, `ResourceSubscribeCTA` (none imported anywhere)
- `AlertSignupBanner` has hardcoded wrong URLs (`919876543210`, `truejobsindia` vs correct `917982306492`, `truejobs_alerts`)
- No Notification Centre exists in admin
- Existing email sending uses Resend directly (7 transactional edge functions). `RESEND_API_KEY` is configured
- No `notification_send_log` table exists yet

## Implementation Summary

### Phase 1: Database Migration

Create `notification_send_log` table:
```
id (uuid PK), channel (text), subject (text), message_body (text),
audience_filter (jsonb), audience_count (int), sent_count (int),
failed_count (int), sent_by (uuid FK profiles), status (text),
created_at (timestamptz)
```
RLS: admin-only SELECT/INSERT via `has_role(auth.uid(), 'admin')`.

### Phase 2: Admin Edge Function — `admin-send-notification`

Single edge function handling email broadcast:
- Validates admin JWT + `has_role` check (auth-first pattern)
- Accepts: `channel`, `subject`, `message_body`, `cta_label`, `cta_url`, `audience_filter`, `test_email`
- For email: queries `email_subscribers` (active), sends via Resend in batches (10/batch, 200ms delay)
- Logs to `notification_send_log`
- For telegram: queries `telegram_subscribers`, sends via existing `telegram-bot` broadcast (only if `TELEGRAM_BOT_TOKEN` exists)
- Returns sent/failed counts

### Phase 3: Frontend — Notification Centre Components

**New files:**
1. `src/components/admin/notifications/NotificationCentre.tsx` — main container with sub-tabs (Overview, Email, Telegram, WhatsApp, Logs, Settings)
2. `src/components/admin/notifications/NotificationOverview.tsx` — channel health cards with subscriber counts, config status
3. `src/components/admin/notifications/EmailSubscribersTab.tsx` — searchable table of `email_subscribers` + compose/send panel
4. `src/components/admin/notifications/TelegramSubscribersTab.tsx` — subscriber table + honest status about bot token
5. `src/components/admin/notifications/WhatsAppTab.tsx` — honest "link-only" status card
6. `src/components/admin/notifications/NotificationLogs.tsx` — `notification_send_log` table
7. `src/components/admin/notifications/NotificationSettings.tsx` — channel config status (key exists yes/no, URLs)

**Modified:**
- `src/pages/admin/AdminDashboard.tsx` — add "Notifications" tab with Bell icon

### Phase 4: Cleanup

- Delete `src/components/home/NewsletterSection.tsx`
- Delete `src/components/home/AlertSignupBanner.tsx`
- Delete `src/components/resources/ResourceSubscribeCTA.tsx`

### What Each Channel Gets

| Channel | View Subscribers | Send from Admin | Status |
|---------|-----------------|-----------------|--------|
| Email | Yes (6 active) | Yes (via Resend) | Operational |
| Telegram | Yes (0 active) | Disabled (no bot token) | Honest disabled state |
| WhatsApp | No (no data) | No | Link-only status shown |

### Security

- All admin routes use existing auth + admin role check pattern
- Edge function uses auth-first pattern with `verify_jwt = false` + manual JWT validation
- Send actions require confirmation dialog
- Secret values never exposed (only "configured" / "not configured")

### Files Changed Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | 7 admin notification components | Notification Centre UI |
| Create | 1 edge function | Admin send capability |
| Modify | AdminDashboard.tsx | Add Notifications tab |
| Delete | 3 orphaned components | Cleanup dead code |
| Migration | 1 table | `notification_send_log` |

### Post-Implementation Verification Checklist

1. Admin can see Notifications tab in dashboard
2. Overview shows correct subscriber counts (Email: 6, Telegram: 0, WhatsApp: N/A)
3. Email tab shows subscriber list with search
4. Admin can compose and send test email to own address
5. Admin can send broadcast to all active email subscribers
6. Send confirmation dialog prevents accidental dispatch
7. Send log records the broadcast
8. Telegram tab shows "Bot token not configured" honest state
9. WhatsApp tab shows "Link-only, no delivery backend" honest state
10. Settings shows config health without secret values
11. Orphaned components deleted
12. Existing admin tabs unaffected

