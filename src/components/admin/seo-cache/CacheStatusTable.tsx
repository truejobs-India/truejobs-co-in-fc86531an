import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CachePage, CacheStatus, isDbSourced } from './cacheTypes';
import { MoreHorizontal, Eye, ShieldCheck, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';

const STATUS_COLORS: Record<CacheStatus, string> = {
  cached: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  missing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  stale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  rebuilding: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  failed: 'bg-destructive/10 text-destructive',
};

interface Props {
  pages: CachePage[];
  totalRows: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (p: number) => void;
  onPreview: (page: CachePage) => void;
  onValidate: (page: CachePage) => void;
  onRebuild: (slugs: string[]) => void;
  isRebuilding: boolean;
  selectedSlugs: Set<string>;
  onSelectionChange: (slugs: Set<string>) => void;
}

export function CacheStatusTable({
  pages, totalRows, currentPage, pageSize, isLoading,
  onPageChange, onPreview, onValidate, onRebuild, isRebuilding,
  selectedSlugs, onSelectionChange,
}: Props) {
  const totalPages = Math.ceil(totalRows / pageSize);
  const allSelected = pages.length > 0 && pages.every(p => selectedSlugs.has(p.slug));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(pages.map(p => p.slug)));
    }
  };

  const toggleOne = (slug: string) => {
    const next = new Set(selectedSlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      {selectedSlugs.size > 0 && (
        <div className="flex items-center gap-3 p-2 rounded-md bg-muted text-sm">
          <span className="font-medium">{selectedSlugs.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => onRebuild([...selectedSlugs])} disabled={isRebuilding} className="gap-1 h-7">
            {isRebuilding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Rebuild Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSelectionChange(new Set())} className="h-7">Clear</Button>
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Title / Slug</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Built</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : pages.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No pages found</TableCell></TableRow>
            ) : pages.map(p => (
              <TableRow key={p.slug}>
                <TableCell><Checkbox checked={selectedSlugs.has(p.slug)} onCheckedChange={() => toggleOne(p.slug)} /></TableCell>
                <TableCell>
                  <div className="max-w-xs">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">/{p.slug}</p>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{p.pageType}</Badge></TableCell>
                <TableCell>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    isDbSourced(p.pageType)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isDbSourced(p.pageType) ? 'DB rebuild' : 'Inventory'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    isDbSourced(p.pageType)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isDbSourced(p.pageType) ? 'DB rebuild' : 'Inventory'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.cacheUpdatedAt ? new Date(p.cacheUpdatedAt).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {p.contentHash ? p.contentHash.substring(0, 8) : '—'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {p.status !== 'missing' && (
                        <DropdownMenuItem onClick={() => onPreview(p)}>
                          <Eye className="h-4 w-4 mr-2" /> Preview
                        </DropdownMenuItem>
                      )}
                      {p.status !== 'missing' && (
                        <DropdownMenuItem onClick={() => onValidate(p)}>
                          <ShieldCheck className="h-4 w-4 mr-2" /> Validate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onRebuild([p.slug])}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Rebuild
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`https://truejobs.co.in/${p.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" /> Open Live
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {currentPage + 1} of {totalPages} ({totalRows} total)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages - 1} onClick={() => onPageChange(currentPage + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
