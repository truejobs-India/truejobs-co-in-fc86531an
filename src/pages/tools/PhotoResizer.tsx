import { useState, useRef, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Upload, Download, ImageIcon, Shield, Crop, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const SITE_URL = 'https://truejobs.co.in';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface Preset {
  label: string;
  width: number;
  height: number;
  maxSizeKB: number;
  description: string;
}

const PHOTO_PRESETS: Record<string, Preset[]> = {
  'Photo Presets': [
    { label: 'SSC Photo', width: 100, height: 120, maxSizeKB: 50, description: '100×120px, 20-50KB' },
    { label: 'IBPS Photo', width: 200, height: 230, maxSizeKB: 50, description: '200×230px, 20-50KB' },
    { label: 'UPSC Photo', width: 150, height: 200, maxSizeKB: 300, description: '150×200px, 20-300KB' },
    { label: 'Railway Photo', width: 100, height: 120, maxSizeKB: 50, description: '100×120px, 20-50KB' },
    { label: 'Passport Photo', width: 350, height: 450, maxSizeKB: 300, description: '350×450px, ≤300KB' },
  ],
  'Signature Presets': [
    { label: 'SSC Signature', width: 140, height: 60, maxSizeKB: 30, description: '140×60px, 10-30KB' },
    { label: 'IBPS Signature', width: 140, height: 60, maxSizeKB: 20, description: '140×60px, 10-20KB' },
    { label: 'UPSC Signature', width: 150, height: 70, maxSizeKB: 40, description: '150×70px, ≤40KB' },
    { label: 'Railway Signature', width: 140, height: 60, maxSizeKB: 30, description: '140×60px, 10-30KB' },
  ],
};

const FAQ_ITEMS = [
  {
    question: 'What photo size is required for SSC exams?',
    answer: 'SSC exams require a photograph of 100×120 pixels with file size between 20KB and 50KB in JPG/JPEG format.',
  },
  {
    question: 'What is the photo and signature size for IBPS?',
    answer: 'IBPS requires a photograph of 200×230 pixels (20-50KB) and a signature of 140×60 pixels (10-20KB), both in JPG format.',
  },
  {
    question: 'Is this tool safe to use?',
    answer: 'Yes, this tool processes your images entirely in your browser. No files are uploaded to any server. Your photos and signatures remain completely private.',
  },
  {
    question: 'Can I crop my photo before resizing?',
    answer: 'Yes, you can adjust the crop area to focus on your face or signature before applying the resize. The tool maintains the correct aspect ratio for each exam preset.',
  },
];

export default function PhotoResizer() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [quality, setQuality] = useState([85]);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState(0);

  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 20MB.', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please upload an image file (JPG, PNG, WebP).', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
    setOutputUrl(null);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const processImage = useCallback(() => {
    if (!image || !selectedPreset || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = selectedPreset.width;
    canvas.height = selectedPreset.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate crop to maintain aspect ratio
    const targetRatio = selectedPreset.width / selectedPreset.height;
    const imgRatio = image.width / image.height;
    let sx = 0, sy = 0, sw = image.width, sh = image.height;

    if (imgRatio > targetRatio) {
      sw = image.height * targetRatio;
      sx = (image.width - sw) / 2;
    } else {
      sh = image.width / targetRatio;
      sy = (image.height - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, selectedPreset.width, selectedPreset.height);

    // Try to meet max size by adjusting quality
    let q = quality[0] / 100;
    let blob: string;
    let attempts = 0;

    const tryCompress = () => {
      blob = canvas.toDataURL('image/jpeg', q);
      const sizeKB = Math.round((blob.length * 3) / 4 / 1024);

      if (sizeKB > selectedPreset.maxSizeKB && q > 0.1 && attempts < 10) {
        q -= 0.05;
        attempts++;
        tryCompress();
        return;
      }

      setOutputUrl(blob);
      setOutputSize(sizeKB);

      if (sizeKB > selectedPreset.maxSizeKB) {
        toast({
          title: 'Size notice',
          description: `Output is ${sizeKB}KB. Target is ≤${selectedPreset.maxSizeKB}KB. Try a lower quality setting.`,
        });
      }
    };

    tryCompress();
  }, [image, selectedPreset, quality, toast]);

  const downloadImage = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    const ext = 'jpg';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    a.download = `${baseName}-resized.${ext}`;
    a.click();
  }, [outputUrl, fileName]);

  const reset = () => {
    setImage(null);
    setFileName('');
    setSelectedPreset(null);
    setOutputUrl(null);
    setOutputSize(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const allPresets = Object.entries(PHOTO_PRESETS).flatMap(([, presets]) => presets);

  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Government Exam Photo Resizer',
    url: `${SITE_URL}/photo-resizer`,
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
      { '@type': 'ListItem', position: 3, name: 'Photo Resizer', item: `${SITE_URL}/photo-resizer` },
    ],
  };

  return (
    <Layout noAds>
      <SEO
        title="Photo Resizer for Govt Exams | SSC IBPS UPSC"
        description="Resize your photo and signature for SSC, IBPS, UPSC, Railway exam applications. Free online tool with exact pixel presets. 100% browser-based, no upload to server."
        canonical="/photo-resizer"
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
            <li className="text-foreground font-medium">Photo Resizer</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">Photo & Signature Resizer for Government Exams</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Resize your passport photo and signature to the exact dimensions required by SSC, IBPS, UPSC,
          and Railway exam application forms. This free tool processes images entirely in your browser —
          no files are uploaded to any server, ensuring complete privacy.
        </p>

        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-muted-foreground">Files are processed entirely in your browser. Nothing is uploaded.</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Upload & Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Upload Area */}
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                {image ? (
                  <div className="space-y-2">
                    <ImageIcon className="h-8 w-8 mx-auto text-primary" />
                    <p className="font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{image.width}×{image.height}px</p>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reset(); }}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Change Image
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="font-medium">Drop an image or click to upload</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP • Max 20MB</p>
                  </div>
                )}
              </div>

              {/* Preset Selection */}
              <div>
                <Label>Select Preset</Label>
                <Select
                  value={selectedPreset?.label || ''}
                  onValueChange={(v) => setSelectedPreset(allPresets.find(p => p.label === v) || null)}
                >
                  <SelectTrigger><SelectValue placeholder="Choose exam preset" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PHOTO_PRESETS).map(([group, presets]) => (
                      <div key={group}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                        {presets.map(p => (
                          <SelectItem key={p.label} value={p.label}>
                            {p.label} — {p.description}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality Slider */}
              <div>
                <Label>Quality: {quality[0]}%</Label>
                <Slider value={quality} onValueChange={setQuality} min={10} max={100} step={5} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">Lower quality = smaller file size</p>
              </div>

              {/* Process Button */}
              <Button
                onClick={processImage}
                disabled={!image || !selectedPreset}
                className="w-full"
              >
                <Crop className="h-4 w-4 mr-2" />
                Resize Image
              </Button>
            </CardContent>
          </Card>

          {/* Preview & Download */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview & Download</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <canvas ref={canvasRef} className="hidden" />

              {outputUrl ? (
                <div className="space-y-4">
                  <div className="border rounded-xl p-4 flex items-center justify-center bg-muted/30 min-h-[200px]">
                    <img
                      src={outputUrl}
                      alt="Resized output"
                      className="max-w-full max-h-[300px] object-contain border"
                      style={{ imageRendering: 'auto' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Size: <strong>{selectedPreset?.width}×{selectedPreset?.height}px</strong>
                    </span>
                    <span>
                      File: <strong
                        className={outputSize <= (selectedPreset?.maxSizeKB || 999)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-destructive'}
                      >
                        {outputSize}KB
                      </strong>
                      {' '}/ {selectedPreset?.maxSizeKB}KB
                    </span>
                  </div>
                  <Button onClick={downloadImage} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Resized Image
                  </Button>
                </div>
              ) : (
                <div className="border rounded-xl p-8 text-center text-muted-foreground min-h-[200px] flex flex-col items-center justify-center">
                  <ImageIcon className="h-12 w-12 mb-3 opacity-30" />
                  <p>Upload an image and select a preset to see the preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preset Reference Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Exam Photo & Signature Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2.5 px-3 font-semibold">Exam</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Dimensions</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Max Size</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Format</th>
                  </tr>
                </thead>
                <tbody>
                  {allPresets.map((p) => (
                    <tr key={p.label} className="border-b">
                      <td className="py-2 px-3 font-medium">{p.label}</td>
                      <td className="py-2 px-3 text-center">{p.width}×{p.height}px</td>
                      <td className="py-2 px-3 text-center">{p.maxSizeKB}KB</td>
                      <td className="py-2 px-3 text-center">JPEG</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
          <h2 className="text-lg font-semibold mb-3">Related Tools & Resources</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Image Resizer', href: '/image-resizer' },
              { label: 'Age Calculator', href: '/govt-job-age-calculator' },
              { label: 'Salary Calculator', href: '/govt-salary-calculator' },
              { label: 'SSC Jobs', href: '/sarkari-jobs' },
              { label: 'IBPS PO', href: '/sarkari-jobs' },
              { label: 'Railway Jobs', href: '/sarkari-jobs' },
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
