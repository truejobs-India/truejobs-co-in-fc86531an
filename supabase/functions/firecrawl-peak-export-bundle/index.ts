/**
 * firecrawl-peak-export-bundle
 *
 * Builds a ZIP archive of every Firecrawl Peak artifact:
 *   - peak-sources.csv
 *   - peak-staged.csv
 *   - peak-drafts.csv
 *   - peak-runs.csv
 *   - staged-markdown/<id>.md  (one full markdown file per staged item)
 *
 * Returns: { zip_base64, stats } so the browser can save it as a Blob.
 *
 * Auth: admin role required (validated via JWT + has_role()).
 * Pagination: every read uses .range() in 1000-row pages (project policy).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BlobWriter, TextReader, ZipWriter } from 'https://deno.land/x/zipjs@v2.7.45/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PEAK_SOURCE_TYPES = ['firecrawl_sitemap_peak', 'government_peak'];

/** CSV escape: quote any cell containing comma, quote, or newline. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.map(csvCell).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

/** Paginated select honouring the 1000-row Supabase JS cap. */
async function fetchAll<T>(build: () => any): Promise<T[]> {
  const PAGE = 1000;
  let from = 0;
  const out: T[] = [];
  while (true) {
    const { data, error } = await build().order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate caller JWT + admin role
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Sources (peak only)
    const sources = await fetchAll<any>(() =>
      admin.from('firecrawl_sources').select('*').in('source_type', PEAK_SOURCE_TYPES),
    );
    const peakSourceIds = sources.map((s) => s.id);

    // 2. Staged items belonging to peak sources
    const staged = peakSourceIds.length
      ? await fetchAll<any>(() =>
          admin.from('firecrawl_staged_items').select('*').in('firecrawl_source_id', peakSourceIds),
        )
      : [];

    // 3. Draft jobs tagged peak
    const drafts = await fetchAll<any>(() =>
      admin.from('firecrawl_draft_jobs').select('*').in('source_type_tag', PEAK_SOURCE_TYPES),
    );

    // 4. Fetch runs for peak sources
    const runs = peakSourceIds.length
      ? await fetchAll<any>(() =>
          admin.from('firecrawl_fetch_runs').select('*').in('firecrawl_source_id', peakSourceIds),
        )
      : [];

    // Build CSVs
    const sourcesCsv = toCsv(
      sources.map((r) => ({
        id: r.id, name: r.source_name, url: r.seed_url, source_type: r.source_type,
        priority: r.priority, crawl_mode: r.crawl_mode, extraction_mode: r.extraction_mode,
        max_pages_per_run: r.max_pages_per_run, enabled: r.is_enabled,
        created_at: r.created_at, last_run_at: r.last_fetched_at,
      })),
      ['id', 'name', 'url', 'source_type', 'priority', 'crawl_mode', 'extraction_mode',
        'max_pages_per_run', 'enabled', 'created_at', 'last_run_at'],
    );

    const stagedCsv = toCsv(
      staged.map((r) => ({
        id: r.id, source_url: r.page_url, title: r.page_title, bucket: r.bucket,
        status: r.status, extraction_status: r.extraction_status,
        content_hash: r.content_hash, created_at: r.created_at,
        firecrawl_source_id: r.firecrawl_source_id,
      })),
      ['id', 'source_url', 'title', 'bucket', 'status', 'extraction_status',
        'content_hash', 'created_at', 'firecrawl_source_id'],
    );

    const draftsCsv = toCsv(
      drafts.map((r) => ({
        id: r.id, title: r.title, organization: r.organization_name, location: r.location,
        qualification: r.qualification, last_date: r.last_date_of_application,
        source_url: r.source_url, status: r.status,
        extraction_confidence: r.extraction_confidence, created_at: r.created_at,
        details: JSON.stringify(r.extracted_raw_fields || {}),
      })),
      ['id', 'title', 'organization', 'location', 'qualification', 'last_date',
        'source_url', 'status', 'extraction_confidence', 'created_at', 'details'],
    );

    const runsCsv = toCsv(
      runs.map((r) => ({
        id: r.id, started_at: r.started_at, finished_at: r.finished_at,
        status: r.status, run_mode: r.run_mode,
        items_found: r.items_found, items_new: r.items_new,
        errors_json: JSON.stringify(r.error_log || null),
        firecrawl_source_id: r.firecrawl_source_id,
      })),
      ['id', 'started_at', 'finished_at', 'status', 'run_mode',
        'items_found', 'items_new', 'errors_json', 'firecrawl_source_id'],
    );

    // Build ZIP
    const blobWriter = new BlobWriter('application/zip');
    const zip = new ZipWriter(blobWriter);
    await zip.add('peak-sources.csv', new TextReader(sourcesCsv));
    await zip.add('peak-staged.csv', new TextReader(stagedCsv));
    await zip.add('peak-drafts.csv', new TextReader(draftsCsv));
    await zip.add('peak-runs.csv', new TextReader(runsCsv));

    // One markdown file per staged item that has extracted_markdown
    let mdCount = 0;
    for (const item of staged) {
      const md: string | null = item.extracted_markdown ?? null;
      if (!md) continue;
      const safeId = String(item.id).replace(/[^a-zA-Z0-9-]/g, '_');
      const header = `# ${item.page_title ?? '(untitled)'}\n\nSource: ${item.page_url ?? ''}\n\n---\n\n`;
      await zip.add(`staged-markdown/${safeId}.md`, new TextReader(header + md));
      mdCount++;
    }

    await zip.close();
    const blob = await blobWriter.getData();
    const buf = new Uint8Array(await blob.arrayBuffer());

    // Base64 encode (chunked to avoid call-stack overflow)
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    }
    const zip_base64 = btoa(binary);

    return new Response(
      JSON.stringify({
        zip_base64,
        stats: {
          sources: sources.length,
          staged: staged.length,
          drafts: drafts.length,
          runs: runs.length,
          markdown_files: mdCount,
          zip_bytes: buf.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[firecrawl-peak-export-bundle] error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
