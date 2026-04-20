/**
 * Firecrawl - P (PEAK) admin container.
 * Reuses the existing FirecrawlSourcesManager, GovtSourcesManager, and
 * DraftJobsSection but pins them to the isolated peak source_type tags:
 *   - firecrawl_sitemap_peak
 *   - government_peak
 *
 * Plus inline xlsx export buttons for sources, staged items, drafts, and runs.
 */
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminToast } from '@/contexts/AdminMessagesContext';
import { Zap, Download, Loader2 } from 'lucide-react';
import { FirecrawlSourcesManager } from '@/components/admin/firecrawl/FirecrawlSourcesManager';
import { GovtSourcesManager } from '@/components/admin/firecrawl/GovtSourcesManager';
import { DraftJobsSection } from '@/components/admin/firecrawl/DraftJobsSection';

const PEAK_SOURCE_TYPES = ['firecrawl_sitemap_peak', 'government_peak'] as const;

/** Paginated SELECT helper (project pagination policy: > 1000 rows). */
async function fetchAllPaginated<T>(
  build: () => any,
): Promise<T[]> {
  const PAGE = 1000;
  let from = 0;
  const out: T[] = [];
  // Loop until empty page
  // eslint-disable-next-line no-constant-condition
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

function downloadXlsx(rows: any[], sheet: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
}

export function FirecrawlPeakManager() {
  const { toast } = useAdminToast();
  const [exporting, setExporting] = useState<string | null>(null);
  const [bundling, setBundling] = useState(false);

  const peakBadge = (
    <Badge variant="destructive" className="ml-2 text-[10px]">PEAK</Badge>
  );

  const exportSources = async () => {
    setExporting('sources');
    try {
      const rows = await fetchAllPaginated<any>(() =>
        supabase.from('firecrawl_sources').select('*').in('source_type', PEAK_SOURCE_TYPES as any),
      );
      downloadXlsx(
        rows.map((r) => ({
          name: r.source_name, url: r.seed_url, source_type: r.source_type,
          priority: r.priority, crawl_mode: r.crawl_mode, extraction_mode: r.extraction_mode,
          max_pages_per_run: r.max_pages_per_run, enabled: r.is_enabled,
          created_at: r.created_at, last_run_at: r.last_fetched_at,
        })),
        'PeakSources', `firecrawl-peak-sources-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast({ title: `Exported ${rows.length} peak sources` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally { setExporting(null); }
  };

  const exportStaged = async () => {
    setExporting('staged');
    try {
      const peakSources = await fetchAllPaginated<any>(() =>
        supabase.from('firecrawl_sources').select('id').in('source_type', PEAK_SOURCE_TYPES as any),
      );
      const ids = peakSources.map((s) => s.id);
      if (!ids.length) { toast({ title: 'No peak sources yet' }); return; }
      const rows = await fetchAllPaginated<any>(() =>
        supabase.from('firecrawl_staged_items').select('*').in('firecrawl_source_id', ids),
      );
      downloadXlsx(
        rows.map((r) => ({
          source_url: r.page_url, title: r.page_title, bucket: r.bucket,
          status: r.status, extraction_status: r.extraction_status,
          content_hash: r.content_hash,
          raw_markdown: (r.extracted_markdown || '').slice(0, 32_000),
          created_at: r.created_at,
        })),
        'PeakStaged', `firecrawl-peak-staged-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast({ title: `Exported ${rows.length} staged items` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally { setExporting(null); }
  };

  const exportDrafts = async () => {
    setExporting('drafts');
    try {
      const rows = await fetchAllPaginated<any>(() =>
        supabase.from('firecrawl_draft_jobs').select('*').in('source_type_tag', PEAK_SOURCE_TYPES as any),
      );
      downloadXlsx(
        rows.map((r) => ({
          title: r.title, organization: r.organization_name, location: r.location,
          qualification: r.qualification, last_date: r.last_date_of_application,
          source_url: r.source_url, status: r.status,
          extraction_confidence: r.extraction_confidence, created_at: r.created_at,
          details: JSON.stringify(r.extracted_raw_fields || {}),
        })),
        'PeakDrafts', `firecrawl-peak-drafts-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast({ title: `Exported ${rows.length} draft jobs` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally { setExporting(null); }
  };

  const exportRuns = async () => {
    setExporting('runs');
    try {
      const peakSources = await fetchAllPaginated<any>(() =>
        supabase.from('firecrawl_sources').select('id').in('source_type', PEAK_SOURCE_TYPES as any),
      );
      const ids = peakSources.map((s) => s.id);
      if (!ids.length) { toast({ title: 'No peak sources yet' }); return; }
      const rows = await fetchAllPaginated<any>(() =>
        supabase.from('firecrawl_fetch_runs').select('*').in('firecrawl_source_id', ids),
      );
      downloadXlsx(
        rows.map((r) => ({
          started_at: r.started_at, finished_at: r.finished_at, status: r.status,
          run_mode: r.run_mode, items_found: r.items_found, items_new: r.items_new,
          errors_json: JSON.stringify(r.error_log || null),
        })),
        'PeakRuns', `firecrawl-peak-runs-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast({ title: `Exported ${rows.length} runs` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally { setExporting(null); }
  };

  const downloadBundle = async () => {
    setBundling(true);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-peak-export-bundle', {
        body: {},
      });
      if (error) throw new Error(error.message);
      // Edge returns a base64 zip
      const b64 = (data as any)?.zip_base64;
      if (!b64) throw new Error('No zip returned');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `firecrawl-peak-bundle-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Bundle downloaded' });
    } catch (e: any) {
      toast({ title: 'Bundle failed', description: e.message, variant: 'destructive' });
    } finally { setBundling(false); }
  };

  return (
    <div className="space-y-4">
      {/* Warning banner + bundle button */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-4 pb-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-2">
            <Zap className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <div className="font-semibold flex items-center gap-2">
                Firecrawl - P (Peak Mode) {peakBadge}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                Aggressive mode — 5× scrape volume, parallel workers, reduced throttle.
                Quotas burn faster. Fully isolated from the regular Firecrawl tab via separate
                source_type tags (<code className="text-[10px]">firecrawl_sitemap_peak</code>,{' '}
                <code className="text-[10px]">government_peak</code>).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={exportSources} disabled={!!exporting}>
              {exporting === 'sources' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Sources .xlsx
            </Button>
            <Button size="sm" variant="outline" onClick={exportStaged} disabled={!!exporting}>
              {exporting === 'staged' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Staged .xlsx
            </Button>
            <Button size="sm" variant="outline" onClick={exportDrafts} disabled={!!exporting}>
              {exporting === 'drafts' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Drafts .xlsx
            </Button>
            <Button size="sm" variant="outline" onClick={exportRuns} disabled={!!exporting}>
              {exporting === 'runs' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Runs .xlsx
            </Button>
            <Button size="sm" variant="default" onClick={downloadBundle} disabled={bundling}>
              {bundling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Raw bundle (.zip)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Source sections — peak-tagged */}
      <GovtSourcesManager
        sourceTypeOverride="government_peak"
        titleOverride="Peak Government Sources"
        defaultMaxPagesPerRun={250}
        titleBadge={peakBadge}
      />
      <FirecrawlSourcesManager sourceTypeFilter="firecrawl_sitemap_peak" />

      {/* Draft sections — peak-tagged (cast: types not yet regenerated for new tags) */}
      <DraftJobsSection sourceTypeTag={'government_peak' as any} />
      <DraftJobsSection sourceTypeTag={'firecrawl_sitemap_peak' as any} />
    </div>
  );
}