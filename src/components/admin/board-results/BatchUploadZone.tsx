/**
 * BatchUploadZone — Parse XLSX → validate → save rows to DB permanently.
 * No generation. No custom_pages creation. Parsed data in DB is the source of truth.
 */
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { generateSlug, extractBoardAbbr, mapVariant } from '@/lib/boardResultUtils';
import { resolveHeaders, extractCanonicalValues } from '@/lib/headerNormalizer';
import * as XLSX from 'xlsx';

interface Props {
  onBatchCreated: (batchId: string) => void;
  createBatch: (fileName: string, rows: any[], filePath?: string | null) => Promise<string | null>;
}

export function BatchUploadZone({ onBatchCreated, createBatch }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<{ total: number; valid: number; invalid: number } | null>(null);

  const handleFile = async (file: File) => {
    setParsing(true);
    setParseResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Multi-sheet support: find first sheet with valid headers
      let ws: XLSX.WorkSheet | null = null;
      let rawRows: any[] = [];
      let resolved: ReturnType<typeof resolveHeaders> | null = null;
      let chosenSheet = '';

      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) continue;

        const headers = Object.keys(rows[0]);
        const res = resolveHeaders(headers);
        if (res.missing.length === 0) {
          ws = sheet;
          rawRows = rows;
          resolved = res;
          chosenSheet = sheetName;
          break;
        }
        // Keep last attempt for error reporting
        if (!resolved) resolved = res;
      }

      if (!resolved) {
        toast({ title: 'Empty file', description: 'No sheets with data found.', variant: 'destructive' });
        setParsing(false);
        return;
      }

      if (resolved.missing.length > 0) {
        const detectedHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]) : Object.keys(wb.Sheets[wb.SheetNames[0]] || {});
        toast({
          title: 'Missing required columns',
          description: [
            `Detected headers: ${detectedHeaders.join(', ')}`,
            `Normalized: ${resolved.normalizedHeaders.join(', ')}`,
            `Matched: ${resolved.matched.join(', ') || 'none'}`,
            `Missing: ${resolved.missing.join(', ')}`,
          ].join('\n'),
          variant: 'destructive',
        });
        setParsing(false);
        return;
      }

      // Parse + normalize using canonical field extraction
      const headerMap = resolved.headerMap;
      const slugsSeen = new Set<string>();
      const parsedRows = rawRows.map((raw, i) => {
        const vals = extractCanonicalValues(raw, headerMap);
        const stateUt = vals.state_ut;
        const boardName = vals.board_name;
        const resultUrl = vals.result_url;
        const officialBoardUrl = vals.official_board_url;
        const seoIntroText = vals.seo_intro_text;

        const errors: string[] = [];
        if (!stateUt) errors.push('Missing State/UT');
        if (!boardName) errors.push('Missing Board Name');

        const slug = generateSlug(stateUt, boardName);
        if (slugsSeen.has(slug)) errors.push(`Duplicate slug within file: ${slug}`);
        slugsSeen.add(slug);

        return {
          state_ut: stateUt,
          board_name: boardName,
          result_url: resultUrl,
          official_board_url: officialBoardUrl,
          seo_intro_text: seoIntroText,
          slug,
          variant: mapVariant(boardName),
          board_abbr: extractBoardAbbr(boardName),
          is_valid: errors.length === 0,
          validation_errors: errors,
          source_payload: raw,
        };
      });

      const valid = parsedRows.filter(r => r.is_valid).length;
      const invalid = parsedRows.length - valid;
      setParseResult({ total: parsedRows.length, valid, invalid });

      // Try uploading file to storage (optional — failure is non-blocking)
      let filePath: string | null = null;
      try {
        const path = `board-result-files/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('blog-assets').upload(path, file);
        if (!uploadErr) filePath = path;
      } catch { /* storage optional */ }

      // Save to DB — this is the mandatory success gate
      const batchId = await createBatch(file.name, parsedRows, filePath);
      if (batchId) onBatchCreated(batchId);
    } catch (err: any) {
      toast({ title: 'Parse error', description: err.message, variant: 'destructive' });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5" /> Upload Board Result Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed rounded-lg border-muted-foreground/25">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Upload XLSX/CSV with columns: State/UT, Board Name, Result URL, Official Board URL</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? 'Parsing…' : 'Choose File'}
          </Button>
        </div>

        {parseResult && (
          <div className="flex gap-3 mt-3">
            <Badge variant="secondary">{parseResult.total} total</Badge>
            <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />{parseResult.valid} valid</Badge>
            {parseResult.invalid > 0 && (
              <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{parseResult.invalid} invalid</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
