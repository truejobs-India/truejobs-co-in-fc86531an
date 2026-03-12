import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CoverImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export function CoverImageUploader({ value, onChange }: CoverImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file', description: 'Only JPG, PNG, WebP allowed', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB allowed', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `covers/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
      .from('blog-assets')
      .upload(filePath, file, { contentType: file.type });

    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('blog-assets')
      .getPublicUrl(filePath);

    onChange(urlData.publicUrl);
    setIsUploading(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <Label>Cover Image</Label>
      <Tabs defaultValue={value && !value.startsWith('http') ? 'upload' : 'url'} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
          <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
        </TabsList>
        <TabsContent value="url">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </TabsContent>
        <TabsContent value="upload">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Choose Image</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </TabsContent>
      </Tabs>

      {value && (
        <div className="relative mt-2 rounded-md overflow-hidden border">
          <img src={value} alt="Cover preview" className="w-full h-32 object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => onChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
