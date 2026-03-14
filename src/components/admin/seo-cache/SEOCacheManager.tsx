import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Globe, RefreshCw, Loader2, Download, Trash2 } from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { CacheFiltersState, CachePage } from './cacheTypes';
import { useCacheData } from './useCacheData';
import { CacheOverviewCards } from './CacheOverviewCards';
import { CacheFilters } from './CacheFilters';
import { CacheStatusTable } from './CacheStatusTable';
import { CachePreviewModal } from './CachePreviewModal';
import { CacheValidationPanel } from './CacheValidationPanel';
import { CacheGlobalAudit } from './CacheGlobalAudit';
import { CacheBuildLog } from './CacheBuildLog';
import { CacheFailedItems } from './CacheFailedItems';
import { SEOValidationDashboard } from './SEOValidationDashboard';
import { exportAsCSV, exportAsJSON } from './cacheExport';

export function SEOCacheManager() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<CacheFiltersState>({
    search: '', pageType: '', status: '', quickFilter: 'all',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const {
    stats, pages, totalRows, isLoading, inventory, logs, failedItems,
    refresh, pageSize, loadPageHtml, allMergedPages, getFilteredPages,
  } = useCacheData(filters, currentPage);

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [previewPage, setPreviewPage] = useState<CachePage | null>(null);
  const [validatePage, setValidatePage] = useState<CachePage | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');

  const handleFiltersChange = (f: CacheFiltersState) => {
    setFilters(f);
    setCurrentPage(0);
    setSelectedSlugs(new Set());
  };

  // Load full HTML before opening preview/validation
  const handlePreview = useCallback(async (p: CachePage) => {
    if (p.headHtml || p.status === 'missing') {
      setPreviewPage(p);
      return;
    }
    const { head_html, body_html } = await loadPageHtml(p.slug);
    setPreviewPage({ ...p, headHtml: head_html, bodyHtml: body_html });
  }, [loadPageHtml]);

  const handleValidate = useCallback(async (p: CachePage) => {
    if (p.headHtml || p.status === 'missing') {
      setValidatePage(p);
      return;
    }
    const { head_html, body_html } = await loadPageHtml(p.slug);
    setValidatePage({ ...p, headHtml: head_html, bodyHtml: body_html });
  }, [loadPageHtml]);

  const handleRebuildSlugs = useCallback(async (slugs: string[]) => {
    setIsRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-cache-rebuild', {
        body: { mode: 'slugs', slugs, trigger: 'admin-ui' },
      });
      if (error) throw error;
      toast({
        title: 'Rebuild Complete',
        description: `Rebuilt: ${data?.rebuilt ?? 0}, Skipped: ${data?.skipped ?? 0}`,
      });
      setSelectedSlugs(new Set());
      refresh();
    } catch (err: any) {
      toast({ title: 'Rebuild Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRebuilding(false);
    }
  }, [toast, refresh]);

  const handleRebuildAll = async () => {
    setIsRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-cache-rebuild', {
        body: { mode: 'full', trigger: 'admin-ui' },
      });
      if (error) throw error;
      toast({
        title: 'Full Rebuild Complete',
        description: `Rebuilt: ${data?.rebuilt ?? 0}, Skipped: ${data?.skipped ?? 0}, Failed: ${data?.failed ?? 0}`,
      });
      refresh();
    } catch (err: any) {
      toast({ title: 'Rebuild Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRebuilding(false);
    }
  };

  const handlePurgeAllCF = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('seo-cache-rebuild', {
        body: { mode: 'purge-all-cf', trigger: 'admin-ui' },
      });
      if (error) throw error;
      toast({
        title: 'CF Cache Purged',
        description: data?.message || 'All Cloudflare cached pages have been purged.',
      });
      setPurgeConfirmText('');
    } catch (err: any) {
      toast({ title: 'Purge Failed', description: err.message, variant: 'destructive' });
      setPurgeConfirmText('');
    }
  };

  const handleExport = (format: 'csv' | 'json', scope: 'filtered' | 'all') => {
    const data = scope === 'all' ? allMergedPages : getFilteredPages();
    if (format === 'csv') exportAsCSV(data, `seo-cache-${scope}.csv`);
    else exportAsJSON(data, `seo-cache-${scope}.json`);
    toast({ title: 'Exported', description: `${data.length} rows exported as ${format.toUpperCase()}` });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            SEO Static HTML Cache
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1 h-8">
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>

            {/* Rebuild All — standard confirm */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="secondary" disabled={isRebuilding} className="gap-1 h-8">
                  {isRebuilding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Rebuild All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rebuild All Pages?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will regenerate cached HTML for all {stats.totalCacheable} pages. Unchanged pages will be skipped.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRebuildAll}>Rebuild All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Purge All CF — type-to-confirm */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1 h-8">
                  <Trash2 className="h-3 w-3" /> Purge All CF
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ Purge All Cloudflare Cache?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>This will purge <strong>ALL</strong> cached pages from Cloudflare CDN. All pages will be re-fetched from origin on next visit, causing temporary increased load.</p>
                    <p className="font-medium">Type <code className="bg-muted px-1 rounded">PURGE ALL</code> to confirm:</p>
                    <Input
                      value={purgeConfirmText}
                      onChange={e => setPurgeConfirmText(e.target.value)}
                      placeholder="Type PURGE ALL"
                      className="mt-2"
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPurgeConfirmText('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={purgeConfirmText !== 'PURGE ALL'}
                    onClick={handlePurgeAllCF}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Purge All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 h-8">
                  <Download className="h-3 w-3" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv', 'filtered')}>Export Filtered (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json', 'filtered')}>Export Filtered (JSON)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv', 'all')}>Export All (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json', 'all')}>Export All (JSON)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CacheOverviewCards stats={stats} isLoading={isLoading && currentPage === 0} />

        <Tabs defaultValue="pages">
          <TabsList>
            <TabsTrigger value="pages">All Pages</TabsTrigger>
            <TabsTrigger value="audit">Global Audit</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="log">Build Log</TabsTrigger>
            <TabsTrigger value="failed">
              Failed{failedItems.length > 0 ? ` (${failedItems.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="space-y-3 mt-3">
            <CacheFilters filters={filters} onChange={handleFiltersChange} />
            <CacheStatusTable
              pages={pages}
              totalRows={totalRows}
              currentPage={currentPage}
              pageSize={pageSize}
              isLoading={isLoading}
              onPageChange={setCurrentPage}
              onPreview={handlePreview}
              onValidate={handleValidate}
              onRebuild={handleRebuildSlugs}
              isRebuilding={isRebuilding}
              selectedSlugs={selectedSlugs}
              onSelectionChange={setSelectedSlugs}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-3">
            <CacheGlobalAudit inventory={inventory} />
          </TabsContent>

          <TabsContent value="validation" className="mt-3">
            <SEOValidationDashboard
              allMergedPages={allMergedPages}
              inventory={inventory}
              loadPageHtml={loadPageHtml}
              handleRebuildSlugs={handleRebuildSlugs}
            />
          </TabsContent>

          <TabsContent value="log" className="mt-3">
            <CacheBuildLog logs={logs} />
          </TabsContent>

          <TabsContent value="failed" className="mt-3">
            <CacheFailedItems items={failedItems} onRefresh={refresh} />
          </TabsContent>
        </Tabs>

        <CachePreviewModal page={previewPage} open={!!previewPage} onClose={() => setPreviewPage(null)} />
        <CacheValidationPanel page={validatePage} open={!!validatePage} onClose={() => setValidatePage(null)} />
      </CardContent>
    </Card>
  );
}
