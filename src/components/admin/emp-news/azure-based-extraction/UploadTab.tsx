import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, AlertTriangle, CheckCircle, XCircle, Loader2, Image, Zap, Trash2 } from 'lucide-react';
import type { AzureEmpNewsIssue, AzureEmpNewsPage } from '@/types/azureEmpNews';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const FILENAME_PATTERN = /^(\d{3})\.(jpg|jpeg|png|webp)$/i;
const BUCKET = 'employment-news-azure';

interface UploadTabProps {
  issues: AzureEmpNewsIssue[];
  selectedIssueId: string | null;
  onIssueChange: (id: string) => void;
  onUploadComplete: () => void;
}

interface FileValidation {
  file: File;
  pageNo: number | null;
  valid: boolean;
  error?: string;
}

export function UploadTab({ issues, selectedIssueId, onIssueChange, onUploadComplete }: UploadTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingPages, setExistingPages] = useState<AzureEmpNewsPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [validatedFiles, setValidatedFiles] = useState<FileValidation[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [gapWarning, setGapWarning] = useState<string | null>(null);

  // Fetch existing pages for selected issue
  const fetchPages = useCallback(async () => {
    if (!selectedIssueId) { setExistingPages([]); return; }
    setLoadingPages(true);
    const { data, error } = await supabase
      .from('azure_emp_news_pages')
      .select('*')
      .eq('issue_id', selectedIssueId)
      .order('page_no', { ascending: true });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setExistingPages((data || []) as unknown as AzureEmpNewsPage[]);
    }
    setLoadingPages(false);
  }, [selectedIssueId, toast]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // Validate selected files
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const existingPageNos = new Set(existingPages.map(p => p.page_no));
    const newPageNos = new Set<number>();
    const validated: FileValidation[] = [];

    for (const file of Array.from(files)) {
      const match = FILENAME_PATTERN.exec(file.name);
      if (!match) {
        validated.push({ file, pageNo: null, valid: false, error: `Invalid filename "${file.name}". Expected format: 001.jpg, 002.png, etc.` });
        continue;
      }

      const pageNo = parseInt(match[1], 10);
      if (pageNo === 0) {
        validated.push({ file, pageNo: 0, valid: false, error: 'Page number cannot be 000' });
        continue;
      }

      if (existingPageNos.has(pageNo)) {
        validated.push({ file, pageNo, valid: false, error: `Page ${pageNo} already uploaded for this issue` });
        continue;
      }

      if (newPageNos.has(pageNo)) {
        validated.push({ file, pageNo, valid: false, error: `Duplicate page ${pageNo} in selection` });
        continue;
      }

      newPageNos.add(pageNo);
      validated.push({ file, pageNo, valid: true });
    }

    setValidatedFiles(validated);

    // Check for gaps
    const allPageNos = [...existingPageNos, ...newPageNos].sort((a, b) => a - b);
    if (allPageNos.length > 0) {
      const maxPage = allPageNos[allPageNos.length - 1];
      const missing: number[] = [];
      for (let i = 1; i <= maxPage; i++) {
        if (!allPageNos.includes(i)) missing.push(i);
      }
      if (missing.length > 0) {
        const display = missing.length <= 10 ? missing.join(', ') : `${missing.slice(0, 10).join(', ')}... (+${missing.length - 10} more)`;
        setGapWarning(`Missing page(s): ${display}`);
      } else {
        setGapWarning(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedIssueId) return;
    const validFiles = validatedFiles.filter(f => f.valid && f.pageNo !== null);
    if (validFiles.length === 0) {
      toast({ title: 'No valid files', description: 'No files passed validation', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });
    let successCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const { file, pageNo } = validFiles[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const paddedPage = String(pageNo).padStart(3, '0');
      const storagePath = `${selectedIssueId}/pages/${paddedPage}.${ext}`;

      try {
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { upsert: false });

        if (uploadError) throw uploadError;

        // Insert page record
        const { error: insertError } = await supabase
          .from('azure_emp_news_pages')
          .insert({
            issue_id: selectedIssueId,
            page_no: pageNo,
            original_filename: file.name,
            storage_path: storagePath,
            file_size: file.size,
            mime_type: file.type,
          } as any);

        if (insertError) {
          // Rollback storage upload
          await supabase.storage.from(BUCKET).remove([storagePath]);
          throw insertError;
        }

        successCount++;
      } catch (err: any) {
        console.error(`Upload failed for ${file.name}:`, err);
        toast({ title: `Failed: ${file.name}`, description: err.message, variant: 'destructive' });
      }

      setUploadProgress({ current: i + 1, total: validFiles.length });
    }

    // Update issue totals
    if (successCount > 0) {
      const { data: countData } = await supabase
        .from('azure_emp_news_pages')
        .select('page_no', { count: 'exact' })
        .eq('issue_id', selectedIssueId);

      const totalUploaded = countData?.length || 0;
      const maxPage = countData ? Math.max(...countData.map((p: any) => p.page_no)) : 0;

      await supabase
        .from('azure_emp_news_issues')
        .update({
          uploaded_pages: totalUploaded,
          total_pages: maxPage,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedIssueId);

      toast({ title: 'Upload Complete', description: `${successCount} page(s) uploaded successfully` });
    }

    setValidatedFiles([]);
    setGapWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchPages();
    onUploadComplete();
    setUploading(false);
  };

  const handleDeletePage = async (page: AzureEmpNewsPage) => {
    await supabase.storage.from(BUCKET).remove([page.storage_path]);
    const { error } = await supabase.from('azure_emp_news_pages').delete().eq('id', page.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `Page ${page.page_no} removed` });

      // Update issue totals
      const remaining = existingPages.filter(p => p.id !== page.id);
      const totalUploaded = remaining.length;
      const maxPage = remaining.length > 0 ? Math.max(...remaining.map(p => p.page_no)) : 0;

      await supabase
        .from('azure_emp_news_issues')
        .update({
          uploaded_pages: totalUploaded,
          total_pages: maxPage,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedIssueId!);

      fetchPages();
      onUploadComplete();
    }
  };

  const selectedIssue = issues.find(i => i.id === selectedIssueId);
  const validCount = validatedFiles.filter(f => f.valid).length;
  const invalidCount = validatedFiles.filter(f => !f.valid).length;

  return (
    <div className="space-y-4">
      {/* Issue selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Pages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Select Issue</label>
            <Select value={selectedIssueId || ''} onValueChange={onIssueChange}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose an issue..." />
              </SelectTrigger>
              <SelectContent>
                {issues.map((issue) => (
                  <SelectItem key={issue.id} value={issue.id}>
                    {issue.issue_name} {issue.issue_date ? `(${issue.issue_date})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedIssueId && (
            <>
              {/* File input */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Select Page Images (named 001.jpg, 002.jpg, etc.)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_EXTENSIONS.map(e => `.${e}`).join(',')}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Files must be named as three-digit page numbers: 001.jpg, 002.png, 003.webp, etc.
                </p>
              </div>

              {/* Validation results */}
              {validatedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-3 text-sm">
                    {validCount > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" /> {validCount} valid
                      </span>
                    )}
                    {invalidCount > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" /> {invalidCount} rejected
                      </span>
                    )}
                  </div>

                  {invalidCount > 0 && (
                    <div className="bg-destructive/10 rounded-md p-3 space-y-1">
                      {validatedFiles.filter(f => !f.valid).map((f, i) => (
                        <p key={i} className="text-sm text-destructive">{f.error}</p>
                      ))}
                    </div>
                  )}

                  {gapWarning && (
                    <div className="bg-amber-50 dark:bg-amber-950 rounded-md p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">{gapWarning}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload progress */}
              {uploading && (
                <div className="space-y-2">
                  <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
                  <p className="text-sm text-muted-foreground">
                    Uploading {uploadProgress.current}/{uploadProgress.total}...
                  </p>
                </div>
              )}

              {/* Upload button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || validCount === 0}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload {validCount} Page(s)
                </Button>

                {selectedIssue && selectedIssue.uploaded_pages > 0 && (
                  <Button variant="outline" disabled>
                    <Zap className="h-4 w-4 mr-2" />
                    Start Azure Extraction (Coming Soon)
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Existing pages list */}
      {selectedIssueId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Uploaded Pages {selectedIssue ? `— ${selectedIssue.issue_name}` : ''}
              {existingPages.length > 0 && ` (${existingPages.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : existingPages.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No pages uploaded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>OCR Status</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingPages.map((page) => {
                    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(page.storage_path);
                    return (
                      <TableRow key={page.id}>
                        <TableCell className="font-mono font-medium">{String(page.page_no).padStart(3, '0')}</TableCell>
                        <TableCell className="text-sm">{page.original_filename}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {page.file_size ? `${(page.file_size / 1024).toFixed(1)} KB` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            page.ocr_status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            page.ocr_status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            page.ocr_status === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-muted text-muted-foreground'
                          }>
                            {page.ocr_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <a href={urlData.publicUrl} target="_blank" rel="noopener noreferrer">
                            <Image className="h-4 w-4 text-primary hover:text-primary/80" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePage(page)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
