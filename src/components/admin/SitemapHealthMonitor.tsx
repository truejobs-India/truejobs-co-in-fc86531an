import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ExternalLink,
  FileText,
  Building2,
  Briefcase,
  BookOpen,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HealthIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  affectedUrls?: string[];
}

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  summary: {
    totalUrls: number;
    jobsCount: number;
    companiesCount: number;
    blogPostsCount: number;
    staticPagesCount: number;
  };
  issues: HealthIssue[];
  recommendations: string[];
}

export function SitemapHealthMonitor() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: healthData, isLoading, error, refetch } = useQuery({
    queryKey: ['sitemap-health'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('sitemap-health');
      return data as HealthCheckResult;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const sitemapUrls = {
    dynamic: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-sitemap`,
    index: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sitemap-index`,
    static: 'https://truejobs.co.in/sitemap.xml',
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sitemap Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to fetch sitemap health data. Please try again.
            </AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sitemap Health Monitor
            </CardTitle>
            <CardDescription>
              Monitor your XML sitemap for Google Search Console compliance
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {healthData && getStatusBadge(healthData.status)}
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        {healthData?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary">{healthData.summary.totalUrls.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total URLs</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Briefcase className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">{healthData.summary.jobsCount.toLocaleString()}</span>
              </div>
              <div className="text-sm text-muted-foreground">Jobs</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Building2 className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">{healthData.summary.companiesCount.toLocaleString()}</span>
              </div>
              <div className="text-sm text-muted-foreground">Companies</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <BookOpen className="h-4 w-4 text-purple-500" />
                <span className="text-2xl font-bold">{healthData.summary.blogPostsCount.toLocaleString()}</span>
              </div>
              <div className="text-sm text-muted-foreground">Blog Posts</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{healthData.summary.staticPagesCount}</div>
              <div className="text-sm text-muted-foreground">Static Pages</div>
            </div>
          </div>
        )}

        {/* Sitemap URLs */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Sitemap URLs</h4>
          <div className="grid gap-2">
            <a 
              href={sitemapUrls.dynamic} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Dynamic Sitemap (Primary)
            </a>
            <a 
              href={sitemapUrls.index} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Sitemap Index (Segmented)
            </a>
            <a 
              href={sitemapUrls.static} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Static Fallback
            </a>
          </div>
        </div>

        {/* Issues */}
        {healthData?.issues && healthData.issues.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Issues Detected</h4>
            {healthData.issues.map((issue, index) => (
              <Alert key={index} variant={issue.type === 'error' ? 'destructive' : 'default'}>
                {getIssueIcon(issue.type)}
                <AlertTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{issue.category}</Badge>
                </AlertTitle>
                <AlertDescription>
                  {issue.message}
                  {issue.affectedUrls && issue.affectedUrls.length > 0 && (
                    <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                      {issue.affectedUrls.slice(0, 5).map((url, i) => (
                        <li key={i}>{url}</li>
                      ))}
                      {issue.affectedUrls.length > 5 && (
                        <li>...and {issue.affectedUrls.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {healthData?.recommendations && healthData.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Recommendations</h4>
            <ul className="space-y-1">
              {healthData.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No Issues */}
        {healthData?.status === 'healthy' && (!healthData.issues || healthData.issues.length === 0) && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>All Good!</AlertTitle>
            <AlertDescription>
              Your sitemap is healthy and ready for Google Search Console submission.
            </AlertDescription>
          </Alert>
        )}

        {/* Last Updated */}
        {healthData?.timestamp && (
          <p className="text-xs text-muted-foreground text-right">
            Last checked: {new Date(healthData.timestamp).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
