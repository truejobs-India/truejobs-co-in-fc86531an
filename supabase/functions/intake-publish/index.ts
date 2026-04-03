/**
 * Phase 5: Protected Publish Edge Function for Intake Drafts.
 * Validates, routes to correct live table, handles exam linking and slug collisions.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

// ── Minimum publish checks per type ──
function validateForPublish(draft: any): string | null {
  const target = draft.publish_target;
  const t = draft.normalized_title || draft.raw_title;

  if (!t) return 'Missing title';

  switch (target) {
    case 'jobs':
      if (!draft.organisation_name) return 'Missing organisation_name for jobs';
      if (!draft.post_name) return 'Missing post_name for jobs';
      if (!draft.closing_date && !draft.official_apply_link && !draft.official_notification_link) {
        return 'Jobs need at least one of: closing_date, official_apply_link, official_notification_link';
      }
      break;
    case 'results':
      if (!draft.result_date && !draft.result_link && !draft.official_notification_link) {
        return 'Results need at least one of: result_date, result_link, official_notification_link';
      }
      break;
    case 'admit_cards':
      if (!draft.admit_card_date && !draft.admit_card_link && !draft.official_notification_link) {
        return 'Admit cards need at least one of: admit_card_date, admit_card_link, official_notification_link';
      }
      break;
    case 'answer_keys':
      if (!draft.answer_key_date && !draft.answer_key_link && !draft.official_notification_link) {
        return 'Answer keys need at least one of: answer_key_date, answer_key_link, official_notification_link';
      }
      break;
    case 'exams':
      if (!draft.exam_name && !t) return 'Exams need a title or exam_name';
      break;
    case 'notifications':
      if (!draft.organisation_name) return 'Notifications need organisation_name';
      if (!draft.official_notification_link && !draft.official_apply_link && !draft.closing_date) {
        return 'Notifications need at least one of: official_notification_link, official_apply_link, closing_date';
      }
      break;
    case 'scholarships':
    case 'certificates':
    case 'marksheets':
      return `Publish target "${target}" has no safe live destination — keep in manual review`;
    default:
      return `Unknown publish target: ${target}`;
  }
  return null;
}

// ── Resolve slug collision ──
async function resolveSlug(client: any, baseSlug: string, table: string, slugColumn = 'slug'): Promise<string> {
  let slug = baseSlug;
  const { data } = await client.from(table).select(slugColumn).eq(slugColumn, slug).limit(1);
  if (data && data.length > 0) {
    const shortId = crypto.randomUUID().slice(0, 6);
    slug = `${baseSlug}-${shortId}`;
  }
  return slug;
}

// ── Strict exam linking ──
async function findOrCreateExam(client: any, draft: any): Promise<{ examId: string; created: boolean } | { error: string }> {
  const examName = draft.exam_name || draft.normalized_title || draft.raw_title;
  const org = draft.organisation_name || '';

  if (!examName) return { error: 'No exam_name available for exam linking' };

  // 1. Try exact match (case-insensitive)
  const { data: matches } = await client
    .from('govt_exams')
    .select('id, exam_name, conducting_body')
    .ilike('exam_name', examName.trim())
    .limit(5);

  if (matches && matches.length === 1) {
    return { examId: matches[0].id, created: false };
  }

  // 2. Try with conducting_body match
  if (matches && matches.length > 1 && org) {
    const orgMatch = matches.find((m: any) =>
      m.conducting_body && m.conducting_body.toLowerCase().includes(org.toLowerCase())
    );
    if (orgMatch) return { examId: orgMatch.id, created: false };
  }

  // 3. Create minimal exam if enough evidence
  if (!examName || examName.length < 5) {
    return { error: 'Insufficient evidence to create exam record' };
  }

  const slug = generateSlug(examName);
  const resolvedSlug = await resolveSlug(client, slug, 'govt_exams');

  const { data: newExam, error: createErr } = await client
    .from('govt_exams')
    .insert({
      exam_name: examName,
      slug: resolvedSlug,
      conducting_body: org || null,
      status: 'upcoming',
      exam_category: 'Central',
    })
    .select('id')
    .single();

  if (createErr) return { error: `Failed to create exam: ${createErr.message}` };
  return { examId: newExam.id, created: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Auth-first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) return json({ error: 'Admin required' }, 403);

    // Parse body
    const body = await req.json().catch(() => ({}));
    const draftId = body.draft_id as string;
    if (!draftId) return json({ error: 'Missing draft_id' }, 400);

    const client = createClient(supabaseUrl, serviceRoleKey);

    // Fetch draft
    const { data: draft, error: fetchErr } = await client
      .from('intake_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchErr || !draft) return json({ error: 'Draft not found' }, 404);

    // Gate checks
    if (draft.primary_status !== 'publish_ready') {
      return json({ error: `Cannot publish: primary_status is "${draft.primary_status}", must be "publish_ready"` }, 400);
    }
    if (draft.review_status !== 'approved') {
      return json({ error: `Cannot publish: review_status is "${draft.review_status}", must be "approved"` }, 400);
    }

    // Check blockers
    const blockers = Array.isArray(draft.publish_blockers) ? draft.publish_blockers as string[] : [];
    if (blockers.length > 0) {
      return json({ error: `Publish blocked: ${blockers.join(', ')}` }, 400);
    }

    // Validate minimum fields
    const validationError = validateForPublish(draft);
    if (validationError) {
      await client.from('intake_drafts').update({
        processing_status: 'publish_failed',
        publish_error: validationError,
      }).eq('id', draftId);
      return json({ error: validationError }, 400);
    }

    const title = draft.normalized_title || draft.raw_title || 'Untitled';
    const slug = draft.slug || generateSlug(title);
    let publishedId: string | null = null;
    let publishedTable: string | null = null;

    try {
      switch (draft.publish_target) {
        case 'jobs': {
          const resolvedSlug = await resolveSlug(client, slug, 'employment_news_jobs');
          const { data: inserted, error: insErr } = await client
            .from('employment_news_jobs')
            .insert({
              enriched_title: title,
              org_name: draft.organisation_name,
              post: draft.post_name,
              slug: resolvedSlug,
              meta_title: draft.seo_title || title,
              meta_description: draft.meta_description,
              enriched_description: draft.draft_content_html || draft.summary,
              description: draft.draft_content_text || draft.summary,
              location: draft.job_location,
              qualification: draft.qualification_text,
              age_limit: draft.age_limit_text,
              salary: draft.salary_text,
              last_date: draft.closing_date,
              apply_link: draft.official_apply_link,
              application_mode: draft.application_mode,
              job_category: draft.content_type === 'notification' ? 'Notification' : null,
              status: 'published',
              source: 'intake_pipeline',
              published_at: new Date().toISOString(),
              faq_html: draft.faq_json ? JSON.stringify(draft.faq_json) : null,
              advertisement_number: draft.advertisement_no,
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`Insert into employment_news_jobs failed: ${insErr.message}`);
          publishedId = inserted.id;
          publishedTable = 'employment_news_jobs';
          break;
        }

        case 'notifications': {
          const resolvedSlug = await resolveSlug(client, slug, 'employment_news_jobs');
          const { data: inserted, error: insErr } = await client
            .from('employment_news_jobs')
            .insert({
              enriched_title: title,
              org_name: draft.organisation_name,
              post: draft.post_name || title,
              slug: resolvedSlug,
              meta_title: draft.seo_title || title,
              meta_description: draft.meta_description,
              enriched_description: draft.draft_content_html || draft.summary,
              description: draft.draft_content_text || draft.summary,
              location: draft.job_location,
              qualification: draft.qualification_text,
              age_limit: draft.age_limit_text,
              salary: draft.salary_text,
              last_date: draft.closing_date,
              apply_link: draft.official_apply_link || draft.official_notification_link,
              application_mode: draft.application_mode,
              job_category: 'Notification',
              status: 'published',
              source: 'intake_pipeline',
              published_at: new Date().toISOString(),
              faq_html: draft.faq_json ? JSON.stringify(draft.faq_json) : null,
              advertisement_number: draft.advertisement_no,
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`Insert into employment_news_jobs failed: ${insErr.message}`);
          publishedId = inserted.id;
          publishedTable = 'employment_news_jobs';
          break;
        }

        case 'exams': {
          const resolvedSlug = await resolveSlug(client, slug, 'govt_exams');
          const { data: inserted, error: insErr } = await client
            .from('govt_exams')
            .insert({
              exam_name: draft.exam_name || title,
              slug: resolvedSlug,
              conducting_body: draft.organisation_name,
              status: 'upcoming',
              exam_category: 'Central',
              description: draft.draft_content_html || draft.summary,
              meta_title: draft.seo_title || title,
              meta_description: draft.meta_description,
              qualification: draft.qualification_text,
              age_limit: draft.age_limit_text,
              total_vacancies: draft.vacancy_count,
              application_fee: draft.application_fee_text,
              selection_process: draft.selection_process_text,
              official_website: draft.official_website_link,
              notification_pdf_url: draft.official_notification_link,
              apply_link: draft.official_apply_link,
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`Insert into govt_exams failed: ${insErr.message}`);
          publishedId = inserted.id;
          publishedTable = 'govt_exams';
          break;
        }

        case 'results': {
          const examResult = await findOrCreateExam(client, draft);
          if ('error' in examResult) {
            await client.from('intake_drafts').update({
              processing_status: 'publish_failed',
              publish_error: examResult.error,
              primary_status: 'manual_check',
            }).eq('id', draftId);
            return json({ error: examResult.error }, 400);
          }

          const { data: inserted, error: insErr } = await client
            .from('govt_results')
            .insert({
              exam_id: examResult.examId,
              result_title: title,
              result_date: draft.result_date || null,
              result_link: draft.result_link || draft.official_notification_link,
              description: draft.draft_content_html || draft.summary,
              status: 'published',
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`Insert into govt_results failed: ${insErr.message}`);
          publishedId = inserted.id;
          publishedTable = 'govt_results';
          break;
        }

        case 'admit_cards': {
          const examResult = await findOrCreateExam(client, draft);
          if ('error' in examResult) {
            await client.from('intake_drafts').update({
              processing_status: 'publish_failed',
              publish_error: examResult.error,
              primary_status: 'manual_check',
            }).eq('id', draftId);
            return json({ error: examResult.error }, 400);
          }

          const { data: inserted, error: insErr } = await client
            .from('govt_admit_cards')
            .insert({
              exam_id: examResult.examId,
              title: title,
              release_date: draft.admit_card_date || null,
              download_link: draft.admit_card_link || draft.official_notification_link,
              description: draft.draft_content_html || draft.summary,
              status: 'active',
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`Insert into govt_admit_cards failed: ${insErr.message}`);
          publishedId = inserted.id;
          publishedTable = 'govt_admit_cards';
          break;
        }

        case 'answer_keys': {
          const examResult = await findOrCreateExam(client, draft);
          if ('error' in examResult) {
            await client.from('intake_drafts').update({
              processing_status: 'publish_failed',
              publish_error: examResult.error,
              primary_status: 'manual_check',
            }).eq('id', draftId);
            return json({ error: examResult.error }, 400);
          }

          const { data: inserted, error: insErr } = await client
            .from('govt_answer_keys')
            .insert({
              exam_id: examResult.examId,
              title: title,
              release_date: draft.answer_key_date || null,
              download_link: draft.answer_key_link || draft.official_notification_link,
              description: draft.draft_content_html || draft.summary,
              status: 'published',
            })
            .select('id')
            .single();
          if (insErr) throw new Error(`Insert into govt_answer_keys failed: ${insErr.message}`);
          publishedId = inserted.id;
          publishedTable = 'govt_answer_keys';
          break;
        }

        default:
          return json({ error: `Unsupported publish target: ${draft.publish_target}` }, 400);
      }

      // Update intake draft with publish result
      await client.from('intake_drafts').update({
        processing_status: 'published',
        published_record_id: publishedId,
        published_table_name: publishedTable,
        published_at: new Date().toISOString(),
        publish_error: null,
      }).eq('id', draftId);

      return json({
        success: true,
        published_id: publishedId,
        table: publishedTable,
      });

    } catch (publishErr) {
      const errMsg = publishErr instanceof Error ? publishErr.message : 'Publish failed';
      await client.from('intake_drafts').update({
        processing_status: 'publish_failed',
        publish_error: errMsg,
      }).eq('id', draftId);
      return json({ error: errMsg }, 500);
    }

  } catch (e) {
    console.error('[intake-publish] Error:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});
