import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2 } from 'lucide-react';
import mammoth from 'mammoth';
import { supabase } from '@/integrations/supabase/client';

interface WordFileImporterProps {
  onImport: (html: string) => void;
}

export function WordFileImporter({ onImport }: WordFileImporterProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && ext !== 'docx' && ext !== 'doc') {
      toast({ title: 'Invalid file', description: 'Only .docx / .doc files are supported', variant: 'destructive' });
      return;
    }

    setIsImporting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            // Upload embedded images to storage
            const buffer = await image.read();
            const uint8 = new Uint8Array(buffer as unknown as ArrayBuffer);
            const blob = new Blob([uint8], { type: image.contentType });
            const ext = image.contentType.split('/')[1] || 'png';
            const filePath = `articles/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

            const { error } = await supabase.storage
              .from('blog-assets')
              .upload(filePath, blob, { contentType: image.contentType });

            if (error) {
              console.error('Image upload failed:', error);
              return { src: '' };
            }

            const { data: urlData } = supabase.storage
              .from('blog-assets')
              .getPublicUrl(filePath);

            return { src: urlData.publicUrl };
          }),
        }
      );

      if (result.messages.length > 0) {
        console.warn('Mammoth warnings:', result.messages);
      }

      onImport(result.value);
      toast({ title: 'Word file imported', description: 'Content has been loaded into the editor' });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message || 'Could not parse Word file', variant: 'destructive' });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
      >
        {isImporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
        ) : (
          <><FileText className="h-4 w-4 mr-2" /> Import Word File</>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
