/**
 * Intake File Importer: Excel, CSV, JSON support.
 * Auto-maps columns, auto-skips mapping when shape is known.
 * Returns imported IDs + scrape_run_id for scoped processing.
 */
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';

interface ParsedRow {
  [key: string]: string;
}

interface ImportSummary {
  total: number;
  imported: number;
  skippedExactDupes: number;
  skippedPublishedDupes: number;
  taggedDuplicateRisk: number;
  taggedPublishedDupeRisk: number;
  taggedGenericTitle: number;
  taggedStaleContent: number;
  errors: number;
}

type FileType = 'csv' | 'json' | 'excel' | null;

const COLUMN_MAP_OPTIONS: { label: string; value: string }[] = [
  { label: '— Skip —', value: '__skip__' },
  { label: 'Raw Title', value: 'raw_title' },
  { label: 'Source URL', value: 'source_url' },
  { label: 'Source Domain', value: 'source_domain' },
  { label: 'Source Name', value: 'source_name' },
  { label: 'Raw Text', value: 'raw_text' },
  { label: 'Raw HTML', value: 'raw_html' },
  { label: 'Raw File URL', value: 'raw_file_url' },
  { label: 'Raw File Type', value: 'raw_file_type' },
  { label: 'Source Type', value: 'source_type' },
  { label: 'Scrape Run ID', value: 'scrape_run_id' },
];

const AUTO_MAP: Record<string, string> = {
  title: 'raw_title', raw_title: 'raw_title',
  url: 'source_url', source_url: 'source_url', link: 'source_url',
  domain: 'source_domain', source_domain: 'source_domain', host: 'source_domain',
  source_name: 'source_name', sourcename: 'source_name', source: 'source_name',
  text: 'raw_text', raw_text: 'raw_text', content: 'raw_text',
  html: 'raw_html', raw_html: 'raw_html',
  file_url: 'raw_file_url', raw_file_url: 'raw_file_url',
  filetype: 'raw_file_type', file_type: 'raw_file_type', raw_file_type: 'raw_file_type',
  type: 'source_type', source_type: 'source_type',
  scrape_run_id: 'scrape_run_id',
};

const GENERIC_TITLE_PATTERNS = /^(advertisement|notice|notification|corrigendum|file|download|document|circular|detailed\s+notification|recruitment)\b.*\.pdf$/i;
const TIME_SENSITIVE_TERMS = /\b(result|merit\s+list|shortlist|admit\s+card|hall\s+ticket|call\s+letter|answer\s+key|correction\s+notice|interview\s+schedule|cut[\s-]?off)\b/i;

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function extractYears(text: string): number[] {
  const matches = text.match(/\b(19|20)\d{2}\b/g);
  return matches ? matches.map(Number) : [];
}

function detectTags(title: string, rawText: string, fileUrl: string): string[] {
  const tags: string[] = [];
  const currentYear = new Date().getFullYear();
  const combined = `${title} ${rawText}`;
  const years = extractYears(combined);
  const maxYear = years.length > 0 ? Math.max(...years) : null;

  if (GENERIC_TITLE_PATTERNS.test(title.trim())) tags.push('generic_title');
  if (maxYear !== null) {
    if (maxYear <= currentYear - 2) tags.push('old_year', 'stale_content');
    else if (maxYear <= currentYear - 1 && TIME_SENSITIVE_TERMS.test(title)) tags.push('stale_content');
  }
  if (fileUrl && /\.pdf$/i.test(fileUrl) && title.split(/\s+/).length <= 5) tags.push('pdf_only');
  if (!title || title.split(/\s+/).length <= 3) tags.push('weak_evidence');
  return tags;
}

function flattenForPreview(obj: Record<string, unknown>): ParsedRow {
  const row: ParsedRow = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) row[key] = '';
    else if (typeof value === 'object') row[key] = JSON.stringify(value);
    else row[key] = String(value);
  }
  return row;
}

