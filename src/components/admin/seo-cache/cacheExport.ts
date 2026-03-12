import { CachePage } from './cacheTypes';

export function exportAsCSV(pages: CachePage[], filename = 'seo-cache-report.csv') {
  const headers = ['Slug', 'Page Type', 'Status', 'Title', 'Cache Updated At', 'Content Hash'];
  const rows = pages.map(p => [
    p.slug,
    p.pageType,
    p.status,
    `"${(p.title || '').replace(/"/g, '""')}"`,
    p.cacheUpdatedAt || '',
    p.contentHash || '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csv, filename, 'text/csv');
}

export function exportAsJSON(pages: CachePage[], filename = 'seo-cache-report.json') {
  const data = pages.map(p => ({
    slug: p.slug,
    pageType: p.pageType,
    status: p.status,
    title: p.title,
    cacheUpdatedAt: p.cacheUpdatedAt,
    contentHash: p.contentHash,
  }));
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
