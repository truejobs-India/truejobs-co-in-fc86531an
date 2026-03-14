import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Zap, Crown, ImageIcon } from 'lucide-react';

type TestStatus = 'idle' | 'running' | 'success' | 'error';

interface TestResult {
  status: TestStatus;
  elapsedMs?: number;
  model?: string;
  preview?: string;
  error?: string;
}

export function VertexAITestPanel() {
  const [flash, setFlash] = useState<TestResult>({ status: 'idle' });
  const [pro, setPro] = useState<TestResult>({ status: 'idle' });
  const [imagen, setImagen] = useState<TestResult>({ status: 'idle' });

  const runTest = async (
    fnName: string,
    body: Record<string, unknown>,
    setter: React.Dispatch<React.SetStateAction<TestResult>>,
    previewExtractor: (data: any) => string,
  ) => {
    setter({ status: 'running' });
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      const elapsed = Date.now() - start;
      if (error) {
        setter({ status: 'error', elapsedMs: elapsed, error: error.message });
        return;
      }
      if (data?.success === false) {
        setter({ status: 'error', elapsedMs: elapsed, error: data.error, model: data.model });
        return;
      }
      setter({
        status: 'success',
        elapsedMs: data?.elapsedMs ?? elapsed,
        model: data?.model,
        preview: previewExtractor(data?.data),
      });
    } catch (e: any) {
      setter({ status: 'error', elapsedMs: Date.now() - start, error: e.message });
    }
  };

  const testFlash = () =>
    runTest(
      'generate-seo-helper',
      { action: 'generate-meta', topic: 'SSC CGL 2025 Recruitment', title: 'SSC CGL 2025 Notification' },
      setFlash,
      (d) => {
        if (!d) return 'No data returned';
        const obj = typeof d === 'string' ? d : JSON.stringify(d, null, 2);
        return obj.substring(0, 400);
      },
    );

  const testPro = () =>
    runTest(
      'generate-premium-article',
      { action: 'generate-full-article', topic: 'UPSC Civil Services 2025', desiredWordCount: 300, tone: 'professional', locale: 'en-IN' },
      setPro,
      (d) => {
        if (!d) return 'No data returned';
        const title = d.title || '';
        const excerpt = d.excerpt || '';
        const wc = d.word_count || '?';
        return `Title: ${title}\nExcerpt: ${excerpt}\nWords: ${wc}`;
      },
    );

  const testImagen = () =>
    runTest(
      'generate-vertex-image',
      { title: 'Government Jobs Portal Test', topic: 'Indian Government Recruitment', slug: 'vertex-test', aspectRatio: '16:9', imageCount: 1 },
      setImagen,
      (d) => {
        if (!d) return 'No data returned';
        if (d.images?.[0]?.url) return d.images[0].url;
        return JSON.stringify(d).substring(0, 300);
      },
    );

  const StatusIcon = ({ status }: { status: TestStatus }) => {
    if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  const ResultCard = ({ label, icon: Icon, result, onRun }: { label: string; icon: any; result: TestResult; onRun: () => void }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusIcon status={result.status} />
            {result.elapsedMs != null && (
              <Badge variant="outline" className="text-xs">{(result.elapsedMs / 1000).toFixed(1)}s</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onRun} disabled={result.status === 'running'} size="sm" className="w-full">
          {result.status === 'running' ? 'Testing…' : 'Run Test'}
        </Button>
        {result.model && <p className="text-xs text-muted-foreground">Model: {result.model}</p>}
        {result.error && (
          <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{result.error}</pre>
        )}
        {result.status === 'success' && result.preview && (
          result.preview.startsWith('http') ? (
            <img src={result.preview} alt="Test output" className="rounded border max-h-48 w-full object-cover" />
          ) : (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">{result.preview}</pre>
          )
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Vertex AI Model Tests</h3>
        <p className="text-sm text-muted-foreground">Quick connectivity & response checks for each Google model.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Gemini 2.5 Flash" icon={Zap} result={flash} onRun={testFlash} />
        <ResultCard label="Gemini 2.5 Pro" icon={Crown} result={pro} onRun={testPro} />
        <ResultCard label="Imagen" icon={ImageIcon} result={imagen} onRun={testImagen} />
      </div>
    </div>
  );
}
