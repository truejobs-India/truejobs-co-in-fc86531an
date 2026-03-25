import { useState, useRef, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Upload, Download, FileText, Merge, Minimize2, ImageIcon, Shield, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const SITE_URL = 'https://truejobs.co.in';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_MERGE_FILES = 10;

const FAQ_ITEMS = [
  {
    question: 'Is this PDF tool safe to use?',
    answer: 'Yes, all PDF processing happens entirely in your browser using the pdf-lib library. No files are uploaded to any server, ensuring complete privacy and security.',
  },
  {
    question: 'What is the maximum file size supported?',
    answer: 'Each PDF file can be up to 20MB. For merging, you can combine up to 10 PDF files at once.',
  },
  {
    question: 'Can I merge PDFs with different page sizes?',
    answer: 'Yes, the merge tool handles PDFs with different page sizes. Each page retains its original dimensions in the merged output.',
  },
  {
    question: 'How does PDF compression work?',
    answer: 'The compression tool optimizes the internal structure of the PDF by removing redundant data. The actual compression ratio depends on the content of the PDF.',
  },
];

async function loadPdfLib() {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument;
}

function FileDropZone({
  accept,
  multiple,
  maxFiles,
  onFiles,
  label,
  description,
}: {
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  onFiles: (files: File[]) => void;
  label: string;
  description: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validate = (files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: 'File too large', description: `${f.name} exceeds 20MB limit.`, variant: 'destructive' });
        continue;
      }
      valid.push(f);
    }
    if (maxFiles && valid.length > maxFiles) {
      toast({ title: 'Too many files', description: `Maximum ${maxFiles} files allowed.`, variant: 'destructive' });
      return valid.slice(0, maxFiles);
    }
    return valid;
  };

  return (
    <div
      className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = validate(Array.from(e.dataTransfer.files));
        if (files.length) onFiles(files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = validate(Array.from(e.target.files || []));
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function MergeTab() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_MERGE_FILES);
    });
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const merge = async () => {
    if (files.length < 2) {
      toast({ title: 'Need at least 2 PDFs', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const PDFDocument = await loadPdfLib();
      const merged = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const pdfBytes = await merged.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDFs merged successfully!' });
    } catch {
      toast({ title: 'Merge failed', description: 'One or more PDFs may be corrupted.', variant: 'destructive' });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <FileDropZone
        accept=".pdf"
        multiple
        maxFiles={MAX_MERGE_FILES}
        onFiles={addFiles}
        label="Drop PDFs here or click to upload"
        description={`PDF files • Max 20MB each • Up to ${MAX_MERGE_FILES} files`}
      />
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{files.length} file(s) selected:</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
              <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)}KB)</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button onClick={merge} disabled={processing || files.length < 2} className="w-full">
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Merge className="h-4 w-4 mr-2" />}
            Merge {files.length} PDFs
          </Button>
        </div>
      )}
    </div>
  );
}

function CompressTab() {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const compress = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setProcessing(true);
    try {
      const PDFDocument = await loadPdfLib();
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const originalKB = (file.size / 1024).toFixed(0);
      const compressedKB = (blob.size / 1024).toFixed(0);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.pdf', '-compressed.pdf');
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF compressed', description: `${originalKB}KB → ${compressedKB}KB` });
    } catch {
      toast({ title: 'Compression failed', variant: 'destructive' });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      {processing ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Compressing PDF...</p>
        </div>
      ) : (
        <FileDropZone
          accept=".pdf"
          onFiles={compress}
          label="Drop a PDF to compress"
          description="PDF file • Max 20MB"
        />
      )}
    </div>
  );
}

