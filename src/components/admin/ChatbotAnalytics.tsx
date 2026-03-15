import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, MessageSquare, ShieldAlert, Clock, Search } from 'lucide-react';

interface AnalyticsData {
  totalQueries: number;
  todayQueries: number;
  refusalCount: number;
  avgResponseTime: number;
  topIntents: { intent: string; count: number }[];
  retrievalBreakdown: { status: string; count: number }[];
  topUnanswered: { query_text: string; count: number }[];
}

export function ChatbotAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData>({
    totalQueries: 0, todayQueries: 0, refusalCount: 0, avgResponseTime: 0,
    topIntents: [], retrievalBreakdown: [], topUnanswered: [],
  });

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Total queries
      const { count: totalQueries } = await supabase
        .from('chatbot_analytics')
        .select('*', { count: 'exact', head: true });

      // Today queries
      const { count: todayQueries } = await supabase
        .from('chatbot_analytics')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      // Refusals
      const { count: refusalCount } = await supabase
        .from('chatbot_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('was_refused', true);

      // Avg response time
      const { data: timeData } = await supabase
        .from('chatbot_analytics')
        .select('response_time_ms')
        .not('response_time_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      const avgResponseTime = timeData && timeData.length > 0
        ? Math.round(timeData.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / timeData.length)
        : 0;

      // Top intents (last 500)
      const { data: intentData } = await supabase
        .from('chatbot_analytics')
        .select('intent')
        .not('intent', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      const intentMap = new Map<string, number>();
      intentData?.forEach(r => {
        if (r.intent) intentMap.set(r.intent, (intentMap.get(r.intent) || 0) + 1);
      });
      const topIntents = Array.from(intentMap.entries())
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Retrieval breakdown
      const { data: retrievalData } = await supabase
        .from('chatbot_analytics')
        .select('retrieval_status')
        .not('retrieval_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      const retMap = new Map<string, number>();
      retrievalData?.forEach(r => {
        if (r.retrieval_status) retMap.set(r.retrieval_status, (retMap.get(r.retrieval_status) || 0) + 1);
      });
      const retrievalBreakdown = Array.from(retMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      // Top unanswered
      const { data: unansweredData } = await supabase
        .from('chatbot_analytics')
        .select('query_text')
        .eq('retrieval_status', 'no_match')
        .eq('was_refused', false)
        .not('query_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      const uMap = new Map<string, number>();
      unansweredData?.forEach(r => {
        if (r.query_text) uMap.set(r.query_text, (uMap.get(r.query_text) || 0) + 1);
      });
      const topUnanswered = Array.from(uMap.entries())
        .map(([query_text, count]) => ({ query_text, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setData({
        totalQueries: totalQueries || 0,
        todayQueries: todayQueries || 0,
        refusalCount: refusalCount || 0,
        avgResponseTime,
        topIntents,
        retrievalBreakdown,
        topUnanswered,
      });
    } catch (err) {
      console.error('Failed to load chatbot analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnalytics(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Chatbot Analytics</span>
          <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.totalQueries}</p>
            <p className="text-xs text-muted-foreground">Total Queries</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.todayQueries}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-destructive">{data.refusalCount}</p>
            <p className="text-xs text-muted-foreground">Refusals</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.avgResponseTime}ms</p>
            <p className="text-xs text-muted-foreground">Avg Latency</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Top Intents */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Search className="h-4 w-4" />Top Intents</h4>
            <div className="space-y-1">
              {data.topIntents.map(i => (
                <div key={i.intent} className="flex justify-between text-sm">
                  <span className="truncate">{i.intent}</span>
                  <Badge variant="secondary" className="ml-2">{i.count}</Badge>
                </div>
              ))}
              {data.topIntents.length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
            </div>
          </div>

          {/* Retrieval Breakdown */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock className="h-4 w-4" />Retrieval Status</h4>
            <div className="space-y-1">
              {data.retrievalBreakdown.map(r => (
                <div key={r.status} className="flex justify-between text-sm">
                  <span className={r.status === 'no_match' ? 'text-destructive' : r.status === 'strong_match' ? 'text-green-600' : ''}>{r.status}</span>
                  <Badge variant="secondary">{r.count}</Badge>
                </div>
              ))}
              {data.retrievalBreakdown.length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
            </div>
          </div>

          {/* Top Unanswered */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><ShieldAlert className="h-4 w-4" />Top Unanswered</h4>
            <div className="space-y-1">
              {data.topUnanswered.map((u, i) => (
                <div key={i} className="text-xs text-muted-foreground truncate" title={u.query_text}>
                  {u.query_text} ({u.count})
                </div>
              ))}
              {data.topUnanswered.length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
