import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getImageModels } from '@/lib/aiModels';
import { Loader2, Download, Copy, CheckCircle2, XCircle, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const IMAGE_MODELS = getImageModels();
const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '9:16'] as const;

export function ManualImagePromptTest() {
  const { toast } = useToast();
  const [userPrompt, setUserPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0]?.value || 'gemini-flash-image');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [loading, setLoading] = useState(false);
  const [guardedPrompt, setGuardedPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [modelUsed, setModelUsed] = useState('');

  const handleGenerate = async () => {
    if (!userPrompt.trim()) return;
    setLoading(true);
    setError('');
    setGuardedPrompt('');
    setImageUrl('');
    setElapsedMs(null);
    setModelUsed('');

    const start = Date.now();
    try {
      const slug = `manual-test-${Date.now()}`;
      const { data, error: fnError } = await supabase.functions.invoke('generate-vertex-image', {
        body: {
          purpose: 'manual-test',
          model: selectedModel,
          userPrompt: userPrompt.trim(),
          aspectRatio,
          slug,
          strict: true,
        },
      });

      const elapsed = Date.now() - start;
      setElapsedMs(data?.elapsedMs ?? elapsed);

      if (fnError) {
        setError(fnError.message);
        return;
      }

      if (data?.guardedPrompt) {
        setGuardedPrompt(data.guardedPrompt);
      }

      if (data?.success === false) {
        setError(data.error || 'Generation failed');
        return;
      }

      const url = data?.data?.images?.[0]?.url;
      if (url) {
        setImageUrl(url);
        setModelUsed(data?.model || selectedModel);
      } else {
        setError('No image returned');
      }
    } catch (e: any) {
      setError(e.message);
      setElapsedMs(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(guardedPrompt);
    toast({ title: 'Copied', description: 'Guarded prompt copied to clipboard' });
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `manual-test-${selectedModel}-${Date.now()}.${blob.type.includes('jpeg') ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          Manual Image Prompt Test
          <Badge variant="outline" className="text-xs ml-auto">Policy-Guarded</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Your raw prompt is always transformed through the image prompt policy before generation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Raw prompt input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Raw User Prompt</label>
          <Textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="e.g. create an image of 2 students studying for UPSC exam"
            rows={3}
          />
        </div>

        {/* Model + Aspect Ratio selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Image Model</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Aspect Ratio</label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate button */}
        <Button onClick={handleGenerate} disabled={loading || !userPrompt.trim()} className="w-full" size="sm">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            'Generate Image'
          )}
        </Button>

        {/* Status line */}
        {elapsedMs != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {error ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : imageUrl ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : null}
            <span>{(elapsedMs / 1000).toFixed(1)}s</span>
            {modelUsed && <Badge variant="outline" className="text-xs">{modelUsed}</Badge>}
          </div>
        )}

        {/* Error */}
        {error && (
          <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{error}</pre>
        )}

        {/* Image preview + download */}
        {imageUrl && (
          <div className="space-y-2">
            <img src={imageUrl} alt="Generated test image" className="rounded border w-full max-h-80 object-contain bg-muted" />
            <Button onClick={handleDownload} variant="outline" size="sm" className="w-full">
              <Download className="h-4 w-4" />
              Download Image
            </Button>
          </div>
        )}

        {/* Guarded prompt preview */}
        {guardedPrompt && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Final Guarded Prompt Sent to Model</label>
              <Button onClick={handleCopyPrompt} variant="ghost" size="sm" className="h-6 px-2">
                <Copy className="h-3 w-3" />
                <span className="text-xs">Copy</span>
              </Button>
            </div>
            <Textarea
              value={guardedPrompt}
              readOnly
              rows={8}
              className="text-xs font-mono bg-muted cursor-default"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
