import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';

const GUIDE_SLUGS = [
  { slug: 'ssc-cgl-preparation-guide', title: 'SSC CGL Preparation Guide' },
  { slug: 'govt-jobs-after-12th-guide', title: 'Govt Jobs After 12th Guide' },
  { slug: 'upsc-vs-ssc-guide', title: 'UPSC vs SSC Comparison' },
  { slug: 'railway-jobs-guide', title: 'Railway Jobs Career Guide' },
  { slug: 'govt-salary-calculation-guide', title: 'Govt Salary Calculation Guide' },
  { slug: 'govt-jobs-by-stream-guide', title: 'Govt Jobs by Stream Guide' },
  { slug: 'nda-preparation-guide', title: 'NDA Preparation Guide' },
  { slug: 'sbi-po-vs-ibps-po-guide', title: 'SBI PO vs IBPS PO' },
  { slug: 'govt-jobs-bihar-guide', title: 'Govt Jobs in Bihar Guide' },
  { slug: 'agniveer-complete-guide', title: 'Agniveer Complete Guide' },
];

type GuideStatus = 'idle' | 'generating' | 'done' | 'skipped' | 'error';

export function GuideGenerator() {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<Record<string, GuideStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);

  const generateOne = async (slug: string) => {
    setStatuses(prev => ({ ...prev, [slug]: 'generating' }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('generate-guide-content', {
        body: { slug },
      });

      if (response.error) throw new Error(response.error.message);
      const report = response.data;

      if (report.generated?.includes(slug)) {
        setStatuses(prev => ({ ...prev, [slug]: 'done' }));
      } else if (report.skipped?.includes(slug)) {
        setStatuses(prev => ({ ...prev, [slug]: 'skipped' }));
      } else {
        const errMsg = report.errors?.[0] || 'Unknown error';
        setErrors(prev => ({ ...prev, [slug]: errMsg }));
        setStatuses(prev => ({ ...prev, [slug]: 'error' }));
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, [slug]: err instanceof Error ? err.message : 'Failed' }));
      setStatuses(prev => ({ ...prev, [slug]: 'error' }));
    }
  };

  const generateAll = async () => {
    setIsRunning(true);
    for (const guide of GUIDE_SLUGS) {
      if (statuses[guide.slug] === 'done' || statuses[guide.slug] === 'skipped') continue;
      await generateOne(guide.slug);
    }
    setIsRunning(false);
    toast({ title: 'Guide generation complete', description: 'Check statuses below for results.' });
  };

  const statusIcon = (status: GuideStatus) => {
    switch (status) {
      case 'generating': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'skipped': return <SkipForward className="h-4 w-4 text-muted-foreground" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Long-Form Guide Generator (Phase E)
        </CardTitle>
        <Button onClick={generateAll} disabled={isRunning}>
          {isRunning ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : 'Generate All Guides'}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Generates 10 long-form (2,000+ word) exam prep guides via AI and saves them as drafts for review.
        </p>
        <div className="space-y-2">
          {GUIDE_SLUGS.map(guide => (
            <div key={guide.slug} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {statusIcon(statuses[guide.slug] || 'idle')}
                <div>
                  <span className="text-sm font-medium">{guide.title}</span>
                  {statuses[guide.slug] === 'skipped' && (
                    <Badge variant="secondary" className="ml-2 text-xs">Already exists</Badge>
                  )}
                  {statuses[guide.slug] === 'error' && (
                    <p className="text-xs text-destructive mt-0.5">{errors[guide.slug]}</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isRunning || statuses[guide.slug] === 'generating'}
                onClick={() => generateOne(guide.slug)}
              >
                {statuses[guide.slug] === 'generating' ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
