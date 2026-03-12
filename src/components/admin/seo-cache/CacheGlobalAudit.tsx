import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, AlertTriangle, XCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GlobalAuditResult, AuditSeverity, CachePage, PageData } from './cacheTypes';
import { runGlobalAudit } from './cacheValidation';

const SEVERITY_CONFIG: Record<AuditSeverity, { icon: typeof XCircle; color: string; label: string }> = {
  error: { icon: XCircle, color: 'text-destructive', label: 'Error' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-500', label: 'Info' },
};

interface Props {
  inventory: PageData[];
}

export function CacheGlobalAudit({ inventory }: Props) {
  const [results, setResults] = useState<GlobalAuditResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runAudit = async () => {
    setIsRunning(true);
    try {
      // Fetch all cached pages (slug + head_html only for audit)
      const allCached: CachePage[] = [];
      const allCachedSlugs = new Set<string>();
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase
          .from('seo_page_cache')
          .select('slug, page_type, head_html, body_html, content_hash, updated_at')
          .range(offset, offset + batchSize - 1);
        if (!data || data.length === 0) break;
        data.forEach((row: any) => {
          allCachedSlugs.add(row.slug);
          allCached.push({
            slug: row.slug,
            pageType: row.page_type || 'unknown',
            title: row.slug,
            status: 'cached',
            headHtml: row.head_html,
            bodyHtml: row.body_html,
            contentHash: row.content_hash,
            cacheUpdatedAt: row.updated_at,
            sourceUpdatedAt: null,
            inventoryEntry: null,
          });
        });
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      const inventorySlugs = new Set(inventory.map(p => p.slug));
      const auditResults = runGlobalAudit(allCached, inventorySlugs, allCachedSlugs);
      setResults(auditResults);
      setHasRun(true);
    } catch (err) {
      console.error('Global audit failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const grouped = {
    error: results.filter(r => r.severity === 'error'),
    warning: results.filter(r => r.severity === 'warning'),
    info: results.filter(r => r.severity === 'info'),
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Global Audit
          </CardTitle>
          <Button onClick={runAudit} disabled={isRunning || inventory.length === 0} size="sm" className="gap-1">
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            {isRunning ? 'Running…' : 'Run Global Audit'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasRun ? (
          <p className="text-sm text-muted-foreground">Click "Run Global Audit" to check for cross-page issues.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-emerald-600">✓ No issues found</p>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {(['error', 'warning', 'info'] as AuditSeverity[]).map(sev => {
                const items = grouped[sev];
                if (items.length === 0) return null;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <div key={sev}>
                    <p className={`text-sm font-semibold ${cfg.color} mb-2 flex items-center gap-1`}>
                      <cfg.icon className="h-4 w-4" /> {cfg.label}s ({items.length})
                    </p>
                    {items.map((r, i) => (
                      <div key={i} className="mb-3 pl-5">
                        <p className="text-sm font-medium">{r.category}</p>
                        <p className="text-xs text-muted-foreground">{r.message}</p>
                        {r.slugs.length > 0 && r.slugs.length <= 10 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.slugs.map(s => <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>)}
                          </div>
                        )}
                        {r.slugs.length > 10 && (
                          <details className="mt-1">
                            <summary className="text-xs cursor-pointer text-muted-foreground">Show all {r.slugs.length} slugs</summary>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.slugs.map(s => <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>)}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
