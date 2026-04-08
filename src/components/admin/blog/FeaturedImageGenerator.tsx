import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { getModelDef } from '@/lib/aiModels';

interface FeaturedImageGeneratorProps {
  slug: string;
  title: string;
  category?: string;
  tags?: string[];
  currentImageUrl?: string;
  imageModel?: string;
  onImageGenerated: (url: string, altText: string) => void;
}

/**
 * Generates featured images via the selected image model.
 * Routes to the correct edge function based on model selection.
 */
export function FeaturedImageGenerator({
  slug,
  title,
  category,
  tags,
  currentImageUrl,
  imageModel = 'vertex-imagen',
  onImageGenerated,
}: FeaturedImageGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAlt, setGeneratedAlt] = useState('');

  const modelDef = getModelDef(imageModel);
  const modelLabel = modelDef?.label || imageModel;

  const handleGenerate = async () => {
    if (!slug || !title) {
      toast({ title: 'Missing data', description: 'Title and slug are required', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      // Route based on selected model
      if (imageModel === 'gemini-flash-image' || imageModel === 'vertex-imagen' || imageModel === 'nova-canvas' || imageModel === 'azure-flux-kontext') {
        // Both go through generate-vertex-image with model routing
        const { data, error } = await supabase.functions.invoke('generate-vertex-image', {
          body: { slug, title, category: category || 'General', tags: tags || [], model: imageModel, imageCount: 1, aspectRatio: '16:9' },
        });

        if (error) throw error;
        if (data?.success === false) throw new Error(data.error || 'Image generation failed');
        if (!data?.data?.images?.[0]?.url) throw new Error('No image returned');

        const img = data.data.images[0];
        setGeneratedAlt(img.altText || title);
        onImageGenerated(img.url, img.altText || title);
        toast({ title: 'Cover image generated', description: `Via ${data.model || modelLabel}` });
      } else {
        // Fallback: generate-blog-image (legacy Lovable gateway path)
        const { data, error } = await supabase.functions.invoke('generate-blog-image', {
          body: { slug, title, category: category || 'General', keywords: tags || [] },
        });

        if (error) throw error;
        if (data?.code === 'IMAGE_GEN_REGION_UNAVAILABLE') {
          toast({
            title: 'Region unavailable',
            description: 'AI cover image generation is currently unavailable. Please upload manually.',
            variant: 'destructive',
          });
          return;
        }
        if (!data?.imageUrl) throw new Error('No image returned');

        setGeneratedAlt(data.altText || title);
        onImageGenerated(data.imageUrl, data.altText || title);
        toast({ title: 'Cover image generated', description: `Via ${data.model || 'AI'}` });
      }
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
        <span className="text-[10px] text-muted-foreground">via {modelLabel}</span>
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