function parseJSONFile(text: string): {
  headers: string[]; rows: ParsedRow[];
  originalItems: Record<string, unknown>[]; skippedNonObjects: number;
} {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of objects');
  if (parsed.length === 0) throw new Error('JSON array is empty');

  const validItems: Record<string, unknown>[] = [];
  let skippedNonObjects = 0;
  for (const item of parsed) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) validItems.push(item as Record<string, unknown>);
    else skippedNonObjects++;
  }
  if (validItems.length === 0) throw new Error('No valid object rows found in JSON array');

  const keySet = new Set<string>();
  for (const item of validItems) for (const key of Object.keys(item)) keySet.add(key);
  const headers = Array.from(keySet);
  const rows = validItems.map(flattenForPreview);
  return { headers, rows, originalItems: validItems, skippedNonObjects };
}

function getFileExtension(filename: string): string {
  return (filename.split('.').pop() || '').toLowerCase();
}

function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach(h => {
    const key = h.trim().toLowerCase().replace(/\s+/g, '_');
    mapping[h] = AUTO_MAP[key] || '__skip__';
  });
  return mapping;
}

function hasMinimumMapping(mapping: Record<string, string>): boolean {
  const mapped = new Set(Object.values(mapping).filter(v => v !== '__skip__'));
  return mapped.has('raw_title') && mapped.has('source_url');
}

