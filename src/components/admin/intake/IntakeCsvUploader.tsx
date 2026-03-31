/**
 * Phase 2: CSV Import UI for the Intake Pipeline.
 * Parses CSV, previews rows, detects duplicates/stale/generic titles,
 * and imports rows into intake_drafts.
 */
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';

interface ParsedRow {
  [key: string]: string;
}

interface ImportSummary {
  total: number;
  imported: number;
  skippedExactDupes: number;
  taggedDuplicateRisk: number;
  taggedGenericTitle: number;
  taggedStaleContent: number;
  errors: number;
}

// Column mapping: CSV column name → intake_drafts field
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
  title: 'raw_title',
  raw_title: 'raw_title',
  url: 'source_url',
  source_url: 'source_url',
  link: 'source_url',
  domain: 'source_domain',
  source_domain: 'source_domain',
  source_name: 'source_name',
  source: 'source_name',
  text: 'raw_text',
  raw_text: 'raw_text',
  content: 'raw_text',
  html: 'raw_html',
  raw_html: 'raw_html',
  file_url: 'raw_file_url',
  raw_file_url: 'raw_file_url',
  file_type: 'raw_file_type',
  raw_file_type: 'raw_file_type',
  type: 'source_type',
  source_type: 'source_type',
  scrape_run_id: 'scrape_run_id',
};

const GENERIC_TITLE_PATTERNS = /^(advertisement|notice|notification|corrigendum|file|download|document|circular|detailed\s+notification|recruitment)\b.*\.pdf$/i;

const TIME_SENSITIVE_TERMS = /\b(result|merit\s+list|shortlist|admit\s+card|hall\s+ticket|call\s+letter|answer\s+key|correction\s+notice|interview\s+schedule|cut[\s-]?off)\b/i;

function parseCSVWithPapa(text: string): { headers: string[]; rows: ParsedRow[]; warnings: number } {
  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  });

  const headers = result.meta.fields || [];
  const rows = result.data;
  const warnings = result.errors.length;

  return { headers, rows, warnings };
}

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

  // Generic title
  if (GENERIC_TITLE_PATTERNS.test(title.trim())) {
    tags.push('generic_title');
  }

  // Stale content
  if (maxYear !== null) {
    if (maxYear <= currentYear - 2) {
      tags.push('old_year', 'stale_content');
    } else if (maxYear <= currentYear - 1 && TIME_SENSITIVE_TERMS.test(title)) {
      tags.push('stale_content');
    }
  }

  // PDF-led
  if (fileUrl && /\.pdf$/i.test(fileUrl) && title.split(/\s+/).length <= 5) {
    tags.push('pdf_only');
  }

  // Weak evidence
  if (!title || title.split(/\s+/).length <= 3) {
    tags.push('weak_evidence');
  }

  return tags;
}

export function IntakeCsvUploader({ onImportComplete }: { onImportComplete?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setParsedData(parsed);

      // Auto-map columns
      const mapping: Record<string, string> = {};
      parsed.headers.forEach(h => {
        const key = h.trim().toLowerCase().replace(/\s+/g, '_');
        mapping[h] = AUTO_MAP[key] || '__skip__';
      });
      setColumnMapping(mapping);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);

    const stats: ImportSummary = {
      total: parsedData.rows.length,
      imported: 0,
      skippedExactDupes: 0,
      taggedDuplicateRisk: 0,
      taggedGenericTitle: 0,
      taggedStaleContent: 0,
      errors: 0,
    };

    try {
      // Fetch existing source_urls for exact dupe check
      const { data: existingUrls } = await supabase
        .from('intake_drafts')
        .select('source_url, raw_title, source_domain');

      const existingUrlSet = new Set(
        (existingUrls || []).filter(r => r.source_url).map(r => normalizeUrl(r.source_url!))
      );
      const existingTitleDomains = new Set(
        (existingUrls || []).filter(r => r.raw_title && r.source_domain)
          .map(r => `${normalizeTitle(r.raw_title!)}||${(r.source_domain || '').toLowerCase()}`)
      );

      const batchRows: any[] = [];

      for (const row of parsedData.rows) {
        const mapped: Record<string, any> = {
          processing_status: 'imported',
          review_status: 'pending',
        };

        // Apply column mapping
        for (const [csvCol, dbField] of Object.entries(columnMapping)) {
          if (dbField !== '__skip__' && row[csvCol]) {
            mapped[dbField] = row[csvCol];
          }
        }

        // Extract source_domain from source_url if not provided
        if (mapped.source_url && !mapped.source_domain) {
          try {
            mapped.source_domain = new URL(mapped.source_url).hostname.toLowerCase();
          } catch { /* ignore */ }
        }

        // Exact duplicate check
        if (mapped.source_url && existingUrlSet.has(normalizeUrl(mapped.source_url))) {
          stats.skippedExactDupes++;
          continue;
        }

        // Detect tags
        const tags = detectTags(
          mapped.raw_title || '',
          mapped.raw_text || '',
          mapped.raw_file_url || ''
        );

        // Probable duplicate check
        if (mapped.raw_title && mapped.source_domain) {
          const titleDomainKey = `${normalizeTitle(mapped.raw_title)}||${mapped.source_domain.toLowerCase()}`;
          if (existingTitleDomains.has(titleDomainKey)) {
            tags.push('duplicate_risk');
            stats.taggedDuplicateRisk++;
          }
          // Add to set for intra-batch dedup
          existingTitleDomains.add(titleDomainKey);
        }

        if (tags.includes('generic_title')) stats.taggedGenericTitle++;
        if (tags.includes('stale_content')) stats.taggedStaleContent++;

        mapped.secondary_tags = JSON.stringify(tags);

        // Add source_url to set for intra-batch dedup
        if (mapped.source_url) {
          existingUrlSet.add(normalizeUrl(mapped.source_url));
        }

        batchRows.push(mapped);
      }

      // Insert in batches of 50
      for (let i = 0; i < batchRows.length; i += 50) {
        const batch = batchRows.slice(i, i + 50);
        const { error } = await supabase.from('intake_drafts').insert(batch as any);
        if (error) {
          console.error('Import batch error:', error);
          stats.errors += batch.length;
        } else {
          stats.imported += batch.length;
        }
      }

      setSummary(stats);
      toast({
        title: 'Import Complete',
        description: `${stats.imported} rows imported, ${stats.skippedExactDupes} exact dupes skipped`,
      });
      onImportComplete?.();
    } catch (err) {
      console.error('Import error:', err);
      toast({ title: 'Import Failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" />
            Select CSV File
          </Button>
        </div>

        {/* Preview */}
        {parsedData && (
          <>
            <div className="text-sm text-muted-foreground">
              Detected {parsedData.headers.length} columns, {parsedData.rows.length} rows
            </div>

            {/* Column Mapping */}
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
                      <SelectTrigger className="h-7 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
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

            {/* Preview Table */}
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

            {/* Import Button */}
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import {parsedData.rows.length} Rows
            </Button>
          </>
        )}

        {/* Summary */}
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
              <div>Tagged Duplicate Risk: <Badge variant="outline" className="ml-1">{summary.taggedDuplicateRisk}</Badge></div>
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
