import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ChevronDown, ChevronRight, Activity, XCircle } from 'lucide-react';
import { useAdminToast } from '@/contexts/AdminMessagesContext';

interface HealthIssue {
  slug: string;
  pageType: string;
  issue: string;
  severity: 'warning' | 'error';
}

export function SEOContentHealth() {
  const [issues, setIssues] = useState<HealthIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [stats, setStats] = useState({ authority: 0, hubs: 0, pyp: 0, longTail: 0, total: 0 });

  const runScan = async () => {
    setIsScanning(true);
    setScanError(null);
    const found: HealthIssue[] = [];
    const now = new Date();

    const scanLogic = async () => {
      // Authority pages
      const { getAllExamAuthoritySlugs, getExamAuthorityConfig } = await import('@/data/examAuthority/index');
      const authSlugs = getAllExamAuthoritySlugs();

      for (const slug of authSlugs) {
        const cfg = getExamAuthorityConfig(slug);
        if (!cfg) continue;

        const lastUpdated = new Date(cfg.lastUpdated);
        const daysDiff = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 60) {
          found.push({ slug, pageType: `authority-${cfg.pageType}`, issue: `Last updated ${daysDiff} days ago`, severity: 'warning' });
        }

        const contentFields = [cfg.overview, cfg.eligibility || '', cfg.syllabusSummary || ''];
        if (contentFields.some(f => /\bTBA\b|To Be Announced/i.test(f))) {
          found.push({ slug, pageType: `authority-${cfg.pageType}`, issue: 'Contains TBA / To Be Announced placeholder', severity: 'warning' });
        }

        if (cfg.metaTitle.length > 60) {
          found.push({ slug, pageType: `authority-${cfg.pageType}`, issue: `metaTitle too long (${cfg.metaTitle.length} chars)`, severity: 'error' });
        }
        if (cfg.metaDescription.length > 160) {
          found.push({ slug, pageType: `authority-${cfg.pageType}`, issue: `metaDescription too long (${cfg.metaDescription.length} chars)`, severity: 'error' });
        }

        if (cfg.pageType === 'notification' && (!cfg.cutoffs || cfg.cutoffs.length === 0)) {
          found.push({ slug, pageType: 'authority-notification', issue: 'Missing cutoff data', severity: 'warning' });
        }
      }

      const { getAllHubSlugs } = await import('@/data/examAuthority/hubs');
      const hubSlugs = getAllHubSlugs();

      const { getAllPYPSlugs } = await import('@/data/previousYearPapers');
      const pypSlugs = getAllPYPSlugs();

      const { getAllCustomLongTailSlugs } = await import('@/pages/seo/customLongTailData');
      const ltSlugs = getAllCustomLongTailSlugs();

      setStats({
        authority: authSlugs.length,
        hubs: hubSlugs.length,
        pyp: pypSlugs.length,
        longTail: ltSlugs.length,
        total: authSlugs.length + hubSlugs.length + pypSlugs.length + ltSlugs.length,
      });
    };

    try {
      await Promise.all([scanLogic(), new Promise(r => setTimeout(r, 400))]);
      setIssues(found);
      setHasScanned(true);
      const errorCount = found.filter(i => i.severity === 'error').length;
      const warningCount = found.filter(i => i.severity === 'warning').length;
      toast({
        title: 'Health check complete',
        description: `${stats.total || 'All'} pages scanned — ${errorCount} errors, ${warningCount} warnings`,
      });
    } catch (err: any) {
      console.error('SEOContentHealth scan error:', err);
      setScanError(err?.message || 'Unknown error during scan');
    }

    setIsScanning(false);
  };

  // Group issues by type
  const grouped = issues.reduce<Record<string, HealthIssue[]>>((acc, issue) => {
    const key = issue.issue.includes('metaTitle') || issue.issue.includes('metaDescription')
      ? 'Metadata Issues'
      : issue.issue.includes('TBA')
      ? 'Placeholder Content'
      : issue.issue.includes('cutoff')
      ? 'Missing Data'
      : 'Stale Content';
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          SEO Content Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scans authority pages, hubs, and custom long-tail configs for stale content, placeholder text, and metadata issues.
        </p>

        <div className="flex items-center gap-3">
          <Button onClick={runScan} disabled={isScanning} variant="outline" className="gap-2">
            {isScanning ? 'Scanning...' : 'Run Health Check'}
          </Button>
          {hasScanned && (
            <div className="flex gap-2">
              <Badge variant="secondary">{stats.total} pages scanned</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} errors</Badge>}
              {warningCount > 0 && <Badge className="bg-amber-100 text-amber-800">{warningCount} warnings</Badge>}
              {issues.length === 0 && <Badge className="bg-emerald-100 text-emerald-800">All healthy</Badge>}
            </div>
          )}
        </div>

        {scanError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{scanError}</AlertDescription>
          </Alert>
        )}

        {hasScanned && (
          <div className="text-xs text-muted-foreground flex gap-4">
            <span>Authority: {stats.authority}</span>
            <span>Hubs: {stats.hubs}</span>
            <span>PYP: {stats.pyp}</span>
            <span>Long-tail: {stats.longTail}</span>
          </div>
        )}

        {Object.entries(grouped).map(([groupName, groupIssues]) => (
          <div key={groupName} className="border rounded-lg">
            <button
              onClick={() => setExpandedGroup(expandedGroup === groupName ? null : groupName)}
              className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                {expandedGroup === groupName ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {groupName}
                <Badge variant="secondary" className="text-xs">{groupIssues.length}</Badge>
              </div>
            </button>
            {expandedGroup === groupName && (
              <div className="border-t px-3 pb-3 max-h-60 overflow-y-auto">
                {groupIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 text-xs border-b last:border-0">
                    <span className={issue.severity === 'error' ? 'text-destructive' : 'text-amber-600'}>●</span>
                    <span className="font-mono text-muted-foreground">{issue.slug}</span>
                    <span className="text-foreground">{issue.issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