function ImageToPdfTab() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);

  const addFiles = (newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith('image/'));
    if (images.length !== newFiles.length) {
      toast({ title: 'Some files skipped', description: 'Only image files are accepted.', variant: 'destructive' });
    }
    setFiles(prev => [...prev, ...images].slice(0, MAX_MERGE_FILES));
  };

  const convert = async () => {
    if (!files.length) return;
    setProcessing(true);
    try {
      const PDFDocument = await loadPdfLib();
      const doc = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        let img;
        if (file.type === 'image/png') {
          img = await doc.embedPng(bytes);
        } else {
          img = await doc.embedJpg(bytes);
        }
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'images.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF created from images!' });
      setFiles([]);
    } catch {
      toast({ title: 'Conversion failed', variant: 'destructive' });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="image/*"
        multiple
        maxFiles={MAX_MERGE_FILES}
        onFiles={addFiles}
        label="Drop images here"
        description={`JPG or PNG • Max 20MB each • Up to ${MAX_MERGE_FILES} images`}
      />
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{files.length} image(s) selected</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
              <span className="truncate">{f.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button onClick={convert} disabled={processing} className="w-full">
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Create PDF
          </Button>
        </div>
      )}
    </div>
  );
}

function PdfToImageTab() {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-8 text-center text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium mb-2">PDF to Image Conversion</p>
        <p className="text-sm">
          This feature requires rendering PDF pages, which needs a specialized library.
          For now, we recommend using the browser's built-in Print → Save as Image option,
          or taking screenshots of individual pages.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => toast({ title: 'Tip', description: 'Open the PDF in your browser, then use Ctrl+P → Save as Image.' })}
        >
          Show Tip
        </Button>
      </div>
    </div>
  );
}

export default function PdfTools() {
  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Online PDF Tools',
    url: `${SITE_URL}/pdf-tools`,
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
      { '@type': 'ListItem', position: 3, name: 'PDF Tools', item: `${SITE_URL}/pdf-tools` },
    ],
  };

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO
        title="Free PDF Tools Online | Merge, Compress, Convert"
        description="Merge, compress, and convert PDFs for free. Create PDFs from images. 100% browser-based — no files uploaded to any server. Safe and private."
        canonical="/pdf-tools"
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
            <li className="text-foreground font-medium">PDF Tools</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">Free Online PDF Tools</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Merge multiple PDFs into one, compress PDF file sizes, or convert images to PDF — all for free.
          Every operation runs entirely in your browser using the pdf-lib library. No files are uploaded
          to any server, making this the safest way to handle your documents online.
        </p>

        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-muted-foreground">Files are processed entirely in your browser. Nothing is uploaded.</span>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <Tabs defaultValue="merge" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="merge" className="text-xs sm:text-sm">
                  <Merge className="h-3.5 w-3.5 mr-1 hidden sm:inline" />Merge
                </TabsTrigger>
                <TabsTrigger value="compress" className="text-xs sm:text-sm">
                  <Minimize2 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />Compress
                </TabsTrigger>
                <TabsTrigger value="img2pdf" className="text-xs sm:text-sm">
                  <FileText className="h-3.5 w-3.5 mr-1 hidden sm:inline" />IMG→PDF
                </TabsTrigger>
                <TabsTrigger value="pdf2img" className="text-xs sm:text-sm">
                  <ImageIcon className="h-3.5 w-3.5 mr-1 hidden sm:inline" />PDF→IMG
                </TabsTrigger>
              </TabsList>

              <TabsContent value="merge"><MergeTab /></TabsContent>
              <TabsContent value="compress"><CompressTab /></TabsContent>
              <TabsContent value="img2pdf"><ImageToPdfTab /></TabsContent>
              <TabsContent value="pdf2img"><PdfToImageTab /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Limits Info */}
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-lg">Tool Limits</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">20MB</p>
                <p className="text-muted-foreground">Max file size</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">10</p>
                <p className="text-muted-foreground">Max files for merge</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">100%</p>
                <p className="text-muted-foreground">Browser-based</p>
              </div>
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
          <h2 className="text-lg font-semibold mb-3">Related Tools</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Photo Resizer', href: '/photo-resizer' },
              { label: 'Image Resizer', href: '/image-resizer' },
              { label: 'AI Resume Checker', href: '/tools/resume-checker' },
              { label: 'Age Calculator', href: '/govt-job-age-calculator' },
              { label: 'Salary Calculator', href: '/govt-salary-calculator' },
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
