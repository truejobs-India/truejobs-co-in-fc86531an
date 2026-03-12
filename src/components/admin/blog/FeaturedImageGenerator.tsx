import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

interface FeaturedImageGeneratorProps {
  slug: string;
  title: string;
  category?: string;
  tags?: string[];
  currentImageUrl?: string;
  onImageGenerated: (url: string, altText: string) => void;
}

/**
 * Generates featured images via gemini-2.5-flash direct Google API.
 * Does NOT use Lovable AI gateway — calls external Gemini API only.
 * Image generation is fully optional and never blocks manual workflow.
 */
export function FeaturedImageGenerator({
  slug,
  title,
  category,
  tags,
  currentImageUrl,
  onImageGenerated,
}: FeaturedImageGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAlt, setGeneratedAlt] = useState('');

  const handleGenerate = async () => {
    if (!slug || !title) {
      toast({ title: 'Missing data', description: 'Title and slug are required', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-blog-image', {
        body: { slug, title, category: category || 'General', keywords: tags || [] },
      });

      if (error) throw error;
      if (data?.code === 'IMAGE_GEN_REGION_UNAVAILABLE') {
        toast({
          title: 'Region unavailable',
          description: 'AI cover image generation is currently unavailable in the deployed edge region. Please upload a cover image manually.',
          variant: 'destructive',
        });
        return;
      }
      if (!data?.imageUrl) throw new Error('No image returned');

      setGeneratedAlt(data.altText || title);
      onImageGenerated(data.imageUrl, data.altText || title);
      toast({ title: 'Cover image generated', description: 'AI Generated via gemini-2.5-flash' });
    } catch (err: any) {
      console.error('Image generation failed:', err);
      toast({
        title: 'Generation failed',
        description: err.message || 'Try again or upload manually',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating || !slug}
          className="gap-1.5"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : currentImageUrl ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? 'Generating...' : currentImageUrl ? 'Regenerate' : 'Generate Cover'}
        </Button>
        <span className="text-[10px] text-muted-foreground">AI via Gemini 2.5 Flash</span>
      </div>

      {generatedAlt && (
        <div className="space-y-1">
          <Label className="text-xs">Generated Alt Text</Label>
          <Input
            value={generatedAlt}
            onChange={(e) => setGeneratedAlt(e.target.value)}
            className="text-xs h-7"
            placeholder="Alt text for generated image"
          />
        </div>
      )}
    </div>
  );
}