export function IntakeCsvUploader({ onImportComplete }: { onImportComplete?: (importedIds: string[], scrapeRunId: string) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [originalJsonItems, setOriginalJsonItems] = useState<Record<string, unknown>[] | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parseWarnings, setParseWarnings] = useState(0);
  const [autoMapped, setAutoMapped] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  const resetState = () => {
    setParsedData(null); setOriginalJsonItems(null); setFileType(null);
    setSummary(null); setParseWarnings(0); setAutoMapped(false); setShowMapping(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetState();
    const ext = getFileExtension(file.name);

    if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { defval: '' });
          if (jsonData.length === 0) {
            toast({ title: 'Empty File', description: 'No rows found in the Excel file.', variant: 'destructive' });
            return;
          }
          const headers = Object.keys(jsonData[0]);
          const rows = jsonData.map(r => {
            const row: ParsedRow = {};
            headers.forEach(h => { row[h] = r[h] !== undefined ? String(r[h]) : ''; });
            return row;
          });
          setFileType('excel');
          setParsedData({ headers, rows });
          setOriginalJsonItems(null);
          const mapping = autoMapHeaders(headers);
          setColumnMapping(mapping);
          const isAuto = hasMinimumMapping(mapping);
          setAutoMapped(isAuto);
          setShowMapping(!isAuto);
        } catch (err: any) {
          toast({ title: 'Excel Parse Error', description: err.message || 'Could not parse Excel file.', variant: 'destructive' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv' || ext === 'json') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (ext === 'json') handleJsonParse(text);
        else handleCsvParse(text);
      };
      reader.readAsText(file);
    } else {
      toast({ title: 'Unsupported File', description: 'Please upload an Excel, CSV, or JSON file.', variant: 'destructive' });
    }
  };

  const handleCsvParse = (text: string) => {
    const result = Papa.parse<ParsedRow>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h: string) => h.trim() });
    const headers = result.meta.fields || [];
    const rows = result.data;
    if (headers.length === 0 || rows.length === 0) {
      toast({ title: 'Invalid CSV', description: 'No headers or rows detected.', variant: 'destructive' });
      return;
    }
    setFileType('csv');
    setParsedData({ headers, rows });
    setParseWarnings(result.errors.length);
    setOriginalJsonItems(null);
    const mapping = autoMapHeaders(headers);
    setColumnMapping(mapping);
    const isAuto = hasMinimumMapping(mapping);
    setAutoMapped(isAuto);
    setShowMapping(!isAuto);
  };

  const handleJsonParse = (text: string) => {
    try { JSON.parse(text); } catch {
      toast({ title: 'Invalid JSON', description: 'File could not be parsed.', variant: 'destructive' });
      return;
    }
    try {
      const { headers, rows, originalItems, skippedNonObjects } = parseJSONFile(text);
      setFileType('json');
      setParsedData({ headers, rows });
      setOriginalJsonItems(originalItems);
      setParseWarnings(skippedNonObjects);
      const mapping = autoMapHeaders(headers);
      setColumnMapping(mapping);
      const isAuto = hasMinimumMapping(mapping);
      setAutoMapped(isAuto);
      setShowMapping(!isAuto);
    } catch (err: any) {
      toast({ title: 'Invalid JSON', description: err.message, variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);
    const scrapeRunId = crypto.randomUUID();

    const stats: ImportSummary = {
      total: parsedData.rows.length, imported: 0, skippedExactDupes: 0,
      skippedPublishedDupes: 0, taggedDuplicateRisk: 0, taggedPublishedDupeRisk: 0,
      taggedGenericTitle: 0, taggedStaleContent: 0, errors: 0,
    };

    try {
      // Fetch existing draft URLs and title+domain sets
      const { data: existingUrls } = await supabase
        .from('intake_drafts').select('source_url, raw_title, source_domain');
      const existingUrlSet = new Set(
        (existingUrls || []).filter(r => r.source_url).map(r => normalizeUrl(r.source_url!))
      );
      const existingTitleDomains = new Set(
        (existingUrls || []).filter(r => r.raw_title && r.source_domain)
          .map(r => `${normalizeTitle(r.raw_title!)}||${(r.source_domain || '').toLowerCase()}`)
      );

      // Fetch published URLs from employment_news_jobs and govt_exams
      const [{ data: enjUrls }, { data: geUrls }] = await Promise.all([
        supabase.from('employment_news_jobs').select('apply_link, post, org_name'),
        supabase.from('govt_exams').select('apply_link, official_notification_url, exam_name, conducting_body'),
      ]);

      const publishedUrlSet = new Set<string>();
      for (const r of (enjUrls || [])) {
        if (r.apply_link) publishedUrlSet.add(normalizeUrl(r.apply_link));
      }
      for (const r of (geUrls || [])) {
        if (r.apply_link) publishedUrlSet.add(normalizeUrl(r.apply_link));
        if (r.official_notification_url) publishedUrlSet.add(normalizeUrl(r.official_notification_url));
      }

      // Build strict published identifier set (exact normalized post+org / exam+body)
      const publishedIdentifierSet = new Set<string>();
      for (const r of (enjUrls || [])) {
        if (r.post && r.org_name) {
          publishedIdentifierSet.add(`${normalizeTitle(r.post)}||${normalizeTitle(r.org_name)}`);
        }
      }
      for (const r of (geUrls || [])) {
        if (r.exam_name && r.conducting_body) {
          publishedIdentifierSet.add(`${normalizeTitle(r.exam_name)}||${normalizeTitle(r.conducting_body)}`);
        }
      }

      const batchRows: any[] = [];

      for (let rowIdx = 0; rowIdx < parsedData.rows.length; rowIdx++) {
        const row = parsedData.rows[rowIdx];
        const mapped: Record<string, any> = {
          processing_status: 'imported',
          review_status: 'pending',
          scrape_run_id: scrapeRunId,
        };

        if (fileType === 'json' && originalJsonItems) {
          const originalItem = originalJsonItems[rowIdx];
          for (const [csvCol, dbField] of Object.entries(columnMapping)) {
            if (dbField !== '__skip__' && row[csvCol]) mapped[dbField] = row[csvCol];
          }
          if (originalItem.url && typeof originalItem.url === 'string') mapped.source_url = originalItem.url;
          if (originalItem.sourceName && typeof originalItem.sourceName === 'string') mapped.source_name = originalItem.sourceName;
          if (originalItem.host && typeof originalItem.host === 'string') mapped.source_domain = originalItem.host;
          if (originalItem.title && typeof originalItem.title === 'string') mapped.raw_title = originalItem.title;
          if (originalItem.isFile === true && originalItem.url && typeof originalItem.url === 'string') mapped.raw_file_url = originalItem.url;
          if (originalItem.isFile === true && originalItem.fileType && typeof originalItem.fileType === 'string') mapped.raw_file_type = originalItem.fileType;
          if (!mapped.source_type) mapped.source_type = 'crawler';
          mapped.structured_data_json = originalItem;
        } else {
          for (const [csvCol, dbField] of Object.entries(columnMapping)) {
            if (dbField !== '__skip__' && row[csvCol]) mapped[dbField] = row[csvCol];
          }
          // Preserve original row payload for debugging and re-processing
          mapped.structured_data_json = row;
        }

        if (mapped.source_url && !mapped.source_domain) {
          try { mapped.source_domain = new URL(mapped.source_url).hostname.toLowerCase(); } catch { /* ignore */ }
        }

        if (mapped.source_url && existingUrlSet.has(normalizeUrl(mapped.source_url))) {
          stats.skippedExactDupes++;
          continue;
        }

        // Skip exact URL duplicates against published tables
        if (mapped.source_url && publishedUrlSet.has(normalizeUrl(mapped.source_url))) {
          stats.skippedPublishedDupes++;
          continue;
        }

        const tags = detectTags(mapped.raw_title || '', mapped.raw_text || '', mapped.raw_file_url || '');

        if (mapped.raw_title && mapped.source_domain) {
          const titleDomainKey = `${normalizeTitle(mapped.raw_title)}||${mapped.source_domain.toLowerCase()}`;
          if (existingTitleDomains.has(titleDomainKey)) { tags.push('duplicate_risk'); stats.taggedDuplicateRisk++; }
          existingTitleDomains.add(titleDomainKey);
        }

        // Tag exact identifier matches against published items (conservative: no fuzzy)
        if (mapped.raw_title && mapped.source_domain) {
          const pubIdKey = `${normalizeTitle(mapped.raw_title)}||${normalizeTitle(mapped.source_domain)}`;
          if (publishedIdentifierSet.has(pubIdKey)) {
            tags.push('published_duplicate_risk');
            stats.taggedPublishedDupeRisk++;
          }
        }

        if (tags.includes('generic_title')) stats.taggedGenericTitle++;
        if (tags.includes('stale_content')) stats.taggedStaleContent++;
        mapped.secondary_tags = tags;
        if (mapped.source_url) existingUrlSet.add(normalizeUrl(mapped.source_url));
        batchRows.push(mapped);
      }

      const allInsertedIds: string[] = [];

      for (let i = 0; i < batchRows.length; i += 50) {
        const batch = batchRows.slice(i, i + 50);
        const { data: inserted, error } = await supabase.from('intake_drafts').insert(batch as any).select('id');
        if (error) {
          console.error('Import batch error:', error);
          stats.errors += batch.length;
        } else {
          stats.imported += (inserted || []).length;
          allInsertedIds.push(...(inserted || []).map((r: any) => r.id));
        }
      }

      setSummary(stats);
      toast({ title: 'Import Complete', description: `${stats.imported} imported, ${stats.skippedExactDupes} draft dupes skipped, ${stats.skippedPublishedDupes} published dupes skipped` });
      onImportComplete?.(allInsertedIds, scrapeRunId);
    } catch (err) {
      console.error('Import error:', err);
      toast({ title: 'Import Failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const TEMPLATE_COLUMNS = ['raw_title', 'source_url', 'source_domain', 'source_name', 'raw_text', 'raw_html', 'raw_file_url', 'raw_file_type', 'source_type'];
  const TEMPLATE_SAMPLE: Record<string, string> = {
    raw_title: 'SSC CGL 2025 – Combined Graduate Level Examination Notification',
    source_url: 'https://ssc.nic.in/Portal/Notices',
    source_domain: 'ssc.nic.in',
    source_name: 'SSC Official',
    raw_text: 'Staff Selection Commission invites applications for CGL 2025...',
    raw_html: '',
    raw_file_url: 'https://ssc.nic.in/Portal/Notices/cgl-2025.pdf',
    raw_file_type: 'pdf',
    source_type: 'crawler',
  };

  const downloadTemplate = (format: 'xlsx' | 'csv' | 'json') => {
    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet([TEMPLATE_SAMPLE], { header: TEMPLATE_COLUMNS });
      XLSX.utils.sheet_add_aoa(ws, [TEMPLATE_COLUMNS.map(c => `Column: ${c}`)], { origin: 'A2' });
      ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 20 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'intake_template.xlsx');
    } else if (format === 'csv') {
      const csv = [TEMPLATE_COLUMNS.join(','), TEMPLATE_COLUMNS.map(c => `"${(TEMPLATE_SAMPLE[c] || '').replace(/"/g, '""')}"`).join(',')].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'intake_template.csv'; a.click();
      URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify([TEMPLATE_SAMPLE], null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'intake_template.json'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import File (Excel / CSV / JSON)
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download Template
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => downloadTemplate('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadTemplate('csv')}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadTemplate('json')}>JSON (.json)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleFileSelect} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" />
            Select File
          </Button>
        </div>

        {parsedData && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{parsedData.headers.length} fields, {parsedData.rows.length} rows</span>
              {fileType && <Badge variant="outline" className="text-xs uppercase">{fileType}</Badge>}
              {autoMapped && (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Auto-mapped
                </Badge>
              )}
            </div>

            {parseWarnings > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {fileType === 'json'
                  ? `${parseWarnings} non-object item(s) skipped.`
                  : `${parseWarnings} row(s) had formatting issues.`}
              </div>
            )}

            {autoMapped && !showMapping && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowMapping(true)}>
                Review Column Mapping
              </Button>
            )}

            {showMapping && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Column Mapping</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {parsedData.headers.map(h => (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-xs font-mono truncate max-w-[120px]" title={h}>{h}</span>
                      <Select
                        value={columnMapping[h] || '__skip__'}
                        onValueChange={v => setColumnMapping(prev => ({ ...prev, [h]: v }))}
                      >
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMN_MAP_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border rounded-md overflow-auto max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsedData.headers.map(h => (
                      <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {parsedData.headers.map(h => (
                        <TableCell key={h} className="text-xs max-w-[200px] truncate">{row[h]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import {parsedData.rows.length} Rows
            </Button>
          </>
        )}

        {summary && (
          <div className="rounded-md border p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Import Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>Total Parsed: <strong>{summary.total}</strong></div>
              <div>Imported: <Badge variant="default" className="ml-1">{summary.imported}</Badge></div>
              <div>Exact Dupes Skipped: <Badge variant="secondary" className="ml-1">{summary.skippedExactDupes}</Badge></div>
              <div>Published Dupes Skipped: <Badge variant="secondary" className="ml-1">{summary.skippedPublishedDupes}</Badge></div>
              <div>Tagged Duplicate Risk: <Badge variant="outline" className="ml-1">{summary.taggedDuplicateRisk}</Badge></div>
              <div>Tagged Published Dupe Risk: <Badge variant="outline" className="ml-1">{summary.taggedPublishedDupeRisk}</Badge></div>
              <div>Tagged Generic Title: <Badge variant="outline" className="ml-1">{summary.taggedGenericTitle}</Badge></div>
              <div>Tagged Stale: <Badge variant="outline" className="ml-1">{summary.taggedStaleContent}</Badge></div>
              {summary.errors > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  Errors: <Badge variant="destructive" className="ml-1">{summary.errors}</Badge>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
