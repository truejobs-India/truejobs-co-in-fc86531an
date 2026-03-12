import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CachePage, CacheStats, CacheStatus, CacheFiltersState, PageData, STATUS_PRIORITY } from './cacheTypes';

const PAGE_SIZE = 50;

// Re-export collectAllPages from legacy builder
async function loadInventory(): Promise<PageData[]> {
  const { collectAllPages } = await import('@/components/admin/SEOCacheBuilder');
  return collectAllPages();
}

interface CacheRow {
  slug: string;
  page_type: string | null;
  updated_at: string;
  content_hash: string | null;
  head_html: string | null;
  body_html: string | null;
}

/**
 * Core approach: load lightweight cache rows (all slugs + timestamps) once,
 * merge with inventory, compute derived status for EVERY page, then
 * filter/sort/paginate entirely client-side. This ensures accurate counts.
 *
 * Full HTML is only stored on the current page's CachePage objects.
 */
export function useCacheData(filters: CacheFiltersState, page: number) {
  const [stats, setStats] = useState<CacheStats>({
    totalCacheable: 0, cached: 0, missing: 0, stale: 0, failed: 0,
    queuePending: 0, coveragePercent: 0, lastFullBuild: null, lastIncrementalBuild: null,
  });
  const [pages, setPages] = useState<CachePage[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<PageData[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [failedItems, setFailedItems] = useState<any[]>([]);
  const [deployTimestamp, setDeployTimestamp] = useState<string | null>(null);
  const inventoryLoaded = useRef(false);

  // All cache rows (lightweight — slug, timestamps, hash only)
  const [allCacheRows, setAllCacheRows] = useState<CacheRow[]>([]);
  // Queue statuses
  const [queueMap, setQueueMap] = useState<Map<string, string>>(new Map());

  const inventoryMap = useMemo(() => {
    const map = new Map<string, PageData>();
    inventory.forEach(p => map.set(p.slug, p));
    return map;
  }, [inventory]);

  const cacheMap = useMemo(() => {
    const map = new Map<string, CacheRow>();
    allCacheRows.forEach(r => map.set(r.slug, r));
    return map;
  }, [allCacheRows]);

  // Load inventory once
  useEffect(() => {
    if (inventoryLoaded.current) return;
    inventoryLoaded.current = true;
    loadInventory().then(setInventory);
  }, []);

  // Load deploy timestamp
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'last_deploy_at')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const val = typeof data.value === 'string' ? data.value : (data.value as any)?.timestamp;
          setDeployTimestamp(val || null);
        }
      });
  }, []);

  // Fetch ALL cache rows (lightweight) + queue data
  const fetchAllCacheData = useCallback(async () => {
    if (inventory.length === 0) return;

    // Fetch all cache slugs with timestamps (batched to handle >1000 rows)
    const rows: CacheRow[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('seo_page_cache')
        .select('slug, page_type, updated_at, content_hash')
        .range(offset, offset + batchSize - 1);
      if (!data || data.length === 0) break;
      data.forEach((r: any) => rows.push(r));
      if (data.length < batchSize) break;
      offset += batchSize;
    }
    setAllCacheRows(rows);

    // Fetch queue data
    const { data: queueData } = await supabase
      .from('seo_rebuild_queue' as any)
      .select('slug, status')
      .in('status', ['pending', 'processing', 'failed']);
    const qm = new Map<string, string>();
    (queueData || []).forEach((q: any) => qm.set(q.slug, q.status));
    setQueueMap(qm);

    // Fetch logs
    const [lastFullLog, lastIncrLog] = await Promise.all([
      supabase.from('seo_rebuild_log' as any).select('*').eq('rebuild_type', 'full').order('created_at', { ascending: false }).limit(1),
      supabase.from('seo_rebuild_log' as any).select('*').eq('rebuild_type', 'queue').order('created_at', { ascending: false }).limit(1),
    ]);

    setStats(prev => ({
      ...prev,
      lastFullBuild: (lastFullLog.data as any)?.[0]?.created_at || null,
      lastIncrementalBuild: (lastIncrLog.data as any)?.[0]?.created_at || null,
    }));
  }, [inventory]);

  // Compute derived status for a slug
  const computeStatus = useCallback((slug: string): CacheStatus => {
    const queueStatus = queueMap.get(slug);
    if (queueStatus === 'failed') return 'failed';
    if (queueStatus === 'processing') return 'rebuilding';
    if (queueStatus === 'pending') return 'queued';

    const cacheRow = cacheMap.get(slug);
    if (!cacheRow) return 'missing';

    const inv = inventoryMap.get(slug);
    if (!inv) return 'cached'; // orphaned but cached

    const cacheDate = new Date(cacheRow.updated_at).getTime();
    const pt = inv.pageType;

    if (['blog', 'govt-exam', 'employment-news'].some(t => pt === t || pt.startsWith(t))) {
      const sourceDate = new Date(inv.lastUpdated).getTime();
      if (!isNaN(sourceDate) && sourceDate > cacheDate) return 'stale';
    } else if (pt.startsWith('authority-') || pt === 'exam-hub' || pt === 'previous-year-paper') {
      const sourceDate = new Date(inv.lastUpdated).getTime();
      if (!isNaN(sourceDate) && sourceDate > cacheDate) return 'stale';
    } else {
      // Programmatic/static: use deploy timestamp
      if (deployTimestamp) {
        const deployDate = new Date(deployTimestamp).getTime();
        if (!isNaN(deployDate) && deployDate > cacheDate) return 'stale';
      }
      // No deploy timestamp → don't mark stale (graceful fallback)
    }

    return 'cached';
  }, [queueMap, cacheMap, inventoryMap, deployTimestamp]);

  // Build full merged list with derived statuses
  const allMergedPages = useMemo(() => {
    if (inventory.length === 0) return [];

    const result: CachePage[] = [];
    const seen = new Set<string>();

    // All inventory pages
    for (const inv of inventory) {
      seen.add(inv.slug);
      const cacheRow = cacheMap.get(inv.slug);
      const status = computeStatus(inv.slug);
      result.push({
        slug: inv.slug,
        pageType: inv.pageType,
        title: inv.title,
        status,
        headHtml: null, // loaded on demand
        bodyHtml: null,
        contentHash: cacheRow?.content_hash || null,
        cacheUpdatedAt: cacheRow?.updated_at || null,
        sourceUpdatedAt: inv.lastUpdated,
        inventoryEntry: inv,
      });
    }

    // Orphaned cache rows (not in inventory)
    for (const row of allCacheRows) {
      if (!seen.has(row.slug)) {
        result.push({
          slug: row.slug,
          pageType: row.page_type || 'unknown',
          title: row.slug,
          status: computeStatus(row.slug),
          headHtml: null,
          bodyHtml: null,
          contentHash: row.content_hash || null,
          cacheUpdatedAt: row.updated_at,
          sourceUpdatedAt: null,
          inventoryEntry: null,
        });
      }
    }

    return result;
  }, [inventory, allCacheRows, cacheMap, computeStatus]);

  // Compute stats from full merged list
  useEffect(() => {
    if (allMergedPages.length === 0) return;

    let cached = 0, missing = 0, stale = 0, failed = 0, queued = 0;
    for (const p of allMergedPages) {
      switch (p.status) {
        case 'cached': cached++; break;
        case 'missing': missing++; break;
        case 'stale': stale++; break;
        case 'failed': failed++; break;
        case 'queued': case 'rebuilding': queued++; break;
      }
    }

    setStats(prev => ({
      ...prev,
      totalCacheable: inventory.length,
      cached,
      missing,
      stale,
      failed,
      queuePending: queued,
      coveragePercent: inventory.length > 0 ? Math.round(((cached + stale) / inventory.length) * 100) : 0,
    }));
  }, [allMergedPages, inventory]);

  // Apply filters, sort, and paginate
  useEffect(() => {
    if (allMergedPages.length === 0 && inventory.length === 0) return;
    setIsLoading(true);

    let filtered = [...allMergedPages];

    // Search filter
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.slug.toLowerCase().includes(s) || p.title.toLowerCase().includes(s)
      );
    }

    // Page type filter
    if (filters.pageType) {
      filtered = filtered.filter(p => p.pageType === filters.pageType);
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === filters.status);
    }

    // Quick filter
    if (filters.quickFilter === 'missing') filtered = filtered.filter(p => p.status === 'missing');
    if (filters.quickFilter === 'stale') filtered = filtered.filter(p => p.status === 'stale');
    if (filters.quickFilter === 'failed') filtered = filtered.filter(p => p.status === 'failed');
    if (filters.quickFilter === 'recent') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      filtered = filtered.filter(p => p.cacheUpdatedAt && new Date(p.cacheUpdatedAt).getTime() > oneDayAgo);
    }

    // Sort by status priority, then by date
    filtered.sort((a, b) => {
      const diff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (diff !== 0) return diff;
      return (b.cacheUpdatedAt || '').localeCompare(a.cacheUpdatedAt || '');
    });

    setTotalRows(filtered.length);

    // Paginate
    const sliced = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    setPages(sliced);
    setIsLoading(false);
  }, [allMergedPages, filters, page, inventory]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('seo_rebuild_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs(data || []);
  }, []);

  const fetchFailedItems = useCallback(async () => {
    const { data } = await supabase
      .from('seo_rebuild_queue' as any)
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(50);
    setFailedItems(data || []);
  }, []);

  // Trigger data load when inventory is ready
  useEffect(() => {
    if (inventory.length > 0) {
      fetchAllCacheData();
    }
  }, [inventory, deployTimestamp]);

  useEffect(() => {
    fetchLogs();
    fetchFailedItems();
  }, []);

  const refresh = useCallback(() => {
    fetchAllCacheData();
    fetchLogs();
    fetchFailedItems();
  }, [fetchAllCacheData, fetchLogs, fetchFailedItems]);

  // Function to load full HTML for a specific page (for preview/validation)
  const loadPageHtml = useCallback(async (slug: string): Promise<{ head_html: string | null; body_html: string | null }> => {
    const { data } = await supabase
      .from('seo_page_cache')
      .select('head_html, body_html')
      .eq('slug', slug)
      .maybeSingle();
    return { head_html: data?.head_html || null, body_html: data?.body_html || null };
  }, []);

  // For export: return the full filtered list (not just current page)
  const getFilteredPages = useCallback((): CachePage[] => {
    let filtered = [...allMergedPages];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(p => p.slug.toLowerCase().includes(s) || p.title.toLowerCase().includes(s));
    }
    if (filters.pageType) filtered = filtered.filter(p => p.pageType === filters.pageType);
    if (filters.status && filters.status !== 'all') filtered = filtered.filter(p => p.status === filters.status);
    if (filters.quickFilter === 'missing') filtered = filtered.filter(p => p.status === 'missing');
    if (filters.quickFilter === 'stale') filtered = filtered.filter(p => p.status === 'stale');
    if (filters.quickFilter === 'failed') filtered = filtered.filter(p => p.status === 'failed');
    if (filters.quickFilter === 'recent') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      filtered = filtered.filter(p => p.cacheUpdatedAt && new Date(p.cacheUpdatedAt).getTime() > oneDayAgo);
    }
    filtered.sort((a, b) => {
      const diff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (diff !== 0) return diff;
      return (b.cacheUpdatedAt || '').localeCompare(a.cacheUpdatedAt || '');
    });
    return filtered;
  }, [allMergedPages, filters]);

  return {
    stats, pages, totalRows, isLoading, inventory, inventoryMap,
    logs, failedItems, refresh, pageSize: PAGE_SIZE,
    loadPageHtml, allMergedPages, getFilteredPages,
  };
}
