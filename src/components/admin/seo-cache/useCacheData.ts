import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CachePage, CacheStats, CacheStatus, CacheFiltersState, PageData, STATUS_PRIORITY } from './cacheTypes';

const PAGE_SIZE = 50;

// Re-export collectAllPages from legacy builder
async function loadInventory(): Promise<PageData[]> {
  const { collectAllPages } = await import('@/components/admin/SEOCacheBuilder');
  return collectAllPages();
}

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

  const inventoryMap = useMemo(() => {
    const map = new Map<string, PageData>();
    inventory.forEach(p => map.set(p.slug, p));
    return map;
  }, [inventory]);

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

  const fetchStats = useCallback(async () => {
    if (inventory.length === 0) return;

    const [cachedRes, queuePendingRes, queueFailedRes] = await Promise.all([
      supabase.from('seo_page_cache').select('*', { count: 'exact', head: true }),
      supabase.from('seo_rebuild_queue' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('seo_rebuild_queue' as any).select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    ]);

    const lastFullLog = await supabase
      .from('seo_rebuild_log' as any)
      .select('*')
      .eq('rebuild_type', 'full')
      .order('created_at', { ascending: false })
      .limit(1);
    const lastIncrLog = await supabase
      .from('seo_rebuild_log' as any)
      .select('*')
      .eq('rebuild_type', 'queue')
      .order('created_at', { ascending: false })
      .limit(1);

    const cachedCount = cachedRes.count ?? 0;
    const totalCacheable = inventory.length;
    const missingCount = Math.max(0, totalCacheable - cachedCount);
    const failedCount = queueFailedRes.count ?? 0;

    setStats({
      totalCacheable,
      cached: cachedCount,
      missing: missingCount,
      stale: 0, // computed from page-level data below
      failed: failedCount,
      queuePending: queuePendingRes.count ?? 0,
      coveragePercent: totalCacheable > 0 ? Math.round((cachedCount / totalCacheable) * 100) : 0,
      lastFullBuild: lastFullLog.data?.[0]?.created_at || null,
      lastIncrementalBuild: lastIncrLog.data?.[0]?.created_at || null,
    });
  }, [inventory]);

  const fetchPages = useCallback(async () => {
    if (inventory.length === 0) return;
    setIsLoading(true);

    // If filtering for "missing" pages, we handle client-side from inventory
    if (filters.status === 'missing' || filters.quickFilter === 'missing') {
      const allCachedSlugs = new Set<string>();
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase.from('seo_page_cache').select('slug').range(offset, offset + batchSize - 1);
        if (!data || data.length === 0) break;
        data.forEach((r: any) => allCachedSlugs.add(r.slug));
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      let missing = inventory.filter(p => !allCachedSlugs.has(p.slug));
      if (filters.search) {
        const s = filters.search.toLowerCase();
        missing = missing.filter(p => p.slug.includes(s) || p.title.toLowerCase().includes(s));
      }
      if (filters.pageType) {
        missing = missing.filter(p => p.pageType === filters.pageType);
      }
      setTotalRows(missing.length);
      const sliced = missing.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      setPages(sliced.map(p => ({
        slug: p.slug, pageType: p.pageType, title: p.title, status: 'missing' as CacheStatus,
        headHtml: null, bodyHtml: null, contentHash: null,
        cacheUpdatedAt: null, sourceUpdatedAt: p.lastUpdated, inventoryEntry: p,
      })));
      setIsLoading(false);
      return;
    }

    // Build supabase query
    let query = supabase.from('seo_page_cache').select('*', { count: 'exact' });

    if (filters.search) {
      query = query.or(`slug.ilike.%${filters.search}%,page_type.ilike.%${filters.search}%`);
    }
    if (filters.pageType) {
      query = query.eq('page_type', filters.pageType);
    }

    // Fetch queue data for status enrichment
    const { data: queueData } = await supabase
      .from('seo_rebuild_queue' as any)
      .select('slug, status')
      .in('status', ['pending', 'processing', 'failed']);
    const queueMap = new Map<string, string>();
    (queueData || []).forEach((q: any) => queueMap.set(q.slug, q.status));

    query = query.order('updated_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) { console.error(error); setIsLoading(false); return; }

    const cachePages: CachePage[] = (data || []).map((row: any) => {
      const inv = inventoryMap.get(row.slug);
      const queueStatus = queueMap.get(row.slug);
      let status: CacheStatus = 'cached';

      if (queueStatus === 'failed') status = 'failed';
      else if (queueStatus === 'processing') status = 'rebuilding';
      else if (queueStatus === 'pending') status = 'queued';
      else {
        // Stale detection per page type
        const cacheDate = new Date(row.updated_at).getTime();
        if (inv) {
          const pt = inv.pageType;
          if (['blog', 'govt-exam', 'employment-news'].some(t => pt === t || pt.startsWith(t))) {
            // DB-backed: compare against inventory lastUpdated
            const sourceDate = new Date(inv.lastUpdated).getTime();
            if (sourceDate > cacheDate) status = 'stale';
          } else if (pt.startsWith('authority-') || pt === 'exam-hub' || pt === 'previous-year-paper') {
            // TS registry backed
            const sourceDate = new Date(inv.lastUpdated).getTime();
            if (!isNaN(sourceDate) && sourceDate > cacheDate) status = 'stale';
          } else {
            // Programmatic/static: use deploy timestamp
            if (deployTimestamp) {
              const deployDate = new Date(deployTimestamp).getTime();
              if (!isNaN(deployDate) && deployDate > cacheDate) status = 'stale';
            }
            // If no deploy timestamp, don't mark as stale (graceful fallback)
          }
        }
      }

      return {
        slug: row.slug,
        pageType: row.page_type || inv?.pageType || 'unknown',
        title: inv?.title || row.slug,
        status,
        headHtml: row.head_html,
        bodyHtml: row.body_html,
        contentHash: row.content_hash,
        cacheUpdatedAt: row.updated_at,
        sourceUpdatedAt: inv?.lastUpdated || null,
        inventoryEntry: inv || null,
      };
    });

    // Filter by status if requested
    let filtered = cachePages;
    if (filters.status && filters.status !== 'all' && filters.status !== 'missing') {
      filtered = cachePages.filter(p => p.status === filters.status);
    }
    if (filters.quickFilter === 'stale') filtered = cachePages.filter(p => p.status === 'stale');
    if (filters.quickFilter === 'failed') filtered = cachePages.filter(p => p.status === 'failed');
    if (filters.quickFilter === 'recent') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      filtered = cachePages.filter(p => p.cacheUpdatedAt && new Date(p.cacheUpdatedAt).getTime() > oneDayAgo);
    }

    // Sort by status priority
    filtered.sort((a, b) => {
      const diff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (diff !== 0) return diff;
      return (b.cacheUpdatedAt || '').localeCompare(a.cacheUpdatedAt || '');
    });

    setPages(filtered);
    setTotalRows(count ?? filtered.length);
    setIsLoading(false);
  }, [filters, page, inventory, inventoryMap, deployTimestamp]);

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

  useEffect(() => {
    if (inventory.length > 0) {
      fetchStats();
      fetchPages();
    }
  }, [inventory, filters, page, deployTimestamp]);

  useEffect(() => {
    fetchLogs();
    fetchFailedItems();
  }, []);

  const refresh = useCallback(() => {
    fetchStats();
    fetchPages();
    fetchLogs();
    fetchFailedItems();
  }, [fetchStats, fetchPages, fetchLogs, fetchFailedItems]);

  return {
    stats, pages, totalRows, isLoading, inventory, inventoryMap,
    logs, failedItems, refresh, pageSize: PAGE_SIZE,
  };
}
