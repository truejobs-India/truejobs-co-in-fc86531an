import { useState, useRef, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Upload, Download, ImageIcon, Shield, RotateCcw, Lock, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const SITE_URL = 'https://truejobs.co.in';
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const SIZE_PRESETS = [
  { label: 'Custom', width: 0, height: 0 },
  { label: 'HD (1280×720)', width: 1280, height: 720 },
  { label: 'Full HD (1920×1080)', width: 1920, height: 1080 },
  { label: 'Instagram Post (1080×1080)', width: 1080, height: 1080 },
  { label: 'Instagram Story (1080×1920)', width: 1080, height: 1920 },
  { label: 'LinkedIn Banner (1584×396)', width: 1584, height: 396 },
  { label: 'Facebook Cover (820×312)', width: 820, height: 312 },
  { label: 'Thumbnail (300×300)', width: 300, height: 300 },
  { label: 'A4 Print (2480×3508)', width: 2480, height: 3508 },
];

type OutputFormat = 'jpeg' | 'png' | 'webp';

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

const FAQ_ITEMS = [
  {
    question: 'What image formats are supported?',
    answer: 'This tool accepts JPG, PNG, WebP, GIF, and BMP images. You can export in JPG, PNG, or WebP format.',
  },
  {
    question: 'Is there a file size limit?',
    answer: 'Yes, the maximum upload file size is 20MB. All processing happens in your browser — nothing is uploaded to a server.',
  },
  {
    question: 'Can I convert between image formats?',
    answer: 'Yes! You can convert between JPG, PNG, and WebP formats. For example, upload a PNG and download it as a compressed JPG.',
  },
  {
    question: 'Does resizing reduce image quality?',
    answer: 'Enlarging images beyond their original size may reduce quality. Reducing size generally preserves quality. Use the quality slider to balance file size and visual quality.',
  },
];

export default function ImageResizer() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [origWidth, setOrigWidth] = useState(0);
  const [origHeight, setOrigHeight] = useState(0);

  const [targetWidth, setTargetWidth] = useState('');
  const [targetHeight, setTargetHeight] = useState('');
  const [lockAspect, setLockAspect] = useState(true);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg');
  const [quality, setQuality] = useState([85]);
  const [preset, setPreset] = useState('Custom');

  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState(0);

  const aspectRatio = origWidth && origHeight ? origWidth / origHeight : 1;

  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 20MB.', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setOrigWidth(img.width);
      setOrigHeight(img.height);
      setTargetWidth(String(img.width));
      setTargetHeight(String(img.height));
    };
    img.src = URL.createObjectURL(file);
    setOutputUrl(null);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleWidthChange = (val: string) => {
    setTargetWidth(val);
    if (lockAspect && val) {
      setTargetHeight(String(Math.round(Number(val) / aspectRatio)));
    }
    setPreset('Custom');
  };

  const handleHeightChange = (val: string) => {
    setTargetHeight(val);
    if (lockAspect && val) {
      setTargetWidth(String(Math.round(Number(val) * aspectRatio)));
    }
    setPreset('Custom');
  };

  const handlePresetChange = (label: string) => {
    setPreset(label);
    const p = SIZE_PRESETS.find(s => s.label === label);
    if (p && p.width > 0) {
      setTargetWidth(String(p.width));
      setTargetHeight(String(p.height));
    }
  };

  const processImage = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const w = Number(targetWidth) || origWidth;
    const h = Number(targetHeight) || origHeight;
    if (w <= 0 || h <= 0 || w > 10000 || h > 10000) {
      toast({ title: 'Invalid dimensions', description: 'Width and height must be between 1 and 10,000px.', variant: 'destructive' });
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, 0, 0, w, h);

    const mimeType = `image/${outputFormat}`;
    const q = outputFormat === 'png' ? undefined : quality[0] / 100;
    const dataUrl = canvas.toDataURL(mimeType, q);
    const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);

    setOutputUrl(dataUrl);
    setOutputSize(sizeKB);
  }, [image, targetWidth, targetHeight, origWidth, origHeight, outputFormat, quality, toast]);

  const downloadImage = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
    a.download = `${baseName}-${targetWidth}x${targetHeight}.${ext}`;
    a.click();
  }, [outputUrl, fileName, outputFormat, targetWidth, targetHeight]);

  const reset = () => {
    setImage(null);
    setFileName('');
    setOutputUrl(null);
    setOutputSize(0);
    setTargetWidth('');
    setTargetHeight('');
    setPreset('Custom');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Online Image Resizer',
    url: `${SITE_URL}/image-resizer`,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'All',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };

  const schemaFAQ = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const schemaBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Image Resizer', item: `${SITE_URL}/image-resizer` },
    ],
  };

  return (
    <Layout>
      <SEO
        title="Free Image Resizer Online | Resize & Convert"
        description="Resize images online for free. Convert between JPG, PNG, WebP. Preset sizes for social media, print, and web. 100% browser-based, no server upload."
        canonical="/image-resizer"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaBreadcrumb) }} />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li>/</li>
            <li><Link to="/tools" className="hover:text-primary">Tools</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Image Resizer</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">Free Online Image Resizer</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Resize any image to custom dimensions or use presets for social media, web, and print.
          Convert between JPG, PNG, and WebP formats with adjustable quality. All processing
          happens in your browser — your images are never uploaded to any server.
        </p>

        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-muted-foreground">Files are processed entirely in your browser. Nothing is uploaded.</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Settings */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Upload & Settings</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Upload */}
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {image ? (
                  <div className="space-y-2">
                    <ImageIcon className="h-8 w-8 mx-auto text-primary" />
                    <p className="font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{origWidth}×{origHeight}px</p>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reset(); }}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="font-medium">Drop an image or click to upload</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF, BMP • Max 20MB</p>
                  </div>
                )}
              </div>

              {/* Preset */}
              <div>
                <Label>Size Preset</Label>
                <Select value={preset} onValueChange={handlePresetChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZE_PRESETS.map(p => (
                      <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                <div>
                  <Label>Width (px)</Label>
                  <Input type="number" value={targetWidth} onChange={(e) => handleWidthChange(e.target.value)} min={1} max={10000} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mb-0.5"
                  onClick={() => setLockAspect(!lockAspect)}
                  title={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                >
                  {lockAspect ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
                <div>
                  <Label>Height (px)</Label>
                  <Input type="number" value={targetHeight} onChange={(e) => handleHeightChange(e.target.value)} min={1} max={10000} />
                </div>
              </div>

              {/* Format */}
              <div>
                <Label>Output Format</Label>
                <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              {outputFormat !== 'png' && (
                <div>
                  <Label>Quality: {quality[0]}%</Label>
                  <Slider value={quality} onValueChange={setQuality} min={10} max={100} step={5} className="mt-2" />
                </div>
              )}

              <Button onClick={processImage} disabled={!image} className="w-full">
                <ImageIcon className="h-4 w-4 mr-2" /> Resize Image
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Preview & Download</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <canvas ref={canvasRef} className="hidden" />
              {outputUrl ? (
                <div className="space-y-4">
                  <div className="border rounded-xl p-4 flex items-center justify-center bg-muted/30 min-h-[200px]">
                    <img src={outputUrl} alt="Resized" className="max-w-full max-h-[300px] object-contain" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Size: <strong>{targetWidth}×{targetHeight}px</strong></span>
                    <span>File: <strong>{outputSize}KB</strong></span>
                    <span>Format: <strong>{outputFormat.toUpperCase()}</strong></span>
                  </div>
                  <Button onClick={downloadImage} className="w-full">
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                </div>
              ) : (
                <div className="border rounded-xl p-8 text-center text-muted-foreground min-h-[200px] flex flex-col items-center justify-center">
                  <ImageIcon className="h-12 w-12 mb-3 opacity-30" />
                  <p>Upload an image to see the preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Internal Links */}
        <section className="mb-8 p-6 bg-muted/50 rounded-xl">
          <h2 className="text-lg font-semibold mb-3">Related Tools</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Photo Resizer (Exams)', href: '/photo-resizer' },
              { label: 'PDF Tools', href: '/pdf-tools' },
              { label: 'Age Calculator', href: '/govt-job-age-calculator' },
              { label: 'Salary Calculator', href: '/govt-salary-calculator' },
              { label: 'AI Resume Checker', href: '/tools/resume-checker' },
            ].map((link) => (
              <Link key={link.label} to={link.href}>
                <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                  {link.label}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
